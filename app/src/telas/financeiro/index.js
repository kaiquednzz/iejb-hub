// Financeiro (D45 a D49): o caixa da igreja.
//
// Quem vê: tesouraria (lança e edita) e pastor (só lê). O banco garante; a
// tela só não mostra os botões de mexer para quem não pode.
//
// Desenho da tela, de cima para baixo:
//   saldo (total e por conta) → mês (entradas, saídas, resultado e por
//   categoria) → contagens esperando conferência → lançamentos do mês.
// Lançar fica num botão fixo embaixo, perto do polegar.
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { hojeEmBrasilia } from '../../util/datas.js';
import { temCargo } from '../../sessao.js';
import { cabecalhoApp } from '../moldura.js';
import { reais, nomeDoMes, primeiroDoMes, somarMeses, dataCurta, FORMAS, nomeDe } from './util.js';
import { folhaLancar, folhaDetalhe, folhaAjustes, folhaCancelarContagem } from './lancar.js';

const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const rotuloDia = (iso) => {
    const t = DIA_SEMANA.format(new Date(`${iso}T12:00:00Z`));
    return t.charAt(0).toUpperCase() + t.slice(1);
};

export function telaFinanceiro(conta) {
    const edita = temCargo(conta, 'tesouraria');
    let mes = primeiroDoMes(hojeEmBrasilia());
    let dados = null;

    const area = h('div', { class: 'fin-area', 'aria-busy': 'true' }, esqueleto());
    const tituloMes = h('h2', { class: 'fin-mes-nome', 'aria-live': 'polite' }, nomeDoMes(mes));
    const anterior = h('button', { type: 'button', class: 'fin-mes-seta', 'aria-label': 'Mês anterior' }, icone('seta', 'icone gira-180'));
    const proximo = h('button', { type: 'button', class: 'fin-mes-seta', 'aria-label': 'Próximo mês' }, icone('seta'));
    anterior.addEventListener('click', () => trocarMes(-1));
    proximo.addEventListener('click', () => trocarMes(1));

    const ajustes = edita ? h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, 'Contas e categorias') : null;
    ajustes?.addEventListener('click', () => dados && folhaAjustes(dados, carregar));
    const exportar = h('button', { type: 'button', class: 'botao-texto' }, icone('baixar', 'icone icone-p'), 'Baixar o mês (planilha)');
    exportar.addEventListener('click', () => dados && baixarCSV(dados, mes));

    const lancar = edita ? h('button', { type: 'button', class: 'botao-principal fin-lancar' }, icone('mais'), 'Lançar') : null;
    lancar?.addEventListener('click', () => dados && folhaLancar(dados, conta, carregar));

    const tela = h('div', { class: 'tela tela-app tela-financeiro' },
        cabecalhoApp(conta, { modulo: 'Financeiro' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'fin-topo' },
                h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Financeiro'),
                !edita && h('span', { class: 'selo selo-neutro' }, icone('olho', 'icone icone-p'), 'Só leitura')),
            area,
            h('nav', { class: 'fin-mes', 'aria-label': 'Mês' }, anterior, tituloMes, proximo),
            h('div', { class: 'fin-mes-area' }),
            h('div', { class: 'fin-rodape' }, exportar, ajustes),
        ),
        lancar && h('div', { class: 'fin-barra' }, lancar),
    );
    const areaMes = tela.querySelector('.fin-mes-area');

    carregar();
    return tela;

    function trocarMes(n) {
        mes = somarMeses(mes, n);
        tituloMes.textContent = nomeDoMes(mes);
        areaMes.classList.remove('entra-esq', 'entra-dir');
        void areaMes.offsetWidth;
        areaMes.classList.add(n > 0 ? 'entra-dir' : 'entra-esq');
        carregar();
    }

    async function carregar() {
        const fim = somarMeses(mes, 1);
        const [resumo, lancamentos, contas, categorias, contagens] = await Promise.all([
            supabase.rpc('resumo_financeiro', { p_mes: mes }),
            supabase.from('lancamento')
                .select(`id, tipo, valor_centavos, data, descricao, forma, conta_id, conta_destino_id, categoria_id,
                         contagem_id, culto_id, cancelado_em, motivo_cancelamento, criado_em,
                         criado:pessoa!lancamento_criado_por_fkey ( nome, apelido )`)
                .gte('data', mes).lt('data', fim)
                .order('data', { ascending: false }).order('criado_em', { ascending: false }),
            supabase.from('conta_financeira').select('*').order('ordem').order('nome'),
            supabase.from('categoria_financeira').select('*').order('nome'),
            supabase.from('contagem')
                .select(`id, data, dizimos_centavos, ofertas_centavos, estado, motivo, decidido_em, criado_em,
                         conferente:pessoa!contagem_conferente_id_fkey ( nome, apelido )`)
                .in('estado', ['aguardando', 'recusada'])
                .order('data', { ascending: false }).limit(10),
        ]);
        area.removeAttribute('aria-busy');
        const erro = resumo.error || lancamentos.error || contas.error || categorias.error || contagens.error;
        if (erro) {
            console.error(erro);
            const botao = h('button', { type: 'button', class: 'botao-principal' }, 'Tentar de novo');
            botao.addEventListener('click', () => comCarregando(botao, carregar));
            area.replaceChildren(h('div', { class: 'estado-vazio' },
                h('p', { class: 'estado-vazio-titulo' }, 'Não deu para carregar o financeiro.'),
                h('p', { class: 'estado-vazio-texto' }, mensagemDoBanco(erro)), botao));
            areaMes.replaceChildren();
            return;
        }
        dados = {
            resumo: resumo.data,
            lancamentos: lancamentos.data,
            contas: contas.data,
            contaPorId: new Map(contas.data.map((c) => [c.id, c])),
            categorias: categorias.data,
            categoriaPorId: new Map(categorias.data.map((c) => [c.id, c])),
            contagens: contagens.data,
            edita,
        };
        // replaceChildren escreve "null" na tela se receber null: filtra antes
        area.replaceChildren(...[blocoSaldo(dados), blocoContagens(dados, carregar)].filter(Boolean));
        areaMes.replaceChildren(...[blocoMes(dados), blocoLancamentos(dados, (l) => folhaDetalhe(l, dados, conta, carregar))].filter(Boolean));
    }
}

