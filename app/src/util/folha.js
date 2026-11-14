// "Folha": o painel que sobe de baixo no iPhone (bottom sheet).
//
// Usa <dialog> com showModal(), que já resolve de graça o que dá mais
// trabalho num modal: prende o foco dentro dele (Tab não escapa), fecha com
// Esc, deixa o resto da página inerte para o leitor de tela e devolve o foco
// para o botão que abriu quando fecha.
import { h, icone } from './dom.js';

let contador = 0;

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
        const terminar = () => {
            dialogo.close();
            dialogo.remove();
            document.documentElement.classList.remove('com-folha');
            aoFechar?.();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return terminar();
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
    document.documentElement.classList.add('com-folha'); // trava a rolagem da página atrás
    dialogo.showModal();
    // Não abrir o teclado do celular sozinho: foca o título, não o 1º campo
    dialogo.querySelector('h2').setAttribute('tabindex', '-1');
    dialogo.querySelector('h2').focus();

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
