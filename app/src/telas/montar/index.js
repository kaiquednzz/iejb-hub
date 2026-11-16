// "Montar escala" (só o líder de louvor, RN-02).
//
// Feita a partir da planilha que ele já manda: o mês inteiro de uma vez,
// semana por semana, e em cada culto o grupo e quem fica na mesa.
// O atalho que mais economiza: o grupo da SEMANA. Na planilha de novembro
// domingo e terça sempre têm o mesmo grupo, então um toque em "G2" na semana
// escala os dois cultos. Dá para trocar um culto só, se precisar.
//
// Nada aparece para os outros até "Publicar". Depois de publicada, cada
// mudança avisa só quem foi afetado (os gatilhos do banco cuidam disso).
import { h, icone, comCarregando, marcarCopiado } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, avisar, anunciar } from '../../util/folha.js';
import { comemorar } from '../../util/comemorar.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { partesDaData, formatarHorario, somarDias, hojeEmBrasilia } from '../../util/datas.js';
import { nomeCurto } from '../../sessao.js';
import { cabecalhoApp, barraAbas } from '../moldura.js';
import { carregarMontagem, somarMes, nomeDoMes, mesSugerido, nomesDosGrupos, textoDoMes } from './dados.js';
import { abrirCulto, folhaAdicionarCulto, grupoVazio, avisarGrupoVazio } from './culto.js';

const LEMBRAR = 'iejb-hub-montar-mes';

