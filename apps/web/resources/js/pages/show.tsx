import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@/lib/css';
import { useLiveSession } from '@/hooks/use-live-session';

type PageProps = {
    live: { id: number; slug: string; title: string; status: string } | null;
    endpoints: { token: string | null };
};

// ============================================================================
// Porta fiel do design brunoaiubshow.dc.html (Claude Design) para React/Inertia.
// Mantém a máquina de estados original (chat simulado, contagem de prévia grátis,
// paywall) e os pontos onde o backend real (token JWT, WS de chat) se conectam.
// ============================================================================

type View = 'home' | 'live' | 'checkout' | 'dashboard' | 'admin' | 'episodes' | 'clip';
type Msg = { id: number; user: string; body: string; color: string; me?: boolean };
type ModMsg = { id: number; user: string; body: string; flags: number; deleted: boolean };

const POOL = [
    { u: 'rafa_tk', b: 'que jogada absurda dessa', c: '#8b5cf6' },
    { u: 'duda.live', b: 'primeira vez no canal, ja amei', c: '#22d3a8' },
    { u: 'kZin', b: 'GG demais kkk', c: '#ff5c8a' },
    { u: 'marcao_98', b: 'bruno joga muito mano', c: '#f59e0b' },
    { u: 'leleco', b: 'sobe o volume do mic ai', c: '#3b82f6' },
    { u: 'biaaa', b: 'esse patch ta quebrado', c: '#22c55e' },
    { u: 'th1ago', b: 'clipa isso ai mod', c: '#8b5cf6' },
    { u: 'nanda_', b: 'assinei o premium agora vamo', c: '#ff5c8a' },
    { u: 'pdr0', b: 'q build e essa?', c: '#22d3a8' },
    { u: 'vitin', b: 'Pog', c: '#f59e0b' },
    { u: 'samile', b: 'do BR pra cima', c: '#3b82f6' },
    { u: 'igorzdg', b: 'ping ta sofrendo hoje hein', c: '#8b5cf6' },
    { u: 'carol_m', b: 'live boa demais hoje', c: '#22c55e' },
    { u: 'foxx', b: 'roda a roleta de skin', c: '#ff5c8a' },
    { u: 'joaozin', b: '+1 sub aqui', c: '#22d3a8' },
    { u: 'remo', b: 'esse challenger e mito', c: '#f59e0b' },
];

const SUB_FEATURES = ['Full HD 1080p, sem anúncios', 'Replays e VOD das lives', 'Badge + emotes no chat', 'Chat sem espera no modo lento', 'Cancele quando quiser'];

const COINS = [
    { key: 'btc', label: 'BTC' },
    { key: 'eth', label: 'ETH' },
    { key: 'usdt', label: 'USDT' },
];
const CRYPTO: Record<string, { symbol: string; net: string; addr: string; amount: string }> = {
    btc: { symbol: 'BTC', net: 'Bitcoin · on-chain', addr: 'bc1q7x4f3k9d2s8m5p0a6v2n4t7r9w1z3c5b8h2j4', amount: '0.00041 BTC' },
    eth: { symbol: 'ETH', net: 'Ethereum · ERC-20', addr: '0x9aF34bC7e21D0f5A8b3C6d9E2f1A4b7C8d0E5f2A', amount: '0.0094 ETH' },
    usdt: { symbol: 'USDT', net: 'Tron · TRC-20', addr: 'TJ8skLm4QaP2r7Vd9Nc3Bf6Xy1Zq5Wt0Hg', amount: '34.90 USDT' },
};

const EPISODES = [
    { title: 'RANKED — subida pro Challenger (dia 1)', date: '24 jun', dur: '4h 12min', views: '48k', cat: 'League of Legends' },
    { title: 'reagindo ao novo patch 14.12 com a galera', date: '22 jun', dur: '3h 05min', views: '31k', cat: 'Just Chatting' },
    { title: 'torneio comunitário — finais', date: '19 jun', dur: '5h 47min', views: '92k', cat: 'Esports' },
    { title: 'tier list de campeões pós-nerf', date: '17 jun', dur: '2h 38min', views: '27k', cat: 'League of Legends' },
    { title: 'aram only até perder 10x', date: '15 jun', dur: '3h 51min', views: '19k', cat: 'League of Legends' },
    { title: 'Q&A + sorteio de skin pros subs', date: '12 jun', dur: '1h 44min', views: '24k', cat: 'Just Chatting' },
];

const NEW_SUBS = [
    { u: 'nanda_', when: 'há 1 min', plan: 'Premium' },
    { u: 'joaozin', when: 'há 4 min', plan: 'Premium' },
    { u: 'foxx', when: 'há 9 min', plan: 'Premium' },
    { u: 'carol_m', when: 'há 16 min', plan: 'Premium' },
];

const CHART_BARS = [42, 55, 48, 63, 70, 58, 66, 74, 81, 72, 68, 77, 85, 79, 88, 92, 84, 90, 76, 83, 95, 89, 80, 87];

const PIX_CODE = '00020126580014BR.GOV.BCB.PIX0136brunoaiubshow@pix.com.br5204000053039865406034.905802BR5913BRUNO AIUB6009SAO PAULO62070503***6304A1B2';

// estilos derivados ------------------------------------------------------------
const navStyle = (a: boolean) =>
    `display:flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:9px;border:none;cursor:pointer;font:600 14px Archivo,sans-serif;background:${a ? '#1c1c26' : 'transparent'};color:${a ? '#fff' : '#9a9aa6'}`;
const tabStyle = (a: boolean) =>
    `flex:1;height:46px;border:none;cursor:pointer;border-radius:11px;font:700 14px Archivo,sans-serif;display:flex;align-items:center;justify-content:center;gap:7px;background:${a ? '#8b5cf6' : '#15151c'};color:${a ? '#fff' : '#9a9aa6'}`;
const modeStyle = (a: boolean) =>
    `flex:1;min-width:128px;height:46px;border-radius:11px;cursor:pointer;font:600 13.5px Archivo,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid ${a ? '#8b5cf6' : '#26262f'};background:${a ? '#1c1730' : '#15151c'};color:${a ? '#fff' : '#9a9aa6'}`;
const coinChip = (a: boolean) =>
    `flex:1;height:42px;border:1px solid ${a ? '#8b5cf6' : '#26262f'};background:${a ? '#1c1730' : 'transparent'};color:${a ? '#fff' : '#9a9aa6'};border-radius:11px;cursor:pointer;font:600 13px 'JetBrains Mono',monospace`;

const clipAt = (p: number) => {
    const secs = Math.round((p / 100) * 6120);
    const h = Math.floor(secs / 3600),
        m = Math.floor((secs % 3600) / 60),
        sc = secs % 60;
    return `${h}:${m < 10 ? '0' + m : m}:${sc < 10 ? '0' + sc : sc}`;
};
const clipDur = (a: number, b: number) => {
    const secs = Math.round((Math.abs(b - a) / 100) * 6120);
    const m = Math.floor(secs / 60),
        sc = secs % 60;
    return `${m}:${sc < 10 ? '0' + sc : sc}`;
};

