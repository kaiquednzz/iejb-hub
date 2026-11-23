// Pedidos de oração (D69).
//
// Quem pede escolhe para qual pastor vai (um ou mais) e pode mandar sem o
// nome. Só esses pastores leem; nem o administrador vê. O pastor toca "Orei
// por você" e a pessoa recebe um aviso. Tudo some em 30 dias.
//
// Uma tela para os dois lados: o pastor vê primeiro a caixa dele ("Pra você")
// e, como qualquer membro, também pode pedir oração ("Pedir").
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { cabecalhoApp, avatar, caixaDeAviso } from './moldura.js';
import { confirmar, avisar, anunciar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { comemorar } from '../util/comemorar.js';
import { interruptor } from './equipe/pecas.js';
import { nomeCurto, ePastor } from '../sessao.js';


export function telaOracao(conta) {
    const lugar = h('div', { class: 'oracao-area' });
    const abas = h('div', { class: 'segmentos', role: 'tablist', 'aria-label': 'Pedidos de oração', style: { '--n': 2 } });
    let atual = ePastor(conta) ? 'caixa' : 'pedir';

    const tela = h('div', { class: 'tela tela-app tela-oracao' },
        cabecalhoApp(conta, { modulo: 'Oração' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('header', { class: 'oracao-topo' },
                h('p', { class: 'casa-ministerio' }, 'Pedidos de'),
                h('h1', { class: 'casa-nome', tabindex: -1 }, 'Oração')),
            ePastor(conta) && abas,
            lugar));

    desenhar();
    return tela;

    function desenhar() {
        if (ePastor(conta)) {
            const secoes = [['caixa', 'Pra você'], ['pedir', 'Pedir']];
            abas.style.setProperty('--ativo', secoes.findIndex(([id]) => id === atual));
            abas.replaceChildren(...secoes.map(([id, nome]) => {
                const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === atual) }, nome);
                b.addEventListener('click', () => { if (id !== atual) { atual = id; desenhar(); } });
                return b;
            }));
        }
        lugar.replaceChildren(atual === 'caixa' ? caixaDoPastor(conta) : pedir(conta, desenhar));
    }
}

// --- Pedir ------------------------------------------------------------------
function pedir(conta, recarregar) {
    const lugar = h('div', { class: 'oracao-pedir' }, h('div', { class: 'esqueleto oracao-esqueleto' }));
    carregar();
    return lugar;

    async function carregar() {
        const [pastores, meus] = await Promise.all([
            supabase.rpc('pastores_da_igreja'),
            supabase.from('pedido_oracao')
                .select('id, texto, anonimo, criado_em, orado_em, orado_por_pessoa:orado_por ( nome, apelido ), pedido_oracao_destino ( pastor_id )')
                .order('criado_em', { ascending: false }),
        ]);
        if (pastores.error || meus.error) {
            console.error(pastores.error || meus.error);
            const tentar = h('button', { type: 'button', class: 'botao-principal' }, 'Tentar de novo');
            tentar.addEventListener('click', () => { lugar.replaceChildren(h('div', { class: 'esqueleto oracao-esqueleto' })); carregar(); });
            lugar.replaceChildren(h('div', { class: 'estado-vazio' }, h('p', null, 'Não deu para carregar.'), tentar));
            return;
        }
        // O próprio pastor não pede oração a si mesmo
        const lista = pastores.data.filter((p) => p.id !== conta.pessoa?.id);
        lugar.replaceChildren(...[formulario(lista), meusPedidos(meus.data, lista)].filter(Boolean));
    }

    function formulario(pastores) {
        if (!pastores.length) {
            return h('div', { class: 'estado-vazio' }, h('p', null, 'Ainda não tem pastor com conta no Hub.'));
        }
        const escolhidos = new Set(pastores.length === 1 ? [pastores[0].id] : []);
        const aviso = caixaDeAviso();
        const texto = h('textarea', { id: 'oracao-texto', class: 'campo-texto', rows: 5, maxlength: 1000, placeholder: 'Pelo que você quer que a gente ore?' });
        let anonimo = false;
        const chave = interruptor({ rotulo: 'Não mostrar meu nome', descricao: 'O pastor lê o pedido, mas não sabe quem mandou.', ligado: false,
            aoMudar: (v) => { anonimo = v; return true; } });

        const fichas = h('div', { class: 'oracao-pastores', role: 'group', 'aria-labelledby': 'oracao-para' },
            pastores.map((p) => {
                const b = h('button', { type: 'button', class: 'oracao-pastor', 'aria-pressed': String(escolhidos.has(p.id)) },
                    avatar(p, 'pessoa-avatar oracao-pastor-foto'),
                    h('span', null, nomeCurto(p)),
                    icone('certo', 'icone icone-p oracao-pastor-ok'));
                b.addEventListener('click', () => {
                    if (escolhidos.has(p.id)) escolhidos.delete(p.id); else escolhidos.add(p.id);
                    b.setAttribute('aria-pressed', String(escolhidos.has(p.id)));
                });
                return b;
            }));

        const enviar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Mandar pedido');
        const form = h('form', { class: 'form oracao-form', novalidate: true },
            h('div', { class: 'campo' }, h('span', { class: 'campo-rotulo', id: 'oracao-para' }, 'Para quem vai'), fichas),
            h('div', { class: 'campo' }, h('label', { for: 'oracao-texto' }, 'Seu pedido'), texto),
            chave,
            aviso.elemento,
            enviar,
            h('p', { class: 'campo-dica oracao-privacidade' }, icone('cadeado', 'icone icone-p'),
                'Só o pastor escolhido lê. O pedido some sozinho em 30 dias.'));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            aviso.limpar();
            if (!escolhidos.size) return aviso.mostrar('Escolha para qual pastor vai o pedido.');
            if (texto.value.trim().length < 3) return aviso.mostrar('Escreva o seu pedido.');
            comCarregando(enviar, async () => {
                const { error } = await supabase.rpc('pedir_oracao', { p_texto: texto.value.trim(), p_pastores: [...escolhidos], p_anonimo: anonimo });
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                comemorar('Pedido enviado', 'Estamos orando com você.');
                anunciar('Pedido enviado.');
                recarregar();
            });
        });
        return form;
    }

    function meusPedidos(pedidos, pastores) {
        if (!pedidos.length) return null;
        const nomeDe = new Map(pastores.map((p) => [p.id, nomeCurto(p)]));
        return h('section', { class: 'oracao-meus', 'aria-labelledby': 'titulo-meus' },
            h('h2', { class: 'rotulo-secao', id: 'titulo-meus' }, 'Seus pedidos'),
            h('ul', { class: 'oracao-lista' }, pedidos.map((p) => {
                const para = p.pedido_oracao_destino.map((d) => nomeDe.get(d.pastor_id)).filter(Boolean).join(' e ');
                const apagar = h('button', { type: 'button', class: 'botao-icone oracao-apagar', 'aria-label': 'Apagar este pedido' }, icone('lixeira'));
                apagar.addEventListener('click', async () => {
                    if (!await confirmar({ titulo: 'Apagar o pedido?', texto: 'Ele some também para o pastor.', botao: 'Apagar', perigo: true })) return;
                    const { error } = await supabase.from('pedido_oracao').delete().eq('id', p.id);
                    if (error) return avisar(mensagemDoBanco(error));
                    avisar('Pedido apagado.');
                    recarregar();
                });
                return h('li', { class: 'oracao-cartao' },
                    h('p', { class: 'oracao-texto' }, p.texto),
                    h('div', { class: 'oracao-rodape' },
                        p.orado_em
                            ? h('span', { class: 'oracao-status orado' }, icone('coracao', 'icone icone-p'),
                                `${p.orado_por_pessoa ? nomeCurto(p.orado_por_pessoa) : 'O pastor'} orou por você`)
                            : h('span', { class: 'oracao-status' }, `Para ${para || 'o pastor'}${p.anonimo ? ' · sem nome' : ''}`),
                        h('time', { class: 'oracao-quando', datetime: p.criado_em }, dataCurta(p.criado_em)),
                        apagar));
            })));
    }
}

