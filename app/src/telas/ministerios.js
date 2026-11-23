// Ministérios (redesign v2): a "porta" de cada ministério e das áreas da
// igreja. Cada ministério tem uma capa própria (o Louvor é o primeiro); os
// que vêm aí aparecem menores. As áreas de administração seguem as mesmas
// regras de quem vê o quê de antes (sessao.js), e o banco continua conferindo.
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { cabecalhoApp, contadorDePedidos, avatar, campo, caixaDeAviso } from './moldura.js';
import { linhaLista } from './voce.js';
import { veFinanceiro, cuidaDosEventos, eLiderDeLouvor, nomeCurto } from '../sessao.js';
import { abrirFolha, avisar, confirmar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { nomeDoTitulo } from '../util/titulos.js';

export function telaMinisterios(conta) {
    const areas = [
        conta.e_administrador && { href: '#/pessoas', nome: 'Pessoas', texto: 'Acessos e cadastro', nomeIcone: 'chave', id: 'pessoas' },
        cuidaDosEventos(conta) && { href: '#/eventos', nome: 'Eventos do site', texto: 'Agenda de iejb.com.br', nomeIcone: 'megafone' },
        veFinanceiro(conta) && { href: '#/financeiro', nome: 'Financeiro', texto: 'Caixa da igreja', nomeIcone: 'moeda' },
    ].filter(Boolean);
    const linhas = areas.map((a, i) => {
        const li = linhaLista(a);
        li.style.setProperty('--i', i + 2);
        if (a.id === 'pessoas') contadorDePedidos(li.querySelector('.item-nome'), 'item-contador');
        return li;
    });

    // Os outros ministérios (D71): por enquanto, quem serve e quem lidera
    const outros = h('ul', { class: 'capas-ministerios', 'aria-label': 'Outros ministérios' });
    carregarOutros(conta, outros);

    return h('div', { class: 'tela tela-app tela-ministerios' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Ministérios'),
            h('h2', { class: 'rotulo-secao' }, 'Ministérios'),
            // Capa do Louvor: a casa inteira é o link
            h('a', { class: 'capa-ministerio capa-louvor', href: '#/escala' },
                h('span', { class: 'capa-marca', 'aria-hidden': 'true' }, icone('musica')),
                h('span', { class: 'capa-sobre' }, 'Ministério de'),
                h('span', { class: 'capa-nome' }, 'Louvor'),
                h('span', { class: 'capa-texto' }, eLiderDeLouvor(conta) ? 'Escala, montar, repertórios e equipe' : 'Escala, repertórios e equipe'),
                h('span', { class: 'capa-acao' }, 'Entrar', icone('seta', 'icone icone-p'))),
            outros,
            linhas.length ? h('h2', { class: 'rotulo-secao' }, 'Administração') : null,
            linhas.length ? h('ul', { class: 'grupo-lista' }, linhas) : null,
        ),
    );
}

async function carregarOutros(conta, lugar) {
    const { data } = await supabase.from('ministerio')
        .select('id, nome, ativo, membro_ministerio ( ativo )')
        .neq('nome', 'Louvor').eq('ativo', true).order('nome');
    const itens = (data ?? []).map((m, i) => {
        const n = m.membro_ministerio.filter((v) => v.ativo).length;
        return h('li', { style: { '--i': i } }, h('a', { class: 'capa-outro', href: `#/ministerio/${m.id}` },
            h('span', { class: 'capa-outro-nome' }, m.nome),
            h('span', { class: 'capa-outro-texto' }, n === 0 ? 'Ninguém ainda' : n === 1 ? '1 pessoa' : `${n} pessoas`),
            icone('seta', 'icone icone-p capa-outro-seta')));
    });
    if (conta.e_administrador) {
        const novo = h('button', { type: 'button', class: 'capa-outro capa-novo' }, icone('mais', 'icone'), h('span', null, 'Novo ministério'));
        novo.addEventListener('click', () => folhaMinisterio(null, () => carregarOutros(conta, lugar)));
        itens.push(h('li', null, novo));
    }
    lugar.replaceChildren(...itens);
}

// Criar ou renomear um ministério (só o admin; o banco confere)
function folhaMinisterio(ministerio, depois) {
    const aviso = caixaDeAviso();
    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, ministerio ? 'Salvar' : 'Criar');
    const form = h('form', { class: 'form', novalidate: true },
        campo({ rotulo: 'Nome do ministério', nome: 'nome', autocomplete: 'off', autocapitalize: 'words', maxlength: 40,
            value: ministerio?.nome ?? '', placeholder: 'Ex.: Kids, Recepção, Mídia' }),
        h('p', { class: 'campo-dica' }, 'Quem serve nele você marca na ficha de cada pessoa, em Pessoas.'),
        aviso.elemento, salvar);
    const folha = abrirFolha({ titulo: ministerio ? 'Renomear ministério' : 'Novo ministério', conteudo: form });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        aviso.limpar();
        const nome = form.elements.nome.value.trim().replace(/\s+/g, ' ');
        if (!nome) return aviso.mostrar('Escreva o nome.');
        comCarregando(salvar, async () => {
            const { error } = ministerio
                ? await supabase.from('ministerio').update({ nome }).eq('id', ministerio.id)
                : await supabase.from('ministerio').insert({ nome });
            if (error) return aviso.mostrar(error.code === '23505' ? 'Já existe um ministério com esse nome.' : mensagemDoBanco(error));
            folha.fechar();
            avisar(ministerio ? 'Nome trocado.' : `${nome} criado.`);
            depois();
        });
    });
}

