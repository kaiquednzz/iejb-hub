// Resumo do mês (D55): a aba "Resumo" do Financeiro. Responde em segundos:
// quanto entrou, quanto saiu, se o mês fechou no azul, o que fugiu do normal
// e para onde o dinheiro está indo.
//
// Tudo é calculado aqui a partir dos lançamentos dos últimos 6 meses (o banco
// já só deixa tesouraria e pastor lerem). "Normal" = a média dos até 3 meses
// anteriores que tiveram movimento; sem histórico, a tela diz isso em vez de
// inventar comparação. Transferências e lançamentos cancelados não contam.
//
// Gráficos: entradas sempre à esquerda e verdes, saídas à direita e vinho,
// com legenda e sinais + e −: vermelho e verde se confundem para quem tem
// daltonismo, então a cor nunca é a única pista. As barras só usam transform.
import { h, icone } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { hojeEmBrasilia } from '../../util/datas.js';
import { reais, MESES, nomeDoMes, primeiroDoMes, somarMeses } from './util.js';

const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const MESES_CURTOS = MESES.map((m) => m.slice(0, 3));
const nomeMes = (iso) => MESES[Number(iso.slice(5, 7)) - 1];
const curto = (iso) => MESES_CURTOS[Number(iso.slice(5, 7)) - 1];
// Variação só faz sentido acima de um mínimo, senão R$ 5 → R$ 10 vira "+100%"
const RELEVANTE = 5000;   // R$ 50,00

export function blocoResumo(dados, mes, irParaMes) {
    const lugar = h('div', { class: 'fin-an', 'aria-busy': 'true' }, h('div', { class: 'fin-an-esqueleto' }));
    carregar();
    return lugar;

    async function carregar() {
        const inicio = somarMeses(mes, -5);
        const { data, error } = await supabase.from('lancamento')
            .select('tipo, valor_centavos, data, categoria_id')
            .gte('data', inicio).lt('data', somarMeses(mes, 1))
            .is('cancelado_em', null).in('tipo', ['entrada', 'saida']);
        lugar.removeAttribute('aria-busy');
        if (error) {
            console.error(error);
            lugar.replaceChildren(h('p', { class: 'fin-vazio' }, 'Não deu para montar o resumo agora. Tente de novo daqui a pouco.'));
            return;
        }
        lugar.replaceChildren(...montar(calcular(data, mes, dados), dados, irParaMes).filter(Boolean));
    }
}

// --- Contas -----------------------------------------------------------------
function calcular(lancamentos, mes, dados) {
    const meses = Array.from({ length: 6 }, (_, i) => somarMeses(mes, i - 5));
    const porMes = new Map(meses.map((m) => [m, { entradas: 0, saidas: 0, cat: new Map() }]));
    for (const l of lancamentos) {
        const m = porMes.get(primeiroDoMes(l.data));
        if (!m) continue;
        const v = Number(l.valor_centavos);
        if (l.tipo === 'entrada') m.entradas += v; else m.saidas += v;
        m.cat.set(l.categoria_id, (m.cat.get(l.categoria_id) ?? 0) + v);
    }
    const atual = porMes.get(mes);
    // Base de comparação: até 3 meses antes deste, só os que tiveram movimento
    const base = meses.slice(2, 5).map((m) => porMes.get(m)).filter((m) => m.entradas || m.saidas);
    const media = (f) => (base.length ? base.reduce((s, m) => s + f(m), 0) / base.length : null);

    const categorias = (tipo) => dados.categorias.filter((c) => c.tipo === tipo)
        .map((c) => ({ ...c, total: atual.cat.get(c.id) ?? 0, media: media((m) => m.cat.get(c.id) ?? 0),
            // Em quantos dos meses-base apareceu: gasto eventual (manutenção, compra) não tem "normal"
            vezes: base.filter((m) => m.cat.get(c.id)).length }))
        .filter((c) => c.total > 0 || (c.media ?? 0) > 0)
        .sort((a, b) => b.total - a.total);

    // Média de saídas dos meses com movimento (inclusive este, se já fechou): para a reserva
    const emAndamento = mes === primeiroDoMes(hojeEmBrasilia());
    const fechados = meses.map((m) => porMes.get(m)).filter((m, i) => (m.entradas || m.saidas) && !(emAndamento && i === 5));
    const saidaMedia = fechados.length ? fechados.reduce((s, m) => s + m.saidas, 0) / fechados.length : null;

    return {
        mes, meses, porMes, atual, base, emAndamento, saidaMedia,
        mediaEntradas: media((m) => m.entradas),
        mediaSaidas: media((m) => m.saidas),
        saidas: categorias('saida'),
        entradas: categorias('entrada'),
        saldo: dados.resumo.contas.reduce((s, c) => s + Number(c.saldo), 0),
    };
}