export function telaMontar(conta) {
    let mes = sessionStorage.getItem(LEMBRAR) || mesSugerido();
    let dados = null;

    const tituloMes = h('h2', { class: 'mes-nome', 'aria-live': 'polite' });
    const anterior = h('button', { type: 'button', class: 'botao-icone mes-seta', 'aria-label': 'Mês anterior' }, icone('seta', 'icone seta-esquerda'));
    const proximo = h('button', { type: 'button', class: 'botao-icone mes-seta', 'aria-label': 'Próximo mês' }, icone('seta'));
    anterior.addEventListener('click', () => trocarMes(-1));
    proximo.addEventListener('click', () => trocarMes(1));

    const resumo = h('p', { class: 'mes-resumo', 'aria-live': 'polite' });
    // Mandar no WhatsApp: botão redondo no canto do título (como a agenda na Escala)
    const whatsapp = h('button', { type: 'button', class: 'botao-icone montar-whatsapp', 'aria-label': 'Mandar a escala do mês no WhatsApp' }, icone('whatsapp'));
    whatsapp.addEventListener('click', () => dados && folhaWhatsApp(dados, dados.cultos.filter((c) => c.ativo && c.escala?.estado === 'rascunho' && c.itens.length > 0).length));
    const area = h('div', { class: 'montar-area', 'aria-busy': 'true' }, esqueleto());
    const barraAcoes = h('div', { class: 'montar-acoes' });

    const tela = h('div', { class: 'tela tela-app tela-montar' },
        cabecalhoApp(conta, { modulo: 'Louvor' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'escala-topo' }, h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Montar escala'), whatsapp),
            h('div', { class: 'mes-navegacao' }, anterior, tituloMes, proximo),
            resumo,
            area,
        ),
        barraAcoes,
        barraAbas(conta, '#/montar'),
    );

    // Contexto para a folha de cada culto
    const ctx = {
        dados: () => dados,
        recarregar: async () => { await carregar(); return dados; },
    };

    carregar();
    return tela;

    function trocarMes(passo) {
        mes = somarMes(mes, passo);
        sessionStorage.setItem(LEMBRAR, mes);
        area.setAttribute('aria-busy', 'true');
        area.dataset.direcao = passo > 0 ? 'frente' : 'tras';
        area.replaceChildren(esqueleto());
        barraAcoes.replaceChildren();
        carregar();
    }

    async function carregar() {
        tituloMes.textContent = nomeDoMes(mes);
        const pedido = mes;
        const resultado = await carregarMontagem(mes);
        if (pedido !== mes) return; // trocou de mês no meio do caminho
        area.removeAttribute('aria-busy');
        if (resultado.erro) {
            console.error(resultado.erro);
            const botao = h('button', { type: 'button', class: 'botao-principal' }, 'Tentar de novo');
            botao.addEventListener('click', () => comCarregando(botao, carregar));
            area.replaceChildren(h('div', { class: 'estado-vazio' },
                h('p', { class: 'estado-vazio-titulo' }, 'Não deu para carregar o mês.'),
                h('p', { class: 'estado-vazio-texto' }, mensagemDoBanco(resultado.erro)), botao));
            return;
        }
        dados = resultado.dados;
        desenhar();
    }

    function desenhar() {
        const ativos = dados.cultos.filter((c) => c.ativo);
        const semGrupo = ativos.filter((c) => c.itens.length === 0 && !c.passou).length;
        const rascunhos = ativos.filter((c) => c.escala?.estado === 'rascunho' && c.itens.length > 0);
        const publicadas = ativos.filter((c) => c.escala?.estado === 'publicada').length;

        // replaceChildren não achata listas nem ignora false: filtra antes
        // Só fala quando tem algo a fazer (o resto os cartões já mostram)
        resumo.replaceChildren(...(ativos.length === 0 ? ['Nenhum culto com louvor neste mês.']
            : semGrupo > 0 ? [h('span', { class: 'resumo-falta' }, `${semGrupo} ${semGrupo === 1 ? 'culto sem ninguém' : 'cultos sem ninguém'}`)]
            : publicadas === ativos.length ? [h('span', { class: 'resumo-ok' }, 'Mês todo publicado')] : []));

        const especial = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('mais'), 'Adicionar culto');
        especial.addEventListener('click', () => folhaAdicionarCulto(dados, ctx));

        // Semanas que já acabaram sem nada para ver saem da lista: só poluem.
        // Semana passada com culto continua (o líder pode querer conferir).
        const hoje = hojeEmBrasilia();
        const semanas = dados.semanas.filter((s) => s.cultos.length > 0 || somarDias(s.domingo, 6) >= hoje);
        area.replaceChildren(h('div', { class: 'lista-semanas' },
            semanas.map((s, i) => cartaoSemana(s, i)),
            especial,
        ));

        // O botão de publicar só aparece quando tem o que publicar
        if (!rascunhos.length) { barraAcoes.replaceChildren(); return; }
        const publicar = h('button', { type: 'button', class: 'botao-principal' },
            `Publicar ${rascunhos.length === 1 ? '1 culto' : `${rascunhos.length} cultos`}`);
        publicar.addEventListener('click', () => comCarregando(publicar, async () => {
            const { error } = await supabase.from('escala').update({ estado: 'publicada' })
                .in('id', rascunhos.map((c) => c.escala.id));
            if (error) return avisar(mensagemDoBanco(error));
            comemorar('Escala publicada!', 'Todo o Louvor já vê a escala, e quem foi escalado recebe o aviso.');
            await carregar();
        }));
        barraAcoes.replaceChildren(publicar);
    }

    function cartaoSemana(semana, indice) {
        const fixos = semana.cultos.filter((c) => c.fixo && c.ativo && !c.passou);
        // O grupo "da semana" é o que todos os cultos fixos dela têm, sozinho
        const daSemana = fixos.length && fixos.every((c) => c.gruposIds.length === 1 && c.gruposIds[0] === fixos[0].gruposIds[0])
            ? fixos[0].gruposIds[0] : null;

        const chips = fixos.length > 0 && h('div', { class: 'chips-grupo', role: 'group', 'aria-label': 'Grupo da semana' },
            h('span', { class: 'chips-grupo-rotulo', 'aria-hidden': 'true' }, 'Grupo'),
            dados.grupos.map((g) => {
                const chip = h('button', {
                    type: 'button', class: 'chip-grupo', 'aria-pressed': String(g.id === daSemana),
                }, g.nome, grupoVazio(g) && h('span', { class: 'chip-vazio' }, 'vazio'));
                chip.addEventListener('click', () => escolherGrupoDaSemana(fixos, g, chip));
                return chip;
            }));

        const fim = somarDias(semana.domingo, 6);
        // Semana sem culto: uma linha só, sem cartão (antes era um cartão
        // inteiro com caixa tracejada, que pesava mais que as semanas com culto)
        if (semana.cultos.length === 0) {
            return h('p', { class: 'semana-vazia', style: { '--i': Math.min(indice, 6) } },
                h('span', { class: 'semana-titulo' }, `${diaMes(semana.domingo)} a ${diaMes(fim)}`), ' · sem culto com louvor');
        }
        return h('section', { class: 'cartao-semana', style: { '--i': Math.min(indice, 6) } },
            h('header', { class: 'semana-topo' },
                h('h3', { class: 'semana-titulo' }, `${diaMes(semana.domingo)} a ${diaMes(fim)}`),
                chips,
            ),
            h('ul', { class: 'lista-cultos-montar' }, semana.cultos.map(linhaCulto)),
        );
    }

    async function escolherGrupoDaSemana(cultos, grupo, chip) {
        // Tocar no grupo que já está escolhido recarrega: traz quem entrou no
        // grupo depois (antes não acontecia nada e parecia defeito)
        const diferentes = cultos.filter((c) => !(c.gruposIds.length === 1 && c.gruposIds[0] === grupo.id));
        const mudar = diferentes.length ? diferentes : cultos;
        chip.classList.add('carregando-chip');
        // Cada culto separado (2 ou 3 por semana): se um falhar, os outros valem
        const resultados = await Promise.all(mudar.map((c) => supabase.rpc('definir_grupos_do_culto', {
            p_culto: c.id, p_ministerio: dados.ministerioId, p_grupos: [grupo.id],
        })));
        const erro = resultados.find((r) => r.error)?.error;
        if (erro) avisar(mensagemDoBanco(erro));
        else if (grupoVazio(grupo)) avisarGrupoVazio(grupo);
        else if (mudar.some((c) => c.escala?.estado === 'publicada')) avisar(`${grupo.nome} na semana. Quem mudou vai ser avisado.`);
        await carregar();
    }

    function linhaCulto(culto) {
        const datas = partesDaData(culto.data);
        const grupos = nomesDosGrupos(culto, dados);
        const tocam = culto.itens.length;
        // Publicada é o normal: só um ✓ verde. Selo de texto só quando pede atenção.
        const publicada = culto.ativo && culto.escala?.estado === 'publicada';
        const estado = !culto.ativo ? ['cancelado', 'Cancelado']
            : publicada ? null
            : tocam ? ['rascunho', 'Rascunho'] : ['vazio', culto.passou ? 'Sem escala' : 'Falta montar'];
        const mesa = culto.ativo && tocam
            ? (culto.mesa.length ? ` · Mesa: ${culto.mesa.map((p) => nomeCurto(p)).join(', ')}` : h('span', { class: 'sem-mesa' }, ' · sem mesa'))
            : null;

        const abrir = h('button', { type: 'button', class: 'culto-montar-abrir' },
            h('span', { class: 'mini-data', 'aria-hidden': 'true' },
                h('span', null, datas.semana), h('strong', null, datas.dia)),
            h('span', { class: 'culto-montar-textos' },
                h('span', { class: 'culto-montar-nome' }, culto.nome,
                    culto.rotulo && h('span', { class: 'rotulo-culto' }, culto.rotulo)),
                h('span', { class: 'culto-montar-detalhe' },
                    `${formatarHorario(culto.horario)} · `,
                    grupos.length ? h('strong', null, grupos.join(' + ')) : (tocam ? `${tocam} ${tocam === 1 ? 'pessoa' : 'pessoas'}` : 'ninguém ainda'),
                    mesa),
            ),
            estado ? h('span', { class: `estado-pill estado-${estado[0]}` }, estado[1])
                : h('span', { class: 'publicada-certo', role: 'img', 'aria-label': 'Publicada' }, icone('certo', 'icone icone-p')),
        );
        abrir.addEventListener('click', () => abrirCulto(culto.id, ctx));

        return h('li', { class: `culto-montar${culto.ativo ? '' : ' cancelado'}${culto.passou ? ' passou' : ''}` }, abrir);
    }
}

