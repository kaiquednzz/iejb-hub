// Grupos G1, G2, G3: quem está em cada um e o instrumento PADRÃO da pessoa
// naquele grupo (RN-17). É esse padrão que vai para a escala ao usar o grupo.
//
// Quem mexe: admin e líder de louvor em todos; o líder do grupo só no dele
// (RN-16). Escolher o líder do grupo: só admin e líder de louvor.
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, confirmar, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { caixaDeAviso } from '../moldura.js';
import { pessoasDoLouvor, sugestoesDeInstrumento } from './dados.js';
import { seletorInstrumentos, interruptor, linhaPessoa, selo, vazio } from './pecas.js';

export function secaoGrupos(dados, ctx) {
    // Admin e líder de louvor criam grupo novo (o banco já permitia; faltava o botão)
    const novo = dados.papeis.gerePessoas
        ? h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('mais', 'icone icone-p'), 'Novo grupo')
        : null;
    novo?.addEventListener('click', () => folhaGrupo(null, dados, ctx));
    return h('div', { class: 'secao lista-grupos' },
        dados.grupos.length === 0 && vazio('Nenhum grupo ainda.', null),
        dados.grupos.map((grupo, i) => cartaoGrupo(grupo, i, dados, ctx)),
        novo);
}

// Criar (grupo = null) ou renomear/desativar um grupo
function folhaGrupo(grupo, dados, ctx) {
    const aviso = caixaDeAviso();
    const id = 'grupo-nome-campo';
    const entrada = h('input', { id, type: 'text', class: 'fin-entrada', maxlength: 30, value: grupo?.nome ?? '', placeholder: 'Ex.: G4', autocomplete: 'off' });
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, grupo ? 'Salvar' : 'Criar grupo');
    const form = h('form', { class: 'form', novalidate: true },
        h('div', { class: 'campo' }, h('label', { for: id }, 'Nome do grupo'), entrada), aviso.elemento, salvar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const nome = entrada.value.trim();
        if (!nome) return aviso.mostrar('Dê um nome ao grupo.');
        comCarregando(salvar, async () => {
            const { error } = grupo
                ? await supabase.from('grupo').update({ nome }).eq('id', grupo.id)
                : await supabase.from('grupo').insert({ nome, ministerio_id: dados.ministerioId });
            if (error) return aviso.mostrar(error.code === '23505' ? 'Já existe um grupo com esse nome.' : mensagemDoBanco(error));
            folha.fechar();
            avisar(grupo ? 'Grupo salvo.' : `${nome} criado. Agora adicione as pessoas.`);
            await ctx.recarregar();
        });
    });

    // Desativar: some das listas, mas escalas antigas continuam como estão
    const desativar = grupo && h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Desativar grupo');
    desativar?.addEventListener('click', async () => {
        const ok = await confirmar({
            titulo: `Desativar o ${grupo.nome}?`,
            texto: 'Ele some das listas. Escalas já feitas não mudam.',
            botao: 'Desativar', perigo: true,
        });
        if (!ok) return;
        await comCarregando(desativar, async () => {
            const { error } = await supabase.from('grupo').update({ ativo: false }).eq('id', grupo.id);
            if (error) return avisar(mensagemDoBanco(error));
            folha.fechar();
            avisar(`${grupo.nome} desativado.`);
            await ctx.recarregar();
        });
    });

    const folha = abrirFolha({
        titulo: grupo ? grupo.nome : 'Novo grupo',
        conteudo: h('div', { class: 'folha-pilha' }, form, desativar && h('div', { class: 'bloco bloco-final' }, desativar)),
    });
}

function podeEditar(grupo, papeis) {
    return papeis.gerePessoas || papeis.gruposQueLidero.has(grupo.id);
}

