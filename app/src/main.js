// Ponto de entrada. Decide qual tela mostrar a partir de 2 perguntas:
//   1. Tem alguém logado?           (sessão do Supabase Auth)
//   2. Em que estado está a conta?  (tabela conta: pendente, ativa...)
//
// Não há "roteador" de verdade: o app tem poucas telas e o estado da conta
// manda mais do que a URL. O hash (#/pedir-acesso) só escolhe entre as telas
// de quem ainda não entrou. Quando o app crescer (escala do líder, admin),
// aí sim vale um roteador pequeno.
import './estilo/tokens.css';
import './estilo/base.css';
import './estilo/componentes.css';
import './estilo/telas.css';

import { supabase } from './supabase.js';
import { carregarConta } from './sessao.js';
import { telaEntrar } from './telas/entrar.js';
import { telaPedirAcesso } from './telas/pedir-acesso.js';
import { telaAguardando } from './telas/aguardando.js';
import { telaTrocarSenha } from './telas/trocar-senha.js';
import { telaEscala } from './telas/escala.js';
import { telaErro } from './telas/erro.js';

const raiz = document.getElementById('app');
let rodada = 0;          // descarta resultados de decisões antigas que chegarem atrasadas
let usuarioAtual;        // undefined = ainda não decidiu nenhuma vez

async function decidirTela() {
    const minhaRodada = ++rodada;
    const { data: { session } } = await supabase.auth.getSession();
    usuarioAtual = session?.user.id ?? null;

    let tela;
    if (!session) {
        tela = location.hash === '#/pedir-acesso' ? telaPedirAcesso() : telaEntrar();
    } else {
        // Logado: o #/pedir-acesso não faz mais sentido (e voltaria ao sair)
        if (location.hash) history.replaceState(null, '', location.pathname);
        const { conta, erro } = await carregarConta(session.user.id);
        if (erro) tela = telaErro(erro, decidirTela);
        // pendente, recusada ou desativada: a tela explica cada caso
        else if (conta.estado !== 'ativa') tela = telaAguardando(conta, decidirTela);
        else if (conta.senha_temporaria) tela = telaTrocarSenha(conta);
        else tela = telaEscala(conta);
    }

    if (minhaRodada !== rodada) return; // outra decisão mais nova já começou
    mostrar(tela);
}

// Troca a tela com a View Transitions API quando existe (Chrome, Safari 18+):
// o navegador faz o cruzamento suave entre a tela velha e a nova.
function mostrar(tela) {
    const trocar = () => {
        raiz.replaceChildren(tela);
        // Leitor de tela: anuncia a tela nova lendo o título dela
        tela.querySelector('h1')?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
    };
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !semMovimento && raiz.firstElementChild?.matches('.tela')) {
        document.startViewTransition(trocar);
    } else {
        trocar();
    }
}

// Reage a login, logout e troca de senha.
// Atenção: não chamar o Supabase DENTRO deste callback (com await) — o
// supabase-js segura um "cadeado" da sessão enquanto ele roda e a chamada
// ficaria esperando para sempre. Por isso o setTimeout joga para depois.
supabase.auth.onAuthStateChange((evento, sessao) => {
    if (usuarioAtual === undefined) return; // a primeira decisão ainda está rodando
    const mudouQuem = (sessao?.user.id ?? null) !== usuarioAtual;
    if (evento === 'USER_UPDATED' || evento === 'SIGNED_OUT' || mudouQuem) {
        setTimeout(decidirTela, 0);
    }
});

window.addEventListener('hashchange', () => {
    if (!usuarioAtual) decidirTela();
});

decidirTela();