function folhaWhatsApp(dados, emRascunho) {
    const texto = textoDoMes(dados);
    const copiar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('copiar'), 'Copiar');
    copiar.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(texto); marcarCopiado(copiar); anunciar('Escala copiada.'); } catch { avisar('Não deu para copiar.'); }
    });
    abrirFolha({
        titulo: 'Mandar a escala',
        conteudo: h('div', { class: 'form' },
            emRascunho > 0 && h('p', { class: 'aviso-form', 'data-tipo': 'erro' },
                `${emRascunho} ${emRascunho === 1 ? 'culto ainda está' : 'cultos ainda estão'} em rascunho e não entra${emRascunho === 1 ? '' : 'm'} na mensagem. Publique antes.`),
            h('pre', { class: 'previa-whatsapp' }, texto),
            h('a', {
                class: 'botao-principal botao-largo', target: '_blank', rel: 'noopener noreferrer',
                href: `https://wa.me/?text=${encodeURIComponent(texto)}`,
            }, icone('whatsapp'), 'Abrir no WhatsApp'),
            copiar,
        ),
    });
}

function diaMes(iso) {
    return `${Number(iso.slice(8))}/${iso.slice(5, 7)}`;
}

function esqueleto() {
    return h('div', { class: 'lista-semanas', 'aria-hidden': 'true' },
        [0, 1, 2].map(() => h('div', { class: 'cartao-semana esqueleto' },
            h('span', { class: 'linha l1' }), h('span', { class: 'linha l3' }), h('span', { class: 'linha l3' }))));
}
