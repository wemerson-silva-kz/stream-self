import type { CSSProperties } from 'react';

/**
 * Converte uma string de estilo CSS (como no design .dc.html) em um objeto de
 * estilo React. Permite portar o markup do Claude Design quase verbatim.
 *
 * Ex.: css('display:flex;gap:8px') => { display: 'flex', gap: '8px' }
 */
export function css(style: string): CSSProperties {
    const out: Record<string, string> = {};
    for (const decl of style.split(';')) {
        const i = decl.indexOf(':');
        if (i === -1) continue;
        const rawKey = decl.slice(0, i).trim();
        const value = decl.slice(i + 1).trim();
        if (!rawKey) continue;
        // -webkit-line-clamp -> WebkitLineClamp ; background-position -> backgroundPosition
        const key = rawKey
            .replace(/^-(\w)/, (_, c) => c.toUpperCase())
            .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        out[key] = value;
    }
    return out as CSSProperties;
}
