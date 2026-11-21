// Folhas do financeiro: lançar (entrada, saída, depósito), contagem do culto,
// detalhe com histórico, cancelar e ajustes (saldo inicial e categorias).
import { botaoCedulas } from './cedulas.js';
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { hojeEmBrasilia, rotuloDoDia, formatarHorario } from '../../util/datas.js';
import { caixaDeAviso } from '../moldura.js';
import { avatar } from '../moldura.js';
import { interruptor } from '../equipe/pecas.js';
import { reais, lerReais, dataCurta, FORMAS, nomeDe } from './util.js';
import { qrSvg } from '../../util/qr.js';
import { comemorar } from '../../util/comemorar.js';

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

// --- Contagem do culto (D48, D61) -------------------------------------------
// Quatro jeitos de conferir. O padrão é a testemunha com celular (QR): a pessoa
// que ajudou a contar digita o que ELA contou, sem ver o número de quem pediu.
const MODOS = [
    { id: 'qr', nome: 'Testemunha com celular' },
    { id: 'papel', nome: 'Testemunha sem celular' },
    { id: 'conta', nome: 'Alguém com conta no app' },
    { id: 'sozinha', nome: 'Contei sozinha' },
];
const BOTAO_DO_MODO = { qr: 'Mostrar o QR', papel: 'Conferir', conta: 'Pedir conferência', sozinha: 'Lançar sem conferência' };

