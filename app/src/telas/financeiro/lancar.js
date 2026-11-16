// Folhas do financeiro: lançar (entrada, saída, depósito), contagem do culto,
// detalhe com histórico, cancelar e ajustes (saldo inicial e categorias).
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { hojeEmBrasilia, rotuloDoDia, formatarHorario } from '../../util/datas.js';
import { caixaDeAviso } from '../moldura.js';
import { avatar } from '../moldura.js';
import { interruptor } from '../equipe/pecas.js';
import { reais, lerReais, dataCurta, FORMAS, nomeDe } from './util.js';

let seq = 0;

// Fichas de escolha única (role=radio no grupo): categoria, conta, forma...
function escolha({ rotulo, opcoes, valor, aoMudar }) {
    let atual = valor ?? null;
    const grupo = h('div', { class: 'fichas', role: 'radiogroup', 'aria-label': rotulo });
    const desenhar = () => grupo.replaceChildren(...opcoes.map((o) => {
        const f = h('button', { type: 'button', class: 'ficha', role: 'radio', 'aria-checked': String(o.id === atual) }, o.nome);
        f.addEventListener('click', () => { atual = o.id; desenhar(); aoMudar?.(atual); });
        return f;
    }));
    desenhar();
    return {
        elemento: h('fieldset', { class: 'campo' }, h('legend', null, rotulo), grupo),
        valor: () => atual,
        trocar(novas, novo) { opcoes = novas; atual = novo ?? null; desenhar(); },
    };
}

function campoValor(rotulo, inicial) {
    const id = `valor-${++seq}`;
    const entrada = h('input', { id, class: 'fin-valor-campo', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00',
        value: inicial ? (inicial / 100).toFixed(2).replace('.', ',') : '' });
    return {
        elemento: h('div', { class: 'campo' }, h('label', { for: id }, rotulo),
            h('div', { class: 'fin-valor' }, h('span', { 'aria-hidden': 'true' }, 'R$'), entrada)),
        centavos: () => lerReais(entrada.value),
        entrada,
    };
}

function campoSimples({ rotulo, tipo = 'text', value = '', dica, ...resto }) {
    const id = `fin-campo-${++seq}`;
    const entrada = h('input', { id, type: tipo, value, class: 'fin-entrada', ...resto });
    return { elemento: h('div', { class: 'campo' }, h('label', { for: id }, rotulo), entrada, dica && h('p', { class: 'campo-dica' }, dica)), entrada };
}

// --- Escolher o que lançar --------------------------------------------------
export function folhaLancar(dados, conta, recarregar) {
    const opcoes = [
        ['entrada', 'Entrada', 'Oferta por Pix, doação, inscrição de evento...', '+'],
        ['saida', 'Saída', 'Conta de luz, compra, ajuda a alguém...', '−'],
        ['contagem', 'Contagem do culto', 'Dinheiro contado; outra pessoa confere', '¢'],
        ['transferencia', 'Depósito ou transferência', 'Do caixa para o PagBank, por exemplo', '⇄'],
    ];
    const folha = abrirFolha({
        titulo: 'Lançar',
        conteudo: h('div', { class: 'form fin-opcoes' }, opcoes.map(([id, nome, texto, simbolo], i) => {
            const b = h('button', { type: 'button', class: `fin-opcao ${id}`, style: { '--i': i } },
                h('span', { class: 'fin-opcao-icone', 'aria-hidden': 'true' }, simbolo),
                h('span', { class: 'fin-opcao-textos' }, h('span', { class: 'fin-opcao-nome' }, nome), h('span', { class: 'fin-opcao-texto' }, texto)),
                icone('seta', 'icone icone-p'));
            b.addEventListener('click', () => {
                folha.fechar();
                if (id === 'contagem') folhaContagem(dados, conta, recarregar);
                else if (id === 'transferencia') folhaTransferencia(dados, null, recarregar, conta);
                else folhaLancamento(dados, { tipo: id }, recarregar, conta);
            });
            return b;
        })),
    });
}

