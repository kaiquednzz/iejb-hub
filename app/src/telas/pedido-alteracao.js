// Pedido de alteração (RN-37 a RN-39, fluxo 6.3).
//
// O líder de grupo NÃO edita a escala: ele pede, em texto livre, num culto
// publicado em que o grupo dele foi escalado. O líder de louvor aprova ou
// reprova (motivo opcional). Aprovar não muda a escala sozinho: ele faz a
// mudança, e o aviso normal vai para quem foi afetado.
// Os avisos do próprio pedido (RN-46, RN-47) são criados por gatilho no banco.
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { rotuloDoDia, formatarHorario } from '../util/datas.js';
import { avatar } from '../util/foto.js';
import { eLiderDeLouvor, nomeCurto } from '../sessao.js';
import { caixaDeAviso } from './moldura.js';

const ESTADOS = { pendente: 'Esperando o líder', aprovada: 'Aprovado', reprovada: 'Reprovado' };

// Mesma regra do banco (lidera_grupo_na_escala): escala publicada e um dos
// grupos escalados é liderado por mim. O líder de louvor edita direto, não pede.
export function podePedirAlteracao(culto, conta) {
    const escala = culto.escala?.[0];
    if (!escala || escala.estado !== 'publicada' || eLiderDeLouvor(conta)) return false;
    return escala.escala_grupo.some((g) => g.grupo?.lider_pessoa_id === conta.pessoa?.id);
}

// ---------------------------------------------------------------------------
// No cartão do culto (aba Escala): pedir + acompanhar os meus pedidos
// ---------------------------------------------------------------------------
export function blocoPedido(culto, conta, aoMudar) {
    if (!podePedirAlteracao(culto, conta)) return null;
    const meus = (culto.escala[0].solicitacao_alteracao ?? [])
        .filter((s) => s.autor_pessoa_id === conta.pessoa?.id)
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

    const pedir = h('button', { type: 'button', class: 'link-pedido' }, icone('mensagem', 'icone icone-p'), 'Pedir alteração na escala');
    pedir.addEventListener('click', () => folhaPedir(culto, aoMudar));

    return h('div', { class: 'bloco-pedido' },
        meus.length > 0 && h('ul', { class: 'meus-pedidos' }, meus.map((s) => h('li', { class: `pedido-${s.estado}` },
            h('span', { class: `estado-pill estado-pedido-${s.estado}` }, ESTADOS[s.estado]),
            h('p', { class: 'pedido-texto' }, s.texto),
            s.motivo && h('p', { class: 'pedido-motivo' }, `Motivo: ${s.motivo}`),
        ))),
        pedir,
    );
}

function folhaPedir(culto, aoMudar) {
    const aviso = caixaDeAviso();
    const texto = h('textarea', {
        name: 'texto', class: 'campo-texto', rows: 4, maxlength: 1000, required: true,
        placeholder: 'Ex.: o Fulano não pode no domingo, o Ciclano toca no lugar dele.',
        'aria-label': 'O que precisa mudar',
    });
    const contador = h('span', { class: 'campo-dica contador', 'aria-live': 'polite' }, '0/1000');
    texto.addEventListener('input', () => { contador.textContent = `${texto.value.length}/1000`; });
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Enviar ao líder de louvor');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `${culto.nome} · ${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
        h('div', { class: 'campo' }, h('label', { for: 'campo-pedido' }, 'O que precisa mudar?'), texto, contador),
        h('p', { class: 'folha-texto folha-texto-pequeno' }, 'O líder de louvor recebe um aviso. Se ele aprovar, ele mesmo muda a escala e quem for afetado é avisado.'),
        aviso.elemento,
        botao,
    );
    texto.id = 'campo-pedido';
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const valor = texto.value.trim();
        if (!valor) return aviso.mostrar('Escreva o que precisa mudar.');
        await comCarregando(botao, async () => {
            const { error } = await supabase.from('solicitacao_alteracao')
                .insert({ escala_id: culto.escala[0].id, texto: valor });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Pedido enviado ao líder de louvor.');
            aoMudar?.();
        });
    });
    const folha = abrirFolha({ titulo: 'Pedir alteração', conteudo: form });
}