function cartaoGrupo(grupo, indice, dados, ctx) {
    const editavel = podeEditar(grupo, dados.papeis);
    const lider = dados.porId.get(grupo.lider_pessoa_id);
    const membros = grupo.grupo_membro
        .map((m) => ({ ...m, pessoa: dados.porId.get(m.pessoa_id) }))
        .filter((m) => m.pessoa)
        // Líder primeiro, depois por nome
        .sort((a, b) => (b.pessoa_id === grupo.lider_pessoa_id) - (a.pessoa_id === grupo.lider_pessoa_id)
            || (a.pessoa.apelido || a.pessoa.nome).localeCompare(b.pessoa.apelido || b.pessoa.nome, 'pt-BR'));

    const adicionar = editavel
        ? h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, icone('mais', 'icone icone-p'), 'Adicionar')
        : null;
    adicionar?.addEventListener('click', () => folhaAdicionar(grupo, dados, ctx));
    const editarGrupo = dados.papeis.gerePessoas
        ? h('button', { type: 'button', class: 'botao-icone botao-icone-p', 'aria-label': `Renomear ou desativar o ${grupo.nome}` }, icone('reticencias', 'icone icone-p'))
        : null;
    editarGrupo?.addEventListener('click', () => folhaGrupo(grupo, dados, ctx));

    return h('section', { class: 'cartao-grupo', style: { '--i': indice }, 'aria-labelledby': `grupo-${grupo.id}` },
        h('header', { class: 'grupo-topo' },
            h('div', null,
                h('h2', { id: `grupo-${grupo.id}`, class: 'grupo-nome' }, grupo.nome),
                h('p', { class: 'grupo-info' },
                    `${membros.length} ${membros.length === 1 ? 'pessoa' : 'pessoas'}`,
                    ' · ',
                    lider ? `líder: ${lider.apelido || lider.nome}` : 'sem líder'),
            ),
            h('div', { class: 'grupo-acoes' }, adicionar, editarGrupo),
        ),
        membros.length === 0
            ? h('p', { class: 'cartao-vazio' }, editavel ? 'Ninguém neste grupo ainda. Toque em Adicionar.' : 'Ninguém neste grupo ainda.')
            : h('ul', { class: 'lista-linhas lista-linhas-compacta' }, membros.map((m) => linhaPessoa({
                pessoa: m.pessoa,
                sou: m.pessoa_id === dados.minhaPessoa,
                detalhe: m.instrumentos.join(', ') || 'instrumento não definido',
                selos: [
                    m.pessoa_id === grupo.lider_pessoa_id && selo('Líder'),
                    !m.pessoa.ativa && selo('Desativada', 'neutro'),
                ].filter(Boolean),
                aoTocar: editavel ? () => folhaMembro(grupo, m, dados, ctx) : null,
            }))),
    );
}

// Escolher quem entra + os instrumentos dela neste grupo
function folhaAdicionar(grupo, dados, ctx) {
    const jaEstao = new Set(grupo.grupo_membro.map((m) => m.pessoa_id));
    const candidatas = pessoasDoLouvor(dados).filter((p) => !jaEstao.has(p.id));
    if (candidatas.length === 0) {
        abrirFolha({
            titulo: `Adicionar ao ${grupo.nome}`,
            conteudo: h('p', { class: 'folha-texto' },
                'Todo mundo do Louvor já está neste grupo. Para incluir alguém novo, cadastre a pessoa em "Pessoas" primeiro.'),
        });
        return;
    }

    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Adicionar');
    const instrumentos = seletorInstrumentos({ sugestoes: sugestoesDeInstrumento(dados), rotulo: `O que toca no ${grupo.nome}` });

    // Lista de escolha única, em botões grandes (melhor que <select> no toque)
    let escolhida = null;
    const opcoes = h('div', { class: 'escolha-pessoas', role: 'radiogroup', 'aria-label': 'Quem entra no grupo' },
        candidatas.map((p) => {
            const opcao = h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'escolha-pessoa' },
                p.apelido || p.nome);
            opcao.addEventListener('click', () => {
                escolhida = p;
                opcoes.querySelectorAll('[role="radio"]').forEach((o) => o.setAttribute('aria-checked', String(o === opcao)));
                // O padrão geral da pessoa vira o ponto de partida neste grupo
                instrumentos.marcar(p.instrumentos);
            });
            return opcao;
        }));

    const form = h('form', { class: 'form', novalidate: true },
        h('fieldset', { class: 'campo' }, h('legend', null, 'Quem entra'), opcoes),
        instrumentos.elemento,
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        if (!escolhida) return aviso.mostrar('Escolha quem entra no grupo.');
        await comCarregando(botao, async () => {
            const { error } = await supabase.from('grupo_membro').insert({
                grupo_id: grupo.id, pessoa_id: escolhida.id, instrumentos: instrumentos.valores(),
            });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar(`${escolhida.apelido || escolhida.nome} entrou no ${grupo.nome}.`);
            await ctx.recarregar();
        });
    });
    const folha = abrirFolha({ titulo: `Adicionar ao ${grupo.nome}`, conteudo: form });
}

