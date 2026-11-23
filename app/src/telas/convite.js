// QR de convite (D69): o administrador abre em tela cheia (no telão, no
// celular apontado para a fila do café) ou imprime para o mural da igreja.
// Quem lê cai no app: instala, entra com o Google e o pedido chega para o
// administrador aprovar (com notificação: acesso_pedido).
//
// O link é o próprio endereço do app com ?convite=1, que só muda o texto da
// tela de instalar ("Você foi convidado"). Não dá acesso a nada sozinho: a
// aprovação continua sendo do administrador.
import { h, icone } from '../util/dom.js';
import { qrSvg } from '../util/qr.js';

export const linkDeConvite = () => `${location.origin}/?convite=1`;
export const veioPorConvite = () => new URLSearchParams(location.search).has('convite');

export function botaoConvite() {
    const b = h('button', { type: 'button', class: 'botao-secundario botao-largo convite-abrir' }, icone('qr', 'icone icone-p'), 'Convidar com QR');
    b.addEventListener('click', () => abrirConvite(b));
    return b;
}

export function abrirConvite(origem) {
    const imprimir = h('button', { type: 'button', class: 'botao-secundario' }, icone('baixar', 'icone icone-p'), 'Imprimir');
    const fechar = h('button', { type: 'button', class: 'convite-fechar', 'aria-label': 'Fechar' }, icone('fechar'));
    const dialogo = h('dialog', { class: 'convite', 'aria-labelledby': 'convite-titulo' },
        fechar,
        h('div', { class: 'convite-folha' },
            h('img', { class: 'convite-logo', src: '/icone-192.png', alt: '', width: 64, height: 64 }),
            h('p', { class: 'convite-chapeu' }, 'IEJB · Igreja Evangélica do Jardim Brasil'),
            h('h2', { id: 'convite-titulo', class: 'convite-titulo' }, 'Entre no IEJB Hub'),
            h('div', { class: 'convite-qr' }, qrSvg(linkDeConvite(), 'QR code do convite para o IEJB Hub')),
            h('ol', { class: 'convite-passos' },
                h('li', null, h('span', null, h('strong', null, 'Aponte a câmera'), ' do celular para o código')),
                h('li', null, h('span', null, h('strong', null, 'Instale o app'), ' na tela de início')),
                h('li', null, h('span', null, h('strong', null, 'Entre com o Google'), ' e a liderança libera o seu acesso'))),
            h('p', { class: 'convite-link' }, linkDeConvite().replace(/^https?:\/\//, ''))),
        h('div', { class: 'convite-acoes' }, imprimir));
    document.body.append(dialogo);

    const sair = () => { dialogo.close(); dialogo.remove(); origem?.focus({ preventScroll: true }); };
    fechar.addEventListener('click', sair);
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); sair(); });
    imprimir.addEventListener('click', () => {
        document.documentElement.classList.add('imprimindo-convite');
        addEventListener('afterprint', () => document.documentElement.classList.remove('imprimindo-convite'), { once: true });
        print();
    });

    dialogo.showModal();
    // Tela acesa e no máximo de brilho não dá para pedir; pelo menos não apaga
    navigator.wakeLock?.request('screen').then((trava) => dialogo.addEventListener('close', () => trava.release(), { once: true })).catch(() => {});
}
