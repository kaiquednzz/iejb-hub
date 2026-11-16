// Peças de layout repetidas entre as telas.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { eLiderDeLouvor, veFinanceiro, cuidaDosEventos } from '../sessao.js';
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

// Cabeçalho de vidro das telas de dentro do app
// Dentro de um módulo (opcoes.modulo = 'Louvor', 'Eventos do site'...), a
// marca dá lugar a "‹ Início" + o nome do módulo: a pessoa sempre sabe onde
// está e como voltar. No Início, aparece a marca do Hub.
// Primeiro desliga o push deste aparelho (ainda logado, o banco deixa apagar)
async function sair() { await removerAparelho(); supabase.auth.signOut(); }

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
function contadorDePedidos(lugar, classe) {
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
    if (conta.e_administrador) contadorDePedidos(equipe, 'lateral-contador');
    const areas = [
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
        h('div', { class: 'lateral-conta' },
            avatar(pessoa, 'pessoa-avatar lateral-avatar'),
            h('span', { class: 'lateral-quem' },
                h('span', { class: 'lateral-quem-nome' }, pessoa.apelido || pessoa.nome || 'Você'),
                h('span', { class: 'lateral-quem-papel' }, conta.e_administrador ? 'Administrador' : 'Membro')),
            h('button', { type: 'button', class: 'botao-icone', 'aria-label': 'Sair da conta', onclick: sair }, icone('sair'))),
        h('nav', { class: 'lateral-links', 'aria-label': 'Documentos' },
            h('a', { href: '#/privacidade' }, 'Privacidade'), h('span', { 'aria-hidden': 'true' }, '·'),
            h('a', { href: '#/termos' }, 'Termos de uso')),
    );
}

export function cabecalhoApp(conta, opcoes = {}) {
    const botaoSair = h('button', {
        type: 'button', class: 'botao-icone', 'aria-label': 'Sair da conta', onclick: sair,
    }, icone('sair'));

    const marca = opcoes.modulo
        ? h('div', { class: 'cabecalho-marca cabecalho-modulo' },
            h('a', { class: 'botao-voltar', href: '#/inicio', 'aria-label': 'Voltar ao Início' }, icone('seta', 'icone icone-p seta-esquerda'), h('span', null, 'Início')),
            h('span', { class: 'cabecalho-titulo-modulo' }, opcoes.modulo))
        : h('div', { class: 'cabecalho-marca' },
            h('img', { src: '/logo-iejb-pequeno.png', alt: '', width: 32, height: 32 }),
            h('span', { class: 'cabecalho-nome' }, 'IEJB ', h('span', null, 'Hub')));
    return h('header', { class: 'cabecalho' },
        marca,
        h('div', { class: 'cabecalho-acoes' },
            conta.e_administrador && h('span', { class: 'selo' }, 'Admin'),
            botaoSair,
        ),
    );
}

// Abas do módulo Louvor, fixas embaixo (Escala | Montar | Repertórios | Equipe),
// como num app do iPhone. "Montar" só aparece para o líder de louvor (RN-02).
// Os outros módulos (Eventos...) abrem pelo Início e não têm abas.
// O número vermelho em "Equipe" mostra pedidos de acesso esperando o admin.
export function barraAbas(conta, atual) {
    const aba = (rota, nome, nomeIcone) => h('a', {
        class: 'aba', href: rota,
        'aria-current': atual === rota ? 'page' : null,
    }, icone(nomeIcone), h('span', null, nome));

    const equipe = aba('#/equipe', 'Equipe', 'pessoas');
    const montar = eLiderDeLouvor(conta) ? aba('#/montar', 'Montar', 'montar') : null;
    const barra = h('nav', { class: 'barra-abas', 'aria-label': 'Seções' },
        aba('#/escala', 'Escala', 'calendario'),
        montar,
        aba('#/repertorios', 'Repertórios', 'musica'),
        equipe,
    );

    if (conta.e_administrador) contadorDePedidos(equipe, 'aba-contador');
    return barra;
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
