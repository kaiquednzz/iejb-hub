// Trava de instalação no celular. Aparece antes de tudo (até do login).
// Três casos:
//   - aberto dentro de outro app (WhatsApp, Instagram): manda abrir no navegador
//   - iPhone/iPad: não existe botão "instalar" no iOS, então ensinamos o caminho
//   - Android: botão "Instalar" de verdade quando o navegador oferece;
//     senão, o caminho pelo menu
import { h, icone, comCarregando } from '../util/dom.js';
import { aparelho, podeInstalarDireto, pedirInstalacao, aoMudarInstalacao } from '../pwa.js';

export function telaInstalar() {
    const corpo = h('div', { class: 'instalar-corpo' });
    const tela = h('div', { class: 'tela tela-entrada tela-instalar' },
        h('main', { id: 'conteudo', class: 'entrada-palco' },
            h('div', { class: 'instalar-icone-app', 'aria-hidden': 'true' },
                h('img', { src: '/icone-192.png', alt: '', width: 96, height: 96 })),
            h('section', { class: 'entrada-cartao', 'aria-labelledby': 'titulo-tela' },
                h('h1', { id: 'titulo-tela', tabindex: -1 }, 'Instale o IEJB Hub'),
                h('p', { class: 'entrada-subtitulo' },
                    'No celular o Hub funciona como app, direto da tela de início. É assim que os avisos de escala chegam até você.'),
                corpo,
            ),
            h('p', { class: 'entrada-rodape' }, 'Leva menos de um minuto e não ocupa espaço.'),
        ),
    );

    desenhar();
    // Android: o botão pode ficar disponível depois (o navegador decide quando)
    const parar = aoMudarInstalacao((estado) => {
        if (!tela.isConnected) return parar();
        desenhar(estado === 'instalado');
    });
    return tela;

    function desenhar(acabouDeInstalar = false) {
        if (acabouDeInstalar) corpo.replaceChildren(...pronto());
        else if (aparelho.navegadorDeApp) corpo.replaceChildren(...abrirNoNavegador());
        else if (aparelho.ios) corpo.replaceChildren(...passosIOS());
        else corpo.replaceChildren(...passosAndroid(desenhar));
    }
}

function passos(lista) {
    return h('ol', { class: 'instalar-passos' },
        lista.map(([icn, texto], i) => h('li', { style: { '--i': i } },
            h('span', { class: 'instalar-passo-icone', 'aria-hidden': 'true' },
                icone(icn, icn === 'menu' || icn === 'reticencias' ? 'icone icone-pontos' : 'icone')),
            h('span', null, ...texto),
        )),
    );
}

function passosIOS() {
    return [passos([
        ['compartilhar', ['Toque em ', h('strong', null, 'Compartilhar'), '. No iPhone ele fica na barra de baixo; se não aparecer, toque antes em ', h('strong', null, '⋯'), '.']],
        ['adicionar', ['Escolha ', h('strong', null, 'Adicionar à Tela de Início'), ' (role a lista se precisar) e toque em ', h('strong', null, 'Adicionar'), '.']],
        ['celular', ['Abra o ', h('strong', null, 'IEJB Hub'), ' pelo ícone novo na tela de início e entre por lá.']],
    ])];
}

function passosAndroid(redesenhar) {
    if (podeInstalarDireto()) {
        const botao = h('button', { type: 'button', class: 'botao-principal botao-largo' }, icone('baixar'), 'Instalar o app');
        botao.addEventListener('click', () => comCarregando(botao, async () => {
            const aceitou = await pedirInstalacao();
            // Se recusou, o evento já foi gasto: mostra o caminho pelo menu
            if (!aceitou) redesenhar();
        }));
        return [botao, h('p', { class: 'instalar-nota' }, 'Depois é só abrir pelo ícone na tela inicial.')];
    }
    return [passos([
        ['menu', ['Toque no menu ', h('strong', null, '⋮'), ' do navegador (canto de cima).']],
        ['adicionar', ['Escolha ', h('strong', null, 'Instalar app'), ' ou ', h('strong', null, 'Adicionar à tela inicial'), '.']],
        ['celular', ['Abra o ', h('strong', null, 'IEJB Hub'), ' pelo ícone novo e entre por lá.']],
    ])];
}

function abrirNoNavegador() {
    const navegador = aparelho.ios ? 'Safari' : 'Chrome';
    const botaoCopiar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('copiar'), 'Copiar o link');
    botaoCopiar.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(location.origin);
            botaoCopiar.replaceChildren(icone('certo'), 'Link copiado');
        } catch {
            botaoCopiar.replaceChildren(location.host);
        }
    });
    return [
        passos([
            [aparelho.ios ? 'reticencias' : 'menu', ['Você abriu o Hub dentro de outro app. Toque no menu ', h('strong', null, aparelho.ios ? '⋯' : '⋮'), '.']],
            ['compartilhar', ['Escolha ', h('strong', null, `Abrir no ${navegador}`), ' (ou "Abrir no navegador").']],
        ]),
        botaoCopiar,
        h('p', { class: 'instalar-nota' }, `Ou copie o link e cole no ${navegador}.`),
    ];
}

function pronto() {
    return [h('div', { class: 'instalar-pronto' },
        h('span', { class: 'instalar-pronto-icone', 'aria-hidden': 'true' }, icone('certo')),
        h('p', null, h('strong', null, 'Instalado!'), ' Agora abra o IEJB Hub pelo ícone na tela inicial. Pode fechar esta aba.'),
    )];
}