const variacao = (valor, media) => (media && media >= RELEVANTE ? (valor - media) / media : null);
// Só compara categoria que aparece na maioria dos meses-base
const regular = (c, base) => base.length > 0 && c.vezes >= Math.ceil(base.length / 2) && c.vezes >= Math.min(2, base.length);

// "Pontos de atenção": poucas frases, só o que foge do normal
function pontos(r) {
    const lista = [];
    const resultado = r.atual.entradas - r.atual.saidas;
    const ate = r.emAndamento ? 'até agora' : 'no mês';

    if (r.atual.saidas > r.atual.entradas && r.atual.saidas > 0) {
        lista.push({ tipo: 'alerta', texto: `Saiu ${reais(-resultado)} a mais do que entrou ${ate}.` });
    }
    // Categoria de saída bem acima do normal
    for (const c of r.saidas) {
        const v = regular(c, r.base) ? variacao(c.total, c.media) : null;
        if (v !== null && v >= 0.3 && c.total - c.media >= RELEVANTE) {
            lista.push({ tipo: 'alerta', texto: `${c.nome}: ${reais(c.total)}, ${PCT.format(v)} acima do normal (${reais(c.media)}).` });
        } else if (!regular(c, r.base) && c.total >= RELEVANTE && r.base.length) {
            lista.push({ tipo: 'info', texto: c.vezes
                ? `${c.nome}: ${reais(c.total)}, gasto eventual (apareceu em ${c.vezes} dos ${r.base.length} meses anteriores).`
                : `${c.nome}: ${reais(c.total)}, gasto que não apareceu nos meses anteriores.` });
        }
    }
    // Entradas: só compara mês fechado (no meio do mês sempre pareceria queda)
    const vEnt = variacao(r.atual.entradas, r.mediaEntradas);
    if (!r.emAndamento && vEnt !== null && vEnt <= -0.2) {
        lista.push({ tipo: 'alerta', texto: `Entradas ${PCT.format(-vEnt)} abaixo do normal (${reais(r.mediaEntradas)}).` });
    } else if (!r.emAndamento && vEnt !== null && vEnt >= 0.2) {
        lista.push({ tipo: 'bom', texto: `Entradas ${PCT.format(vEnt)} acima do normal.` });
    }
    // Uma categoria pesando demais nas saídas
    const maior = r.saidas[0];
    if (maior && r.atual.saidas >= RELEVANTE && r.saidas.length > 1 && maior.total / r.atual.saidas >= 0.5) {
        lista.push({ tipo: 'info', texto: `${maior.nome} é ${PCT.format(maior.total / r.atual.saidas)} de tudo que saiu.` });
    }
    // Reserva: quantos meses de saída o saldo de hoje cobre
    if (r.saidaMedia >= RELEVANTE && r.saldo > 0) {
        const meses = r.saldo / r.saidaMedia;
        const texto = meses < 1
            ? `O saldo de hoje não cobre um mês de saídas (média ${reais(r.saidaMedia)}).`
            : `O saldo de hoje cobre cerca de ${meses < 10 ? meses.toFixed(1).replace('.', ',') : Math.round(meses)} ${meses < 2 ? 'mês' : 'meses'} de saídas.`;
        lista.push({ tipo: meses < 1 ? 'alerta' : 'info', texto });
    }
    if (!lista.some((p) => p.tipo === 'alerta') && (r.atual.entradas || r.atual.saidas) && r.base.length) {
        lista.unshift({ tipo: 'bom', texto: 'Nada fora do normal neste mês.' });
    }
    return lista;
}