export async function folhaContagem(dados, conta, recarregar, inicial = {}) {
    const aviso = caixaDeAviso();
    const caixa = dados.contas.find((c) => c.ativa && c.tipo === 'dinheiro') ?? dados.contas.find((c) => c.ativa);
    const data = campoSimples({ rotulo: 'Dia do culto', tipo: 'date', value: inicial.data ?? hojeEmBrasilia(), max: hojeEmBrasilia() });
    const culto = escolha({ rotulo: 'Culto', opcoes: [] });
    const dizimos = campoValor('Dízimos', inicial.dizimos);
    const ofertas = campoValor('Ofertas', inicial.ofertas);
    const total = h('p', { class: 'fin-contagem-total', 'aria-live': 'polite' }, 'Total: R$ 0,00');
    const obs = campoSimples({ rotulo: 'Observação (opcional)', maxlength: 300, placeholder: 'Ex.: uma nota de 50 rasgada', value: inicial.observacao ?? '' });
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' });

    // Partes que mudam com o modo
    const conferente = escolha({ rotulo: 'Quem confere', opcoes: [] });
    let pessoasCarregadas = false;
    const tNome = campoSimples({ rotulo: 'Nome de quem contou com você', maxlength: 60, autocomplete: 'off' });
    const tDizimos = campoValor('Dízimos que a pessoa anotou');
    const tOfertas = campoValor('Ofertas que a pessoa anotou');
    const areaModo = h('div', { class: 'fin-modo' });
    const modo = escolha({ rotulo: 'Quem confere com você?', opcoes: MODOS, valor: inicial.modo ?? 'qr', aoMudar: desenharModo });

    function desenharModo() {
        const m = modo.valor();
        salvar.textContent = BOTAO_DO_MODO[m];
        aviso.limpar();
        const dica = (texto) => h('p', { class: 'campo-dica fin-modo-dica' }, texto);
        if (m === 'qr') areaModo.replaceChildren(dica('A pessoa lê um QR com o celular dela e digita quanto contou.'));
        if (m === 'papel') areaModo.replaceChildren(
            dica('A pessoa anota no papel quanto contou. Digite o que ela anotou.'),
            tNome.elemento, h('div', { class: 'fin-dois' }, tDizimos.elemento, tOfertas.elemento));
        if (m === 'conta') {
            areaModo.replaceChildren(dica('A pessoa confere pelo app dela.'), conferente.elemento);
            carregarPessoas();
        }
        if (m === 'sozinha') areaModo.replaceChildren(dica('O pastor recebe um aviso.'));
    }

    async function carregarPessoas() {
        if (pessoasCarregadas) return;
        pessoasCarregadas = true;
        const { data: pessoas, error } = await supabase.rpc('quem_pode_conferir');
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        conferente.trocar(pessoas.map((p) => ({ id: p.id, nome: nomeDe(p) })));
        if (!pessoas.length) aviso.mostrar('Ninguém mais tem acesso ao app. Use a testemunha com ou sem celular.', 'info');
    }

    const somar = () => { total.textContent = `Total: ${reais((dizimos.centavos() ?? 0) + (ofertas.centavos() ?? 0))}`; };
    dizimos.entrada.addEventListener('input', somar);
    ofertas.entrada.addEventListener('input', somar);
    somar();

    async function buscarCultos() {
        const { data: cultos } = await supabase.from('culto').select('id, nome, horario').eq('data', data.entrada.value).eq('estado', 'ativo').order('horario');
        const lista = (cultos ?? []).map((c) => ({ id: c.id, nome: `${c.nome} · ${formatarHorario(c.horario)}` }));
        const opcoes = [...lista, { id: '', nome: 'Sem culto' }];
        culto.trocar(opcoes, opcoes.some((o) => o.id === inicial.culto) ? inicial.culto : (lista.at(-1)?.id ?? ''));
    }
    data.entrada.addEventListener('change', buscarCultos);

    const form = h('form', { class: 'form fin-form contagem', novalidate: true },
        h('p', { class: 'folha-texto folha-texto-pequeno' }, `Vai para ${caixa?.nome ?? 'o caixa'} depois da conferência.`),
        data.elemento, culto.elemento,
        h('div', { class: 'fin-dois' }, dizimos.elemento, ofertas.elemento),
        // Opcional: contar tocando nas figuras das notas em vez de digitar
        h('div', { class: 'fin-dois fin-cedulas' }, botaoCedulas(dizimos, 'Dízimos pelas notas'), botaoCedulas(ofertas, 'Ofertas pelas notas')),
        total, modo.elemento, areaModo, obs.elemento, aviso.elemento, salvar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(salvar, async () => {
            aviso.limpar();
            const d = dizimos.centavos() ?? 0;
            const o = ofertas.centavos() ?? 0;
            if ((dizimos.entrada.value && dizimos.centavos() === null) || (ofertas.entrada.value && ofertas.centavos() === null)) return aviso.mostrar('Algum valor não está certo. Ex.: 150 ou 1.250,90');
            if (d + o === 0) return aviso.mostrar('Digite quanto deu.');
            const base = { p_data: data.entrada.value, p_culto: culto.valor() || null, p_conta: caixa.id, p_dizimos: d, p_ofertas: o, p_observacao: obs.entrada.value.trim() || null };
            const m = modo.valor();

            if (m === 'conta') {
                if (!conferente.valor()) return aviso.mostrar('Escolha quem vai conferir.');
                const { error } = await supabase.from('contagem').insert({
                    data: base.p_data, culto_id: base.p_culto, conta_id: caixa.id, dizimos_centavos: d, ofertas_centavos: o,
                    observacao: base.p_observacao, contado_por: conta.pessoa.id, conferente_id: conferente.valor(),
                });
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                folha.fechar();
                avisar('Pedido de conferência enviado.');
                return recarregar();
            }
            if (m === 'sozinha') {
                const { error } = await supabase.rpc('contar_sozinha', base);
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                folha.fechar();
                avisar('Lançado sem conferência. O pastor foi avisado.');
                return recarregar();
            }
            if (m === 'papel') {
                const td = tDizimos.entrada.value.trim() === '' ? 0 : tDizimos.centavos();
                const to = tOfertas.entrada.value.trim() === '' ? 0 : tOfertas.centavos();
                if (tNome.entrada.value.trim().length < 2) return aviso.mostrar('Digite o nome de quem contou com você.');
                if (td === null || to === null) return aviso.mostrar('O valor anotado pela testemunha não está certo. Ex.: 150 ou 1.250,90');
                const { data: r, error } = await supabase.rpc('contar_com_testemunha_sem_celular',
                    { ...base, p_testemunha: tNome.entrada.value.trim(), p_t_dizimos: td, p_t_ofertas: to });
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                if (!r.bateu) {
                    const partes = [!r.dizimos && `dízimos (você ${reais(d)}, testemunha ${reais(td)})`, !r.ofertas && `ofertas (você ${reais(o)}, testemunha ${reais(to)})`].filter(Boolean);
                    return aviso.mostrar(`Não bateu: ${partes.join(' e ')}. Contem de novo.`);
                }
                folha.fechar();
                comemorar('Bateu!', `${tNome.entrada.value.trim()} conferiu. O valor já entrou no caixa.`);
                return recarregar();
            }
            // QR
            const { data: r, error } = await supabase.rpc('pedir_testemunha', base);
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            folhaQR(r.contagem, r.token, dados, conta, recarregar);
        });
    });
    const folha = abrirFolha({ titulo: 'Contagem do culto', conteudo: form });
    desenharModo();
    buscarCultos();
}

