// Dois detalhes de rolagem (redesign v2):
//
// 1. Título que encolhe: quando o título grande da tela (h1) sai de vista,
//    o nome aparece pequeno no meio do cabeçalho, como nos apps do iPhone.
// 2. Puxar para atualizar: no app instalado (no Safari a própria página já
//    faz isso), puxar a tela para baixo no topo acende a chama e, soltando
//    depois do ponto, recarrega a tela atual.
import { chama } from './chama.js';

export function ligarTituloCompacto(tela) {
    const titulo = tela.querySelector('main h1:not(.sr-only)');
    const cabecalho = tela.querySelector('.cabecalho');
    const compacto = cabecalho?.querySelector('.cabecalho-compacto');
    if (!titulo || !compacto || !('IntersectionObserver' in window)) return;
    // Nas áreas, o nome da área já está no cabeçalho; nas abas, usa o título
    if (!compacto.textContent) compacto.textContent = titulo.firstChild?.textContent?.trim() ?? titulo.textContent.trim();
    const observador = new IntersectionObserver(([e]) => {
        if (!tela.isConnected) return observador.disconnect();
        cabecalho.classList.toggle('titulo-fora', !e.isIntersecting && e.boundingClientRect.top < 80);
    }, { rootMargin: '-64px 0px 0px 0px' });
    observador.observe(titulo);
}

const LIMITE = 72;   // quanto puxar (px) para valer
const RESISTENCIA = 0.45;

export function ligarPuxarParaAtualizar(recarregar) {
    const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!instalado || !('ontouchstart' in window)) return;

    const indicador = Object.assign(document.createElement('div'), { className: 'puxar', role: 'status' });
    indicador.setAttribute('aria-live', 'polite');
    indicador.append(chama('chama-puxar'));
    document.body.append(indicador);

    let inicio = null;
    let distancia = 0;
    const podeComecar = (alvo) => window.scrollY <= 0 && !document.querySelector('dialog[open]')
        && !alvo.closest('input, textarea, select, .montar-area, [data-sem-puxar]');

    document.addEventListener('touchstart', (e) => {
        inicio = e.touches.length === 1 && podeComecar(e.target) ? e.touches[0].clientY : null;
        distancia = 0;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (inicio === null) return;
        const dy = e.touches[0].clientY - inicio;
        if (dy <= 0 || window.scrollY > 0) { distancia = 0; mostrar(0); return; }
        distancia = dy * RESISTENCIA;
        mostrar(distancia);
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (inicio === null) return;
        inicio = null;
        if (distancia >= LIMITE) {
            indicador.classList.add('carregando');
            indicador.textContent = '';
            indicador.append(chama('chama-puxar'));
            indicador.setAttribute('aria-label', 'Atualizando');
            recarregar();
            setTimeout(() => { indicador.classList.remove('carregando'); mostrar(0); }, 700);
        } else {
            mostrar(0);
        }
        distancia = 0;
    });

    function mostrar(d) {
        const p = Math.min(d / LIMITE, 1);
        indicador.style.setProperty('--puxado', Math.min(d, LIMITE * 1.3).toFixed(1));
        indicador.style.setProperty('--progresso', p.toFixed(3));
        indicador.classList.toggle('pronto', p >= 1);
        indicador.classList.toggle('visivel', d > 4);
    }
}