// --- Entrada ou saída (nova ou editar) -------------------------------------
export function folhaLancamento(dados, existente, recarregar, conta) {
    const editando = Boolean(existente.id);
    const tipo = existente.tipo;
    const aviso = caixaDeAviso();
    const contas = dados.contas.filter((c) => c.ativa || c.id === existente.conta_id);
    const categorias = dados.categorias.filter((c) => c.tipo === tipo && (c.ativa || c.id === existente.categoria_id));
    const valor = campoValor('Valor', existente.valor_centavos);
    const categoria = escolha({ rotulo: 'Categoria', opcoes: categorias, valor: existente.categoria_id });
    const contaFin = escolha({ rotulo: tipo === 'entrada' ? 'Entrou em' : 'Saiu de', opcoes: contas,
        valor: existente.conta_id ?? contas.find((c) => c.tipo === 'banco')?.id ?? contas[0]?.id });
    const forma = escolha({ rotulo: 'Como', opcoes: Object.entries(FORMAS).map(([id, nome]) => ({ id, nome })), valor: existente.forma ?? 'pix' });
    const data = campoSimples({ rotulo: 'Data', tipo: 'date', value: existente.data ?? hojeEmBrasilia(), max: hojeEmBrasilia() });
    const descricao = campoSimples({ rotulo: 'Descrição (opcional)', value: existente.descricao ?? '', maxlength: 200,
        placeholder: tipo === 'entrada' ? 'Ex.: inscrições do retiro' : 'Ex.: conta de luz de outubro' });
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, editando ? 'Salvar alteração' : `Lançar ${tipo === 'entrada' ? 'entrada' : 'saída'}`);
    const form = h('form', { class: `form fin-form ${tipo}`, novalidate: true },
        valor.elemento, categoria.elemento, contaFin.elemento, forma.elemento, data.elemento, descricao.elemento,
        editando && h('p', { class: 'campo-dica' }, 'A alteração fica no histórico do lançamento, com o valor de antes.'),
        aviso.elemento, salvar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(salvar, async () => {
            aviso.limpar();
            const centavos = valor.centavos();
            if (!centavos) return aviso.mostrar('Digite o valor. Ex.: 50 ou 1.250,90');
            if (!categoria.valor()) return aviso.mostrar('Escolha a categoria.');
            if (!data.entrada.value) return aviso.mostrar('Escolha a data.');
            const linha = {
                valor_centavos: centavos, categoria_id: categoria.valor(), conta_id: contaFin.valor(), forma: forma.valor(),
                data: data.entrada.value, descricao: descricao.entrada.value.trim() || null,
            };
            const { error } = editando
                ? await supabase.from('lancamento').update(linha).eq('id', existente.id)
                : await supabase.from('lancamento').insert({ ...linha, tipo, criado_por: conta.pessoa.id });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar(editando ? 'Alteração salva.' : `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${reais(centavos)} lançada.`);
            recarregar();
        });
    });
    const folha = abrirFolha({ titulo: editando ? 'Editar lançamento' : (tipo === 'entrada' ? 'Nova entrada' : 'Nova saída'), conteudo: form });
    if (!editando) setTimeout(() => valor.entrada.focus(), 350);
}

// --- Transferência entre contas --------------------------------------------
export function folhaTransferencia(dados, existente, recarregar, conta) {
    const editando = Boolean(existente?.id);
    const aviso = caixaDeAviso();
    const contas = dados.contas.filter((c) => c.ativa);
    const caixa = contas.find((c) => c.tipo === 'dinheiro');
    const banco = contas.find((c) => c.tipo === 'banco');
    const valor = campoValor('Valor', existente?.valor_centavos);
    const de = escolha({ rotulo: 'Sai de', opcoes: contas, valor: existente?.conta_id ?? caixa?.id });
    const para = escolha({ rotulo: 'Vai para', opcoes: contas, valor: existente?.conta_destino_id ?? banco?.id });
    const data = campoSimples({ rotulo: 'Data', tipo: 'date', value: existente?.data ?? hojeEmBrasilia(), max: hojeEmBrasilia() });
    const descricao = campoSimples({ rotulo: 'Descrição (opcional)', value: existente?.descricao ?? '', maxlength: 200, placeholder: 'Ex.: depósito das ofertas de domingo' });
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, editando ? 'Salvar alteração' : 'Lançar transferência');
    const form = h('form', { class: 'form fin-form transferencia', novalidate: true },
        h('p', { class: 'folha-texto folha-texto-pequeno' }, 'Não é entrada nem saída da igreja: o dinheiro só muda de lugar.'),
        valor.elemento, de.elemento, para.elemento, data.elemento, descricao.elemento, aviso.elemento, salvar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(salvar, async () => {
            aviso.limpar();
            const centavos = valor.centavos();
            if (!centavos) return aviso.mostrar('Digite o valor.');
            if (de.valor() === para.valor()) return aviso.mostrar('Escolha contas diferentes.');
            const linha = { valor_centavos: centavos, conta_id: de.valor(), conta_destino_id: para.valor(),
                data: data.entrada.value, descricao: descricao.entrada.value.trim() || null };
            const { error } = editando
                ? await supabase.from('lancamento').update(linha).eq('id', existente.id)
                : await supabase.from('lancamento').insert({ ...linha, tipo: 'transferencia', forma: null, criado_por: conta.pessoa.id });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar(editando ? 'Alteração salva.' : 'Transferência lançada.');
            recarregar();
        });
    });
    const folha = abrirFolha({ titulo: editando ? 'Editar transferência' : 'Depósito ou transferência', conteudo: form });
}

