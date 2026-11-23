// Boas-vindas e tour (D69).
//
// Na primeira vez que uma conta aprovada abre o Início: um cartão de
// boas-vindas ("Mostrar" ou "Agora não") e, se a pessoa quiser, um tour de
// poucos passos que acende uma parte da tela de cada vez (a luz desliza de
// um ponto ao outro). O aniversário fica de fora (é detalhe, mora em Você).
//
// Sem forçar: dá para pular a qualquer momento (botão, Esc ou tocar fora),
// e ele não volta sozinho. Quem quiser rever acha em Você > Como usar o app.
//
// Por que um <dialog>? Ele já prende o foco, deixa o resto da tela inerte
// para o leitor de tela e fecha no Esc, sem a gente reinventar nada disso.
import { h } from '../util/dom.js';

// v2: tour corrigido (o balão saía da tela no passo do Mural); quem já viu
// a versão 1 vê de novo uma vez
const chaveVisto = (conta) => `iejb-tour-v2-visto-${conta.id}`;
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Roda `fim` quando a animação de saída acaba (ou em `ms`, se ela não
// disparar), uma vez só: sem a trava, o fim rodava duas vezes e abria o
// próximo passo em dobro.
function aoTerminarSaida(el, fim, ms = 400) {
    if (reduzir()) return fim();
    let feito = false;
    const uma = () => { if (!feito) { feito = true; fim(); } };
    el.addEventListener('animationend', (e) => { if (e.target === el) uma(); });
    setTimeout(uma, ms);
}

export function mostrarBoasVindasSePrimeiraVez(conta) {
    try {
        if (localStorage.getItem(chaveVisto(conta))) return;
        localStorage.setItem(chaveVisto(conta), new Date().toISOString());
    } catch { return; } // sem armazenamento (modo privado): não insiste
    // Espera o Início assentar (as abas entram com animação)
    setTimeout(() => boasVindas(conta), reduzir() ? 0 : 700);
}

function boasVindas(conta) {
    const nome = conta.pessoa?.apelido?.trim() || (conta.pessoa?.nome ?? '').split(' ')[0];
    const mostrar = h('button', { type: 'button', class: 'botao-principal botao-largo', autofocus: true }, 'Me mostra');
    const depois = h('button', { type: 'button', class: 'botao-texto' }, 'Agora não');
    const dialogo = h('dialog', { class: 'boas-vindas', 'aria-labelledby': 'bv-titulo' },
        h('img', { class: 'boas-vindas-logo', src: '/icone-192.png', alt: '', width: 72, height: 72 }),
        h('h2', { id: 'bv-titulo', class: 'boas-vindas-titulo' }, nome ? `Que bom te ver, ${nome}!` : 'Que bom te ver!'),
        h('p', { class: 'boas-vindas-texto' }, 'Este é o app da IEJB. Em poucos toques eu te mostro onde fica cada coisa.'),
        h('div', { class: 'boas-vindas-acoes' }, mostrar, depois));
    document.body.append(dialogo);
    const fechar = (depoisDeFechar) => {
        dialogo.classList.add('saindo');
        aoTerminarSaida(dialogo, () => { dialogo.close(); dialogo.remove(); depoisDeFechar?.(); });
    };
    mostrar.addEventListener('click', () => fechar(() => abrirTour(conta)));
    depois.addEventListener('click', () => fechar());
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
    dialogo.showModal();
}

// --- O tour ------------------------------------------------------------------
// Cada passo procura o alvo visível (barra de abas no celular, barra lateral
// no computador). Passo sem alvo na tela é pulado.
function passos(conta) {
    const serve = !!conta.pessoa?.membro_ministerio?.some((m) => m.ativo);
    const aba = (rota) => [`.barra-abas a[href="${rota}"]`, `.barra-lateral a[href="${rota}"]`];
    return [
        { alvo: aba('#/inicio'), titulo: 'Início', texto: serve ? 'O que importa hoje: sua próxima escala e os avisos da igreja.' : 'O que importa hoje: os avisos da igreja.' },
        // O primeiro cartão (não o mural inteiro, que pode ser mais alto que a tela)
        { alvo: ['.mural-lista > li:first-child .mural-cartao', '.mural-secao:not([hidden])'], titulo: 'Mural', texto: 'Avisos e fotos da igreja. Gostou? Toque em Amém ou no coração.', rolar: true },
        { alvo: aba('#/agenda'), titulo: 'Agenda', texto: serve ? 'Seus próximos cultos e os eventos da igreja.' : 'Os eventos da igreja.' },
        { alvo: aba('#/ministerios'), titulo: 'Ministérios', texto: serve ? 'A casa de cada ministério: escala, repertórios e equipe.' : 'Os ministérios da igreja.' },
        { alvo: aba('#/voce'), titulo: 'Você', texto: 'Seus dados e os pedidos de oração.' },
    ];
}

const visivel = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};

