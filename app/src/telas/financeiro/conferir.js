// "Conferir contagem" (D48): aparece na Início de quem foi chamado para
// conferir o dinheiro contado no culto. Essa pessoa não precisa ter cargo
// nenhum: ela só vê a contagem que está com ela (o banco garante) e responde
// "Confere" ou "Não bateu". Só depois de conferida a contagem entra no caixa.
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { caixaDeAviso } from '../moldura.js';
import { reais, dataCurta, nomeDe } from './util.js';

export function blocoConferir(conta) {
    const lugar = h('div', { class: 'inicio-conferir', 'aria-live': 'polite' });
    if (conta?.pessoa?.id) carregar();
    return lugar;

    async function carregar() {
        const { data, error } = await supabase.from('contagem')
            .select('id, data, dizimos_centavos, ofertas_centavos, observacao, contado:pessoa!contagem_contado_por_fkey ( nome, apelido )')
            .eq('estado', 'aguardando')
            .eq('conferente_id', conta.pessoa.id)
            .order('data');
        if (error || !data?.length) return lugar.replaceChildren();
        lugar.replaceChildren(...data.map(cartao));
    }

    function cartao(c) {
        const total = c.dizimos_centavos + c.ofertas_centavos;
        const confere = h('button', { type: 'button', class: 'botao-principal' }, icone('certo'), 'Confere');
        const naoBateu = h('button', { type: 'button', class: 'botao-secundario' }, 'Não bateu');
        confere.addEventListener('click', () => comCarregando(confere, async () => {
            const { error } = await supabase.rpc('decidir_contagem', { p_contagem: c.id, p_confere: true });
            if (error) return avisar(mensagemDoBanco(error));
            avisar('Conferida. Já entrou no caixa.');
            carregar();
        }));
        naoBateu.addEventListener('click', () => folhaNaoBateu(c, carregar));
        return h('section', { class: 'cartao-conferir', 'aria-label': `Conferir contagem de ${dataCurta(c.data)}` },
            h('p', { class: 'conferir-rotulo' }, icone('moeda', 'icone icone-p'), `Conferir contagem · ${dataCurta(c.data)}`),
            h('p', { class: 'conferir-total' }, reais(total)),
            h('dl', { class: 'conferir-partes' },
                c.dizimos_centavos > 0 && h('div', null, h('dt', null, 'Dízimos'), h('dd', null, reais(c.dizimos_centavos))),
                c.ofertas_centavos > 0 && h('div', null, h('dt', null, 'Ofertas'), h('dd', null, reais(c.ofertas_centavos)))),
            h('p', { class: 'conferir-quem' }, `Contado por ${nomeDe(c.contado)}. Confira se bate com o que você contou.`),
            c.observacao && h('p', { class: 'conferir-obs' }, c.observacao),
            h('div', { class: 'conferir-botoes' }, naoBateu, confere),
        );
    }
}

function folhaNaoBateu(c, aoTerminar) {
    const aviso = caixaDeAviso();
    const texto = h('textarea', { id: 'motivo-contagem', class: 'campo-texto', rows: 3, maxlength: 300, required: true,
        placeholder: 'Ex.: contei R$ 40,00 nas ofertas' });
    const enviar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Avisar a tesouraria');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, 'A contagem volta para a tesouraria e não entra no caixa. Diga o que você contou.'),
        h('div', { class: 'campo' }, h('label', { for: 'motivo-contagem' }, 'O que não bateu'), texto),
        aviso.elemento, enviar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        comCarregando(enviar, async () => {
            aviso.limpar();
            if (!texto.value.trim()) return aviso.mostrar('Escreva o que não bateu.');
            const { error } = await supabase.rpc('decidir_contagem', { p_contagem: c.id, p_confere: false, p_motivo: texto.value.trim() });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('A tesouraria foi avisada.');
            aoTerminar();
        });
    });
    const folha = abrirFolha({ titulo: 'Não bateu', conteudo: form });
}