// --- Contagem do culto (D48) ------------------------------------------------
async function folhaContagem(dados, conta, recarregar) {
    const aviso = caixaDeAviso();
    const caixa = dados.contas.find((c) => c.ativa && c.tipo === 'dinheiro') ?? dados.contas.find((c) => c.ativa);
    const data = campoSimples({ rotulo: 'Dia do culto', tipo: 'date', value: hojeEmBrasilia(), max: hojeEmBrasilia() });
    const culto = escolha({ rotulo: 'Culto', opcoes: [] });
    const dizimos = campoValor('Dízimos');
    const ofertas = campoValor('Ofertas');
    const total = h('p', { class: 'fin-contagem-total', 'aria-live': 'polite' }, 'Total: R$ 0,00');
    const conferente = escolha({ rotulo: 'Quem confere', opcoes: [] });
    const obs = campoSimples({ rotulo: 'Observação (opcional)', maxlength: 300, placeholder: 'Ex.: uma nota de 50 rasgada' });
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Pedir conferência');

    const somar = () => { total.textContent = `Total: ${reais((dizimos.centavos() ?? 0) + (ofertas.centavos() ?? 0))}`; };
    dizimos.entrada.addEventListener('input', somar);
    ofertas.entrada.addEventListener('input', somar);

    async function buscarCultos() {
        const { data: cultos } = await supabase.from('culto').select('id, nome, horario').eq('data', data.entrada.value).eq('estado', 'ativo').order('horario');
        const lista = (cultos ?? []).map((c) => ({ id: c.id, nome: `${c.nome} · ${formatarHorario(c.horario)}` }));
        culto.trocar([...lista, { id: '', nome: 'Sem culto' }], lista.at(-1)?.id ?? '');
    }
    data.entrada.addEventListener('change', buscarCultos);

    const form = h('form', { class: 'form fin-form contagem', novalidate: true },
        h('p', { class: 'folha-texto folha-texto-pequeno' }, `Vai para ${caixa?.nome ?? 'o caixa'} só depois que a outra pessoa conferir no celular dela.`),
        data.elemento, culto.elemento,
        h('div', { class: 'fin-dois' }, dizimos.elemento, ofertas.elemento),
        total, conferente.elemento, obs.elemento, aviso.elemento, salvar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(salvar, async () => {
            aviso.limpar();
            const d = dizimos.centavos() ?? 0;
            const o = ofertas.centavos() ?? 0;
            if ((dizimos.entrada.value && dizimos.centavos() === null) || (ofertas.entrada.value && ofertas.centavos() === null)) return aviso.mostrar('Algum valor não está certo. Ex.: 150 ou 1.250,90');
            if (d + o === 0) return aviso.mostrar('Digite quanto deu.');
            if (!conferente.valor()) return aviso.mostrar('Escolha quem vai conferir.');
            const { error } = await supabase.from('contagem').insert({
                data: data.entrada.value, culto_id: culto.valor() || null, conta_id: caixa.id,
                dizimos_centavos: d, ofertas_centavos: o, observacao: obs.entrada.value.trim() || null,
                contado_por: conta.pessoa.id, conferente_id: conferente.valor(),
            });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Pedido de conferência enviado.');
            recarregar();
        });
    });
    const folha = abrirFolha({ titulo: 'Contagem do culto', conteudo: form });

    buscarCultos();
    const { data: pessoas, error } = await supabase.rpc('quem_pode_conferir');
    if (error) return aviso.mostrar(mensagemDoBanco(error));
    conferente.trocar(pessoas.map((p) => ({ id: p.id, nome: nomeDe(p) })));
    if (!pessoas.length) aviso.mostrar('Ninguém mais tem acesso ao app para conferir. Peça ao admin para dar acesso a quem conta com você.', 'info');
}