// --- Saldo ------------------------------------------------------------------
function blocoSaldo(dados) {
    const contas = dados.resumo.contas;
    const total = contas.reduce((s, c) => s + Number(c.saldo), 0);
    return h('section', { class: 'fin-saldo', 'aria-label': 'Saldo' },
        h('p', { class: 'fin-saldo-rotulo' }, 'Saldo da igreja'),
        h('p', { class: 'fin-saldo-valor' }, reais(total)),
        h('ul', { class: 'fin-contas' }, contas.map((c) => h('li', { class: 'fin-conta' },
            h('span', { class: 'fin-conta-nome' }, c.nome),
            h('span', { class: `fin-conta-valor${c.saldo < 0 ? ' negativo' : ''}` }, reais(c.saldo))))),
    );
}

// --- Contagens esperando ----------------------------------------------------
function blocoContagens(dados, recarregar) {
    if (!dados.contagens.length) return null;
    return h('section', { class: 'fin-contagens', 'aria-label': 'Contagens' },
        dados.contagens.map((c) => {
            const total = c.dizimos_centavos + c.ofertas_centavos;
            const recusada = c.estado === 'recusada';
            const cancelar = dados.edita && !recusada ? h('button', { type: 'button', class: 'botao-texto' }, 'Desistir') : null;
            cancelar?.addEventListener('click', () => folhaCancelarContagem(c, recarregar));
            return h('div', { class: `fin-contagem${recusada ? ' recusada' : ''}` },
                h('span', { class: 'fin-contagem-icone', 'aria-hidden': 'true' }, icone(recusada ? 'fechar' : 'relogio', 'icone icone-p')),
                h('span', { class: 'fin-contagem-textos' },
                    h('span', { class: 'fin-contagem-titulo' }, `Contagem de ${dataCurta(c.data)} · ${reais(total)}`),
                    h('span', { class: 'fin-contagem-detalhe' }, recusada
                        ? `${nomeDe(c.conferente)} não confirmou: ${c.motivo}`
                        : `Esperando ${nomeDe(c.conferente)} conferir`)),
                cancelar);
        }));
}

// --- Mês --------------------------------------------------------------------
function blocoMes(dados) {
    const { entradas, saidas, por_categoria: cats } = dados.resumo;
    const resultado = entradas - saidas;
    const maior = Math.max(1, ...cats.map((c) => Number(c.total)));
    const linhas = (tipo) => cats.filter((c) => c.tipo === tipo).map((c, i) => h('li', { class: `fin-cat ${tipo}`, style: { '--i': i } },
        h('span', { class: 'fin-cat-nome' }, c.nome),
        h('span', { class: 'fin-cat-valor' }, reais(c.total)),
        h('span', { class: 'fin-cat-barra', 'aria-hidden': 'true' },
            h('span', { style: { '--fatia': (Number(c.total) / maior).toFixed(3) } }))));
    const vazio = !cats.length;
    return h('section', { class: 'fin-resumo', 'aria-label': 'Resumo do mês' },
        h('dl', { class: 'fin-numeros' },
            h('div', { class: 'entrada' }, h('dt', null, 'Entradas'), h('dd', null, reais(entradas))),
            h('div', { class: 'saida' }, h('dt', null, 'Saídas'), h('dd', null, reais(saidas))),
            h('div', { class: resultado >= 0 ? 'positivo' : 'negativo' }, h('dt', null, 'Resultado'), h('dd', null, reais(resultado)))),
        vazio
            ? h('p', { class: 'fin-vazio' }, 'Nada lançado neste mês.')
            : h('div', { class: 'fin-cats' },
                cats.some((c) => c.tipo === 'entrada') && h('h3', { class: 'fin-sub' }, 'De onde veio'),
                h('ul', { class: 'fin-cat-lista' }, linhas('entrada')),
                cats.some((c) => c.tipo === 'saida') && h('h3', { class: 'fin-sub' }, 'Para onde foi'),
                h('ul', { class: 'fin-cat-lista' }, linhas('saida'))),
    );
}

