// Peças de layout repetidas entre as telas.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { eLiderDeLouvor } from '../sessao.js';
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
        ),
    );
}

// Cabeçalho de vidro das telas de dentro do app
// Dentro de um módulo (opcoes.modulo = 'Louvor', 'Eventos do site'...), a
// marca dá lugar a "‹ Início" + o nome do módulo: a pessoa sempre sabe onde
// está e como voltar. No Início, aparece a marca do Hub.
export function cabecalhoApp(conta, opcoes = {}) {
    const botaoSair = h('button', {
        type: 'button', class: 'botao-icone', 'aria-label': 'Sair da conta',
        // Primeiro desliga o push deste aparelho (ainda logado, o banco deixa apagar)
        onclick: async () => { await removerAparelho(); supabase.auth.signOut(); },
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

    if (conta.e_administrador) {
        supabase.from('conta').select('id', { count: 'exact', head: true }).eq('estado', 'pendente')
            .then(({ count }) => {
                if (!count) return;
                equipe.append(h('span', { class: 'aba-contador' },
                    String(count), h('span', { class: 'sr-only' }, count === 1 ? ' pedido de acesso' : ' pedidos de acesso')));
            });
    }
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
