// Pedidos de acesso (só o admin vê): quem usou "Pedir acesso" no app.
// Aprovar = ligar a conta a uma pessoa do Louvor (nova ou já cadastrada).
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, confirmar, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { campo, caixaDeAviso } from '../moldura.js';
import { vazio } from './pecas.js';
import { chave } from './dados.js';
import { avatar } from '../../util/foto.js';
import { nomeDoTitulo, nomeDaPermissao, PERMISSOES, seletorDeTitulo } from '../../util/titulos.js';


export function secaoPedidos(dados, ctx) {
    const pendentes = dados.pedidos.filter((p) => p.estado === 'pendente');
    const recusados = dados.pedidos.filter((p) => p.estado === 'recusada');

    return h('div', { class: 'secao' },
        pendentes.length === 0
            ? vazio('Nenhum pedido esperando.', 'Mostre o QR de convite: quem ler pede acesso e o pedido aparece aqui.')
            : h('ul', { class: 'lista-pedidos' }, pendentes.map((p, i) => cartaoPedido(p, i, dados, ctx))),
        recusados.length > 0 && h('details', { class: 'grupo-recolhido' },
            h('summary', null, `Recusados (${recusados.length})`),
            h('ul', { class: 'lista-pedidos' }, recusados.map((p, i) => cartaoPedido(p, i, dados, ctx))),
        ),
    );
}

function cartaoPedido(pedido, indice, dados, ctx) {
    const recusado = pedido.estado === 'recusada';
    const aprovar = h('button', { type: 'button', class: 'botao-principal' }, recusado ? 'Aprovar mesmo assim' : 'Aprovar');
    const recusar = recusado ? null : h('button', { type: 'button', class: 'botao-secundario' }, 'Recusar');

    aprovar.addEventListener('click', () => folhaAprovar(pedido, dados, ctx));
    recusar?.addEventListener('click', async () => {
        const ok = await confirmar({
            titulo: 'Recusar pedido?',
            texto: `${pedido.nome_informado || pedido.login} não vai ter acesso ao Hub. Dá para aprovar depois, se mudar de ideia.`,
            botao: 'Recusar', perigo: true,
        });
        if (!ok) return;
        await comCarregando(recusar, async () => {
            const { error } = await supabase.rpc('recusar_conta', { p_conta: pedido.id });
            if (error) return avisar(mensagemDoBanco(error));
            avisar('Pedido recusado.');
            await ctx.recarregar();
        });
    });

    return h('li', { class: `cartao-pedido${recusado ? ' recusado' : ''}`, style: { '--i': Math.min(indice, 8) } },
        h('div', { class: 'pedido-quem' },
            avatar({ nome: pedido.nome_informado || pedido.login, foto: pedido.foto_informada }),
            h('div', null,
                h('p', { class: 'pedido-nome' }, pedido.nome_informado || 'Sem nome'),
                h('p', { class: 'pedido-login' }, pedido.login),
                pediu(pedido, dados) && h('p', { class: 'pedido-funcoes' }, pediu(pedido, dados)),
                h('p', { class: 'pedido-quando' }, `Pediu ${haQuanto(pedido.criado_em)}`),
            ),
        ),
        h('div', { class: 'pedido-acoes' }, recusar, aprovar),
    );
}