// --- Tela -------------------------------------------------------------------
function montar(r, dados, irParaMes) {
    const { entradas, saidas } = r.atual;
    const resultado = entradas - saidas;
    if (!entradas && !saidas && !r.base.length) {
        return [h('p', { class: 'fin-vazio' }, `Nada lançado em ${nomeMes(r.mes)}. O resumo aparece assim que houver lançamentos.`)];
    }
    const quando = r.emAndamento ? `Até agora em ${nomeMes(r.mes)}` : `Em ${nomeMes(r.mes)}`;
    const frase = resultado >= 0 ? `sobrou ${reais(resultado)}` : `faltou ${reais(-resultado)}`;

    const vSai = variacao(saidas, r.mediaSaidas);
    const comparacao = r.base.length
        ? (vSai === null ? null : `Saídas ${Math.abs(vSai) < 0.05 ? 'no normal' : `${PCT.format(Math.abs(vSai))} ${vSai > 0 ? 'acima' : 'abaixo'} da média`} dos ${r.base.length === 1 ? 'último mês' : `últimos ${r.base.length} meses`}${r.emAndamento ? ', e o mês ainda não acabou' : ''}.`)
        : 'Ainda não há meses anteriores para comparar: as comparações aparecem conforme os meses forem lançados.';

    const lista = pontos(r);
    return [
        h('section', { class: `fin-an-topo ${resultado >= 0 ? 'positivo' : 'negativo'}`, 'aria-label': 'Resultado do mês' },
            h('p', { class: 'fin-an-frase' }, `${quando}, `, h('strong', null, frase), '.'),
            h('p', { class: 'fin-an-detalhe' }, `Entrou ${reais(entradas)} e saiu ${reais(saidas)}.`),
            comparacao && h('p', { class: 'fin-an-detalhe' }, comparacao)),
        graficoMeses(r, irParaMes),
        lista.length ? h('section', { class: 'fin-an-bloco', 'aria-label': 'Pontos de atenção' },
            h('h3', { class: 'fin-sub' }, 'Pontos de atenção'),
            h('ul', { class: 'fin-pontos' }, lista.map((p, i) => h('li', { class: `fin-ponto ${p.tipo}`, style: { '--i': i } },
                h('span', { class: 'fin-ponto-icone', 'aria-hidden': 'true' }, icone(p.tipo === 'alerta' ? 'alerta' : p.tipo === 'bom' ? 'certo' : 'info', 'icone icone-p')),
                h('span', { class: 'sr-only' }, p.tipo === 'alerta' ? 'Atenção: ' : p.tipo === 'bom' ? 'Bom: ' : 'Informação: '),
                h('span', null, p.texto))))) : null,
        listaCategorias('Para onde foi', 'saida', r.saidas, saidas, r.base),
        // No mês em andamento as entradas ainda não chegaram todas: comparar só assusta
        listaCategorias('De onde veio', 'entrada', r.entradas, entradas, r.emAndamento ? [] : r.base),
    ];
}