export function folhaCancelarContagem(c, recarregar) {
    const aviso = caixaDeAviso();
    const motivo = campoSimples({ rotulo: 'Por quê? (opcional)', maxlength: 300, placeholder: 'Ex.: valor digitado errado' });
    const botao = h('button', { type: 'submit', class: 'botao-perigo botao-largo' }, 'Desistir da contagem');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `A contagem de ${dataCurta(c.data)} (${reais(c.dizimos_centavos + c.ofertas_centavos)}) sai da fila de quem ia conferir e não entra no caixa. Se for o caso, faça uma nova.`),
        motivo.elemento, aviso.elemento, botao);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(botao, async () => {
            const { error } = await supabase.rpc('cancelar_contagem', { p_contagem: c.id, p_motivo: motivo.entrada.value.trim() || null });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Contagem cancelada.');
            recarregar();
        });
    });
    const folha = abrirFolha({ titulo: 'Desistir da contagem?', conteudo: form });
}

// --- Detalhe, histórico e cancelar -----------------------------------------
const ACAO = { criado: 'Lançou', editado: 'Alterou', cancelado: 'Cancelou' };
const CAMPOS = { valor_centavos: 'valor', data: 'data', categoria_id: 'categoria', conta_id: 'conta', conta_destino_id: 'destino', forma: 'forma', descricao: 'descrição' };

export async function folhaDetalhe(l, dados, conta, recarregar) {
    const cat = dados.categoriaPorId.get(l.categoria_id);
    const contaFin = dados.contaPorId.get(l.conta_id);
    const destino = dados.contaPorId.get(l.conta_destino_id);
    const historico = h('ol', { class: 'fin-historico', 'aria-busy': 'true' });
    const pode = dados.edita && !l.cancelado_em;
    const editar = pode && !l.contagem_id ? h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Editar') : null;
    const cancelar = pode ? h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Cancelar lançamento') : null;
    editar?.addEventListener('click', () => {
        folha.fechar();
        if (l.tipo === 'transferencia') folhaTransferencia(dados, l, recarregar, conta);
        else folhaLancamento(dados, l, recarregar, conta);
    });
    cancelar?.addEventListener('click', () => { folha.fechar(); folhaCancelar(l, conta, recarregar); });
    const linhas = [
        ['Data', rotuloDoDia(l.data)],
        l.tipo === 'transferencia' ? ['De → para', `${contaFin?.nome} → ${destino?.nome}`] : ['Categoria', cat?.nome],
        l.tipo !== 'transferencia' && ['Conta', contaFin?.nome],
        l.forma && ['Como', FORMAS[l.forma]],
        l.descricao && ['Descrição', l.descricao],
        l.contagem_id && ['Origem', 'Contagem do culto, conferida por duas pessoas'],
        l.cancelado_em && ['Cancelado', l.motivo_cancelamento],
    ].filter(Boolean);
    const folha = abrirFolha({
        titulo: { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência' }[l.tipo],
        conteudo: h('div', { class: 'form' },
            h('p', { class: `fin-detalhe-valor ${l.tipo}${l.cancelado_em ? ' cancelado' : ''}` }, reais(l.valor_centavos)),
            h('dl', { class: 'fin-detalhe' }, linhas.map(([t, v]) => h('div', null, h('dt', null, t), h('dd', null, v)))),
            l.contagem_id && pode && h('p', { class: 'campo-dica' }, 'Veio de uma contagem conferida: não se edita. Se estiver errado, cancele com o motivo e lance de novo.'),
            h('h3', { class: 'fin-sub' }, 'Histórico'),
            historico,
            editar, cancelar),
    });
    const { data } = await supabase.from('lancamento_historico')
        .select('acao, antes, depois, em, por:pessoa ( nome, apelido, foto, id )').eq('lancamento_id', l.id).order('em');
    historico.removeAttribute('aria-busy');
    historico.replaceChildren(...(data ?? []).map((x) => {
        const quando = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(x.em));
        const mudou = x.acao === 'editado' && x.antes
            ? Object.keys(CAMPOS).filter((k) => JSON.stringify(x.antes[k]) !== JSON.stringify(x.depois[k]))
                .map((k) => k === 'valor_centavos' ? `valor de ${reais(x.antes[k])} para ${reais(x.depois[k])}` : CAMPOS[k]).join(', ')
            : null;
        return h('li', null, x.por && avatar(x.por),
            h('span', null, h('strong', null, `${ACAO[x.acao]}`), ` · ${nomeDe(x.por)} · ${quando}`, mudou && h('span', { class: 'fin-historico-mudou' }, `Mudou ${mudou}`)));
    }));
}