// ---------------------------------------------------------------------------
// Para o líder de louvor (tela Montar): os pedidos pendentes
// ---------------------------------------------------------------------------
export async function carregarPedidosPendentes() {
    const { data, error } = await supabase.from('solicitacao_alteracao')
        .select(`id, texto, criado_em,
                 autor:autor_pessoa_id ( id, nome, apelido, foto ),
                 escala:escala_id ( culto:culto_id ( id, nome, data, horario ) )`)
        .eq('estado', 'pendente')
        .order('criado_em');
    return error ? [] : data;
}

// abrirCulto(cultoId, dataDoCulto): a tela Montar decide como abrir (pode
// precisar trocar de mês). aoDecidir: recarrega a tela.
export function secaoPedidosPendentes(pedidos, { abrirCulto, aoDecidir }) {
    if (!pedidos.length) return null;
    return h('section', { class: 'pedidos-pendentes', 'aria-labelledby': 'titulo-pedidos' },
        h('h2', { id: 'titulo-pedidos', class: 'titulo-pedidos' },
            icone('mensagem', 'icone icone-p'),
            pedidos.length === 1 ? '1 pedido de alteração' : `${pedidos.length} pedidos de alteração`),
        pedidos.map((p) => {
            const culto = p.escala?.culto;
            const ver = h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, 'Ver culto');
            const reprovar = h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, 'Reprovar');
            const aprovar = h('button', { type: 'button', class: 'botao-principal botao-pequeno' }, 'Aprovar');
            ver.addEventListener('click', () => culto && abrirCulto(culto.id, culto.data));
            reprovar.addEventListener('click', () => folhaReprovar(p, aoDecidir));
            aprovar.addEventListener('click', () => comCarregando(aprovar, async () => {
                const { error } = await supabase.rpc('decidir_solicitacao', { p_solicitacao: p.id, p_aprovar: true });
                if (error) return avisar(mensagemDoBanco(error));
                avisar(`Aprovado. ${nomeCurto(p.autor)} foi avisado. Agora faça a mudança no culto.`);
                await aoDecidir();
                if (culto) abrirCulto(culto.id, culto.data);
            }));
            return h('article', { class: 'cartao-pedido-alteracao' },
                h('div', { class: 'pedido-cabeca' },
                    avatar(p.autor),
                    h('div', { class: 'linha-textos' },
                        h('span', { class: 'linha-nome' }, nomeCurto(p.autor)),
                        culto && h('span', { class: 'linha-detalhe' }, `${culto.nome} · ${rotuloDoDia(culto.data)}`)),
                ),
                h('p', { class: 'pedido-texto' }, p.texto),
                h('div', { class: 'pedido-botoes' }, ver, reprovar, aprovar),
            );
        }),
    );
}

function folhaReprovar(pedido, aoDecidir) {
    const motivo = h('textarea', { class: 'campo-texto', rows: 3, maxlength: 500, 'aria-label': 'Motivo (opcional)', placeholder: 'Opcional' });
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'button', class: 'botao-perigo botao-largo' }, 'Reprovar pedido');
    botao.addEventListener('click', () => comCarregando(botao, async () => {
        const { error } = await supabase.rpc('decidir_solicitacao', {
            p_solicitacao: pedido.id, p_aprovar: false, p_motivo: motivo.value.trim() || null,
        });
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        folha.fechar();
        avisar(`Reprovado. ${nomeCurto(pedido.autor)} foi avisado.`);
        await aoDecidir();
    }));
    const folha = abrirFolha({
        titulo: 'Reprovar pedido',
        conteudo: h('div', { class: 'form' },
            h('blockquote', { class: 'pedido-texto citado' }, pedido.texto),
            h('div', { class: 'campo' }, h('label', null, 'Motivo'), motivo),
            aviso.elemento, botao),
    });
}