// Entradas x saídas, mês a mês. Tocar num mês leva para ele.
function graficoMeses(r, irParaMes) {
    const maior = Math.max(1, ...r.meses.map((m) => Math.max(r.porMes.get(m).entradas, r.porMes.get(m).saidas)));
    const altura = (v) => (v / maior).toFixed(3);
    const colunas = r.meses.map((m, i) => {
        const d = r.porMes.get(m);
        const atual = m === r.mes;
        const rotulo = `${nomeDoMes(m)}: entrou ${reais(d.entradas)}, saiu ${reais(d.saidas)}`;
        const coluna = h('button', {
            type: 'button', class: `fin-graf-col${atual ? ' atual' : ''}`, style: { '--i': i },
            'aria-label': atual ? `${rotulo} (mês aberto)` : `${rotulo}. Abrir este mês`,
            'aria-current': atual ? 'true' : null,
        },
        h('span', { class: 'fin-graf-dica', 'aria-hidden': 'true' },
            h('strong', null, nomeDoMes(m)),
            h('span', { class: 'entrada' }, `+ ${reais(d.entradas)}`),
            h('span', { class: 'saida' }, `− ${reais(d.saidas)}`)),
        h('span', { class: 'fin-graf-barras', 'aria-hidden': 'true' },
            h('span', { class: 'fin-graf-barra entrada', style: { '--h': altura(d.entradas) } }),
            h('span', { class: 'fin-graf-barra saida', style: { '--h': altura(d.saidas) } })),
        h('span', { class: 'fin-graf-mes', 'aria-hidden': 'true' }, curto(m)));
        if (!atual) coluna.addEventListener('click', () => irParaMes(m));
        return coluna;
    });
    return h('section', { class: 'fin-an-bloco fin-graf', 'aria-label': 'Entradas e saídas dos últimos 6 meses' },
        h('div', { class: 'fin-graf-topo' },
            h('h3', { class: 'fin-sub' }, 'Últimos 6 meses'),
            h('p', { class: 'fin-legenda', 'aria-hidden': 'true' },
                h('span', { class: 'entrada' }, 'Entradas'), h('span', { class: 'saida' }, 'Saídas'))),
        h('div', { class: 'fin-graf-area' }, colunas),
        r.emAndamento ? h('p', { class: 'fin-an-nota' }, `${nomeMes(r.mes).charAt(0).toUpperCase()}${nomeMes(r.mes).slice(1)} ainda está em andamento.`) : null);
}

function listaCategorias(titulo, tipo, cats, total, base) {
    if (!cats.length) return null;
    const maior = Math.max(1, ...cats.map((c) => c.total));
    return h('section', { class: 'fin-an-bloco', 'aria-label': titulo },
        h('h3', { class: 'fin-sub' }, titulo),
        h('ul', { class: 'fin-an-cats' }, cats.map((c, i) => {
            const comparavel = regular(c, base);
            const v = comparavel ? variacao(c.total, c.media) : null;
            // Para saída, subir é o ponto de atenção; para entrada, cair
            const ruim = v !== null && (tipo === 'saida' ? v >= 0.3 : v <= -0.2);
            const selo = v === null || Math.abs(v) < 0.1 ? null
                : h('span', { class: `fin-an-var${ruim ? ' ruim' : ''}` }, `${v > 0 ? '↑' : '↓'} ${PCT.format(Math.abs(v))}`,
                    h('span', { class: 'sr-only' }, v > 0 ? ' acima do normal' : ' abaixo do normal'));
            return h('li', { class: `fin-an-cat ${tipo}`, style: { '--i': i } },
                h('span', { class: 'fin-an-cat-nome' }, c.nome),
                h('span', { class: 'fin-an-cat-valor' }, selo, reais(c.total)),
                h('span', { class: 'fin-an-cat-barra', 'aria-hidden': 'true' }, h('span', { style: { '--fatia': (c.total / maior).toFixed(3) } })),
                h('span', { class: 'fin-an-cat-parte' }, total ? `${PCT.format(c.total / total)} do total` : '',
                    comparavel ? ` · normal ${reais(c.media)}` : (base.length && c.total ? ' · eventual' : '')));
        })));
}