// O QR na tela de quem contou. Fica conferindo (de 3 em 3 s) se a testemunha
// já respondeu, e mantém a tela acesa enquanto está aberto.
export function folhaQR(contagemId, token, dados, conta, recarregar) {
    let tokenAtual = token;
    let ultimaTentativa = 0;
    let terminou = false;
    let vence = Date.now() + 15 * 60 * 1000;
    let travaTela = null;
    const lugarQR = h('div', { class: 'fin-qr' });
    const estado = h('p', { class: 'fin-qr-estado', role: 'status' }, 'Esperando a pessoa…');
    const relogio = h('p', { class: 'fin-qr-relogio' });
    const aviso = caixaDeAviso();
    const outroQR = h('button', { type: 'button', class: 'botao-secundario botao-largo', hidden: true }, 'Gerar outro QR');
    const semCelular = h('button', { type: 'button', class: 'botao-texto' }, 'A testemunha não tem celular');

    const desenharQR = () => {
        lugarQR.replaceChildren(qrSvg(`${location.origin}/#/testemunha/${tokenAtual}`, 'QR code para a testemunha conferir a contagem'));
        lugarQR.classList.remove('vencido');
        outroQR.hidden = true;
        vence = Date.now() + 15 * 60 * 1000;
    };
    desenharQR();

    outroQR.addEventListener('click', () => comCarregando(outroQR, async () => {
        const { data: novo, error } = await supabase.rpc('renovar_testemunha', { p_contagem: contagemId });
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        tokenAtual = novo;
        ultimaTentativa = 0;
        aviso.limpar();
        estado.textContent = 'Esperando a pessoa…';
        desenharQR();
    }));

    // Troca para "sem celular" sem perder o que já foi digitado
    semCelular.addEventListener('click', () => comCarregando(semCelular, async () => {
        const { data: c } = await supabase.from('contagem').select('data, culto_id, dizimos_centavos, ofertas_centavos, observacao').eq('id', contagemId).single();
        const { error } = await supabase.rpc('cancelar_contagem', { p_contagem: contagemId, p_motivo: 'Trocou para testemunha sem celular' });
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        terminou = true;
        folha.fechar();
        folhaContagem(dados, conta, recarregar, {
            modo: 'papel', data: c?.data, culto: c?.culto_id, dizimos: c?.dizimos_centavos, ofertas: c?.ofertas_centavos, observacao: c?.observacao,
        });
    }));

    async function conferir() {
        if (terminou) return;
        const resta = Math.max(0, vence - Date.now());
        relogio.textContent = resta ? `O QR vale por mais ${Math.floor(resta / 60000)}:${String(Math.floor(resta / 1000) % 60).padStart(2, '0')}` : 'QR vencido';
        if (!resta && outroQR.hidden) { lugarQR.classList.add('vencido'); outroQR.hidden = false; }
        const { data: c } = await supabase.from('contagem')
            .select('estado, tentativas, testemunha_nome, testemunha_dizimos_centavos, testemunha_ofertas_centavos, dizimos_centavos, ofertas_centavos')
            .eq('id', contagemId).maybeSingle();
        if (!c || terminou) return;
        if (c.estado === 'conferida') {
            terminou = true;
            folha.fechar();
            comemorar('Bateu!', `${c.testemunha_nome} conferiu. O valor já entrou no caixa.`);
            recarregar();
        } else if (c.estado !== 'aguardando') {
            terminou = true;
            folha.fechar();
        } else if (c.tentativas > ultimaTentativa) {
            ultimaTentativa = c.tentativas;
            const partes = [
                c.testemunha_dizimos_centavos !== c.dizimos_centavos && `dízimos (você ${reais(c.dizimos_centavos)}, ${c.testemunha_nome} ${reais(c.testemunha_dizimos_centavos)})`,
                c.testemunha_ofertas_centavos !== c.ofertas_centavos && `ofertas (você ${reais(c.ofertas_centavos)}, ${c.testemunha_nome} ${reais(c.testemunha_ofertas_centavos)})`,
            ].filter(Boolean);
            estado.textContent = `Não bateu: ${partes.join(' e ')}. Contem de novo.`;
            if (c.tentativas >= 5) { estado.textContent += ' Foram muitas tentativas: gere outro QR.'; outroQR.hidden = false; }
        }
    }
    const timer = setInterval(conferir, 3000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    navigator.wakeLock?.request('screen').then((t) => { travaTela = t; }).catch(() => {});
    conferir();

    const folha = abrirFolha({
        titulo: 'Testemunha',
        conteudo: h('div', { class: 'form fin-qr-folha' },
            h('p', { class: 'folha-texto' }, 'Peça para a pessoa apontar a câmera do celular aqui.'),
            lugarQR, relogio, estado, aviso.elemento, outroQR,
            h('p', { class: 'campo-dica' }, 'Pode fechar. O QR fica em "Contagens".'),
            semCelular),
        aoFechar: () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', aoVoltar);
            travaTela?.release().catch(() => {});
        },
    });
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

// Quem conferiu, em uma frase (D61). Lançamento antigo sem o dado: frase genérica.
export function origemDaContagem(c) {
    if (!c) return 'Contagem do culto, conferida por duas pessoas';
    if (c.modo === 'sozinha') return 'Contagem do culto, contada sozinha (sem conferência)';
    if (c.modo === 'qr') return `Contagem do culto, conferida por ${c.testemunha_nome} (testemunha pelo celular)`;
    if (c.modo === 'papel') return `Contagem do culto, conferida por ${c.testemunha_nome} (testemunha sem celular)`;
    return `Contagem do culto, conferida por ${nomeDe(c.conferente)} no app`;
}

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
        l.contagem_id && ['Origem', origemDaContagem(l.contagem)],
        l.cancelado_em && ['Cancelado', l.motivo_cancelamento],
    ].filter(Boolean);
    const folha = abrirFolha({
        titulo: { entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência' }[l.tipo],
        conteudo: h('div', { class: 'form' },
            h('p', { class: `fin-detalhe-valor ${l.tipo}${l.cancelado_em ? ' cancelado' : ''}` }, reais(l.valor_centavos)),
            h('dl', { class: 'fin-detalhe' }, linhas.map(([t, v]) => h('div', null, h('dt', null, t), h('dd', null, v)))),
            l.contagem_id && pode && h('p', { class: 'campo-dica' }, 'Veio de uma contagem: não se edita. Se estiver errado, cancele com o motivo e lance de novo.'),
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