function folhaCancelar(l, conta, recarregar) {
    const aviso = caixaDeAviso();
    const motivo = campoSimples({ rotulo: 'Motivo', maxlength: 300, placeholder: 'Ex.: lançado em dobro', required: true });
    const botao = h('button', { type: 'submit', class: 'botao-perigo botao-largo' }, 'Cancelar lançamento');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `${reais(l.valor_centavos)} sai do saldo e dos relatórios. O lançamento continua no histórico como cancelado, com o motivo. Isso não se desfaz.`),
        motivo.elemento, aviso.elemento, botao);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(botao, async () => {
            aviso.limpar();
            if (!motivo.entrada.value.trim()) return aviso.mostrar('Diga o motivo.');
            const { error } = await supabase.from('lancamento').update({
                cancelado_em: new Date().toISOString(), cancelado_por: conta.pessoa.id, motivo_cancelamento: motivo.entrada.value.trim(),
            }).eq('id', l.id);
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Lançamento cancelado.');
            recarregar();
        });
    });
    const folha = abrirFolha({ titulo: 'Cancelar lançamento?', conteudo: form });
}

// --- Contas e categorias ----------------------------------------------------
export function folhaAjustes(dados, recarregar) {
    const contas = dados.contas.map((c) => {
        const aviso = caixaDeAviso();
        const valor = campoValor(`Saldo de ${c.nome} no começo`, c.saldo_inicial_centavos);
        const data = campoSimples({ rotulo: 'Em que dia', tipo: 'date', value: c.saldo_inicial_em, max: hojeEmBrasilia(),
            dica: 'O saldo que a conta tinha nesse dia, antes de usar o Hub. Lançamentos antes dele não contam.' });
        const salvar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Salvar');
        salvar.addEventListener('click', () => comCarregando(salvar, async () => {
            aviso.limpar();
            const centavos = valor.entrada.value.trim() === '' ? 0 : valor.centavos();
            if (centavos === null) return aviso.mostrar('Valor não está certo.');
            const { error } = await supabase.from('conta_financeira')
                .update({ saldo_inicial_centavos: centavos, saldo_inicial_em: data.entrada.value }).eq('id', c.id);
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            avisar(`Saldo inicial de ${c.nome} salvo.`);
            recarregar();
        }));
        return h('section', { class: 'bloco' }, h('h3', { class: 'bloco-titulo' }, c.nome), valor.elemento, data.elemento, aviso.elemento, salvar);
    });

    const listaCategorias = (tipo) => dados.categorias.filter((c) => c.tipo === tipo).map((c) => interruptor({
        rotulo: c.nome,
        descricao: c.papel ? 'Usada na contagem do culto' : null,
        ligado: c.ativa,
        aoMudar: async (ativa) => {
            const { error } = await supabase.from('categoria_financeira').update({ ativa }).eq('id', c.id);
            if (error) { avisar(mensagemDoBanco(error)); return false; }
            c.ativa = ativa;
            recarregar();
            return true;
        },
    }));

    const avisoNova = caixaDeAviso();
    const tipoNova = escolha({ rotulo: 'Tipo', opcoes: [{ id: 'entrada', nome: 'Entrada' }, { id: 'saida', nome: 'Saída' }], valor: 'saida' });
    const nomeNova = campoSimples({ rotulo: 'Nome da categoria', maxlength: 40, placeholder: 'Ex.: Aluguel do som' });
    const criar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('mais'), 'Criar categoria');
    criar.addEventListener('click', () => comCarregando(criar, async () => {
        avisoNova.limpar();
        const nome = nomeNova.entrada.value.trim();
        if (!nome) return avisoNova.mostrar('Dê um nome.');
        const { error } = await supabase.from('categoria_financeira').insert({ nome, tipo: tipoNova.valor() });
        if (error) return avisoNova.mostrar(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : mensagemDoBanco(error));
        folha.fechar();
        avisar('Categoria criada.');
        recarregar();
    }));

    const folha = abrirFolha({
        titulo: 'Contas e categorias',
        conteudo: h('div', { class: 'form' },
            h('h3', { class: 'fin-sub' }, 'Saldo inicial'),
            ...contas,
            h('h3', { class: 'fin-sub' }, 'Categorias de entrada'),
            h('div', { class: 'lista-interruptores' }, listaCategorias('entrada')),
            h('h3', { class: 'fin-sub' }, 'Categorias de saída'),
            h('div', { class: 'lista-interruptores' }, listaCategorias('saida')),
            h('p', { class: 'campo-dica' }, 'Desligar esconde a categoria na hora de lançar; o que já foi lançado nela continua.'),
            h('h3', { class: 'fin-sub' }, 'Nova categoria'),
            tipoNova.elemento, nomeNova.elemento, avisoNova.elemento, criar),
    });
}
