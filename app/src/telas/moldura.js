// Peças de layout repetidas entre as telas.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { eLiderDeLouvor, veFinanceiro, cuidaDosEventos, temCargo } from '../sessao.js';
import { avatar } from '../util/foto.js';
import { removerAparelho } from '../util/push.js';
import { googleAtivo, entrarComGoogle } from '../util/google.js';

// Telas de quem ainda não entrou (ou está esperando aprovação):
// fundo vinho com brilho e um cartão de vidro no meio.
export function molduraEntrada({ titulo, subtitulo, conteudo, rodape }) {
    return h('div', { class: 'tela tela-entrada' },
        h('main', { id: 'conteudo', class: 'entrada-palco' },
            h('div', { class: 'entrada-marca' },
                h('img', { src: '/logo-iejb-pequeno.png', alt: '', width: 64, height: 64 }),
                h('p', { class: 'entrada-marca-nome' }, 'IEJB ', h('span', null, 'Hub')),
            ),
            h('section', { class: 'entrada-cartao', 'aria-labelledby': 'titulo-tela' },
                h('h1', { id: 'titulo-tela', tabindex: -1 }, titulo),
                subtitulo && h('p', { class: 'entrada-subtitulo' }, subtitulo),
                conteudo,
            ),
            rodape && h('p', { class: 'entrada-rodape' }, rodape),
            h('nav', { class: 'entrada-docs', 'aria-label': 'Documentos' },
                h('a', { href: '#/privacidade' }, 'Privacidade'), h('span', { 'aria-hidden': 'true' }, '·'),
                h('a', { href: '#/termos' }, 'Termos de uso')),
        ),
    );
}

// Primeiro desliga o push deste aparelho (ainda logado, o banco deixa apagar)
// O papel mais importante, para mostrar embaixo do nome
export function papelPrincipal(conta) {
    if (conta.e_administrador) return 'Administrador';
    if (temCargo(conta, 'pastor')) return 'Pastor';
    if (eLiderDeLouvor(conta)) return 'Líder de louvor';
    if (temCargo(conta, 'tesouraria')) return 'Tesouraria';
    if (temCargo(conta, 'comunicacao')) return 'Comunicação';
    return 'Membro';
}

export async function sair() { await removerAparelho(); supabase.auth.signOut(); }

// Pedidos de acesso esperando o admin. A barra de abas e a barra lateral
// mostram o mesmo número: guarda a resposta por 30 s para não perguntar duas vezes.
let pedidosGuardados = null;
function contarPedidos() {
    if (!pedidosGuardados) {
        pedidosGuardados = supabase.from('conta').select('id', { count: 'exact', head: true }).eq('estado', 'pendente')
            .then(({ count }) => count ?? 0, () => 0);
        setTimeout(() => { pedidosGuardados = null; }, 30_000);
    }
    return pedidosGuardados;
}
export function contadorDePedidos(lugar, classe) {
    contarPedidos().then((n) => {
        if (n) lugar.append(h('span', { class: classe }, String(n), h('span', { class: 'sr-only' }, n === 1 ? ' pedido de acesso' : ' pedidos de acesso')));
    });
}