// --- A caixa do pastor -------------------------------------------------------
function caixaDoPastor() {
    const lugar = h('div', { class: 'oracao-caixa' }, h('div', { class: 'esqueleto oracao-esqueleto' }));
    carregar();
    return lugar;

    async function carregar() {
        const { data, error } = await supabase.rpc('pedidos_de_oracao_para_mim');
        if (error) {
            console.error(error);
            lugar.replaceChildren(h('div', { class: 'estado-vazio' }, h('p', null, 'Não deu para carregar os pedidos.')));
            return;
        }
        if (!data.length) {
            lugar.replaceChildren(h('div', { class: 'estado-vazio oracao-vazio' },
                icone('coracao', 'icone oracao-vazio-icone'),
                h('p', null, 'Nenhum pedido por enquanto.'),
                h('p', { class: 'campo-dica' }, 'Quando alguém pedir oração para você, chega aqui e no seu celular.')));
            return;
        }
        lugar.replaceChildren(h('ul', { class: 'oracao-lista' }, data.map((p, i) => cartao(p, i))));
    }

    function cartao(p, i) {
        const autor = p.anonimo ? null : { nome: p.autor_nome, apelido: p.autor_apelido, foto: p.autor_foto };
        const orei = h('button', { type: 'button', class: 'botao-secundario oracao-orei' }, icone('coracao', 'icone icone-p'), 'Orei por você');
        orei.addEventListener('click', () => comCarregando(orei, async () => {
            const { error } = await supabase.rpc('marcar_orei', { p_pedido: p.id });
            if (error) return avisar(mensagemDoBanco(error));
            navigator.vibrate?.(10);
            avisar(autor ? `${nomeCurto(autor)} vai saber que você orou.` : 'A pessoa vai saber que você orou.');
            carregar();
        }));
        return h('li', { class: `oracao-cartao${p.orado_em ? ' orado' : ''}`, style: { '--i': Math.min(i, 6) } },
            h('header', { class: 'oracao-quem' },
                autor ? avatar(autor, 'pessoa-avatar oracao-quem-foto') : h('span', { class: 'pessoa-avatar oracao-quem-foto anonimo', 'aria-hidden': 'true' }, icone('cadeado', 'icone icone-p')),
                h('span', { class: 'oracao-quem-nome' }, autor ? nomeCurto(autor) : 'Sem nome'),
                h('time', { class: 'oracao-quando', datetime: p.criado_em }, dataCurta(p.criado_em))),
            h('p', { class: 'oracao-texto' }, p.texto),
            p.orado_em
                ? h('p', { class: 'oracao-status orado' }, icone('certo', 'icone icone-p'),
                    p.orado_por_nome ? `${p.orado_por_nome} orou` : 'Orado')
                : orei);
    }
}

function dataCurta(iso) {
    const dias = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 7) return `há ${dias} dias`;
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

// Contador da caixa do pastor (para o Início): quantos ainda sem "orei"
export async function pedidosSemResposta(conta) {
    if (!ePastor(conta)) return 0;
    const { data } = await supabase.rpc('pedidos_de_oracao_para_mim');
    return (data ?? []).filter((p) => !p.orado_em).length;
}
