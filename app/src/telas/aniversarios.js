// Aniversários (D69). Só dia e mês, opcional: ninguém precisa contar a idade.
// A igreja toda vê no Início (hoje e amanhã) e recebe a notificação na véspera
// (privado.avisar_aniversarios, todo dia às 9h).
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { hojeEmBrasilia, somarDias } from '../util/datas.js';
import { avatar, caixaDeAviso } from './moldura.js';
import { nomeCurto } from '../sessao.js';

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const textoAniversario = (p) =>
    p?.aniversario_dia ? `${p.aniversario_dia} de ${MESES[p.aniversario_mes - 1]}` : null;

// --- Escolher a data (Você e boas-vindas) -------------------------------------
// Dois seletores nativos (dia e mês): no celular viram a roda do sistema, que
// todo mundo já sabe usar. Sem ano, de propósito.
export function camposAniversario(pessoa) {
    const dia = h('select', { id: 'aniv-dia', class: 'campo-select', 'aria-label': 'Dia' },
        h('option', { value: '' }, 'Dia'),
        Array.from({ length: 31 }, (_, i) => h('option', { value: i + 1, selected: pessoa?.aniversario_dia === i + 1 }, String(i + 1))));
    const mes = h('select', { id: 'aniv-mes', class: 'campo-select', 'aria-label': 'Mês' },
        h('option', { value: '' }, 'Mês'),
        MESES.map((m, i) => h('option', { value: i + 1, selected: pessoa?.aniversario_mes === i + 1 }, m[0].toUpperCase() + m.slice(1))));
    // Trinta e um de abril não existe: o dia se ajusta ao mês escolhido
    const ajustar = () => {
        const max = mes.value ? DIAS_NO_MES[mes.value - 1] : 31;
        for (const o of dia.options) if (o.value) o.disabled = Number(o.value) > max;
        if (Number(dia.value) > max) dia.value = String(max);
    };
    mes.addEventListener('change', ajustar);
    ajustar();
    return {
        elemento: h('div', { class: 'aniversario-campos' }, dia, mes),
        valor: () => (dia.value && mes.value ? { dia: Number(dia.value), mes: Number(mes.value) } : null),
        incompleto: () => !!dia.value !== !!mes.value,
    };
}

export async function salvarAniversario(valor) {
    return supabase.rpc('definir_meu_aniversario', { p_dia: valor?.dia ?? null, p_mes: valor?.mes ?? null });
}

export function folhaAniversario(conta, aoSalvar) {
    const campos = camposAniversario(conta.pessoa);
    const aviso = caixaDeAviso();
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar');
    const tirar = conta.pessoa?.aniversario_dia && h('button', { type: 'button', class: 'botao-texto' }, 'Tirar meu aniversário');
    const form = h('form', { class: 'form', novalidate: true },
        h('fieldset', { class: 'campo' }, h('legend', null, 'Quando é seu aniversário?'), campos.elemento,
            h('p', { class: 'campo-dica' }, 'A igreja recebe um aviso na véspera. Não precisa dizer o ano.')),
        aviso.elemento, salvar, tirar);
    const folha = abrirFolha({ titulo: 'Aniversário', conteudo: form });

    const gravar = async (valor) => {
        const { error } = await salvarAniversario(valor);
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        conta.pessoa.aniversario_dia = valor?.dia ?? null;
        conta.pessoa.aniversario_mes = valor?.mes ?? null;
        folha.fechar();
        avisar(valor ? 'Aniversário salvo.' : 'Aniversário tirado.');
        aoSalvar?.();
    };
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        aviso.limpar();
        const valor = campos.valor();
        if (!valor) return aviso.mostrar('Escolha o dia e o mês.');
        comCarregando(salvar, () => gravar(valor));
    });
    tirar?.addEventListener('click', () => comCarregando(tirar, () => gravar(null)));
}

// --- No Início: quem faz aniversário hoje e amanhã ---------------------------
export function blocoAniversarios() {
    const lugar = h('section', { class: 'aniversarios', hidden: true, 'aria-labelledby': 'titulo-aniversarios' });
    carregar();
    return lugar;

    async function carregar() {
        const hoje = hojeEmBrasilia();
        const amanha = somarDias(hoje, 1);
        const partes = (iso) => ({ dia: Number(iso.slice(8, 10)), mes: Number(iso.slice(5, 7)) });
        const [a, b] = [partes(hoje), partes(amanha)];
        const { data, error } = await supabase.from('pessoa')
            .select('id, nome, apelido, foto, aniversario_dia, aniversario_mes')
            .eq('ativa', true)
            .or(`and(aniversario_mes.eq.${a.mes},aniversario_dia.eq.${a.dia}),and(aniversario_mes.eq.${b.mes},aniversario_dia.eq.${b.dia})`);
        if (error || !data?.length) return;
        const deHoje = data.filter((p) => p.aniversario_mes === a.mes && p.aniversario_dia === a.dia);
        const deAmanha = data.filter((p) => !deHoje.includes(p));
        lugar.replaceChildren(
            h('h2', { class: 'sr-only', id: 'titulo-aniversarios' }, 'Aniversários'),
            deHoje.length > 0 && faixa('hoje', deHoje),
            deAmanha.length > 0 && faixa('amanha', deAmanha));
        lugar.hidden = false;
    }

    function faixa(quando, pessoas) {
        const nomes = juntar(pessoas.map((p) => nomeCurto(p)));
        return h('div', { class: `aniversario-faixa ${quando}` },
            h('span', { class: 'aniversario-rostos' }, pessoas.slice(0, 3).map((p) => avatar(p, 'pessoa-avatar aniversario-rosto'))),
            h('p', { class: 'aniversario-texto' },
                h('span', { class: 'aniversario-quando' }, quando === 'hoje' ? 'Hoje' : 'Amanhã'),
                ` é aniversário de `, h('strong', null, nomes), quando === 'hoje' ? '! 🎉' : '!'),
            quando === 'hoje' && icone('presente', 'icone aniversario-icone'));
    }
}

const juntar = (nomes) => (nomes.length < 2 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`);
