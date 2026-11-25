// Peças de layout repetidas entre as telas.
import { acenderNoAvatar } from '../util/chama.js';
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { eLiderDeLouvor, veFinanceiro, cuidaDosEventos, temCargo, ePastor } from '../sessao.js';
import { nomeDoTitulo } from '../util/titulos.js';
import { avatar } from '../util/foto.js';
import { removerAparelho } from '../util/push.js';
import { googleAtivo, entrarComGoogle } from '../util/google.js';

// Telas de quem ainda não entrou (ou está esperando aprovação):
// fundo vinho com brilho e um cartão de vidro no meio.
export function molduraEntrada({ titulo, subtitulo, conteudo, rodape }) {
    return h('div', { class: 'tela tela-entrada' },
        h('main', { id: 'conteudo', class: 'entrada-palco' },
            h('div', { class: 'entrada-marca' },
                h('img', { src: '/simbolo-fogo-iejb.png', alt: '', width: 28, height: 55 }),
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
    const titulo = conta.pessoa?.titulo;
    if (titulo && titulo !== 'membro') return nomeDoTitulo(titulo);
    if (conta.e_administrador) return 'Administrador';
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
            h('img', { src: '/simbolo-fogo-iejb.png', alt: '', width: 14, height: 28 }),
            h('span', { class: 'cabecalho-nome' }, 'IEJB ', h('span', null, 'Hub'))),
        h('nav', { class: 'lateral-nav', 'aria-label': 'Menu principal' },
            item('#/inicio', 'Início', 'casa'),
            item('#/agenda', 'Agenda', 'calendario'),
            item('#/ministerios', 'Ministérios', 'igreja'),
            // No computador o cabeçalho some: a oração mora aqui (D69)
            item('#/oracao', 'Oração', 'maos'),
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
    // Áreas que não são aba (Louvor, Financeiro, Eventos, Pessoas) moram em
    // Ministérios e voltam para lá; Privacidade e Termos voltam para o Você.
    const area = opcoes.modulo ?? null;
    // Oração é da igreja toda (não de um ministério): volta para o Início.
    const [destino, rotulo] = AREAS_DA_VOCE.has(area) ? ['#/voce', 'Você']
        : area === 'Oração' ? ['#/inicio', 'Início'] : ['#/ministerios', 'Ministérios'];
    const esquerda = area
        ? h('div', { class: 'cabecalho-marca cabecalho-modulo' },
            h('a', { class: 'botao-voltar', href: destino, 'aria-label': `Voltar para ${rotulo}` }, icone('seta', 'icone icone-p seta-esquerda'), h('span', null, rotulo)))
        : h('a', { class: 'cabecalho-marca', href: '#/inicio', 'aria-label': 'IEJB Hub, ir para o Início' },
            h('img', { src: '/simbolo-fogo-iejb.png', alt: '', width: 14, height: 28 }),
            h('span', { class: 'cabecalho-nome' }, 'IEJB ', h('span', null, 'Hub')));
    // Título compacto: aparece no meio quando o título grande da tela sai de
    // vista ao rolar (main.js liga isso). Nas áreas começa com o nome da área.
    const compacto = h('span', { class: 'cabecalho-compacto', 'aria-hidden': 'true' }, area ?? '');
    const pessoa = conta.pessoa ?? { nome: conta.nome_informado };
    const eu = h('a', { class: 'cabecalho-conta', href: '#/voce', 'aria-label': 'Você: sua conta' },
        avatar(pessoa, 'pessoa-avatar cabecalho-avatar'));
    acenderNoAvatar(eu); // a chama acende na semana em que a pessoa toca
    // Pedir oração (D69): discreto, ao lado do avatar, em toda tela. O pastor
    // com pedido esperando vê um pontinho.
    const oracao = area !== 'Oração' && h('a', { class: 'cabecalho-oracao', href: '#/oracao', 'aria-label': 'Pedidos de oração', title: 'Pedidos de oração' },
        icone('maos'));
    if (oracao && ePastor(conta)) marcarPedidosDeOracao(oracao);
    return h('header', { class: `cabecalho${area ? ' com-area' : ''}` }, esquerda, compacto,
        h('div', { class: 'cabecalho-direita' }, oracao, eu));
}

// Barra de abas (redesign v2): as abas são da PESSOA, não de um ministério.
// Início (hoje), Agenda (tudo que é meu), Ministérios (a casa de cada
// ministério e as áreas da igreja) e Você. Assim o Hub cresce (Kids,
// Pregações) sem a barra mudar. Iguais para todo mundo. main.js coloca a
// barra; as telas não precisam chamar.
const ABA_DA_ROTA = {
    '#/escala': '#/ministerios', '#/montar': '#/ministerios', '#/repertorios': '#/ministerios', '#/equipe': '#/ministerios',
    '#/eventos': '#/ministerios', '#/financeiro': '#/ministerios', '#/pessoas': '#/ministerios',
    '#/privacidade': '#/voce', '#/termos': '#/voce', '#/oracao': '#/inicio',
};
export function barraAbas(conta, rota) {
    const atual = ABA_DA_ROTA[rota] ?? (rota.startsWith('#/ministerio/') ? '#/ministerios' : rota);
    const aba = (destino, nome, nomeIcone) => {
        const ativa = atual === destino;
        return h('a', { class: 'aba', href: destino, 'aria-current': ativa ? 'page' : null },
            // A "gota" atrás do ícone da aba atual desliza entre as abas na
            // troca de tela (view-transition-name em sistema.css)
            ativa ? h('span', { class: 'aba-gota', 'aria-hidden': 'true' }) : null,
            icone(nomeIcone), h('span', { class: 'aba-nome' }, nome));
    };
    const ministerios = aba('#/ministerios', 'Ministérios', 'igreja');
    if (conta.e_administrador) contadorDePedidos(ministerios, 'aba-contador');
    return h('nav', { class: 'barra-abas', 'aria-label': 'Menu principal' },
        // Fundo separado dos ícones: na troca de tela a "gota" passa ENTRE os
        // dois (fundo embaixo, gota no meio, ícones por cima). Ver sistema.css.
        h('span', { class: 'barra-fundo', 'aria-hidden': 'true' }),
        aba('#/inicio', 'Início', 'casa'),
        aba('#/agenda', 'Agenda', 'calendario'),
        ministerios,
        aba('#/voce', 'Você', 'pessoa'),
    );
}

// Navegação da casa do Louvor: Escala, Montar (só o líder, RN-02),
// Repertórios e Equipe. Abas de texto com traço embaixo, no estilo editorial
// (diferente da barra de baixo, que é do app inteiro).
const NOME_DA_ABA = { '#/escala': 'Escala', '#/montar': 'Montar escala', '#/repertorios': 'Repertórios', '#/equipe': 'Equipe' };
export function navLouvor(conta, atual, ...acoes) {
    const lado = (rota, nome) => h('a', { href: rota, 'aria-current': atual === rota ? 'page' : null }, nome);
    return h('div', { class: 'casa-topo' },
        h('div', { class: 'casa-linha' },
            h('div', null,
                h('p', { class: 'casa-ministerio' }, 'Ministério de'),
                // O h1 da tela é o nome do ministério; o leitor de tela ouve
                // também em qual parte está ("Louvor, Repertórios")
                h('h1', { class: 'casa-nome', tabindex: -1 }, 'Louvor', h('span', { class: 'sr-only' }, `, ${NOME_DA_ABA[atual]}`))),
            acoes.length ? h('div', { class: 'casa-acoes' }, acoes) : null),
        h('nav', { class: 'subnav', 'aria-label': 'Partes do Louvor' },
            lado('#/escala', 'Escala'),
            eLiderDeLouvor(conta) ? lado('#/montar', 'Montar') : null,
            lado('#/repertorios', 'Repertórios'),
            lado('#/equipe', 'Equipe')));
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

// Pontinho no botão de oração quando há pedido esperando o pastor. Uma
// consulta por abertura de tela é barata (a função só olha os dele).
async function marcarPedidosDeOracao(botao) {
    const { data } = await supabase.rpc('pedidos_de_oracao_para_mim');
    const n = (data ?? []).filter((p) => !p.orado_em).length;
    if (!n || !botao.isConnected) return;
    botao.classList.add('tem-pedido');
    botao.setAttribute('aria-label', `Pedidos de oração: ${n} esperando`);
}