export function abrirTour(conta) {
    if (location.hash !== '#/inicio' && location.hash !== '') {
        location.hash = '#/inicio';
        setTimeout(() => abrirTour(conta), 600);
        return;
    }
    const lista = passos(conta)
        .map((p) => ({ ...p, el: p.alvo.map((s) => document.querySelector(s)).find(visivel) }))
        .filter((p) => p.el);
    if (!lista.length) return;

    const luz = h('div', { class: 'tour-luz', 'aria-hidden': 'true' });
    const titulo = h('h2', { class: 'tour-titulo', id: 'tour-titulo' });
    const texto = h('p', { class: 'tour-texto', id: 'tour-texto' });
    const pontos = h('div', { class: 'tour-pontos', 'aria-hidden': 'true' }, lista.map(() => h('span')));
    const contagem = h('span', { class: 'sr-only' });
    const proximo = h('button', { type: 'button', class: 'botao-principal tour-proximo' });
    const pular = h('button', { type: 'button', class: 'botao-texto tour-pular' }, 'Pular');
    const balao = h('div', { class: 'tour-balao', role: 'group', 'aria-labelledby': 'tour-titulo', 'aria-describedby': 'tour-texto' },
        contagem, titulo, texto, h('div', { class: 'tour-rodape' }, pontos, pular, proximo));
    const dialogo = h('dialog', { class: 'tour', 'aria-label': 'Como usar o app' }, luz, balao);
    document.body.append(dialogo);

    let i = 0;
    let terminou = false;
    const sair = () => {
        if (terminou) return;
        terminou = true;
        removeEventListener('resize', posicionar);
        dialogo.classList.add('saindo');
        aoTerminarSaida(dialogo, () => { dialogo.close(); dialogo.remove(); });
    };

    function posicionar() {
        const passo = lista[i];
        const r = passo.el.getBoundingClientRect();
        const folga = 6;
        luz.style.setProperty('--x', `${r.left - folga}px`);
        luz.style.setProperty('--y', `${r.top - folga}px`);
        luz.style.setProperty('--w', `${r.width + folga * 2}px`);
        luz.style.setProperty('--h', `${r.height + folga * 2}px`);
        // O balão vai do lado que tem mais espaço e NUNCA sai da tela: se o
        // alvo ocupa quase tudo, o balão fica por cima dele, preso na borda
        const largura = Math.min(340, innerWidth - 32);
        const x = Math.max(16, Math.min(innerWidth - largura - 16, r.left + r.width / 2 - largura / 2));
        balao.style.width = `${largura}px`;
        balao.style.left = `${x}px`;
        const alto = balao.offsetHeight;
        const margem = 16;
        const espacoAcima = r.top - margem;
        const espacoAbaixo = innerHeight - r.bottom - margem;
        const embaixo = espacoAbaixo >= espacoAcima;
        let y = embaixo ? r.bottom + margem : r.top - margem - alto;
        y = Math.max(margem + seguro('top'), Math.min(innerHeight - alto - margem - seguro('bottom'), y));
        balao.style.top = `${y}px`;
        balao.style.bottom = 'auto';
        balao.dataset.lado = embaixo ? 'baixo' : 'cima';
    }

    function ir(n) {
        i = n;
        const passo = lista[i];
        if (passo.rolar) {
            // Rola com a página destravada por um instante, e trava de novo
            document.documentElement.style.overflow = '';
            passo.el.scrollIntoView({ block: 'center', behavior: reduzir() ? 'auto' : 'smooth' });
            setTimeout(() => { document.documentElement.style.overflow = 'hidden'; }, reduzir() ? 0 : 500);
        }
        titulo.textContent = passo.titulo;
        texto.textContent = passo.texto;
        contagem.textContent = `Passo ${i + 1} de ${lista.length}. `;
        proximo.textContent = i === lista.length - 1 ? 'Entendi' : 'Próximo';
        [...pontos.children].forEach((p, k) => p.classList.toggle('atual', k === i));
        balao.classList.remove('troca');
        void balao.offsetWidth; // reinicia a animação do texto
        balao.classList.add('troca');
        // Depois de rolar, mede de novo (a rolagem suave leva um instante)
        posicionar();
        if (passo.rolar) setTimeout(posicionar, reduzir() ? 0 : 450);
        proximo.focus({ focusVisible: false });
    }

    proximo.addEventListener('click', () => (i < lista.length - 1 ? ir(i + 1) : sair()));
    pular.addEventListener('click', () => sair());
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); sair(); });
    dialogo.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' && i < lista.length - 1) ir(i + 1);
        if (e.key === 'ArrowLeft' && i > 0) ir(i - 1);
    });
    addEventListener('resize', posicionar);

    // A página não rola por baixo do tour (no iPhone o dedo arrastava o fundo
    // e o alvo fugia da luz); se rolar mesmo assim, a luz acompanha
    const travaAntes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    addEventListener('scroll', posicionar, { passive: true, capture: true });
    dialogo.addEventListener('close', () => {
        document.documentElement.style.overflow = travaAntes;
        removeEventListener('scroll', posicionar, { capture: true });
    });

    dialogo.showModal();
    ir(0);
}

// Área segura do iPhone (entalhe e barra de gestos)
function seguro(lado) {
    const sonda = document.createElement('div');
    sonda.style.cssText = `position:fixed;${lado}:0;height:env(safe-area-inset-${lado});visibility:hidden`;
    document.body.append(sonda);
    const px = sonda.offsetHeight;
    sonda.remove();
    return px;
}