// Barra lateral do computador (telas de 1024 px ou mais). No celular ela fica
// escondida pelo CSS e quem navega são a cápsula de cima + as abas de baixo;
// no computador é o contrário. Mostra todos os módulos de uma vez, porque
// numa tela larga sobra espaço e trocar de área fica a um clique.
// A pílula do item atual tem view-transition-name: ao trocar de tela, o
// navegador a desliza do item velho até o novo.
let lateralJaApareceu = false;
export function barraLateral(conta, atual) {
    const classe = lateralJaApareceu ? 'lateral' : 'lateral chegando';
    lateralJaApareceu = true;
    const item = (rota, nome, nomeIcone) => {
        const ativo = atual === rota;
        return h('a', { class: 'lateral-item', href: rota, 'aria-current': ativo ? 'page' : null },
            ativo ? h('span', { class: 'lateral-pilula', 'aria-hidden': 'true' }) : null,
            icone(nomeIcone), h('span', { class: 'lateral-nome' }, nome));
    };
    const equipe = item('#/equipe', 'Equipe', 'pessoas');
    const pessoas = conta.e_administrador ? item('#/pessoas', 'Pessoas', 'chave') : null;
    if (pessoas) contadorDePedidos(pessoas, 'lateral-contador');
    const areas = [
        pessoas,
        cuidaDosEventos(conta) ? item('#/eventos', 'Eventos do site', 'megafone') : null,
        veFinanceiro(conta) ? item('#/financeiro', 'Financeiro', 'moeda') : null,
    ].filter(Boolean);
    const pessoa = conta.pessoa ?? { nome: conta.nome_informado };

    return h('aside', { class: classe },
        h('a', { class: 'lateral-marca', href: '#/inicio', 'aria-label': 'IEJB Hub, ir para o Início' },
            h('img', { src: '/logo-iejb-pequeno.png', alt: '', width: 32, height: 32 }),
            h('span', { class: 'cabecalho-nome' }, 'IEJB ', h('span', null, 'Hub'))),
        h('nav', { class: 'lateral-nav', 'aria-label': 'Menu principal' },
            item('#/inicio', 'Início', 'casa'),
            h('p', { class: 'lateral-grupo', 'aria-hidden': 'true' }, 'Louvor'),
            h('ul', { 'aria-label': 'Louvor' },
                [item('#/escala', 'Escala', 'calendario'),
                    eLiderDeLouvor(conta) ? item('#/montar', 'Montar escala', 'montar') : null,
                    item('#/repertorios', 'Repertórios', 'musica'),
                    equipe].filter(Boolean).map((a) => h('li', null, a))),
            areas.length ? h('p', { class: 'lateral-grupo', 'aria-hidden': 'true' }, 'Áreas') : null,
            areas.length ? h('ul', { 'aria-label': 'Áreas' }, areas.map((a) => h('li', null, a))) : null),
        // A conta leva à tela Você (onde mora o Sair, no fim)
        h('a', { class: 'lateral-conta', href: '#/voce', 'aria-current': atual === '#/voce' ? 'page' : null },
            avatar(pessoa, 'pessoa-avatar lateral-avatar'),
            h('span', { class: 'lateral-quem' },
                h('span', { class: 'lateral-quem-nome' }, pessoa.apelido || pessoa.nome || 'Você'),
                h('span', { class: 'lateral-quem-papel' }, papelPrincipal(conta))),
            icone('seta', 'icone icone-p lateral-conta-seta')),
        h('nav', { class: 'lateral-links', 'aria-label': 'Documentos' },
            h('a', { href: '#/privacidade' }, 'Privacidade'), h('span', { 'aria-hidden': 'true' }, '·'),
            h('a', { href: '#/termos' }, 'Termos de uso')),
    );
}

// Cabeçalho das telas de dentro do app (redesign, etapa 2).
// Simples e baixo: à esquerda a marca (ou "‹ Voltar" dentro de uma área que
// não é aba, como Financeiro e Eventos); à direita o avatar, que leva à tela
// Você. O Sair e o selo "Admin" saíram daqui: o Sair mora no fim da tela Você
// e o admin se diferencia pelo que vê (avisos no Início, número no avatar).
const AREAS_DA_VOCE = new Set(['Privacidade', 'Termos']);
export function cabecalhoApp(conta, opcoes = {}) {
    // As telas do Louvor são abas: mostram a marca, não um "voltar"
    const area = opcoes.modulo && opcoes.modulo !== 'Louvor' ? opcoes.modulo : null;
    const [destino, rotulo] = AREAS_DA_VOCE.has(area) ? ['#/voce', 'Você'] : ['#/inicio', 'Início'];
    const esquerda = area
        ? h('div', { class: 'cabecalho-marca cabecalho-modulo' },
            h('a', { class: 'botao-voltar', href: destino, 'aria-label': `Voltar para ${rotulo}` }, icone('seta', 'icone icone-p seta-esquerda'), h('span', null, rotulo)),
            h('span', { class: 'cabecalho-titulo-modulo' }, area))
        : h('a', { class: 'cabecalho-marca', href: '#/inicio', 'aria-label': 'IEJB Hub, ir para o Início' },
            h('img', { src: '/logo-iejb-pequeno.png', alt: '', width: 32, height: 32 }),
            h('span', { class: 'cabecalho-nome' }, 'IEJB ', h('span', null, 'Hub')));
    const pessoa = conta.pessoa ?? { nome: conta.nome_informado };
    const eu = h('a', { class: 'cabecalho-conta', href: '#/voce', 'aria-label': 'Você: sua conta' },
        avatar(pessoa, 'pessoa-avatar cabecalho-avatar'));
    if (conta.e_administrador) contadorDePedidos(eu, 'cabecalho-contador');
    return h('header', { class: 'cabecalho' }, esquerda, eu);
}

