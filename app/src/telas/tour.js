// Boas-vindas e tour (D69).
//
// Na primeira vez que uma conta aprovada abre o Início: um cartão de
// boas-vindas ("Mostrar" ou "Agora não") e, se a pessoa quiser, um tour de
// poucos passos que acende uma parte da tela de cada vez (a luz desliza de
// um ponto ao outro). No fim, se ainda não tem, pergunta o aniversário.
//
// Sem forçar: dá para pular a qualquer momento (botão, Esc ou tocar fora),
// e ele não volta sozinho. Quem quiser rever acha em Você > Como usar o app.
//
// Por que um <dialog>? Ele já prende o foco, deixa o resto da tela inerte
// para o leitor de tela e fecha no Esc, sem a gente reinventar nada disso.
import { h, icone, comCarregando } from '../util/dom.js';
import { avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { camposAniversario, salvarAniversario } from './aniversarios.js';

const chaveVisto = (conta) => `iejb-tour-visto-${conta.id}`;
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
    depois.addEventListener('click', () => fechar(() => perguntarAniversario(conta)));
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
        { alvo: aba('#/inicio'), titulo: 'Início', texto: serve ? 'O que importa hoje: sua próxima escala, os avisos e os aniversários.' : 'O que importa hoje: os avisos da igreja e os aniversários.' },
        { alvo: ['.mural-secao:not([hidden])'], titulo: 'Mural', texto: 'Avisos e fotos da igreja. Gostou? Toque em Amém ou no coração.', rolar: true },
        { alvo: aba('#/agenda'), titulo: 'Agenda', texto: serve ? 'Seus próximos cultos e os eventos da igreja.' : 'Os eventos da igreja.' },
        { alvo: aba('#/ministerios'), titulo: 'Ministérios', texto: serve ? 'A casa de cada ministério: escala, repertórios e equipe.' : 'Os ministérios da igreja.' },
        { alvo: aba('#/voce'), titulo: 'Você', texto: 'Seus dados, seu aniversário e os pedidos de oração.' },
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
    const sair = (completo) => {
        if (terminou) return;
        terminou = true;
        removeEventListener('resize', posicionar);
        dialogo.classList.add('saindo');
        aoTerminarSaida(dialogo, () => {
            dialogo.close(); dialogo.remove();
            if (completo) perguntarAniversario(conta);
        });
    };

    function posicionar() {
        const passo = lista[i];
        const r = passo.el.getBoundingClientRect();
        const folga = 6;
        luz.style.setProperty('--x', `${r.left - folga}px`);
        luz.style.setProperty('--y', `${r.top - folga}px`);
        luz.style.setProperty('--w', `${r.width + folga * 2}px`);
        luz.style.setProperty('--h', `${r.height + folga * 2}px`);
        // O balão vai do lado que tem mais espaço (em cima das abas, embaixo
        // de coisas do topo), sem sair da tela
        const embaixo = r.top + r.height / 2 < innerHeight / 2;
        const largura = Math.min(340, innerWidth - 32);
        const x = Math.max(16, Math.min(innerWidth - largura - 16, r.left + r.width / 2 - largura / 2));
        balao.style.width = `${largura}px`;
        balao.style.left = `${x}px`;
        balao.style.top = embaixo ? `${Math.min(r.bottom + 16, innerHeight - 200)}px` : 'auto';
        balao.style.bottom = embaixo ? 'auto' : `${Math.max(innerHeight - r.top + 16, 16)}px`;
        balao.dataset.lado = embaixo ? 'baixo' : 'cima';
    }

    function ir(n) {
        i = n;
        const passo = lista[i];
        if (passo.rolar) passo.el.scrollIntoView({ block: 'center', behavior: reduzir() ? 'auto' : 'smooth' });
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

    proximo.addEventListener('click', () => (i < lista.length - 1 ? ir(i + 1) : sair(true)));
    pular.addEventListener('click', () => sair(false));
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); sair(false); });
    dialogo.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' && i < lista.length - 1) ir(i + 1);
        if (e.key === 'ArrowLeft' && i > 0) ir(i - 1);
    });
    addEventListener('resize', posicionar);

    dialogo.showModal();
    ir(0);
}

// --- Por último: o aniversário (se ainda não tem) -------------------------------
function perguntarAniversario(conta) {
    if (!conta.pessoa || conta.pessoa.aniversario_dia) return;
    const campos = camposAniversario(conta.pessoa);
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar');
    const pular = h('button', { type: 'button', class: 'botao-texto' }, 'Pular');
    const erro = h('p', { class: 'campo-erro', role: 'alert', hidden: true });
    const form = h('form', { class: 'boas-vindas-form', method: 'dialog', novalidate: true },
        icone('presente', 'icone boas-vindas-presente'),
        h('h2', { id: 'bv-aniv', class: 'boas-vindas-titulo' }, 'Quando é seu aniversário?'),
        h('p', { class: 'boas-vindas-texto' }, 'A igreja fica sabendo um dia antes. Não precisa dizer o ano.'),
        campos.elemento, erro,
        h('div', { class: 'boas-vindas-acoes' }, salvar, pular));
    const dialogo = h('dialog', { class: 'boas-vindas', 'aria-labelledby': 'bv-aniv' }, form);
    document.body.append(dialogo);
    const fechar = () => { dialogo.close(); dialogo.remove(); };
    pular.addEventListener('click', fechar);
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const valor = campos.valor();
        if (!valor) { erro.hidden = false; erro.textContent = 'Escolha o dia e o mês, ou toque em Pular.'; return; }
        comCarregando(salvar, async () => {
            const { error } = await salvarAniversario(valor);
            if (error) { erro.hidden = false; erro.textContent = mensagemDoBanco(error); return; }
            conta.pessoa.aniversario_dia = valor.dia;
            conta.pessoa.aniversario_mes = valor.mes;
            fechar();
            avisar('Aniversário salvo. Tudo pronto!');
        });
    });
    dialogo.showModal();
}
