// "Folha": o painel que sobe de baixo no iPhone (bottom sheet).
//
// Usa <dialog> com showModal(), que já resolve de graça o que dá mais
// trabalho num modal: prende o foco dentro dele (Tab não escapa), fecha com
// Esc, deixa o resto da página inerte para o leitor de tela e devolve o foco
// para o botão que abriu quando fecha.
import { h, icone } from './dom.js';

let contador = 0;

// Trava a rolagem da página atrás da folha.
// Não dá pra usar só overflow:hidden no <html>: no Safari do iPhone, com a
// página já rolada, o <dialog> fica deslocado (aparece no meio da tela,
// cortado). Prender o <body> no lugar (position:fixed + top negativo) zera a
// rolagem de verdade sem a página "pular", e na hora de fechar devolvemos a
// posição. Conta quantas folhas estão abertas (uma pode abrir outra).
let folhasAbertas = 0;
let rolagemGuardada = 0;
function travarRolagem() {
    if (folhasAbertas++ > 0) return;
    rolagemGuardada = window.scrollY;
    const corpo = document.body.style;
    corpo.position = 'fixed';
    corpo.top = `-${rolagemGuardada}px`;
    corpo.left = '0';
    corpo.right = '0';
    document.documentElement.classList.add('com-folha');
}
function destravarRolagem() {
    if (--folhasAbertas > 0) return;
    folhasAbertas = 0;
    const corpo = document.body.style;
    corpo.position = corpo.top = corpo.left = corpo.right = '';
    document.documentElement.classList.remove('com-folha');
    window.scrollTo({ top: rolagemGuardada, behavior: 'instant' });
}

export function abrirFolha({ titulo, conteudo, aoFechar }) {
    const idTitulo = `folha-titulo-${++contador}`;
    const fecharBotao = h('button', { type: 'button', class: 'folha-fechar', 'aria-label': 'Fechar' }, icone('fechar'));

    const dialogo = h('dialog', { class: 'folha', 'aria-labelledby': idTitulo },
        h('div', { class: 'folha-caixa' },
            h('div', { class: 'folha-alca', 'aria-hidden': 'true' }),
            h('header', { class: 'folha-topo' },
                h('h2', { id: idTitulo }, titulo),
                fecharBotao,
            ),
            h('div', { class: 'folha-conteudo' }, conteudo),
        ),
    );

    let fechando = false;
    function fechar() {
        if (fechando) return;
        fechando = true;
        let terminou = false;
        const terminar = () => {
            if (terminou) return; // animationend e o setTimeout de garantia podem chegar os dois
            terminou = true;
            dialogo.close();
            dialogo.remove();
            destravarRolagem();
            aoFechar?.();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return terminar();
        // Fechou ainda subindo: cancela a subida (feita pelo JS), senão ela
        // ficaria por cima da animação de descida do CSS
        caixa.getAnimations().forEach((a) => { if (!(a instanceof CSSAnimation)) a.cancel(); });
        dialogo.classList.add('saindo');
        dialogo.addEventListener('animationend', terminar, { once: true });
        setTimeout(terminar, 400); // garantia se a animação não disparar
    }

    fecharBotao.addEventListener('click', fechar);
    // Esc: em vez de sumir seco, sai com a animação
    dialogo.addEventListener('cancel', (evento) => { evento.preventDefault(); fechar(); });
    // Toque no fundo escurecido (fora da caixa) fecha
    dialogo.addEventListener('click', (evento) => { if (evento.target === dialogo) fechar(); });

    document.body.append(dialogo);
    travarRolagem();
    const caixa = dialogo.querySelector('.folha-caixa');
    const comAnimacao = !matchMedia('(prefers-reduced-motion: reduce)').matches
        && !matchMedia('(min-width: 720px)').matches; // no computador quem anima é o CSS (cartão no meio)
    if (comAnimacao) caixa.style.visibility = 'hidden';
    dialogo.showModal();
    if (comAnimacao) {
        // Espera 2 quadros: o iPhone termina de posicionar o <dialog> e só
        // então a folha sobe. Escondida nesse meio tempo (~30ms, imperceptível).
        requestAnimationFrame(() => requestAnimationFrame(() => {
            caixa.style.visibility = '';
            caixa.animate(
                [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
                { duration: 550, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }, // --ease-ios
            );
        }));
    }
    // Não abrir o teclado do celular sozinho: foca o título, não o 1º campo.
    // preventScroll: a folha ainda está lá embaixo (subindo); sem isso o
    // Safari rola a tela atrás do foco e a folha "pula" no meio da animação.
    dialogo.querySelector('h2').setAttribute('tabindex', '-1');
    dialogo.querySelector('h2').focus({ preventScroll: true });

    return { fechar, elemento: dialogo, trocarConteudo: (novo) => dialogo.querySelector('.folha-conteudo').replaceChildren(novo) };
}

// Pergunta "tem certeza?" e devolve true/false.
export function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false }) {
    return new Promise((resolver) => {
        let resposta = false;
        const sim = h('button', { type: 'button', class: perigo ? 'botao-perigo botao-largo' : 'botao-principal botao-largo' }, botao);
        const nao = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Cancelar');
        const folha = abrirFolha({
            titulo,
            conteudo: h('div', { class: 'form' }, h('p', { class: 'folha-texto' }, texto), sim, nao),
            aoFechar: () => resolver(resposta),
        });
        sim.addEventListener('click', () => { resposta = true; folha.fechar(); });
        nao.addEventListener('click', () => folha.fechar());
    });
}

// Mensagem curta que aparece e some sozinha ("Salvo", "Pedido aprovado").
// role=status: o leitor de tela lê sem roubar o foco.
// É um popover para ir à "camada de cima" do navegador: sem isso, com uma
// folha aberta (o <dialog> também mora lá), o aviso ficaria escondido atrás.
let caixaToast;
export function avisar(texto) {
    const comPopover = typeof HTMLElement.prototype.showPopover === 'function';
    if (!caixaToast) {
        caixaToast = h('div', { class: 'toast', role: 'status', popover: comPopover ? 'manual' : null });
        document.body.append(caixaToast);
    }
    caixaToast.textContent = texto;
    caixaToast.classList.remove('visivel');
    if (comPopover) {
        // Esconder e mostrar de novo põe o aviso acima da folha aberta mais recente
        if (caixaToast.matches(':popover-open')) caixaToast.hidePopover();
        caixaToast.showPopover();
    }
    void caixaToast.offsetWidth; // reinicia a animação se dois avisos vierem seguidos
    caixaToast.classList.add('visivel');
    clearTimeout(caixaToast.timer);
    caixaToast.timer = setTimeout(() => {
        caixaToast.classList.remove('visivel');
        if (comPopover) setTimeout(() => caixaToast.matches(':popover-open') && caixaToast.hidePopover(), 400);
    }, 2600);
}

// Fala algo só para o leitor de tela (sem aviso na tela).
let caixaAnuncio;
export function anunciar(texto) {
    if (!caixaAnuncio) {
        caixaAnuncio = h('div', { class: 'sr-only', role: 'status' });
        document.body.append(caixaAnuncio);
    }
    caixaAnuncio.textContent = '';
    setTimeout(() => { caixaAnuncio.textContent = texto; }, 60); // a região tem que existir antes do texto
}