export default function Show() {
    const { endpoints } = usePage<PageProps>().props;
    const chatRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [view, setView] = useState<View>('home');
    const [tier, setTier] = useState<'free' | 'paid'>('free');
    const [paywallOpen, setPaywallOpen] = useState(false);
    const [freeRemaining, setFreeRemaining] = useState(42);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [elapsed, setElapsed] = useState(6120);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [draft, setDraft] = useState('');
    const [payTab, setPayTab] = useState<'pix' | 'card' | 'crypto'>('pix');
    const [cryptoCoin, setCryptoCoin] = useState('btc');
    const [modes, setModes] = useState({ slow: false, subs: false, followers: false, emotes: false });
    const [modLog, setModLog] = useState<{ a: string; t: string; w: string }[]>([]);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [clipStart, setClipStart] = useState(24);
    const [clipEnd, setClipEnd] = useState(52);
    const [clipTitle, setClipTitle] = useState('');
    const [clips, setClips] = useState([
        { id: 1, title: 'Pentakill insano roubando o Baron', dur: '0:42', views: '12k', when: 'há 2h' },
        { id: 2, title: 'reação ao nerf do Yone kkkk', dur: '1:15', views: '8.4k', when: 'há 5h' },
        { id: 3, title: 'clutch 1v3 no torneio', dur: '0:58', views: '21k', when: 'ontem' },
    ]);
    const [keyRevealed, setKeyRevealed] = useState(false);
    const [streamKey, setStreamKey] = useState('live_sk_8f3a9c2e7b14d05f');
    const [copied, setCopied] = useState<Record<string, boolean>>({});
    const [toast, setToast] = useState('');
    const [modMessages, setModMessages] = useState<ModMsg[]>([
        { id: 1, user: 'rafa_tk', body: 'que jogada absurda dessa', flags: 0, deleted: false },
        { id: 2, user: 'skins_gratis_88', body: 'GANHE SKINS GRATIS link na bio >>> resgate agora', flags: 7, deleted: false },
        { id: 3, user: 'leleco', body: 'sobe o volume ai por favor', flags: 0, deleted: false },
        { id: 4, user: 'toxic_one', body: 'voce joga muito mal sai do jogo lixo', flags: 4, deleted: false },
        { id: 5, user: 'biaaa', body: 'esse patch ta quebrado kkk', flags: 0, deleted: false },
        { id: 6, user: 'promo_followers', body: 'COMPRE SEGUIDORES baratinho chama no zap', flags: 9, deleted: false },
        { id: 7, user: 'th1ago', body: 'clipa isso ai mod foi insano', flags: 0, deleted: false },
        { id: 8, user: 'flood_x', body: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', flags: 3, deleted: false },
    ]);
    const [banned, setBanned] = useState([
        { user: 'cheater_99', reason: 'spam de link', when: 'há 2 min' },
        { user: 'rage_kid', reason: 'toxicidade reincidente', when: 'há 14 min' },
    ]);

    const isPaid = tier === 'paid';

    // ---- sessão real (token JWT + chat WS + hls.js), com fallback simulado ----
    const { session, tokenError, chatLive, liveMessages, sendLive, attachPlayer } = useLiveSession(endpoints.token, view === 'live');

    // chat simulado: só roda enquanto o WS real NÃO estiver conectado ----------
    useEffect(() => {
        if (chatLive) return; // chat real assumiu
        const pushMsg = () => {
            const p = POOL[Math.floor(Math.random() * POOL.length)];
            setMessages((m) => [...m, { id: Date.now() + Math.random(), user: p.u, body: p.b, color: p.c }].slice(-60));
        };
        for (let i = 0; i < 7; i++) pushMsg();
        const chatTimer = setInterval(pushMsg, 1700);
        return () => clearInterval(chatTimer);
    }, [chatLive]);

    // anexa o player real quando a live está tocando e há token ----------------
    useEffect(() => {
        if (view !== 'live' || !playing || !session || !videoRef.current) return;
        const detach = attachPlayer(videoRef.current);
        return () => detach?.();
    }, [view, playing, session, attachPlayer]);

    // mensagens exibidas: reais (WS) quando conectado, senão as simuladas -------
    const shownMessages = chatLive ? liveMessages : messages;

    // contagem regressiva da prévia grátis -> paywall --------------------------
    useEffect(() => {
        const t = setInterval(() => {
            setFreeRemaining((r) => {
                if (view !== 'live' || tier !== 'free' || paywallOpen || !playing) return r;
                if (r - 1 <= 0) {
                    setPaywallOpen(true);
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [view, tier, paywallOpen, playing]);

    useEffect(() => {
        const t = setInterval(() => {
            if (playing && view === 'live') setElapsed((e) => e + 1);
        }, 1000);
        return () => clearInterval(t);
    }, [playing, view]);

    useEffect(() => {
        const el = chatRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [shownMessages]);

    // ações --------------------------------------------------------------------
    const go = (v: View) => () => {
        setView(v);
        setPaywallOpen(false);
    };
    const flashToast = (msg: string, ms = 2400) => {
        setToast(msg);
        setTimeout(() => setToast(''), ms);
    };
    const copy = (text: string, flag: string) => {
        try {
            navigator.clipboard?.writeText(text);
        } catch {
            /* noop */
        }
        setCopied((c) => ({ ...c, [flag]: true }));
        setTimeout(() => setCopied((c) => ({ ...c, [flag]: false })), 1500);
    };
    const send = () => {
        const d = draft.trim();
        if (!d) return;
        // tenta enviar pelo WS real; se não estiver conectado, ecoa localmente
        const sent = sendLive(d);
        if (!sent) {
            setMessages((m) => [...m, { id: Date.now() + Math.random(), user: 'voce', body: d, color: '#c4b5fd', me: true }].slice(-60));
        }
        setDraft('');
    };
    const logFn = (a: string, t: string) => setModLog((l) => [{ a, t, w: 'agora' }, ...l].slice(0, 8));
    const del = (id: number) => {
        const m = modMessages.find((x) => x.id === id);
        setModMessages((ms) => ms.map((x) => (x.id === id ? { ...x, deleted: true } : x)));
        logFn('Mensagem apagada', m?.user ?? '');
    };
    const ban = (user: string) => {
        setModMessages((ms) => ms.map((x) => (x.user === user ? { ...x, deleted: true } : x)));
        setBanned((b) => [{ user, reason: 'banido pelo moderador', when: 'agora' }, ...b]);
        logFn('Usuário banido', user);
    };
    const timeout = (user: string) => {
        setModMessages((ms) => ms.map((x) => (x.user === user ? { ...x, deleted: true } : x)));
        logFn('Timeout 10min', user);
    };
    const toggleMode = (k: keyof typeof modes) => {
        const v = !modes[k];
        const n = { slow: 'Modo lento', subs: 'Só inscritos', followers: 'Só seguidores', emotes: 'Só emotes' };
        setModes((m) => ({ ...m, [k]: v }));
        logFn(n[k] + (v ? ' ativado' : ' desativado'), 'chat');
    };
    const createClip = () => {
        const d = clipDur(clipStart, clipEnd);
        setClips((cs) => [{ id: Date.now(), title: clipTitle.trim() || 'Corte sem título', dur: d, views: '0', when: 'agora' }, ...cs]);
        setClipTitle('');
        flashToast('Corte criado ✓');
    };
    const completePayment = () => {
        setTier('paid');
        setPaywallOpen(false);
        setView('live');
        flashToast('Assinatura ativa — acesso liberado ✓', 2800);
    };

    const sec = freeRemaining % 60;
    const mm = Math.floor(freeRemaining / 60);
    const freeLabel = `${mm}:${sec < 10 ? '0' + sec : sec}`;
    const freePct = Math.max(0, (freeRemaining / 42) * 100) + '%';
    const elapsedLabel = useMemo(() => clipAt((elapsed / 6120) * 100), [elapsed]);
    const coin = CRYPTO[cryptoCoin];

    const Btn = ({ s, onClick, children }: { s: string; onClick?: (e: React.MouseEvent) => void; children: React.ReactNode }) => (
        <button onClick={onClick} style={css(s)}>
            {children}
        </button>
    );

    return (
        <div style={css('min-height:100vh;background:#0b0b0f;color:#f2f2f5;font-family:Archivo,system-ui,sans-serif')}>
            <Head title="brunoaiubshow">
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
                <style>{`
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
          @keyframes fadein{from{opacity:0}to{opacity:1}}
          @keyframes drift{from{background-position:0 0}to{background-position:96px 0}}
          ::-webkit-scrollbar{width:9px;height:9px}
          ::-webkit-scrollbar-thumb{background:#2a2a34;border-radius:8px}
          ::-webkit-scrollbar-track{background:transparent}
        `}</style>
            </Head>

            {/* NAVBAR */}
            <div style={css('position:sticky;top:0;z-index:40;height:64px;display:flex;align-items:center;gap:16px;padding:0 22px;background:rgba(11,11,15,.85);backdrop-filter:blur(14px);border-bottom:1px solid #1b1b23')}>
                <div onClick={go('home')} style={css('display:flex;align-items:center;gap:9px;cursor:pointer;margin-right:6px')}>
                    <div style={css('width:11px;height:11px;border-radius:3px;background:#8b5cf6;box-shadow:0 0 14px #8b5cf6')} />
                    <span style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;letter-spacing:-.5px")}>brunoaiubshow</span>
                </div>
                <Btn s={navStyle(view === 'home')} onClick={go('home')}>Início</Btn>
                <Btn s={navStyle(view === 'live')} onClick={go('live')}>● Ao vivo</Btn>
                <Btn s={navStyle(view === 'episodes')} onClick={go('episodes')}>Episódios</Btn>
                <Btn s={navStyle(view === 'dashboard')} onClick={go('dashboard')}>Streamer</Btn>
                <Btn s={navStyle(view === 'admin')} onClick={go('admin')}>Moderação</Btn>
                <div style={css('flex:1')} />
                <div style={css('display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:10px;background:#141419;border:1px solid #23232c;color:#7a7a86;font-size:13px;min-width:200px')}>
                    <span style={css('opacity:.6')}>⌕</span>
                    <span>Buscar lives, canais...</span>
                </div>
                {isPaid && (
                    <span style={css('display:flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;background:#16261c;border:1px solid #1f5135;color:#34d399;font-size:12px;font-weight:700;letter-spacing:.5px')}>★ PREMIUM</span>
                )}
                <Btn s="height:38px;padding:0 18px;border-radius:10px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:700;font-size:14px;font-family:Archivo,sans-serif" onClick={go('checkout')}>Assinar</Btn>
                <Btn s="height:38px;padding:0 15px;border-radius:10px;border:1px solid #2a2a34;cursor:pointer;background:#15151c;color:#fff;font-weight:700;font-size:14px;font-family:Archivo,sans-serif" onClick={() => { setAuthOpen(true); setAuthMode('login'); }}>Entrar</Btn>
                <div onClick={() => { setAuthOpen(true); setAuthMode('login'); }} style={css('width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;cursor:pointer')}>B</div>
            </div>

            <main>
                {/* ===================== HOME ===================== */}
                {view === 'home' && (
                    <div style={css('max-width:1180px;margin:0 auto;padding:32px 32px 80px')}>
                        <div style={css('display:flex;align-items:center;gap:11px;margin-bottom:18px')}>
                            <span style={css('display:flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:8px;background:#2a0f17;border:1px solid #5c1f2c;color:#ff6b85;font-size:12px;font-weight:800;letter-spacing:.5px')}>
                                <span style={css('width:8px;height:8px;border-radius:50%;background:#ff3b5c;animation:pulse 1.4s infinite')} />AO VIVO AGORA
                            </span>
                            <span style={css('color:#8a8a96;font-size:14px')}><strong style={css('color:#fff')}>brunoaiubshow</strong> está transmitindo neste momento</span>
                        </div>

                        <div onClick={go('live')} style={css('border-radius:20px;overflow:hidden;border:1px solid #262630;background:#121218;cursor:pointer;margin-bottom:20px')}>
                            <div style={css('position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#2a1d4d,#120d22);overflow:hidden')}>
                                <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(139,92,246,.15) 0 16px,transparent 16px 34px)')} />
                                <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center')}>
                                    <div style={css('width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center')}>
                                        <div style={css('width:0;height:0;border-top:16px solid transparent;border-bottom:16px solid transparent;border-left:25px solid #fff;margin-left:6px')} />
                                    </div>
                                </div>
                                <div style={css('position:absolute;top:18px;left:18px;display:flex;align-items:center;gap:9px')}>
                                    <span style={css('display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:8px;background:#ff3b5c;color:#fff;font-size:13px;font-weight:800;letter-spacing:.5px')}>
                                        <span style={css('width:8px;height:8px;border-radius:50%;background:#fff;animation:pulse 1.4s infinite')} />AO VIVO
                                    </span>
                                    <span style={css('height:30px;padding:0 12px;border-radius:8px;background:rgba(0,0,0,.55);display:flex;align-items:center;color:#fff;font-size:13px;font-weight:600')}>👁 14.207 assistindo</span>
                                </div>
                                <div style={css('position:absolute;bottom:0;left:0;right:0;padding:60px 24px 22px;background:linear-gradient(0deg,rgba(8,8,12,.94),rgba(8,8,12,.4) 60%,transparent)')}>
                                    <div style={css('display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap')}>
                                        <div style={css('min-width:0;flex:1')}>
                                            <div style={css('display:flex;align-items:center;gap:11px;margin-bottom:11px')}>
                                                <div style={css('width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0')}>B</div>
                                                <div>
                                                    <div style={css('font-weight:700;font-size:15px')}>brunoaiubshow</div>
                                                    <div style={css('color:#c084fc;font-size:13px;font-weight:600')}>League of Legends</div>
                                                </div>
                                            </div>
                                            <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:27px;line-height:1.15;letter-spacing:-.6px")}>RANKED ATÉ CHALLENGER — reação ao patch 14.12</div>
                                        </div>
                                        <Btn s="flex-shrink:0;height:50px;padding:0 28px;border-radius:13px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:16px;font-family:Archivo,sans-serif" onClick={go('live')}>▶ Assistir agora</Btn>
                                    </div>
                                </div>
                            </div>
                            <div style={css('display:flex;border-top:1px solid #1f1f27')}>
                                {[
                                    { v: '14.207', l: 'assistindo agora' },
                                    { v: '1h 42min', l: 'no ar' },
                                    { v: '1080p60', l: 'Full HD · LL-HLS' },
                                    { v: '312/min', l: 'no chat', c: '#34d399' },
                                ].map((s, i, arr) => (
                                    <div key={i} style={css(`flex:1;padding:16px 18px;text-align:center${i < arr.length - 1 ? ';border-right:1px solid #1f1f27' : ''}`)}>
                                        <div style={css(`font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px${s.c ? ';color:' + s.c : ''}`)}>{s.v}</div>
                                        <div style={css('color:#7a7a86;font-size:12px;margin-top:2px')}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={css('display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:stretch')}>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:22px')}>
                                <div style={css('font-weight:800;font-size:12px;letter-spacing:.6px;color:#7a7a86;margin-bottom:11px')}>SOBRE A TRANSMISSÃO</div>
                                <p style={css('margin:0;color:#c5c5cf;font-size:14.5px;line-height:1.6')}>Reação ao patch 14.12 e ranked rumo ao Challenger. Chat liberado, sorteios de skins ao vivo e replay disponível para assinantes logo após a live.</p>
                                <div style={css('display:flex;gap:8px;flex-wrap:wrap;margin-top:15px')}>
                                    {['Português', 'Ranked', 'Competitivo', 'Sorteios'].map((t) => (
                                        <span key={t} style={css('height:26px;padding:0 11px;border-radius:7px;background:#1c1c24;color:#aaa;font-size:12.5px;display:flex;align-items:center')}>{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={css('border-radius:16px;background:linear-gradient(180deg,#1e1830,#15131f);border:1px solid #2a2438;padding:22px;display:flex;flex-direction:column;justify-content:center')}>
                                <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;margin-bottom:6px")}>Assista sem limites</div>
                                <div style={css('color:#9a9aa6;font-size:13.5px;line-height:1.5;margin-bottom:16px')}>Prévia grátis de alguns minutos. Assine para Full HD, sem anúncios e replays.</div>
                                <Btn s="height:46px;border-radius:11px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:15px;font-family:Archivo,sans-serif" onClick={go('checkout')}>★ Assinar por R$ 29,90/mês</Btn>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== LIVE ===================== */}
                {view === 'live' && (
                    <div style={css('display:grid;grid-template-columns:1fr 350px;height:calc(100vh - 64px)')}>
                        <div style={css('overflow-y:auto;border-right:1px solid #1b1b23')}>
                            <div onClick={() => setPlaying((p) => !p)} style={css('position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#241a44,#0f0b1d);overflow:hidden;cursor:pointer')}>
                                {/* player real (LL-HLS). Fica visível quando há token+stream; senão o placeholder abaixo cobre */}
                                <video ref={videoRef} playsInline muted={muted} style={css(`position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;${session && playing ? '' : 'display:none'}`)} />
                                {playing ? (
                                    <div style={css('position:absolute;inset:-30px;background:repeating-linear-gradient(125deg,rgba(139,92,246,.17) 0 16px,transparent 16px 34px);animation:drift 2.2s linear infinite')} />
                                ) : (
                                    <>
                                        <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(139,92,246,.13) 0 16px,transparent 16px 34px)')} />
                                        <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px')}>
                                            <div style={css('width:80px;height:80px;border-radius:50%;background:rgba(139,92,246,.92);box-shadow:0 8px 34px rgba(139,92,246,.5);display:flex;align-items:center;justify-content:center')}>
                                                <div style={css('width:0;height:0;border-top:15px solid transparent;border-bottom:15px solid transparent;border-left:24px solid #fff;margin-left:6px')} />
                                            </div>
                                            <div style={css("font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(255,255,255,.55);letter-spacing:1px")}>clique para assistir · LL-HLS 1080p60</div>
                                        </div>
                                    </>
                                )}
                                <div style={css('position:absolute;top:16px;left:16px;display:flex;align-items:center;gap:8px')}>
                                    <span style={css('display:flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:7px;background:#ff3b5c;color:#fff;font-size:12px;font-weight:800;letter-spacing:.5px')}>
                                        <span style={css('width:7px;height:7px;border-radius:50%;background:#fff;animation:pulse 1.4s infinite')} />AO VIVO
                                    </span>
                                    <span style={css('height:28px;padding:0 11px;border-radius:7px;background:rgba(0,0,0,.55);display:flex;align-items:center;color:#fff;font-size:12px;font-weight:600')}>👁 14.207</span>
                                </div>
                                {isPaid && (
                                    <div style={css('position:absolute;top:54px;left:16px;display:flex;align-items:center;gap:9px;height:28px;padding:0 11px;border-radius:8px;background:rgba(22,38,28,.85);border:1px solid #1f5135;color:#34d399;font-size:12px;font-weight:700;backdrop-filter:blur(6px);width:fit-content')}>★ PREMIUM · sem paywall</div>
                                )}
                                {paywallOpen && <div style={css('position:absolute;inset:0;background:rgba(8,8,12,.72);backdrop-filter:blur(8px)')} />}
                                {playing && (
                                    <div style={css('position:absolute;left:0;right:0;bottom:0;padding:30px 16px 12px;background:linear-gradient(0deg,rgba(8,8,12,.85),transparent);display:flex;align-items:center;gap:14px')}>
                                        <Btn s="width:34px;height:34px;border-radius:8px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center" onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}>❚❚</Btn>
                                        <Btn s="width:34px;height:34px;border-radius:8px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center" onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}>{muted ? '🔇' : '🔊'}</Btn>
                                        <span style={css('display:flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:6px;background:#ff3b5c;color:#fff;font-size:11px;font-weight:800;letter-spacing:.5px')}>
                                            <span style={css('width:6px;height:6px;border-radius:50%;background:#fff;animation:pulse 1.4s infinite')} />AO VIVO
                                        </span>
                                        <span style={css("font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#dcdce2")}>{elapsedLabel}</span>
                                        <div style={css('flex:1')} />
                                        <Btn s="height:30px;padding:0 11px;border-radius:7px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace" onClick={(e) => e.stopPropagation()}>1080p ▾</Btn>
                                        <Btn s="width:34px;height:34px;border-radius:8px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:14px" onClick={(e) => e.stopPropagation()}>⛶</Btn>
                                    </div>
                                )}
                            </div>

                            <div style={css('padding:20px 26px;display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid #17171e')}>
                                <div style={css('width:54px;height:54px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px')}>B</div>
                                <div style={css('flex:1;min-width:0')}>
                                    <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:21px;letter-spacing:-.4px;line-height:1.25")}>RANKED ATÉ CHALLENGER — reação ao patch 14.12</div>
                                    <div style={css('display:flex;align-items:center;gap:10px;margin-top:6px')}>
                                        <span style={css('font-weight:700;font-size:15px')}>brunoaiubshow</span>
                                        <span style={css('color:#8b5cf6;font-size:14px;font-weight:600')}>League of Legends</span>
                                    </div>
                                </div>
                                <div style={css('display:flex;gap:9px;flex-shrink:0')}>
                                    <Btn s="height:42px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#16161c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif" onClick={go('clip')}>✂ Cortar</Btn>
                                    <Btn s="height:42px;padding:0 16px;border-radius:10px;border:1px solid #2a2a34;background:#16161c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif">♥ Seguir</Btn>
                                    <Btn s="height:42px;padding:0 18px;border-radius:10px;border:none;background:#8b5cf6;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif" onClick={go('checkout')}>★ Assinar</Btn>
                                </div>
                            </div>

                            {isPaid ? (
                                <div style={css('margin:18px 26px;padding:16px 18px;border-radius:12px;background:#101016;border:1px solid #1f1f27;color:#7a7a86;font-size:13px;line-height:1.6')}>
                                    Você está assistindo em <strong style={css('color:#34d399')}>acesso PREMIUM</strong>. Sem limite de tempo, sem anúncios, qualidade máxima.
                                </div>
                            ) : (
                                <div style={css('margin:18px 26px')}>
                                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:9px')}>
                                        <span style={css('font-size:13px;font-weight:700;color:#c5c5cf')}>⏱ Prévia grátis — tempo restante</span>
                                        <span style={css("font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:#8b5cf6")}>{freeLabel}</span>
                                    </div>
                                    <div style={css('height:8px;border-radius:5px;background:#1c1c24;overflow:hidden')}>
                                        <div style={css(`height:100%;width:${freePct};background:linear-gradient(90deg,#8b5cf6,#c084fc);border-radius:5px;transition:width .9s linear`)} />
                                    </div>
                                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:12px')}>
                                        <span style={css('color:#6a6a76;font-size:12.5px')}>Plano free libera os primeiros minutos. Depois, o paywall entra.</span>
                                        <Btn s="height:32px;padding:0 13px;border-radius:8px;border:1px solid #2a2a34;background:transparent;color:#9a9aa6;font-size:12px;font-weight:600;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => { setPaywallOpen(true); setFreeRemaining(0); }}>⏩ Simular fim do tempo</Btn>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CHAT */}
                        <div style={css('display:flex;flex-direction:column;height:calc(100vh - 64px);background:#0d0d12')}>
                            <div style={css('height:50px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #1b1b23')}>
                                <span style={css('font-weight:800;font-size:13px;letter-spacing:.6px;color:#c5c5cf')}>CHAT DA LIVE</span>
                                {chatLive ? (
                                    <span style={css('display:flex;align-items:center;gap:6px;font-size:12px;color:#22c55e;font-weight:600')}>
                                        <span style={css('width:7px;height:7px;border-radius:50%;background:#22c55e')} />conectado
                                    </span>
                                ) : (
                                    <span style={css('display:flex;align-items:center;gap:6px;font-size:12px;color:#f59e0b;font-weight:600')} title={tokenError ? 'token indisponível' : 'serviço de chat offline'}>
                                        <span style={css('width:7px;height:7px;border-radius:50%;background:#f59e0b')} />demo
                                    </span>
                                )}
                            </div>
                            <div ref={chatRef} style={css('flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:9px')}>
                                {shownMessages.map((m) => (
                                    <div key={m.id} style={css('font-size:14px;line-height:1.4;word-break:break-word')}>
                                        <span style={css(`font-weight:700;color:${m.color}`)}>{m.user}</span>
                                        <span style={css('color:#5a5a66')}>: </span>
                                        <span style={css('color:#dcdce2')}>{m.body}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={css('flex-shrink:0;padding:12px 14px;border-top:1px solid #1b1b23')}>
                                <div style={css('display:flex;gap:8px')}>
                                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Manda no chat..." style={css('flex:1;height:42px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:14px;font-family:Archivo,sans-serif;outline:none')} />
                                    <Btn s="width:46px;height:42px;border-radius:10px;border:none;background:#8b5cf6;color:#fff;font-size:18px;cursor:pointer" onClick={send}>➤</Btn>
                                </div>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:9px')}>
                                    <span style={css('color:#5a5a66;font-size:11.5px')}>rate-limit · 1 msg / 2s</span>
                                    <span style={css('color:#8b5cf6;font-size:11.5px;font-weight:600;cursor:pointer')}>★ Assinar p/ emotes</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== EPISODES ===================== */}
                {view === 'episodes' && (
                    <div style={css('max-width:1280px;margin:0 auto;padding:30px 32px 80px')}>
                        <div style={css('margin-bottom:24px')}>
                            <div style={css('color:#8b5cf6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:5px')}>EPISÓDIOS</div>
                            <h1 style={css("margin:0;font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;letter-spacing:-.5px")}>Lives salvas</h1>
                            <p style={css('margin:7px 0 0;color:#8a8a96;font-size:15px')}>Reveja transmissões anteriores quando quiser. VODs disponíveis para assinantes.</p>
                        </div>
                        <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:22px')}>
                            {EPISODES.map((e, i) => (
                                <div key={i} onClick={go('live')} style={css('cursor:pointer;border-radius:14px;overflow:hidden;background:#121218;border:1px solid #1f1f27')}>
                                    <div style={css('position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#241a44,#120d22);overflow:hidden')}>
                                        <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(139,92,246,.14) 0 13px,transparent 13px 28px)')} />
                                        <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center')}>
                                            <div style={css('width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center')}>
                                                <div style={css('width:0;height:0;border-top:9px solid transparent;border-bottom:9px solid transparent;border-left:14px solid #fff;margin-left:3px')} />
                                            </div>
                                        </div>
                                        <div style={css('position:absolute;top:10px;left:10px;height:22px;padding:0 9px;border-radius:6px;background:rgba(0,0,0,.6);display:flex;align-items:center;color:#c084fc;font-size:11px;font-weight:800;letter-spacing:.5px')}>VOD</div>
                                        <div style={css("position:absolute;bottom:10px;right:10px;height:22px;padding:0 9px;border-radius:6px;background:rgba(0,0,0,.7);display:flex;align-items:center;color:#fff;font-size:11.5px;font-weight:600;font-family:'JetBrains Mono',monospace")}>{e.dur}</div>
                                    </div>
                                    <div style={css('padding:14px')}>
                                        <div style={css('font-weight:700;font-size:15px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden')}>{e.title}</div>
                                        <div style={css('display:flex;align-items:center;gap:8px;margin-top:8px;color:#8a8a96;font-size:12.5px')}>
                                            <span>{e.date}</span><span style={css('opacity:.5')}>·</span><span>{e.views} views</span>
                                        </div>
                                        <div style={css('color:#8b5cf6;font-size:12.5px;font-weight:600;margin-top:3px')}>{e.cat}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===================== CHECKOUT ===================== */}
                {view === 'checkout' && (
                    <div style={css('max-width:1080px;margin:0 auto;padding:34px 32px 80px')}>
                        <div style={css('margin-bottom:28px')}>
                            <div style={css('color:#8b5cf6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:6px')}>ASSINATURA</div>
                            <h1 style={css("margin:0;font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;letter-spacing:-.6px")}>Finalize sua assinatura</h1>
                            <p style={css('margin:7px 0 0;color:#8a8a96;font-size:15px')}>Cancele quando quiser. Pague com PIX, cartão ou criptomoeda.</p>
                        </div>
                        <div style={css('display:grid;grid-template-columns:1.5fr 1fr;gap:26px;align-items:start')}>
                            <div>
                                <div style={css('font-weight:800;font-size:13px;letter-spacing:.5px;color:#7a7a86;margin-bottom:13px')}>1 · SUA ASSINATURA</div>
                                <div style={css('border-radius:16px;background:linear-gradient(180deg,#1e1830,#15131f);border:1.5px solid #8b5cf6;padding:22px;margin-bottom:30px;position:relative')}>
                                    <div style={css('position:absolute;top:-9px;left:22px;height:20px;padding:0 10px;border-radius:6px;background:#8b5cf6;color:#fff;font-size:10px;font-weight:800;letter-spacing:.5px;display:flex;align-items:center')}>PLANO ÚNICO</div>
                                    <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap')}>
                                        <div>
                                            <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px")}>Assinatura brunoaiubshow</div>
                                            <div style={css('color:#9a9aa6;font-size:13px;margin-top:2px')}>acesso completo ao canal · cancele quando quiser</div>
                                        </div>
                                        <div style={css('display:flex;align-items:baseline;gap:4px')}>
                                            <span style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px")}>R$ 29,90</span>
                                            <span style={css('color:#9a9aa6;font-size:14px')}>/mês</span>
                                        </div>
                                    </div>
                                    <div style={css('height:1px;background:#2a2438;margin:18px 0')} />
                                    <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px')}>
                                        {SUB_FEATURES.map((f) => (
                                            <div key={f} style={css('display:flex;align-items:center;gap:9px;color:#d5d5dd;font-size:13.5px')}><span style={css('color:#8b5cf6;font-weight:800')}>✓</span>{f}</div>
                                        ))}
                                    </div>
                                </div>

                                <div style={css('font-weight:800;font-size:13px;letter-spacing:.5px;color:#7a7a86;margin-bottom:13px')}>2 · FORMA DE PAGAMENTO</div>
                                <div style={css('display:flex;gap:10px;margin-bottom:20px')}>
                                    <Btn s={tabStyle(payTab === 'pix')} onClick={() => setPayTab('pix')}>PIX</Btn>
                                    <Btn s={tabStyle(payTab === 'card')} onClick={() => setPayTab('card')}>💳 Cartão</Btn>
                                    <Btn s={tabStyle(payTab === 'crypto')} onClick={() => setPayTab('crypto')}>₿ Cripto</Btn>
                                </div>

                                <div style={css('border-radius:16px;background:#101016;border:1px solid #1f1f27;padding:24px')}>
                                    {payTab === 'pix' && (
                                        <div style={css('display:flex;gap:24px;align-items:flex-start')}>
                                            <QrCode size={172} />
                                            <div style={css('flex:1;min-width:0')}>
                                                <div style={css('display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;margin-bottom:5px')}>PIX <span style={css('height:20px;padding:0 8px;border-radius:5px;background:#16261c;border:1px solid #1f5135;color:#34d399;font-size:11px;font-weight:700;display:inline-flex;align-items:center')}>aprovação na hora</span></div>
                                                <div style={css('color:#8a8a96;font-size:13px;line-height:1.5;margin-bottom:13px')}>Escaneie o QR code no app do seu banco, ou copie o código abaixo.</div>
                                                <div style={css("font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#9a9aa6;background:#15151c;border:1px solid #23232c;border-radius:9px;padding:11px 13px;line-height:1.4;word-break:break-all;max-height:64px;overflow:hidden")}>{PIX_CODE}</div>
                                                <Btn s="margin-top:11px;height:40px;width:100%;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => copy(PIX_CODE, 'pix')}>{copied.pix ? <span style={css('color:#34d399')}>✓ Código copiado</span> : <span>⧉ Copiar código PIX</span>}</Btn>
                                            </div>
                                        </div>
                                    )}
                                    {payTab === 'card' && (
                                        <div style={css('animation:fadein .25s ease')}>
                                            <Field label="NÚMERO DO CARTÃO"><input placeholder="0000 0000 0000 0000" style={css("width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:'JetBrains Mono',monospace;outline:none")} /></Field>
                                            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:13px')}>
                                                <Field label="VALIDADE"><input placeholder="MM/AA" style={css("width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:'JetBrains Mono',monospace;outline:none")} /></Field>
                                                <Field label="CVV"><input placeholder="123" style={css("width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:'JetBrains Mono',monospace;outline:none")} /></Field>
                                            </div>
                                            <Field label="NOME NO CARTÃO"><input placeholder="BRUNO AIUB" style={css('width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:Archivo,sans-serif;outline:none;text-transform:uppercase')} /></Field>
                                            <div style={css('display:flex;align-items:center;gap:8px;margin-top:14px;color:#6a6a76;font-size:12px')}>🔒 Pagamento criptografado · gateway certificado PCI-DSS</div>
                                        </div>
                                    )}
                                    {payTab === 'crypto' && (
                                        <div style={css('animation:fadein .25s ease')}>
                                            <div style={css('display:flex;gap:10px;margin-bottom:20px')}>
                                                {COINS.map((c) => (
                                                    <Btn key={c.key} s={coinChip(cryptoCoin === c.key)} onClick={() => setCryptoCoin(c.key)}>{c.label}</Btn>
                                                ))}
                                            </div>
                                            <div style={css('display:flex;gap:24px;align-items:flex-start')}>
                                                <QrCode size={172} />
                                                <div style={css('flex:1;min-width:0')}>
                                                    <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px;margin-bottom:4px")}>{coin.amount}</div>
                                                    <div style={css('color:#8a8a96;font-size:13px;margin-bottom:14px')}>{coin.net}</div>
                                                    <Field label="ENDEREÇO DA WALLET"><div style={css("font-family:'JetBrains Mono',monospace;font-size:12px;color:#c5c5cf;background:#15151c;border:1px solid #23232c;border-radius:9px;padding:11px 13px;word-break:break-all;line-height:1.5")}>{coin.addr}</div></Field>
                                                    <Btn s="margin-top:11px;height:40px;width:100%;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => copy(coin.addr, 'wallet')}>{copied.wallet ? <span style={css('color:#34d399')}>✓ Endereço copiado</span> : <span>⧉ Copiar endereço</span>}</Btn>
                                                </div>
                                            </div>
                                            <div style={css('display:flex;align-items:center;gap:8px;margin-top:16px;padding:11px 13px;border-radius:10px;background:#1a1510;border:1px solid #3a2a14;color:#f59e0b;font-size:12px;line-height:1.4')}>⚠ Envie apenas <strong style={css('margin:0 3px')}>{coin.symbol}</strong> nesta rede. Confirmação em ~2-10 min.</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={css('position:sticky;top:84px;border-radius:16px;background:#121218;border:1px solid #23232c;padding:24px')}>
                                <div style={css('font-weight:800;font-size:13px;letter-spacing:.5px;color:#7a7a86;margin-bottom:16px')}>RESUMO</div>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px')}>
                                    <span style={css('color:#c5c5cf;font-size:14px')}>Assinatura brunoaiubshow</span>
                                    <span style={css('font-weight:700;font-size:14px')}>R$ 29,90</span>
                                </div>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px')}>
                                    <span style={css('color:#c5c5cf;font-size:14px')}>Recorrência</span>
                                    <span style={css('color:#9a9aa6;font-size:14px')}>mensal</span>
                                </div>
                                <div style={css('height:1px;background:#23232c;margin:16px 0')} />
                                <div style={css('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:20px')}>
                                    <span style={css('font-weight:700;font-size:16px')}>Total hoje</span>
                                    <span style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:24px")}>R$ 29,90</span>
                                </div>
                                <Btn s="width:100%;height:52px;border-radius:13px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:16px;font-family:Archivo,sans-serif" onClick={completePayment}>Confirmar pagamento</Btn>
                                <div style={css('display:flex;align-items:center;justify-content:center;gap:7px;margin-top:13px;color:#6a6a76;font-size:12px')}>🔒 Ambiente seguro · cancele quando quiser</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== DASHBOARD ===================== */}
                {view === 'dashboard' && (
                    <div style={css('max-width:1240px;margin:0 auto;padding:30px 32px 70px')}>
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:24px')}>
                            <div>
                                <div style={css('color:#8b5cf6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:5px')}>PAINEL DO STREAMER</div>
                                <h1 style={css("margin:0;font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;letter-spacing:-.5px")}>Sua transmissão</h1>
                            </div>
                            <span style={css('display:flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:10px;background:#2a0f17;border:1px solid #5c1f2c;color:#ff6b85;font-size:13px;font-weight:700')}>
                                <span style={css('width:8px;height:8px;border-radius:50%;background:#ff3b5c;animation:pulse 1.4s infinite')} />AO VIVO · 1h 42min
                            </span>
                        </div>

                        <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px')}>
                            <Stat label="VIEWERS AGORA" value="14.207" sub="▲ 6,2% na última hora" subColor="#22c55e" />
                            <Stat label="PICO DE HOJE" value="18.940" sub="às 21h12" />
                            <Stat label="MSGS / MIN" value="312" sub="chat aquecido 🔥" />
                            <Stat label="SAÚDE DO STREAM" value="Ótima" valueColor="#22c55e" sub="5000kbps · 0 drops" mono />
                        </div>

                        <div style={css('display:grid;grid-template-columns:1.6fr 1fr;gap:22px;align-items:start')}>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:22px')}>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:18px')}>
                                    <span style={css("font-weight:700;font-size:16px;font-family:'Space Grotesk',sans-serif")}>Viewers · última hora</span>
                                    <span style={css("color:#7a7a86;font-size:13px;font-family:'JetBrains Mono',monospace")}>média 13.480</span>
                                </div>
                                <div style={css('display:flex;align-items:flex-end;gap:5px;height:150px')}>
                                    {CHART_BARS.map((h, i) => (
                                        <div key={i} style={css(`flex:1;height:${h}%;background:linear-gradient(180deg,#8b5cf6,#5b21b6);border-radius:3px 3px 0 0;min-height:4px`)} />
                                    ))}
                                </div>
                            </div>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:22px')}>
                                <div style={css("font-weight:700;font-size:16px;font-family:'Space Grotesk',sans-serif;margin-bottom:16px")}>Novos assinantes</div>
                                <div style={css('display:flex;flex-direction:column;gap:13px')}>
                                    {NEW_SUBS.map((x) => (
                                        <div key={x.u} style={css('display:flex;align-items:center;gap:11px')}>
                                            <div style={css('width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#3a3a48,#222);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px')}>{x.u[0].toUpperCase()}</div>
                                            <div style={css('flex:1')}>
                                                <div style={css('font-weight:700;font-size:14px')}>{x.u}</div>
                                                <div style={css('color:#7a7a86;font-size:12px')}>{x.when}</div>
                                            </div>
                                            <span style={css('height:24px;padding:0 9px;border-radius:6px;background:#1a1530;border:1px solid #3a2a5c;color:#c084fc;font-size:11px;font-weight:700;display:flex;align-items:center')}>{x.plan}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:22px;align-items:start')}>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:22px')}>
                                <div style={css("display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;font-family:'Space Grotesk',sans-serif;margin-bottom:6px")}>🔑 Stream key</div>
                                <div style={css('color:#7a7a86;font-size:13px;margin-bottom:14px')}>Cole no OBS em Configurações → Transmissão. Nunca compartilhe.</div>
                                <div style={css('display:flex;gap:9px;align-items:center')}>
                                    <div style={css("flex:1;height:46px;display:flex;align-items:center;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;font-family:'JetBrains Mono',monospace;font-size:14px;color:#c5c5cf;overflow:hidden;white-space:nowrap;text-overflow:ellipsis")}>{keyRevealed ? streamKey : '••••••••••••••••••••'}</div>
                                    <Btn s="width:46px;height:46px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#9a9aa6;font-size:17px;cursor:pointer" onClick={() => setKeyRevealed((k) => !k)}>👁</Btn>
                                    <Btn s="height:46px;padding:0 16px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => copy(streamKey, 'key')}>{copied.key ? <span style={css('color:#34d399')}>✓</span> : <span>⧉ Copiar</span>}</Btn>
                                </div>
                                <Btn s="margin-top:12px;height:38px;padding:0 14px;border-radius:9px;border:1px solid #3a2a14;background:#1a1510;color:#f59e0b;font-weight:600;font-size:13px;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => { setStreamKey('live_sk_' + Math.random().toString(16).slice(2, 18)); flashToast('Chave rotacionada ✓'); }}>↻ Rotacionar chave (revoga a anterior)</Btn>
                            </div>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:22px')}>
                                <div style={css("display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;font-family:'Space Grotesk',sans-serif;margin-bottom:14px")}>📡 Ingest</div>
                                <Field label="SERVIDOR RTMP">
                                    <div style={css('display:flex;gap:9px')}>
                                        <div style={css("flex:1;height:44px;display:flex;align-items:center;padding:0 13px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#c5c5cf;overflow:hidden;white-space:nowrap;text-overflow:ellipsis")}>rtmp://ingest.brunoaiubshow.tv/live</div>
                                        <Btn s="width:46px;height:44px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#9a9aa6;font-size:15px;cursor:pointer" onClick={() => copy('rtmp://ingest.brunoaiubshow.tv/live', 'rtmp')}>{copied.rtmp ? <span style={css('color:#34d399')}>✓</span> : '⧉'}</Btn>
                                    </div>
                                </Field>
                                <Field label="SERVIDOR SRT (baixa latência)">
                                    <div style={css('display:flex;gap:9px')}>
                                        <div style={css("flex:1;height:44px;display:flex;align-items:center;padding:0 13px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#c5c5cf;overflow:hidden;white-space:nowrap;text-overflow:ellipsis")}>srt://ingest.brunoaiubshow.tv:9000</div>
                                        <Btn s="width:46px;height:44px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#9a9aa6;font-size:15px;cursor:pointer" onClick={() => copy('srt://ingest.brunoaiubshow.tv:9000', 'srt')}>{copied.srt ? <span style={css('color:#34d399')}>✓</span> : '⧉'}</Btn>
                                    </div>
                                </Field>
                                <div style={css('margin-top:14px;display:flex;gap:8px;flex-wrap:wrap')}>
                                    <span style={css("height:26px;padding:0 10px;border-radius:7px;background:#15151c;border:1px solid #23232c;color:#9a9aa6;font-size:12px;display:flex;align-items:center;font-family:'JetBrains Mono',monospace")}>ABR · 1080/720/480</span>
                                    <span style={css("height:26px;padding:0 10px;border-radius:7px;background:#15151c;border:1px solid #23232c;color:#9a9aa6;font-size:12px;display:flex;align-items:center;font-family:'JetBrains Mono',monospace")}>LL-HLS · 2s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== ADMIN ===================== */}
                {view === 'admin' && (
                    <div style={css('max-width:1280px;margin:0 auto;padding:30px 32px 70px')}>
                        <div style={css('display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px')}>
                            <div>
                                <div style={css('color:#8b5cf6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:5px')}>MODERAÇÃO</div>
                                <h1 style={css("margin:0;font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;letter-spacing:-.5px")}>Painel de moderação · brunoaiubshow</h1>
                            </div>
                            <span style={css('display:flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;background:#2a0f17;border:1px solid #5c1f2c;color:#ff6b85;font-size:13px;font-weight:700')}>
                                <span style={css('width:8px;height:8px;border-radius:50%;background:#ff3b5c;animation:pulse 1.4s infinite')} />chat ao vivo · 14.207
                            </span>
                        </div>

                        <div style={css('display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px')}>
                            <Stat label="MENSAGENS / MIN" value="312" />
                            <Stat label="CHATTERS ÚNICOS" value="8.420" />
                            <Stat label="AÇÕES HOJE" value={String(modLog.length + 47)} />
                            <Stat label="MODS ONLINE" value="3" valueColor="#22c55e" />
                        </div>

                        <div style={css('border-radius:14px;background:#121218;border:1px solid #1f1f27;padding:16px 18px;margin-bottom:18px')}>
                            <div style={css('font-weight:800;font-size:12px;letter-spacing:.6px;color:#7a7a86;margin-bottom:12px')}>MODO DO CHAT</div>
                            <div style={css('display:flex;gap:10px;flex-wrap:wrap')}>
                                <Btn s={modeStyle(modes.slow)} onClick={() => toggleMode('slow')}>🐢 Modo lento</Btn>
                                <Btn s={modeStyle(modes.subs)} onClick={() => toggleMode('subs')}>★ Só inscritos</Btn>
                                <Btn s={modeStyle(modes.followers)} onClick={() => toggleMode('followers')}>♥ Só seguidores</Btn>
                                <Btn s={modeStyle(modes.emotes)} onClick={() => toggleMode('emotes')}>😀 Só emotes</Btn>
                                <Btn s="flex:1;min-width:128px;height:46px;border-radius:11px;cursor:pointer;font:600 13.5px Archivo,sans-serif;border:1px solid #5c1f2c;background:#2a0f17;color:#ff6b85" onClick={() => { setModMessages((ms) => ms.map((x) => ({ ...x, deleted: true }))); flashToast('Chat limpo ✓'); }}>🧹 Limpar chat</Btn>
                            </div>
                        </div>

                        <div style={css('display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start')}>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;overflow:hidden')}>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #1f1f27')}>
                                    <span style={css("font-weight:700;font-size:15px;font-family:'Space Grotesk',sans-serif")}>Sinalizadas pelo AutoMod</span>
                                    <span style={css('color:#7a7a86;font-size:13px')}>apagar · timeout · banir</span>
                                </div>
                                <div style={css('display:flex;flex-direction:column')}>
                                    {modMessages.map((m) => (
                                        <div key={m.id} style={css(`display:flex;align-items:flex-start;gap:13px;padding:14px 20px;border-bottom:1px solid #17171e;${m.deleted ? 'opacity:.4' : ''}`)}>
                                            <div style={css('width:34px;height:34px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#3a3a48,#222);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px')}>{m.user[0].toUpperCase()}</div>
                                            <div style={css('flex:1;min-width:0')}>
                                                <div style={css('display:flex;align-items:center;gap:8px;margin-bottom:2px')}>
                                                    <span style={css('font-weight:700;font-size:14px')}>{m.user}</span>
                                                    {m.flags > 0 && <span style={css('height:18px;padding:0 7px;border-radius:5px;background:#2a0f17;border:1px solid #5c1f2c;color:#ff6b85;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center')}>⚑ {m.flags} reports</span>}
                                                </div>
                                                <div style={css('color:#c5c5cf;font-size:14px;line-height:1.4;word-break:break-word')}>{m.body}</div>
                                            </div>
                                            <div style={css('display:flex;gap:6px;flex-shrink:0')}>
                                                <Btn s="height:30px;padding:0 10px;border-radius:8px;border:1px solid #2a2a34;background:#15151c;color:#d5d5dd;font-size:12px;font-weight:600;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => del(m.id)}>🗑</Btn>
                                                <Btn s="height:30px;padding:0 10px;border-radius:8px;border:1px solid #3a2a14;background:#1a1510;color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => timeout(m.user)}>⏱ 10m</Btn>
                                                <Btn s="height:30px;padding:0 10px;border-radius:8px;border:1px solid #5c1f2c;background:#2a0f17;color:#ff6b85;font-size:12px;font-weight:700;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => ban(m.user)}>⛔</Btn>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={css('display:flex;flex-direction:column;gap:18px')}>
                                <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:20px')}>
                                    <div style={css("display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;font-family:'Space Grotesk',sans-serif;margin-bottom:14px")}>📝 Ações recentes</div>
                                    {modLog.length === 0 ? (
                                        <div style={css('color:#5a5a66;font-size:13px')}>Nenhuma ação ainda.</div>
                                    ) : (
                                        <div style={css('display:flex;flex-direction:column;gap:9px')}>
                                            {modLog.map((a, i) => (
                                                <div key={i} style={css('display:flex;align-items:center;gap:9px;font-size:13px')}>
                                                    <span style={css('width:6px;height:6px;border-radius:50%;background:#8b5cf6;flex-shrink:0')} />
                                                    <span style={css('color:#fff;font-weight:600')}>{a.a}</span>
                                                    <span style={css('color:#7a7a86')}>· {a.t}</span>
                                                    <span style={css('color:#5a5a66;margin-left:auto;font-size:11.5px')}>{a.w}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:20px')}>
                                    <div style={css("display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;font-family:'Space Grotesk',sans-serif;margin-bottom:14px")}>⛔ Banidos</div>
                                    <div style={css('display:flex;flex-direction:column;gap:10px')}>
                                        {banned.map((b, i) => (
                                            <div key={i} style={css('display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:11px;background:#15151c;border:1px solid #23232c')}>
                                                <div style={css('width:30px;height:30px;flex-shrink:0;border-radius:50%;background:#2a0f17;border:1px solid #5c1f2c;display:flex;align-items:center;justify-content:center;font-size:13px')}>⛔</div>
                                                <div style={css('flex:1;min-width:0')}>
                                                    <div style={css('font-weight:700;font-size:13.5px')}>{b.user}</div>
                                                    <div style={css('color:#7a7a86;font-size:12px')}>{b.reason} · {b.when}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={css('padding:14px 16px;border-radius:14px;background:#101016;border:1px solid #1f1f27;color:#7a7a86;font-size:12.5px;line-height:1.6')}>
                                    Ações publicadas no <strong style={css('color:#c5c5cf')}>Redis</strong> e aplicadas por todos os nós de chat em tempo real (<span style={css("font-family:'JetBrains Mono',monospace;color:#8b5cf6")}>mod_delete</span> · <span style={css("font-family:'JetBrains Mono',monospace;color:#8b5cf6")}>ban</span>).
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== CLIP ===================== */}
                {view === 'clip' && (
                    <div style={css('max-width:1280px;margin:0 auto;padding:30px 32px 80px')}>
                        <div style={css('display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px')}>
                            <div>
                                <div style={css('color:#8b5cf6;font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:5px')}>FERRAMENTA DE CORTES</div>
                                <h1 style={css("margin:0;font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;letter-spacing:-.5px")}>Criar um corte da live</h1>
                            </div>
                            <span style={css('display:flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:10px;background:#2a0f17;border:1px solid #5c1f2c;color:#ff6b85;font-size:13px;font-weight:700')}>
                                <span style={css('width:8px;height:8px;border-radius:50%;background:#ff3b5c;animation:pulse 1.4s infinite')} />cortando da live atual
                            </span>
                        </div>
                        <div style={css('display:grid;grid-template-columns:1.5fr 1fr;gap:22px;align-items:start')}>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:20px')}>
                                <div style={css('position:relative;aspect-ratio:16/9;border-radius:12px;background:linear-gradient(135deg,#241a44,#120d22);overflow:hidden;margin-bottom:18px')}>
                                    <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(139,92,246,.13) 0 16px,transparent 16px 34px)')} />
                                    <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center')}>
                                        <div style={css('width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center')}>
                                            <div style={css('width:0;height:0;border-top:11px solid transparent;border-bottom:11px solid transparent;border-left:18px solid #fff;margin-left:4px')} />
                                        </div>
                                    </div>
                                    <div style={css("position:absolute;top:14px;left:14px;height:26px;padding:0 10px;border-radius:7px;background:rgba(0,0,0,.6);display:flex;align-items:center;color:#fff;font-size:12px;font-weight:600;font-family:'JetBrains Mono',monospace")}>prévia do corte · {clipDur(clipStart, clipEnd)}</div>
                                </div>
                                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:9px')}>
                                    <span style={css('font-weight:800;font-size:12px;letter-spacing:.6px;color:#7a7a86')}>SELECIONE O TRECHO</span>
                                    <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;color:#c084fc")}>{clipAt(clipStart)} → {clipAt(clipEnd)}</span>
                                </div>
                                <div style={css('position:relative;height:54px;border-radius:10px;background:#15151c;border:1px solid #23232c;overflow:hidden;margin-bottom:8px')}>
                                    <div style={css('position:absolute;inset:0;display:flex;align-items:center;gap:3px;padding:0 6px;opacity:.4')}>
                                        {CHART_BARS.map((h, i) => (
                                            <div key={i} style={css(`flex:1;height:${h}%;background:#8b5cf6;border-radius:2px;max-height:42px`)} />
                                        ))}
                                    </div>
                                    <div style={css(`position:absolute;top:0;bottom:0;left:${clipStart}%;width:${clipEnd - clipStart}%;background:rgba(139,92,246,.32);border-left:3px solid #8b5cf6;border-right:3px solid #8b5cf6`)} />
                                </div>
                                <div style={css('display:flex;flex-direction:column;gap:12px;margin-top:14px')}>
                                    <div>
                                        <div style={css('display:flex;justify-content:space-between;color:#9a9aa6;font-size:12px;margin-bottom:5px')}><span>Início</span><span style={css("font-family:'JetBrains Mono',monospace;color:#c5c5cf")}>{clipAt(clipStart)}</span></div>
                                        <input type="range" min={0} max={100} value={clipStart} onChange={(e) => setClipStart(Math.min(+e.target.value, clipEnd - 2))} style={css('width:100%;accent-color:#8b5cf6;cursor:pointer')} />
                                    </div>
                                    <div>
                                        <div style={css('display:flex;justify-content:space-between;color:#9a9aa6;font-size:12px;margin-bottom:5px')}><span>Fim</span><span style={css("font-family:'JetBrains Mono',monospace;color:#c5c5cf")}>{clipAt(clipEnd)}</span></div>
                                        <input type="range" min={0} max={100} value={clipEnd} onChange={(e) => setClipEnd(Math.max(+e.target.value, clipStart + 2))} style={css('width:100%;accent-color:#8b5cf6;cursor:pointer')} />
                                    </div>
                                </div>
                                <div style={css('height:1px;background:#1f1f27;margin:20px 0')} />
                                <Field label="TÍTULO DO CORTE"><input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} placeholder="ex: Pentakill insano no Baron" style={css('width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:Archivo,sans-serif;outline:none')} /></Field>
                                <div style={css('display:flex;align-items:center;gap:12px;margin-top:14px')}>
                                    <Btn s="height:48px;padding:0 24px;border-radius:12px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:15px;font-family:Archivo,sans-serif" onClick={createClip}>✂ Criar corte · {clipDur(clipStart, clipEnd)}</Btn>
                                    <span style={css('color:#6a6a76;font-size:12.5px')}>o corte fica disponível na hora para compartilhar</span>
                                </div>
                            </div>
                            <div style={css('border-radius:16px;background:#121218;border:1px solid #1f1f27;padding:20px')}>
                                <div style={css("display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;font-family:'Space Grotesk',sans-serif;margin-bottom:16px")}>🎬 Seus cortes</div>
                                <div style={css('display:flex;flex-direction:column;gap:13px')}>
                                    {clips.map((c) => (
                                        <div key={c.id} style={css('display:flex;gap:12px;align-items:center')}>
                                            <div style={css('position:relative;width:92px;height:52px;flex-shrink:0;border-radius:9px;background:linear-gradient(135deg,#241a44,#120d22);overflow:hidden')}>
                                                <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(125deg,rgba(139,92,246,.16) 0 9px,transparent 9px 18px)')} />
                                                <div style={css("position:absolute;bottom:4px;right:4px;height:16px;padding:0 5px;border-radius:4px;background:rgba(0,0,0,.7);display:flex;align-items:center;color:#fff;font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace")}>{c.dur}</div>
                                            </div>
                                            <div style={css('flex:1;min-width:0')}>
                                                <div style={css('font-weight:700;font-size:13.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden')}>{c.title}</div>
                                                <div style={css('color:#7a7a86;font-size:12px;margin-top:3px')}>{c.views} views · {c.when}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ===================== PAYWALL OVERLAY ===================== */}
            {paywallOpen && (
                <div style={css('position:fixed;inset:0;z-index:55;background:rgba(6,6,10,.74);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px')}>
                    <div style={css('width:460px;max-width:100%;border-radius:20px;background:#121218;border:1px solid #2a2438;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden')}>
                        <div style={css('padding:30px 30px 0;text-align:center')}>
                            <div style={css('width:56px;height:56px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 0 30px rgba(139,92,246,.4)')}>🔒</div>
                            <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:23px;letter-spacing:-.4px")}>Sua prévia grátis acabou</div>
                            <div style={css('color:#9a9aa6;font-size:15px;line-height:1.5;margin-top:8px')}>Assine para continuar assistindo <strong style={css('color:#fff')}>brunoaiubshow</strong> ao vivo, em Full HD e sem limites.</div>
                        </div>
                        <div style={css('padding:22px 30px 0')}>
                            <div style={css('display:flex;flex-direction:column;gap:9px')}>
                                {['Acesso ilimitado a todas as lives', 'Full HD 1080p, sem anúncios', 'Badge + emotes exclusivos no chat'].map((f) => (
                                    <div key={f} style={css('display:flex;align-items:center;gap:10px;color:#d5d5dd;font-size:14px')}><span style={css('color:#8b5cf6;font-weight:800')}>✓</span>{f}</div>
                                ))}
                            </div>
                        </div>
                        <div style={css('padding:22px 30px 28px;display:flex;flex-direction:column;gap:10px')}>
                            <Btn s="height:50px;border-radius:13px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:16px;font-family:Archivo,sans-serif" onClick={go('checkout')}>Assinar por R$ 29,90/mês</Btn>
                            <div style={css('display:flex;gap:8px;justify-content:center;align-items:center;color:#6a6a76;font-size:12px;margin-top:2px')}>
                                <span>Pague com</span><span style={css('font-weight:700;color:#9a9aa6')}>PIX</span><span>·</span><span style={css('font-weight:700;color:#9a9aa6')}>Cartão</span><span>·</span><span style={css('font-weight:700;color:#9a9aa6')}>Cripto</span>
                            </div>
                            <Btn s="height:36px;border-radius:10px;border:none;background:transparent;color:#6a6a76;font-size:13px;cursor:pointer;font-family:Archivo,sans-serif" onClick={() => setPaywallOpen(false)}>Agora não</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== AUTH OVERLAY ===================== */}
            {authOpen && (
                <div style={css('position:fixed;inset:0;z-index:65;background:rgba(6,6,10,.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto')}>
                    <div style={css('width:432px;max-width:100%;border-radius:20px;background:#121218;border:1px solid #2a2438;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden;position:relative')}>
                        <Btn s="position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:8px;border:none;background:#1c1c24;color:#9a9aa6;font-size:16px;cursor:pointer" onClick={() => setAuthOpen(false)}>✕</Btn>
                        <div style={css('padding:34px 32px 0;text-align:center')}>
                            <div style={css('display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:20px')}>
                                <div style={css('width:13px;height:13px;border-radius:3px;background:#8b5cf6;box-shadow:0 0 14px #8b5cf6')} />
                                <span style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;letter-spacing:-.5px")}>brunoaiubshow</span>
                            </div>
                            <div style={css("font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;letter-spacing:-.4px")}>{authMode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta'}</div>
                            <div style={css('color:#9a9aa6;font-size:14px;margin-top:6px')}>{authMode === 'login' ? 'Acesse para assistir, comentar e gerenciar sua assinatura.' : 'Junte-se à comunidade do brunoaiubshow em segundos.'}</div>
                        </div>
                        <div style={css('padding:24px 32px 30px')}>
                            <Btn s="width:100%;height:50px;border-radius:12px;border:none;cursor:pointer;background:#fff;color:#1a1a1a;font-weight:700;font-size:15px;font-family:Archivo,sans-serif;display:flex;align-items:center;justify-content:center;gap:11px" onClick={() => { setAuthOpen(false); flashToast('Conectado com Google ✓'); }}><span style={css("width:22px;height:22px;border-radius:50%;background:#fff;border:1px solid #e3e3e3;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:#4285F4")}>G</span>Continuar com Google</Btn>
                            <div style={css('display:flex;align-items:center;gap:12px;margin:18px 0')}>
                                <div style={css('flex:1;height:1px;background:#23232c')} /><span style={css('color:#6a6a76;font-size:12px')}>ou</span><div style={css('flex:1;height:1px;background:#23232c')} />
                            </div>
                            {authMode === 'register' && <input placeholder="Nome de usuário" style={css('width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:Archivo,sans-serif;outline:none;margin-bottom:11px')} />}
                            <input placeholder="E-mail" style={css('width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:Archivo,sans-serif;outline:none;margin-bottom:11px')} />
                            <input type="password" placeholder="Senha" style={css('width:100%;height:46px;padding:0 14px;border-radius:10px;border:1px solid #2a2a34;background:#15151c;color:#fff;font-size:15px;font-family:Archivo,sans-serif;outline:none;margin-bottom:16px')} />
                            <Btn s="width:100%;height:50px;border-radius:12px;border:none;cursor:pointer;background:#8b5cf6;color:#fff;font-weight:800;font-size:15px;font-family:Archivo,sans-serif" onClick={() => { setAuthOpen(false); flashToast('Bem-vindo de volta ✓'); }}>{authMode === 'login' ? 'Entrar' : 'Criar conta'}</Btn>
                            <div style={css('text-align:center;margin-top:18px;color:#9a9aa6;font-size:13.5px')}>
                                {authMode === 'login' ? (
                                    <><span>Não tem conta? </span><span onClick={() => setAuthMode('register')} style={css('color:#c084fc;font-weight:700;cursor:pointer')}>Criar conta</span></>
                                ) : (
                                    <><span>Já tem conta? </span><span onClick={() => setAuthMode('login')} style={css('color:#c084fc;font-weight:700;cursor:pointer')}>Entrar</span></>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== TOAST ===================== */}
            {toast && (
                <div style={css('position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:60;height:46px;padding:0 22px;display:flex;align-items:center;gap:10px;border-radius:12px;background:#16261c;border:1px solid #1f5135;color:#34d399;font-weight:700;font-size:14px;box-shadow:0 12px 40px rgba(0,0,0,.5)')}>{toast}</div>
            )}
        </div>
    );
}

// helpers de UI ---------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={css('margin-bottom:13px')}>
            <label style={css('display:block;color:#7a7a86;font-size:12px;font-weight:600;margin-bottom:6px')}>{label}</label>
            {children}
        </div>
    );
}

function Stat({ label, value, sub, subColor, valueColor, mono }: { label: string; value: string; sub?: string; subColor?: string; valueColor?: string; mono?: boolean }) {
    return (
        <div style={css('border-radius:14px;background:#121218;border:1px solid #1f1f27;padding:18px')}>
            <div style={css('color:#7a7a86;font-size:12.5px;font-weight:600;margin-bottom:8px')}>{label}</div>
            <div style={css(`font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px${valueColor ? ';color:' + valueColor : ''}`)}>{value}</div>
            {sub && <div style={css(`font-size:12.5px;margin-top:3px;color:${subColor ?? '#9a9aa6'}${mono ? ";font-family:'JetBrains Mono',monospace" : ''}`)}>{sub}</div>}
        </div>
    );
}

function QrCode({ size }: { size: number }) {
    return (
        <div style={css(`width:${size}px;height:${size}px;flex-shrink:0;border-radius:12px;background:#fff;position:relative`)}>
            <div style={css('position:absolute;inset:14px;background:radial-gradient(#0b0b0f 1.4px,transparent 1.5px) 0 0/9px 9px;border-radius:4px')} />
            {[['top:14px;left:14px'], ['top:14px;right:14px'], ['bottom:14px;left:14px']].map(([pos], i) => (
                <div key={i} style={css(`position:absolute;${pos};width:42px;height:42px;border:6px solid #0b0b0f;border-radius:7px;background:#fff`)}>
                    <div style={css('position:absolute;inset:7px;background:#0b0b0f;border-radius:2px')} />
                </div>
            ))}
        </div>
    );
}
