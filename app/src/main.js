// Ponto de entrada. Decide qual tela mostrar a partir de 2 perguntas:
//   1. Tem alguém logado?           (sessão do Supabase Auth)
//   2. Em que estado está a conta?  (tabela conta: pendente, ativa...)
//
// Não há "roteador" de verdade: o app tem poucas telas e o estado da conta
// manda mais do que a URL. O hash só escolhe entre telas do mesmo "andar":
//   deslogado: #/pedir-acesso ou a tela de entrar
//   conta pronta: #/equipe ou a escala (barra de abas embaixo)
import './estilo/tokens.css';
import './estilo/base.css';
import './estilo/componentes.css';
import './estilo/telas.css';
import './estilo/equipe.css';
import './estilo/montar.css';

import { supabase } from './supabase.js';
import { carregarConta } from './sessao.js';
import { telaEntrar } from './telas/entrar.js';
import { telaPedirAcesso } from './telas/pedir-acesso.js';
import { telaAguardando } from './telas/aguardando.js';
import { telaTrocarSenha } from './telas/trocar-senha.js';
import { telaEscala } from './telas/escala.js';
import { telaEquipe } from './telas/equipe/index.js';
import { telaMontar } from './telas/montar/index.js';
import { eLiderDeLouvor } from './sessao.js';
import { telaErro } from './telas/erro.js';
import { telaInstalar } from './telas/instalar.js';
import { precisaInstalar, registrarServiceWorker } from './pwa.js';
import { apagarCopiasLocais } from './offline.js';

const raiz = document.getElementById('app');
let rodada = 0;          // descarta resultados de decisões antigas que chegarem atrasadas
let usuarioAtual;        // undefined = ainda não decidiu nenhuma vez
let contaPronta = null;  // conta ativa e sem senha temporária: pode navegar pelas abas

// Montar escala é só do líder de louvor; para os outros cai na escala
const ROTAS_DA_CONTA = {
    '#/equipe': telaEquipe,
    '#/montar': (conta) => (eLiderDeLouvor(conta) ? telaMontar(conta) : telaEscala(conta)),
};
const telaDaConta = (conta) => (ROTAS_DA_CONTA[location.hash] ?? telaEscala)(conta);

async function decidirTela() {
    const minhaRodada = ++rodada;

    // No celular o Hub só roda instalado (D-PWA). A instalação vem ANTES do
    // login: no iPhone o app da tela de início não enxerga a sessão do Safari,
    // então quem entrasse pelo Safari cairia deslogado ao abrir o ícone.
    if (precisaInstalar()) {
        mostrar(telaInstalar());
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    usuarioAtual = session?.user.id ?? null;

    let tela;
    contaPronta = null;
    if (!session) {
        tela = location.hash === '#/pedir-acesso' ? telaPedirAcesso() : telaEntrar();
    } else {
        // Logado: o #/pedir-acesso não faz mais sentido (e voltaria ao sair)
        if (location.hash && !ROTAS_DA_CONTA[location.hash]) history.replaceState(null, '', location.pathname);
        const { conta, erro } = await carregarConta(session.user.id);
        if (erro) tela = telaErro(erro, decidirTela);
        // pendente, recusada ou desativada: a tela explica cada caso
        else if (conta.estado !== 'ativa') tela = telaAguardando(conta, decidirTela);
        else if (conta.senha_temporaria) tela = telaTrocarSenha(conta);
        else {
            contaPronta = conta;
            tela = telaDaConta(conta);
        }
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
    if (evento === 'SIGNED_OUT') apagarCopiasLocais();
    if (usuarioAtual === undefined) return; // a primeira decisão ainda está rodando
    const mudouQuem = (sessao?.user.id ?? null) !== usuarioAtual;
    if (evento === 'USER_UPDATED' || evento === 'SIGNED_OUT' || mudouQuem) {
        setTimeout(decidirTela, 0);
    }
});

window.addEventListener('hashchange', () => {
    // Trocar de aba não precisa buscar a conta de novo. Âncoras dentro da
    // tela (#culto-...) não são rotas: deixa o navegador só rolar até elas.
    const eRota = location.hash === '' || location.hash.startsWith('#/');
    if (contaPronta) { if (eRota) mostrar(telaDaConta(contaPronta)); }
    else if (!usuarioAtual) decidirTela();
});

registrarServiceWorker();
decidirTela();
