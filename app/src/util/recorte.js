// Ajustar a foto de perfil antes de subir: a pessoa arrasta e dá zoom até o
// rosto ficar no círculo. Devolve o quadrado escolhido, em pixels da foto
// original ({ sx, sy, lado }), ou null se cancelou. Quem recorta de verdade
// é o comprimirFoto (util/foto.js), que já sabe reduzir e comprimir.
//
// Como funciona: a foto é desenhada com transform (translate + scale, só GPU)
// dentro de uma janela quadrada. "x, y" é onde fica o canto da foto e
// "escala" quantos pixels de tela cada pixel da foto ocupa. A foto sempre
// cobre a janela inteira (nunca sobra borda vazia no círculo).
//
// Gestos: 1 dedo arrasta, 2 dedos fazem pinça, o controle deslizante dá zoom
// (acessível) e as setas do teclado movem quando a janela tem foco.
import { h, icone } from './dom.js';
import { abrirFolha } from './folha.js';

const ZOOM_MAX = 4;

export function recortarFoto(arquivo, imagem) {
    return new Promise((resolver) => {
        const largura = imagem.width;
        const altura = imagem.height;
        const lado = Math.min(320, window.innerWidth - 72);
        const escalaMinima = lado / Math.min(largura, altura);   // "cobrir" a janela
        let escala = escalaMinima;
        let x = (lado - largura * escala) / 2;
        let y = (lado - altura * escala) / 2;
        let escolhido = null;

        const url = URL.createObjectURL(arquivo);
        const foto = h('img', { src: url, alt: '', class: 'recorte-foto', draggable: 'false',
            style: { width: `${largura}px`, height: `${altura}px` } });
        const janela = h('div', {
            class: 'recorte-janela', tabindex: 0, role: 'img',
            'aria-label': 'Foto. Arraste para posicionar; use as setas do teclado para mover.',
            style: { '--lado': `${lado}px` },
        }, foto, h('div', { class: 'recorte-mascara', 'aria-hidden': 'true' }));

        const zoom = h('input', { type: 'range', min: 1, max: ZOOM_MAX, step: 0.01, value: 1, class: 'recorte-zoom', 'aria-label': 'Zoom' });
        const usar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Usar foto');
        const cancelar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Cancelar');

        // Mantém a foto cobrindo a janela
        function prender() {
            x = Math.min(0, Math.max(lado - largura * escala, x));
            y = Math.min(0, Math.max(lado - altura * escala, y));
        }
        function desenhar() {
            foto.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${escala})`;
        }
        // Zoom mantendo parado o ponto (px, py) da janela: o que está sob o dedo fica sob o dedo
        function aplicarZoom(nova, px = lado / 2, py = lado / 2) {
            nova = Math.min(escalaMinima * ZOOM_MAX, Math.max(escalaMinima, nova));
            x = px - (px - x) * (nova / escala);
            y = py - (py - y) * (nova / escala);
            escala = nova;
            prender();
            zoom.value = String(escala / escalaMinima);
            desenhar();
        }

        // --- Gestos ---------------------------------------------------------
        const dedos = new Map();
        let pinca = null;   // { distancia, escala } no começo da pinça
        const pontoNaJanela = (e) => {
            const r = janela.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        janela.addEventListener('pointerdown', (e) => {
            janela.setPointerCapture(e.pointerId);
            dedos.set(e.pointerId, pontoNaJanela(e));
            janela.classList.add('arrastando');
            if (dedos.size === 2) {
                const [a, b] = [...dedos.values()];
                pinca = { distancia: Math.hypot(a.x - b.x, a.y - b.y), escala };
            }
        });
        janela.addEventListener('pointermove', (e) => {
            if (!dedos.has(e.pointerId)) return;
            const antes = dedos.get(e.pointerId);
            const agora = pontoNaJanela(e);
            dedos.set(e.pointerId, agora);
            if (dedos.size === 1) {
                x += agora.x - antes.x;
                y += agora.y - antes.y;
                prender();
                desenhar();
            } else if (dedos.size === 2 && pinca) {
                const [a, b] = [...dedos.values()];
                const distancia = Math.hypot(a.x - b.x, a.y - b.y);
                aplicarZoom(pinca.escala * (distancia / pinca.distancia), (a.x + b.x) / 2, (a.y + b.y) / 2);
            }
        });
        const soltar = (e) => {
            dedos.delete(e.pointerId);
            if (dedos.size < 2) pinca = null;
            if (dedos.size === 0) janela.classList.remove('arrastando');
        };
        janela.addEventListener('pointerup', soltar);
        janela.addEventListener('pointercancel', soltar);
        janela.addEventListener('wheel', (e) => {
            e.preventDefault();
            const p = pontoNaJanela(e);
            aplicarZoom(escala * Math.exp(-e.deltaY * 0.002), p.x, p.y);
        }, { passive: false });
        janela.addEventListener('keydown', (e) => {
            const passo = e.shiftKey ? 40 : 12;
            const mover = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }[e.key];
            if (!mover) return;
            e.preventDefault();
            x += mover[0];
            y += mover[1];
            prender();
            desenhar();
        });
        zoom.addEventListener('input', () => aplicarZoom(escalaMinima * Number(zoom.value)));

        usar.addEventListener('click', () => {
            escolhido = { sx: -x / escala, sy: -y / escala, lado: lado / escala };
            folha.fechar();
        });
        cancelar.addEventListener('click', () => folha.fechar());

        desenhar();
        const folha = abrirFolha({
            titulo: 'Ajustar foto',
            conteudo: h('div', { class: 'recorte' },
                janela,
                h('div', { class: 'recorte-controle' },
                    icone('imagem', 'icone icone-p recorte-icone-menor'),
                    zoom,
                    icone('imagem', 'icone recorte-icone-maior')),
                h('p', { class: 'folha-texto folha-texto-pequeno recorte-dica' }, 'Arraste para posicionar. Use dois dedos ou a barra para aproximar.'),
                usar,
                cancelar,
            ),
            aoFechar: () => {
                URL.revokeObjectURL(url);
                resolver(escolhido);
            },
        });
        requestAnimationFrame(() => janela.focus({ preventScroll: true }));
    });
}