// Barra de abas (redesign, etapa 2): a mesma em TODAS as telas de quem já
// entrou, como num app do iPhone. Cinco abas fixas, iguais para todo mundo,
// para a barra não mudar de forma conforme o papel. O que depende de papel
// fica fora dela: "Montar" é um seletor dentro da Escala (só para o líder,
// RN-02) e as áreas (Pessoas, Financeiro, Eventos) abrem pelo Início e pela
// tela Você. main.js coloca a barra; as telas não precisam chamar.
const ABA_DA_ROTA = {
    '#/montar': '#/escala',
    '#/eventos': '#/inicio', '#/financeiro': '#/inicio', '#/pessoas': '#/inicio',
    '#/privacidade': '#/voce', '#/termos': '#/voce',
};
export function barraAbas(conta, rota) {
    const atual = ABA_DA_ROTA[rota] ?? rota;
    const aba = (destino, nome, nomeIcone) => h('a', {
        class: 'aba', href: destino,
        'aria-current': atual === destino ? 'page' : null,
    }, icone(nomeIcone), h('span', { class: 'aba-nome' }, nome));

    const voce = aba('#/voce', 'Você', 'pessoa');
    if (conta.e_administrador) contadorDePedidos(voce, 'aba-contador');
    return h('nav', { class: 'barra-abas', 'aria-label': 'Menu principal' },
        aba('#/inicio', 'Início', 'casa'),
        aba('#/escala', 'Escala', 'calendario'),
        aba('#/repertorios', 'Repertórios', 'musica'),
        aba('#/equipe', 'Equipe', 'pessoas'),
        voce,
    );
}

// "Ver escala | Montar" no topo da Escala e do Montar, só para o líder de
// louvor (RN-02). São links (cada lado é uma rota), com a mesma pílula
// deslizante dos segmentos da Equipe.
export function seletorEscala(conta, atual) {
    if (!eLiderDeLouvor(conta)) return null;
    const lado = (rota, nome) => h('a', { href: rota, 'aria-current': atual === rota ? 'page' : null }, nome);
    return h('nav', { class: 'segmentos segmentos-escala', 'aria-label': 'Escala',
        style: { '--n': 2, '--ativo': atual === '#/montar' ? 1 : 0 } },
    lado('#/escala', 'Ver escala'), lado('#/montar', 'Montar'));
}

export { iniciais, avatar } from '../util/foto.js';

// "Entrar com Google" + divisória "ou". Some se o Google não estiver ligado.
export function blocoGoogle(texto, aviso) {
    const botao = h('button', { type: 'button', class: 'botao-google botao-largo' },
        // Logo oficial do Google (arquivo do pacote de marca do "Sign in with
        // Google", em public/). Se o arquivo faltar, o botão fica só com o texto.
        h('img', { class: 'google-g', src: '/google-g.svg', alt: '', width: 20, height: 20,
            onerror: (e) => e.target.remove() }), texto);
    const bloco = h('div', { class: 'bloco-google', hidden: true }, botao, h('p', { class: 'divisoria' }, h('span', null, 'ou com e-mail')));
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        botao.classList.add('carregando');
        try {
            await entrarComGoogle(); // sai do app; volta logado
        } catch (erro) {
            console.error(erro);
            aviso?.mostrar('Não deu para abrir o Google. Tente de novo.');
            botao.disabled = false;
            botao.classList.remove('carregando');
        }
    });
    googleAtivo().then((ativo) => { bloco.hidden = !ativo; });
    return bloco;
}

// Campo de formulário com rótulo de verdade (acessível e com área de toque boa)
export function campo({ rotulo, nome, tipo = 'text', autocomplete, dica, ...resto }) {
    const id = `campo-${nome}`;
    const idDica = dica ? `${id}-dica` : null;
    return h('div', { class: 'campo' },
        h('label', { for: id }, rotulo),
        h('input', {
            id, name: nome, type: tipo, autocomplete, required: true,
            'aria-describedby': idDica, ...resto, // resto pode trocar o required
        }),
        dica && h('p', { class: 'campo-dica', id: idDica }, dica),
    );
}

// Caixa de mensagem que já existe (vazia) antes de receber texto: é o que faz
// o leitor de tela anunciar o erro quando ele aparece.
export function caixaDeAviso() {
    const caixa = h('p', { class: 'aviso-form', role: 'alert' });
    return {
        elemento: caixa,
        mostrar(texto, tipo = 'erro') {
            caixa.dataset.tipo = tipo;
            caixa.textContent = texto;
        },
        limpar() { caixa.textContent = ''; },
    };
}
