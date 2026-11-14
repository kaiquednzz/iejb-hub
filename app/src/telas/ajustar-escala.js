// O líder de grupo ajusta a escala com autonomia (D32, migração 15).
//
// Nos cultos PUBLICADOS em que o grupo dele está escalado, ele troca quem
// toca e o instrumento de cada um naquele culto. Mesa de som, grupo do culto,
// cancelar e publicar continuam com o líder de louvor (o banco garante).
// Quem é afetado é avisado, e o líder de louvor também ("por Fulano").
//
// Reaproveita as folhas de pessoa da tela Montar (mesmo comportamento).
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { rotuloDoDia, formatarHorario } from '../util/datas.js';
import { FUNCAO_MESA, naoVai } from '../util/escala.js';
import { avatar } from '../util/foto.js';
import { eLiderDeLouvor, nomeCurto } from '../sessao.js';
import { folhaItem, folhaAdicionarPessoa } from './montar/culto.js';

// Mesma regra do banco (privado.lidera_grupo_na_escala). O líder de louvor
// não precisa deste atalho: ele mexe em tudo pela aba Montar.
export function podeAjustar(culto, conta) {
    const escala = culto.escala?.[0];
    if (!escala || escala.estado !== 'publicada' || culto.estado !== 'ativo' || eLiderDeLouvor(conta)) return false;
    return escala.escala_grupo.some((g) => g.grupo?.lider_pessoa_id === conta.pessoa?.id);
}

export function blocoAjustar(culto, conta, aoMudar) {
    if (!podeAjustar(culto, conta)) return null;
    const botao = h('button', { type: 'button', class: 'link-pedido' }, icone('pessoas', 'icone icone-p'), 'Mudar quem toca');
    botao.addEventListener('click', () => abrirAjuste(culto, aoMudar));
    return h('div', { class: 'bloco-pedido' }, botao);
}

async function abrirAjuste(culto, aoMudar) {
    const escalaId = culto.escala[0].id;
    let mudou = false;
    let dados = null;

    const folha = abrirFolha({
        titulo: 'Mudar quem toca',
        conteudo: h('p', { class: 'folha-texto' }, 'Carregando…'),
        aoFechar: () => { if (mudou) aoMudar?.(); },
    });

    // As folhas da tela Montar esperam este formato de "culto" e "dados"
    async function recarregar() {
        const [itens, pessoas] = await Promise.all([
            supabase.from('escala_item').select('id, pessoa_id, instrumento_exibido, origem_grupo_id, saiu_em').eq('escala_id', escalaId),
            supabase.from('pessoa').select('id, nome, apelido, instrumentos, foto, ativa').eq('ativa', true).order('nome'),
        ]);
        const erro = itens.error || pessoas.error;
        if (erro) {
            folha.trocarConteudo(h('p', { class: 'aviso-form', 'data-tipo': 'erro' }, mensagemDoBanco(erro)));
            return;
        }
        const porId = new Map(pessoas.data.map((p) => [p.id, p]));
        dados = { doLouvor: pessoas.data, porId };
        desenhar({ id: culto.id, escala: { id: escalaId, estado: 'publicada' }, itens: itens.data, gruposIds: [] });
    }

    async function fazer(acao, sucesso) {
        const { error } = await acao();
        if (error) { avisar(mensagemDoBanco(error)); return false; }
        mudou = true;
        if (sucesso) avisar(sucesso);
        await recarregar();
        return true;
    }

    function desenhar(cultoLocal) {
        const pessoas = cultoLocal.itens
            .filter((i) => i.instrumento_exibido.some((x) => x !== FUNCAO_MESA) || !i.instrumento_exibido.includes(FUNCAO_MESA))
            .map((i) => ({ ...i, pessoa: dados.porId.get(i.pessoa_id) }))
            .filter((i) => i.pessoa)
            .sort((a, b) => nomeCurto(a.pessoa).localeCompare(nomeCurto(b.pessoa), 'pt-BR'));

        const adicionar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('mais'), 'Adicionar pessoa');
        adicionar.addEventListener('click', () => folhaAdicionarPessoa(cultoLocal, dados, fazer));

        folha.trocarConteudo(h('div', { class: 'folha-pilha' },
            h('p', { class: 'folha-texto' }, `${culto.nome} · ${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
            h('ul', { class: 'lista-linhas lista-linhas-compacta' }, pessoas.map((item) => {
                const linha = h('button', { type: 'button', class: 'linha-caixa linha-tocavel' },
                    avatar(item.pessoa),
                    h('span', { class: 'linha-textos' },
                        h('span', { class: 'linha-nome' }, nomeCurto(item.pessoa)),
                        naoVai(item)
                            ? h('span', { class: 'linha-detalhe linha-nao-vai' }, 'Avisou que não vai · toque para trocar')
                            : h('span', { class: 'linha-detalhe' },
                                item.instrumento_exibido.filter((x) => x !== FUNCAO_MESA).join(', ') || 'sem instrumento')),
                    icone('seta', 'icone icone-p linha-seta'));
                linha.addEventListener('click', () => folhaItem(item, cultoLocal, fazer));
                return h('li', { class: 'linha' }, linha);
            })),
            adicionar,
            h('p', { class: 'folha-texto folha-texto-pequeno' },
                'Quem entrar, sair ou mudar de instrumento é avisado, e o líder de louvor também. Mesa de som e grupo do culto ficam com o líder de louvor.'),
        ));
    }

    await recarregar();
}
