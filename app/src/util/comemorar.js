// Comemoração (D60): o "✓ que se desenha" com confetes, para os poucos
// momentos que fecham uma tarefa de verdade: publicar a escala, conferir a
// contagem, terminar o cadastro do código. É rara de propósito; se
// aparecesse em todo "Salvo", virava espera e perdia a graça.
//
// Mora na "camada de cima" (popover), então aparece até por cima de uma
// folha aberta. Some sozinha em ~2 s ou com um toque. Só transform/opacity
// (e o traço do ✓), então fica lisa em celular simples. Com "reduzir
// movimento", vira o aviso comum, sem festa.
import { h } from './dom.js';
import { avisar, anunciar } from './folha.js';

const CORES = ['#BF262B', '#8F0D0B', '#f2b8b5', '#1f7a4d', '#e8a33d', '#ffffff'];
const PECAS = 22;

export function comemorar(titulo, texto = '') {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        avisar(texto ? `${titulo} ${texto}` : titulo);
        return;
    }
    const confetes = Array.from({ length: PECAS }, (_, i) => {
        const angulo = (360 / PECAS) * i + (Math.random() * 14 - 7);
        return h('span', {
            class: `festa-confete${i % 3 === 0 ? ' fita' : ''}`,
            style: {
                '--a': `${angulo}deg`,
                '--d': `${95 + Math.random() * 70}px`,
                '--g': `${(Math.random() * 300 - 150).toFixed(0)}deg`,
                '--atraso': `${(0.18 + Math.random() * 0.08).toFixed(2)}s`,
                background: CORES[i % CORES.length],
            },
        });
    });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 52 52');
    svg.setAttribute('class', 'festa-certo');
    svg.setAttribute('aria-hidden', 'true');
    const traco = document.createElementNS(ns, 'path');
    traco.setAttribute('d', 'M15 27.5l7.5 7.5L37.5 19');
    traco.setAttribute('pathLength', '1');
    svg.append(traco);

    const comPopover = typeof HTMLElement.prototype.showPopover === 'function';
    const caixa = h('div', { class: 'festa', popover: comPopover ? 'manual' : null, 'aria-hidden': 'true' },
        h('div', { class: 'festa-palco' },
            ...confetes, // antes do círculo: saem "de dentro" dele
            h('div', { class: 'festa-circulo' }, svg)),
        h('p', { class: 'festa-titulo' }, titulo),
        texto && h('p', { class: 'festa-texto' }, texto));
    document.body.append(caixa);
    if (comPopover) caixa.showPopover();
    anunciar(texto ? `${titulo} ${texto}` : titulo);
    navigator.vibrate?.(18); // Android sente um toque; o iPhone ignora

    let saindo = false;
    const sair = () => {
        if (saindo) return;
        saindo = true;
        caixa.classList.add('saindo');
        setTimeout(() => caixa.remove(), 380);
    };
    caixa.addEventListener('pointerdown', sair);
    setTimeout(sair, 2100);
}