// --- Página de um ministério (fora o Louvor): quem lidera e quem serve -------
export function telaMinisterio(conta, id) {
    const lugar = h('div', { class: 'ministerio-pagina', 'aria-busy': 'true' }, h('div', { class: 'esqueleto ministerio-esqueleto' }));
    const titulo = h('h1', { class: 'casa-nome', tabindex: -1 }, ' ');
    const acoes = h('div', { class: 'casa-acoes' });
    const tela = h('div', { class: 'tela tela-app tela-ministerio' },
        cabecalhoApp(conta, { modulo: 'Ministério' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('header', { class: 'casa-topo' },
                h('div', { class: 'casa-linha' },
                    h('div', null, h('p', { class: 'casa-ministerio' }, 'Ministério de'), titulo),
                    acoes)),
            lugar));
    carregar();
    return tela;

    async function carregar() {
        const { data: m, error } = await supabase.from('ministerio')
            .select('id, nome, ativo, membro_ministerio ( e_lider, ativo, pessoa ( id, nome, apelido, foto, titulo, ativa ) )')
            .eq('id', id).maybeSingle();
        lugar.removeAttribute('aria-busy');
        if (error || !m) {
            lugar.replaceChildren(h('div', { class: 'estado-vazio' }, h('p', null, 'Ministério não encontrado.'),
                h('a', { class: 'botao-secundario', href: '#/ministerios' }, 'Voltar')));
            return;
        }
        if (m.nome === 'Louvor') { location.hash = '#/escala'; return; }
        titulo.textContent = m.nome;
        const vinculos = m.membro_ministerio.filter((v) => v.ativo && v.pessoa?.ativa);
        const lideres = vinculos.filter((v) => v.e_lider).map((v) => v.pessoa);
        const servem = vinculos.filter((v) => !v.e_lider).map((v) => v.pessoa)
            .sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b), 'pt-BR'));

        if (conta.e_administrador) {
            const opcoes = h('button', { type: 'button', class: 'botao-icone', 'aria-label': 'Opções do ministério' }, icone('reticencias'));
            opcoes.addEventListener('click', () => folhaOpcoes(m));
            acoes.replaceChildren(opcoes);
        }
        const rosto = (p, i) => h('li', { style: { '--i': Math.min(i, 12) } },
            h('div', { class: 'mural-pessoa' },
                avatar(p, 'pessoa-avatar mural-rosto'),
                h('span', { class: 'mural-nome' }, nomeCurto(p)),
                p.titulo && p.titulo !== 'membro' && h('span', { class: 'mural-instrumentos' }, nomeDoTitulo(p.titulo))));
        lugar.replaceChildren(...[
            h('h2', { class: 'rotulo-secao' }, lideres.length === 1 ? 'Quem lidera' : 'Quem lidera'),
            lideres.length ? h('ul', { class: 'mural' }, lideres.map(rosto)) : h('p', { class: 'ministerio-vazio' }, 'Ninguém marcado como líder ainda.'),
            h('h2', { class: 'rotulo-secao' }, 'Quem serve'),
            servem.length ? h('ul', { class: 'mural' }, servem.map(rosto)) : h('p', { class: 'ministerio-vazio' }, 'Ninguém ainda.'),
            conta.e_administrador && h('p', { class: 'campo-dica ministerio-dica' },
                'Para incluir alguém ou marcar quem lidera, abra a pessoa em ', h('a', { href: '#/pessoas' }, 'Pessoas'), '.'),
        ].filter(Boolean));
    }

    function folhaOpcoes(m) {
        const renomear = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Renomear');
        const tirar = h('button', { type: 'button', class: 'botao-perigo botao-largo' }, 'Tirar da lista');
        const folha = abrirFolha({ titulo: m.nome, conteudo: h('div', { class: 'form' }, renomear, tirar,
            h('p', { class: 'campo-dica' }, 'Tirar da lista não apaga ninguém: o ministério só some dos lugares em que aparece.')) });
        renomear.addEventListener('click', () => { folha.fechar(); folhaMinisterio(m, carregar); });
        tirar.addEventListener('click', async () => {
            folha.fechar();
            if (!await confirmar({ titulo: `Tirar ${m.nome} da lista?`, texto: 'Dá para voltar depois pelo banco, se precisar.', botao: 'Tirar', perigo: true })) return;
            const { error } = await supabase.from('ministerio').update({ ativo: false }).eq('id', m.id);
            if (error) return avisar(mensagemDoBanco(error));
            avisar(`${m.nome} saiu da lista.`);
            location.hash = '#/ministerios';
        });
    }
}
