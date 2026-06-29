import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

type TokenResponse = {
    token: string;
    expires_at: number;
    tier: 'free' | 'paid';
    freemium_seconds: number;
    origin_url: string;
    chat_ws_url: string;
    playback_url: string;
};

export type ChatMsg = { id: number; user: string; body: string; color: string; me?: boolean };
type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

const COLORS = ['#8b5cf6', '#22d3a8', '#ff5c8a', '#f59e0b', '#3b82f6', '#22c55e'];
const colorFor = (id: string) => COLORS[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

/**
 * Liga o front aos serviços reais (token JWT do Laravel + chat WS + LL-HLS).
 * Tudo com degradação graciosa: se o endpoint/serviço não responder, expõe
 * estado para o componente cair no modo simulado.
 */
export function useLiveSession(tokenUrl: string | null, active: boolean) {
    const [session, setSession] = useState<TokenResponse | null>(null);
    const [tokenError, setTokenError] = useState(false);
    const [wsStatus, setWsStatus] = useState<WsStatus>('idle');
    const [liveMessages, setLiveMessages] = useState<ChatMsg[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    // 1) busca o token quando a sessão fica ativa (ex.: entrou na view "live")
    useEffect(() => {
        if (!active || !tokenUrl) return;
        let cancelled = false;
        setTokenError(false);
        fetch(tokenUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((data: TokenResponse) => {
                if (!cancelled) setSession(data);
            })
            .catch(() => {
                if (!cancelled) setTokenError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [active, tokenUrl]);

    // 2) abre o WebSocket do chat quando há token
    useEffect(() => {
        if (!active || !session) return;
        const live = session.playback_url.match(/\/live\/(\d+)\//)?.[1];
        const url = `${session.chat_ws_url}?token=${encodeURIComponent(session.token)}&live=${live ?? ''}`;
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            setWsStatus('error');
            return;
        }
        wsRef.current = ws;
        setWsStatus('connecting');

        ws.onopen = () => setWsStatus('open');
        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => setWsStatus('closed');
        ws.onmessage = (ev) => {
            try {
                const m = JSON.parse(ev.data);
                if (m.t !== 'msg') return; // join/leave/paywall tratados à parte
                setLiveMessages((prev) =>
                    [...prev, { id: Date.now() + Math.random(), user: m.u?.name ?? 'anon', body: m.body, color: colorFor(m.u?.id ?? m.u?.name ?? '') }].slice(-60),
                );
            } catch {
                /* ignora frames inválidos */
            }
        };

        return () => {
            ws.onmessage = null;
            ws.close();
            wsRef.current = null;
        };
    }, [active, session]);

    const sendLive = useCallback((body: string) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ t: 'msg', body }));
            return true;
        }
        return false;
    }, []);

    // 3) anexa o hls.js a um <video> apontando para o playback_url (com token)
    const attachPlayer = useCallback(
        (video: HTMLVideoElement): (() => void) | void => {
            if (!session) return;
            const src = `${session.playback_url}?token=${encodeURIComponent(session.token)}`;
            if (Hls.isSupported()) {
                const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
                return () => hls.destroy();
            }
            // Safari: HLS nativo
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
                video.play().catch(() => {});
            }
        },
        [session],
    );

    const chatLive = wsStatus === 'open';

    return { session, tokenError, wsStatus, chatLive, liveMessages, sendLive, attachPlayer };
}