// Um membro: trocar instrumentos, tornar líder, tirar do grupo
function folhaMembro(grupo, membro, dados, ctx) {
    const nome = membro.pessoa.apelido || membro.pessoa.nome;
    const eLider = membro.pessoa_id === grupo.lider_pessoa_id;
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar');
    const instrumentos = seletorInstrumentos({
        sugestoes: sugestoesDeInstrumento(dados), marcados: membro.instrumentos, rotulo: `O que toca no ${grupo.nome}`,
    });

    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `É o que aparece na escala quando o ${grupo.nome} toca. Num culto específico o líder de louvor pode trocar.`),
        instrumentos.elemento,
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        await comCarregando(botao, async () => {
            const { error } = await supabase.from('grupo_membro')
                .update({ instrumentos: instrumentos.valores() }).eq('id', membro.id);
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar('Instrumentos salvos.');
            await ctx.recarregar();
        });
    });

    // Só admin e líder de louvor escolhem o líder do grupo
    const lideranca = dados.papeis.gerePessoas && h('section', { class: 'bloco' },
        interruptor({
            rotulo: `Líder do ${grupo.nome}`,
            descricao: eLider ? null : (grupo.lider_pessoa_id ? 'Substitui o líder atual.' : 'O grupo ainda não tem líder.'),
            ligado: eLider,
            aoMudar: async (valor) => {
                const { error } = await supabase.from('grupo')
                    .update({ lider_pessoa_id: valor ? membro.pessoa_id : null }).eq('id', grupo.id);
                if (error) { avisar(mensagemDoBanco(error)); return false; }
                avisar(valor ? `${nome} agora lidera o ${grupo.nome}.` : `O ${grupo.nome} ficou sem líder.`);
                ctx.recarregar();
                return true;
            },
        }));

    const tirar = h('button', { type: 'button', class: 'botao-texto-perigo' }, `Tirar do ${grupo.nome}`);
    tirar.addEventListener('click', async () => {
        if (eLider && !dados.papeis.gerePessoas) {
            return avisar('Para sair o líder, peça ao líder de louvor para escolher outro antes.');
        }
        const ok = await confirmar({
            titulo: `Tirar ${nome} do ${grupo.nome}?`,
            texto: eLider
                ? `${nome} é o líder do grupo: o ${grupo.nome} vai ficar sem líder. Escalas já montadas não mudam.`
                : 'Escalas já montadas não mudam. Dá para adicionar de novo depois.',
            botao: 'Tirar do grupo', perigo: true,
        });
        if (!ok) return;
        await comCarregando(tirar, async () => {
            // O líder precisa ser membro (chave grupo_lider_e_membro): solta antes
            if (eLider) {
                const { error } = await supabase.from('grupo').update({ lider_pessoa_id: null }).eq('id', grupo.id);
                if (error) return avisar(mensagemDoBanco(error));
            }
            const { error } = await supabase.from('grupo_membro').delete().eq('id', membro.id);
            if (error) return avisar(mensagemDoBanco(error));
            folha.fechar();
            avisar(`${nome} saiu do ${grupo.nome}.`);
            await ctx.recarregar();
        });
    });

    const folha = abrirFolha({
        titulo: `${nome} no ${grupo.nome}`,
        conteudo: h('div', { class: 'folha-pilha' }, form, lideranca, h('div', { class: 'bloco bloco-final' }, tirar)),
    });
}