// --- Lançamentos ------------------------------------------------------------
function blocoLancamentos(dados, abrir) {
    const ativos = dados.lancamentos.filter((l) => !l.cancelado_em);
    const cancelados = dados.lancamentos.filter((l) => l.cancelado_em);
    if (!dados.lancamentos.length) return null;
    const porDia = new Map();
    for (const l of ativos) {
        if (!porDia.has(l.data)) porDia.set(l.data, []);
        porDia.get(l.data).push(l);
    }
    const linha = (l) => {
        const cat = dados.categoriaPorId.get(l.categoria_id);
        const conta = dados.contaPorId.get(l.conta_id);
        const destino = dados.contaPorId.get(l.conta_destino_id);
        const titulo = l.tipo === 'transferencia' ? `${conta?.nome} → ${destino?.nome}` : (l.descricao || cat?.nome || 'Lançamento');
        const detalhe = l.tipo === 'transferencia'
            ? (l.descricao || 'Transferência entre contas')
            : [l.descricao ? cat?.nome : null, conta?.nome, FORMAS[l.forma]].filter(Boolean).join(' · ');
        const sinal = l.tipo === 'entrada' ? '+' : l.tipo === 'saida' ? '−' : '';
        const b = h('button', { type: 'button', class: `fin-linha ${l.tipo}${l.cancelado_em ? ' cancelado' : ''}` },
            h('span', { class: 'fin-linha-icone', 'aria-hidden': 'true' }, l.tipo === 'entrada' ? '+' : l.tipo === 'saida' ? '−' : '⇄'),
            h('span', { class: 'fin-linha-textos' },
                h('span', { class: 'fin-linha-titulo' }, titulo),
                h('span', { class: 'fin-linha-detalhe' }, l.contagem_id ? `${detalhe} · contagem conferida` : detalhe)),
            h('span', { class: 'fin-linha-valor' }, `${sinal}${reais(l.valor_centavos)}`));
        b.addEventListener('click', () => abrir(l));
        return h('li', null, b);
    };
    return h('section', { class: 'fin-lancamentos', 'aria-label': 'Lançamentos do mês' },
        h('h3', { class: 'fin-sub' }, 'Lançamentos'),
        [...porDia.entries()].map(([dia, itens]) => h('div', { class: 'fin-dia' },
            h('h4', { class: 'fin-dia-nome' }, rotuloDia(dia)),
            h('ul', { class: 'fin-linhas' }, itens.map(linha)))),
        cancelados.length > 0 && h('details', { class: 'grupo-recolhido' },
            h('summary', null, `Cancelados (${cancelados.length})`),
            h('ul', { class: 'fin-linhas' }, cancelados.map(linha))),
    );
}

// --- Planilha do mês (CSV que abre no Excel e no Google Planilhas) ----------
function baixarCSV(dados, mes) {
    const campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [['Data', 'Tipo', 'Categoria', 'Conta', 'Destino', 'Valor', 'Forma', 'Descrição', 'Situação']];
    for (const l of [...dados.lancamentos].reverse()) {
        const valor = ((l.tipo === 'saida' ? -1 : 1) * l.valor_centavos / 100).toFixed(2).replace('.', ',');
        linhas.push([l.data.split('-').reverse().join('/'), { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência' }[l.tipo],
            dados.categoriaPorId.get(l.categoria_id)?.nome, dados.contaPorId.get(l.conta_id)?.nome,
            dados.contaPorId.get(l.conta_destino_id)?.nome, valor, FORMAS[l.forma], l.descricao,
            l.cancelado_em ? `Cancelado: ${l.motivo_cancelamento}` : '']);
    }
    // ";" e BOM: é o que o Excel em português abre certo, com acento
    const csv = '﻿' + linhas.map((l) => l.map(campo).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: `financeiro-iejb-${mes.slice(0, 7)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    avisar('Planilha baixada.');
}

function esqueleto() {
    return h('div', { class: 'fin-saldo esqueleto', 'aria-hidden': 'true' });
}
