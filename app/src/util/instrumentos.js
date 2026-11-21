// Ícones dos instrumentos (redesign v2): o "instrumento embaixo" do cartaz,
// do mural, do compromisso e do dia de culto. Desenhados no mesmo traço dos
// outros ícones do app (24×24, linha de 1,75, cantos redondos).
import { h } from './dom.js';
import { FUNCAO_MESA } from './escala.js';

const NS = 'http://www.w3.org/2000/svg';
const DESENHOS = {
    voz: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20M9 20.5h6',
    violao: 'M20.5 3.5l-2 2M18.5 5.5l-6.2 6.2M10.6 9.8c-1.6-1.2-3.9-1-5.3.4-1.1 1.1-1 2.6-.4 3.6-.9.3-1.6 1.2-1.6 2.3 0 2.1 2.3 3.9 4.4 3.9 1.1 0 2-.7 2.3-1.6 1 .6 2.5.7 3.6-.4 1.4-1.4 1.6-3.7.4-5.3M8.6 13.6l1.8 1.8',
    guitarra: 'M20.5 3.5l-2 2M18.5 5.5l-6.3 6.3M10.4 10.1L7 9.5C5.3 9.5 4 10.8 4 12.5l1 1.5-1.5 2.5 1 3 3 1 2.5-1.5 1.5 1c1.7 0 3-1.3 3-3l-.6-3.4M8.3 14.2l1.5 1.5',
    baixo: 'M21 3l-1.5 1.5M18.5 3.5l2 2M19.5 4.5l-7.7 7.7M10.4 10.1L7 9.5C5.3 9.5 4 10.8 4 12.5l1 1.5-1.5 2.5 1 3 3 1 2.5-1.5 1.5 1c1.7 0 3-1.3 3-3l-.6-3.4M8.3 14.2l1.5 1.5',
    teclado: 'M3 6h18v12H3zM9 13v5M15 13v5M7.5 6v7h3V6M13.5 6v7h3V6',
    bateria: 'M4 10c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M7.5 3.5l3 5M16.5 3.5l-3 5M8 13v5.5M16 13v5.5',
    cajon: 'M6 3h12v18H6zM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 7h12',
    mesa: 'M3 5h18v14H3zM7.5 8v8M12 8v8M16.5 8v8M6 12h3M10.5 10h3M15 14h3',
    outro: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
};

const chave = (nome) => {
    const n = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (nome === FUNCAO_MESA || n.startsWith('mesa') || n.includes('som')) return 'mesa';
    if (n.includes('voz') || n.includes('vocal') || n.includes('canto')) return 'voz';
    if (n.includes('violao')) return 'violao';
    if (n.includes('guitarra')) return 'guitarra';
    if (n.includes('baixo')) return 'baixo';
    if (n.includes('teclado') || n.includes('piano')) return 'teclado';
    if (n.includes('bateria')) return 'bateria';
    if (n.includes('cajon')) return 'cajon';
    return 'outro';
};

export function iconeInstrumento(nome, classe = 'icone icone-instrumento') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', DESENHOS[chave(nome)]);
    svg.append(p);
    return svg;
}

// "Violão · Voz" com o ícone de cada um: [ícone Violão] [ícone Voz]
export function instrumentosComIcone(lista, { classe = 'instrumentos', soIcones = false } = {}) {
    return h('span', { class: classe },
        lista.map((nome) => h('span', { class: 'instrumento', title: nome },
            iconeInstrumento(nome),
            soIcones ? h('span', { class: 'sr-only' }, nome) : h('span', { class: 'instrumento-nome' }, nome))));
}