function folhaAprovar(pedido, dados, ctx) {
    // Pessoas já cadastradas que ainda não têm conta: candidatas a receber esta
    const candidatas = dados.pessoas.filter((p) => p.ativa && !p.conta);
    // Se o nome digitado bate com alguém cadastrado, já sugere essa pessoa
    const primeiro = chave((pedido.nome_informado ?? '').split(/\s+/)[0] ?? '');
    const sugerida = primeiro && candidatas.find((p) =>
        [p.nome, p.apelido].filter(Boolean).some((n) => chave(n.split(/\s+/)[0]) === primeiro));

    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Aprovar acesso');

    const campoNome = campo({ rotulo: 'Nome completo', nome: 'nome', autocomplete: 'off', value: pedido.nome_informado ?? '' });
    const opcaoNova = h('input', { type: 'radio', name: 'quem', value: 'nova', checked: !sugerida });
    const opcaoExistente = h('input', { type: 'radio', name: 'quem', value: 'existente', checked: !!sugerida });
    const lista = h('select', { name: 'pessoa', class: 'seletor', 'aria-label': 'Pessoa cadastrada' },
        candidatas.map((p) => h('option', { value: p.id, selected: p === sugerida },
            p.apelido ? `${p.apelido} (${p.nome})` : p.nome)));

    const blocoNova = h('div', { class: 'opcao-detalhe' }, campoNome);
    const blocoExistente = h('div', { class: 'opcao-detalhe' }, lista);
    const atualizar = () => {
        blocoNova.hidden = !opcaoNova.checked;
        blocoExistente.hidden = !opcaoExistente.checked;
    };
    [opcaoNova, opcaoExistente].forEach((o) => o.addEventListener('change', atualizar));
    atualizar();

    // O que a pessoa pediu no primeiro acesso (D62, D71), já marcado. Desmarque
    // o que não concordar. Pedido antigo, sem nada: Louvor marcado (era assim).
    const marcar = (rotulo, ligado, detalhe) => {
        const caixa = h('input', { type: 'checkbox', checked: ligado });
        return { caixa, elemento: h('label', { class: 'opcao' }, caixa, h('span', null, rotulo, detalhe && h('small', { class: 'opcao-detalhe-texto' }, ` · ${detalhe}`))) };
    };
    const pediuMinisterios = new Set(pedido.ministerios_pedidos ?? []);
    if (pedido.louvor_pedido || !pedido.apresentou_em) pediuMinisterios.add(dados.ministerioId);
    const ministerios = dados.ministerios.filter((m) => m.ativo).map((m) => ({
        id: m.id,
        ...marcar(m.nome, pediuMinisterios.has(m.id),
            m.id === dados.ministerioId ? (pedido.instrumentos_pedidos ?? []).join(', ') : null),
    }));
    const titulo = seletorDeTitulo({ id: 'aprovar-titulo', valor: pedido.titulo_pedido ?? 'membro' });
    const permissoes = PERMISSOES.map(([id, nome]) => ({ id, ...marcar(nome, (pedido.cargos_pedidos ?? []).includes(id)) }));
    const blocoPediu = h('div', { class: 'form' },
        h('div', { class: 'campo' }, h('label', { for: 'aprovar-titulo' }, 'Título na igreja'), titulo),
        h('fieldset', { class: 'opcoes' },
            h('legend', { class: 'bloco-subtitulo' }, 'Onde serve'),
            ministerios.map((m) => m.elemento),
            h('p', { class: 'campo-dica' }, 'Nenhum marcado: entra como membro, vê o mural e os eventos.')),
        h('fieldset', { class: 'opcoes' },
            h('legend', { class: 'bloco-subtitulo' }, 'Pode no app'),
            permissoes.map((c) => c.elemento)));

    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' },
            h('strong', null, pedido.nome_informado || pedido.login), ' entra com ', h('strong', null, pedido.login), '.'),
        h('fieldset', { class: 'opcoes' },
            h('legend', { class: 'sr-only' }, 'Quem é essa pessoa'),
            h('label', { class: 'opcao' }, opcaoNova, h('span', null, 'Pessoa nova no cadastro')),
            blocoNova,
            candidatas.length > 0 && h('label', { class: 'opcao' }, opcaoExistente, h('span', null, 'Já está cadastrada')),
            candidatas.length > 0 && blocoExistente,
        ),
        blocoPediu,
        aviso.elemento,
        botao,
    );

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const nova = opcaoNova.checked;
        const nome = form.elements.nome.value.trim();
        if (nova && !nome) return aviso.mostrar('Escreva o nome da pessoa.');

        const cargosAprovados = permissoes.filter((c) => c.caixa.checked).map((c) => c.id);
        const ministeriosAprovados = ministerios.filter((m) => m.caixa.checked).map((m) => m.id);
        const comLouvor = ministeriosAprovados.includes(dados.ministerioId);
        await comCarregando(botao, async () => {
            const { error } = await supabase.rpc('aprovar_pedido', {
                p_conta: pedido.id,
                p_pessoa: nova ? null : lista.value,
                p_nome: nova ? nome : null,
                p_titulo: titulo.value,
                p_ministerios: ministeriosAprovados,
                p_instrumentos: comLouvor ? (pedido.instrumentos_pedidos ?? []) : [],
                p_cargos: cargosAprovados,
            });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Acesso aprovado.');
            await ctx.recarregar();
        });
    });

    const folha = abrirFolha({ titulo: 'Aprovar acesso', conteudo: form });
}

// "Presbítero · Louvor (Bateria, Voz), Kids · Tesouraria", ou nada se não pediu
function pediu(pedido, dados) {
    const partes = [];
    if (pedido.titulo_pedido && pedido.titulo_pedido !== 'membro') partes.push(nomeDoTitulo(pedido.titulo_pedido));
    const onde = new Set(pedido.ministerios_pedidos ?? []);
    if (pedido.louvor_pedido) onde.add(dados.ministerioId);
    const nomes = dados.ministerios.filter((m) => onde.has(m.id)).map((m) => (m.id === dados.ministerioId && pedido.instrumentos_pedidos?.length
        ? `${m.nome} (${pedido.instrumentos_pedidos.join(', ')})` : m.nome));
    if (nomes.length) partes.push(nomes.join(', '));
    for (const c of pedido.cargos_pedidos ?? []) partes.push(nomeDaPermissao(c));
    return partes.join(' · ');
}

function haQuanto(quando) {
    const dias = Math.floor((Date.now() - new Date(quando).getTime()) / 86_400_000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(quando));
}
