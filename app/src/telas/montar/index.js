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
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { partesDaData, formatarHorario, somarDias } from '../../util/datas.js';
import { nomeCurto } from '../../sessao.js';
import { cabecalhoApp, barraAbas } from '../moldura.js';
import { carregarMontagem, somarMes, nomeDoMes, mesSugerido, nomesDosGrupos, textoDoMes } from './dados.js';
import { abrirCulto, folhaMesa, folhaCultoEspecial } from './culto.js';

const LEMBRAR = 'iejb-hub-montar-mes';

export function telaMontar(conta) {
    let mes = sessionStorage.getItem(LEMBRAR) || mesSugerido();
    let dados = null;

    const tituloMes = h('h2', { class: 'mes-nome', 'aria-live': 'polite' });
    const anterior = h('button', { type: 'button', class: 'botao-icone mes-seta', 'aria-label': 'Mês anterior' }, icone('seta', 'icone seta-esquerda'));
    const proximo = h('button', { type: 'button', class: 'botao-icone mes-seta', 'aria-label': 'Próximo mês' }, icone('seta'));
    anterior.addEventListener('click', () => trocarMes(-1));
    proximo.addEventListener('click', () => trocarMes(1));

    const resumo = h('p', { class: 'mes-resumo' });
    const area = h('div', { class: 'montar-area', 'aria-busy': 'true' }, esqueleto());
    const barraAcoes = h('div', { class: 'montar-acoes' });

    const tela = h('div', { class: 'tela tela-app tela-montar' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Montar escala'),
            h('p', { class: 'subtitulo-tela' }, 'Um toque no grupo da semana escala domingo e terça.'),
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
        resumo.replaceChildren(...(ativos.length === 0 ? ['Nenhum culto com louvor neste mês.'] : [
            `${ativos.length} cultos`,
            publicadas > 0 && h('span', { class: 'resumo-ok' }, ` · ${publicadas} publicados`),
            rascunhos.length > 0 && h('span', { class: 'resumo-rascunho' }, ` · ${rascunhos.length} em rascunho`),
            semGrupo > 0 && h('span', { class: 'resumo-falta' }, ` · ${semGrupo} sem ninguém`),
        ].filter(Boolean)));

        const especial = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('mais'), 'Culto especial');
        especial.addEventListener('click', () => folhaCultoEspecial(dados, ctx));

        area.replaceChildren(h('div', { class: 'lista-semanas' },
            dados.semanas.map((s, i) => cartaoSemana(s, i)),
            especial,
            h('p', { class: 'montar-dica' }, 'Depois de publicar, mudar alguém avisa só quem entrou, saiu ou mudou de instrumento.'),
        ));

        // Ações do mês: publicar o que está em rascunho e mandar o resumo no WhatsApp
        const publicar = h('button', { type: 'button', class: 'botao-principal' },
            rascunhos.length ? `Publicar ${rascunhos.length === 1 ? '1 culto' : `${rascunhos.length} cultos`}` : 'Tudo publicado');
        publicar.disabled = rascunhos.length === 0;
        publicar.addEventListener('click', () => comCarregando(publicar, async () => {
            const { error } = await supabase.from('escala').update({ estado: 'publicada' })
                .in('id', rascunhos.map((c) => c.escala.id));
            if (error) return avisar(mensagemDoBanco(error));
            avisar('Publicado! Todo o Louvor já vê a escala.');
            await carregar();
        }));
        const whatsapp = h('button', { type: 'button', class: 'botao-secundario', 'aria-label': 'Mandar a escala do mês no WhatsApp' }, icone('whatsapp'));
        whatsapp.addEventListener('click', () => folhaWhatsApp(dados, rascunhos.length));
        barraAcoes.replaceChildren(publicar, whatsapp);
    }

    function cartaoSemana(semana, indice) {
        const fixos = semana.cultos.filter((c) => c.fixo && c.ativo && !c.passou);
        // O grupo "da semana" é o que todos os cultos fixos dela têm, sozinho
        const daSemana = fixos.length && fixos.every((c) => c.gruposIds.length === 1 && c.gruposIds[0] === fixos[0].gruposIds[0])
            ? fixos[0].gruposIds[0] : null;

        const chips = fixos.length > 0 && h('div', { class: 'chips-grupo', role: 'group', 'aria-label': 'Grupo da semana' },
            dados.grupos.map((g) => {
                const chip = h('button', {
                    type: 'button', class: 'chip-grupo', 'aria-pressed': String(g.id === daSemana),
                }, g.nome);
                chip.addEventListener('click', () => escolherGrupoDaSemana(fixos, g, chip));
                return chip;
            }));

        const fim = somarDias(semana.domingo, 6);
        return h('section', { class: 'cartao-semana', style: { '--i': Math.min(indice, 6) } },
            h('header', { class: 'semana-topo' },
                h('h3', { class: 'semana-titulo' }, `${diaMes(semana.domingo)} a ${diaMes(fim)}`),
                chips,
            ),
            semana.cultos.length === 0
                ? h('p', { class: 'cartao-vazio' }, 'Nenhum culto com louvor nesta semana.')
                : h('ul', { class: 'lista-cultos-montar' }, semana.cultos.map(linhaCulto)),
        );
    }

    async function escolherGrupoDaSemana(cultos, grupo, chip) {
        const mudar = cultos.filter((c) => !(c.gruposIds.length === 1 && c.gruposIds[0] === grupo.id));
        if (mudar.length === 0) return;
        chip.classList.add('carregando-chip');
        // Cada culto separado (2 ou 3 por semana): se um falhar, os outros valem
        const resultados = await Promise.all(mudar.map((c) => supabase.rpc('definir_grupos_do_culto', {
            p_culto: c.id, p_ministerio: dados.ministerioId, p_grupos: [grupo.id],
        })));
        const erro = resultados.find((r) => r.error)?.error;
        if (erro) avisar(mensagemDoBanco(erro));
        else if (mudar.some((c) => c.escala?.estado === 'publicada')) avisar(`${grupo.nome} na semana. Quem mudou vai ser avisado.`);
        await carregar();
    }

    function linhaCulto(culto) {
        const datas = partesDaData(culto.data);
        const grupos = nomesDosGrupos(culto, dados);
        const tocam = culto.itens.length;
        const estado = !culto.ativo ? ['cancelado', 'Cancelado']
            : culto.escala?.estado === 'publicada' ? ['publicada', 'Publicada']
            : tocam ? ['rascunho', 'Rascunho'] : ['vazio', culto.passou ? 'Sem escala' : 'Falta montar'];

        const abrir = h('button', { type: 'button', class: 'culto-montar-abrir' },
            h('span', { class: 'mini-data', 'aria-hidden': 'true' },
                h('span', null, datas.semana), h('strong', null, datas.dia)),
            h('span', { class: 'culto-montar-textos' },
                h('span', { class: 'culto-montar-nome' }, culto.nome,
                    culto.rotulo && h('span', { class: 'rotulo-culto' }, culto.rotulo)),
                h('span', { class: 'culto-montar-detalhe' },
                    `${formatarHorario(culto.horario)} · `,
                    grupos.length ? h('strong', null, grupos.join(' + ')) : (tocam ? `${tocam} pessoas` : 'ninguém ainda')),
            ),
            h('span', { class: `estado-pill estado-${estado[0]}` }, estado[1]),
        );
        abrir.addEventListener('click', () => abrirCulto(culto.id, ctx));

        const mesa = !culto.ativo ? null : h('button', { type: 'button', class: `chip-mesa${culto.mesa.length ? ' definida' : ''}` },
            h('span', { class: 'chip-mesa-rotulo' }, 'Mesa'),
            culto.mesa.length ? culto.mesa.map((p) => nomeCurto(p)).join(', ') : 'escolher');
        mesa?.addEventListener('click', () => folhaMesa(culto, ctx));

        return h('li', { class: `culto-montar${culto.ativo ? '' : ' cancelado'}${culto.passou ? ' passou' : ''}` }, abrir, mesa);
    }
}

function folhaWhatsApp(dados, emRascunho) {
    const texto = textoDoMes(dados);
    const copiar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('copiar'), 'Copiar');
    copiar.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(texto); avisar('Escala copiada.'); } catch { avisar('Não deu para copiar.'); }
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
