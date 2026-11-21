// "Ver a escala": os próximos cultos com quem toca o quê e o repertório.
//
// Uma consulta só traz tudo (culto → escala → pessoas, culto → repertório),
// usando os relacionamentos das chaves estrangeiras (o "embed" do PostgREST).
// A RLS já filtra no banco: rascunho só aparece para o líder de louvor, e
// quem não é do ministério não recebe nada. A tela só desenha o que chegou.
import { botaoAgenda } from '../util/agenda.js';
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { nomeCurto } from '../sessao.js';
import { hojeEmBrasilia, somarDias, rotuloDoDia, partesDaData, formatarHorario } from '../util/datas.js';
import { cabecalhoApp, avatar, navLouvor } from './moldura.js';
import { FUNCAO_MESA, separarMesa, naoVai, cultoJaComecou } from '../util/escala.js';
import { confirmar, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { blocoRepertorio } from './repertorio.js';
import { blocoAjustar } from './ajustar-escala.js';
import { estadoDoPush, ativarPush } from '../util/push.js';
import { guardarEscala, escalaGuardada, eErroDeRede } from '../offline.js';

const SEMANAS_A_MOSTRAR = 6;
const SEMANAS_PARA_GERAR = 8;

const CONSULTA = `
    id, nome, rotulo, data, horario, estado,
    escala (
        id, estado,
        escala_item ( id, pessoa_id, instrumento_exibido, saiu_em, pessoa:pessoa_id ( nome, apelido, foto ) ),
        escala_grupo ( grupo:grupo_id ( nome, lider_pessoa_id ) )
    ),
    repertorio_item ( id, posicao, tom, musica:musica_id ( id, titulo, artista, link, links_streaming ) )
`;

export function telaEscala(conta) {
    const lista = h('div', { class: 'lista-cultos', 'aria-busy': 'true' }, esqueleto());
    const destaque = h('div', { class: 'destaque-area' });
    const faixaOffline = h('div', { class: 'faixa-offline-area', role: 'status' });

    const tela = h('div', { class: 'tela tela-app' },
        cabecalhoApp(conta, { modulo: 'Louvor' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            navLouvor(conta, '#/escala', botaoAgenda()),
            faixaOffline,
            cartaoAvisos(),
            destaque,
            h('h2', { class: 'titulo-secao' }, 'Próximos cultos'),
            lista,
        ),
    );

    const seletores = new Map(); // culto.id → abre o bloco dele
    carregar();
    return tela;

    async function carregar() {
        lista.setAttribute('aria-busy', 'true');
        const hoje = hojeEmBrasilia();
        const { data: cultos, error } = await supabase
            .from('culto')
            .select(CONSULTA)
            .eq('tem_louvor', true)
            .gte('data', hoje)
            .lte('data', somarDias(hoje, SEMANAS_A_MOSTRAR * 7))
            .order('data')
            .order('horario')
            .order('posicao', { referencedTable: 'repertorio_item' })
            .retry(navigator.onLine); // ver o comentário em sessao.js

        lista.removeAttribute('aria-busy');
        if (error) {
            console.error(error);
            const copia = eErroDeRede(error) ? escalaGuardada(conta.id) : null;
            if (copia) {
                desenhar(copia.cultos.filter((culto) => culto.data >= hoje), copia.salvaEm);
                return;
            }
            faixaOffline.replaceChildren();
            lista.replaceChildren(estadoVazio('Não deu para carregar a escala.', 'Confira sua internet e tente de novo.',
                botaoAcao('Tentar de novo', carregar)));
            return;
        }
        guardarEscala(conta.id, cultos);
        desenhar(cultos);
    }

    // offlineDesde: quando veio da cópia local, a data dessa cópia
    function desenhar(cultos, offlineDesde) {
        faixaOffline.replaceChildren(...(offlineDesde ? [faixaSemConexao(offlineDesde, carregar)] : []));
        const meuId = conta.pessoa?.id;
        destaque.replaceChildren(...cartaoDestaque(cultos, meuId));

        if (cultos.length === 0) {
            const acao = conta.e_administrador && !offlineDesde && botaoAcao(`Gerar ${SEMANAS_PARA_GERAR} semanas de cultos`, gerarCultos);
            lista.replaceChildren(estadoVazio('Nenhum culto no calendário ainda.',
                conta.e_administrador
                    ? 'Os cultos fixos (domingo e terça) são gerados a partir dos tipos de culto cadastrados.'
                    : 'Assim que a liderança montar o calendário, ele aparece aqui.',
                acao));
            return;
        }
        // Repertório: quem pode monta ali mesmo; ao fechar o editor, recarrega
        const extras = { conta, recarregar: carregar, offline: !!offlineDesde };
        // Semana em blocos (D43): cada culto é um bloco (DOM 15 · TER 17);
        // tocar abre os detalhes embaixo, sem empilhar tudo na tela.
        // A semana atual já abre no próximo culto; as outras ficam fechadas.
        seletores.clear();
        let i = 0;
        lista.replaceChildren(...semanasDe(cultos).map((semana, s) =>
            semanaEmBlocos(semana, s, meuId, extras, () => i++, seletores, s === 0)));
        // O cartão "Seu próximo culto" e links #culto-... abrem o bloco certo
        destaque.querySelector('a.destaque')?.addEventListener('click', (evento) => {
            evento.preventDefault();
            focarCulto(evento.currentTarget.getAttribute('href').slice(7));
        });
        if (location.hash.startsWith('#culto-')) focarCulto(location.hash.slice(7));
    }

    function focarCulto(id) {
        const abrir = seletores.get(id);
        if (!abrir) return;
        abrir(true);
        const bloco = lista.querySelector(`[data-culto="${CSS.escape(id)}"]`);
        bloco?.closest('.semana-escala')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        bloco?.focus({ preventScroll: true });
    }

    async function gerarCultos() {
        const ate = somarDias(hojeEmBrasilia(), SEMANAS_PARA_GERAR * 7);
        const { error } = await supabase.rpc('gerar_cultos', { p_ate: ate });
        if (error) {
            console.error(error);
            alertaInline(lista, 'Não deu para gerar os cultos. Só administrador e líder de louvor podem fazer isso.');
            return;
        }
        await carregar();
    }
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

// A escala que vale para a tela: publicada (todos) ou rascunho (só o líder vê)
function escalaDo(culto) {
    return culto.escala?.[0] ?? null;
}

function cartaoDestaque(cultos, meuId) {
    if (!meuId) return [];
    for (const culto of cultos) {
        const escala = escalaDo(culto);
        if (culto.estado !== 'ativo' || escala?.estado !== 'publicada') continue;
        const eu = escala.escala_item.find((item) => item.pessoa_id === meuId);
        if (!eu || naoVai(eu)) continue;
        // Mesmo cartão do Início (design system): o nome do culto é o título
        return [h('a', { class: 'inicio-compromisso destaque', href: `#culto-${culto.id}` },
            h('span', { class: 'compromisso-rotulo' }, h('span', null, 'Sua próxima escala')),
            h('span', { class: 'compromisso-titulo' }, culto.nome),
            h('span', { class: 'compromisso-quando' }, `${rotuloDoDia(culto.data)} · ${formatarHorario(culto.horario)}`),
            h('span', { class: 'compromisso-chips' },
                eu.instrumento_exibido.map((x) => h('span', { class: 'compromisso-chip' }, x))),
        )];
    }
    return [];
}

function cartaoCulto(culto, meuId, indice, extras) {
    const escala = escalaDo(culto);
    const cancelado = culto.estado === 'cancelado';
    const datas = partesDaData(culto.data);
    const meuItem = escala?.escala_item.find((item) => item.pessoa_id === meuId);
    const estouNela = Boolean(meuItem) && !naoVai(meuItem);

    let selo = null;
    if (cancelado) selo = h('span', { class: 'selo selo-cancelado' }, 'Cancelado');
    else if (escala?.estado === 'rascunho') selo = h('span', { class: 'selo selo-rascunho' }, icone('olho'), 'Rascunho · só você vê');
    else if (estouNela) selo = h('span', { class: 'selo selo-voce' }, 'Você toca');
    else if (meuItem) selo = h('span', { class: 'selo selo-cancelado' }, 'Você não vai');

    return h('article', {
        class: `cartao-culto${cancelado ? ' cancelado' : ''}${estouNela && !cancelado ? ' comigo' : ''}`,
        id: `culto-${culto.id}`,
        style: { '--i': Math.min(indice, 8) },
        'aria-labelledby': `titulo-${culto.id}`,
    },
        h('div', { class: 'cartao-topo' },
            h('div', { class: 'cartao-data', 'aria-hidden': 'true' },
                h('span', { class: 'cartao-data-semana' }, datas.semana),
                h('span', { class: 'cartao-data-dia' }, datas.dia),
                h('span', { class: 'cartao-data-mes' }, datas.mes),
            ),
            h('div', { class: 'cartao-titulos' },
                h('h3', { id: `titulo-${culto.id}` }, culto.nome,
                    culto.rotulo && h('span', { class: 'rotulo-culto' }, culto.rotulo)),
                h('p', { class: 'cartao-quando' },
                    icone('relogio', 'icone icone-p'),
                    `${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
                selo,
            ),
        ),
        !cancelado && corpoDaEscala(escala, meuId, extras.anterior),
        !cancelado && !extras.offline && blocoPresenca(culto, escala, meuItem, extras.recarregar),
        !cancelado && blocoRepertorio(culto, extras.conta, extras.recarregar, extras.offline, extras.anterior),
        !cancelado && !extras.offline && blocoAjustar(culto, extras.conta, extras.recarregar),
    );
}

function corpoDaEscala(escala, meuId, anterior) {
    if (!escala || escala.escala_item.length === 0) {
        return h('p', { class: 'cartao-vazio' }, 'Escala ainda não publicada.');
    }
    // Mesmas pessoas (e instrumentos) do culto anterior da semana: em vez de
    // repetir a lista, uma linha que abre se a pessoa quiser conferir
    const antes = anterior && escalaDo(anterior);
    if (antes && antes.escala_item.length && anterior.estado !== 'cancelado' && mesmaEscala(antes, escala)) {
        return h('details', { class: 'mesma-escala' },
            h('summary', null, icone('certo', 'icone icone-p'), `Mesmas pessoas de ${diaDaSemana(anterior.data)}`),
            listaDaEscala(escala, meuId));
    }
    return listaDaEscala(escala, meuId);
}

function listaDaEscala(escala, meuId) {
    const grupos = escala.escala_grupo.map((g) => g.grupo?.nome).filter(Boolean).sort();
    // Quem só está pela mesa de som vai numa linha à parte, como na planilha
    const { tocam, mesa } = separarMesa(escala.escala_item);
    const pessoas = [...tocam].sort((a, b) =>
        nomeCurto(a.pessoa).localeCompare(nomeCurto(b.pessoa), 'pt-BR'));

    return h('div', { class: 'cartao-escala' },
        grupos.length > 0 && h('p', { class: 'cartao-grupos' }, grupos.length > 1 ? 'Grupos ' : 'Grupo ', grupos.join(' + ')),
        h('ul', { class: 'lista-pessoas' },
            pessoas.map((item) => h('li', { class: [item.pessoa_id === meuId && 'sou-eu', naoVai(item) && 'nao-vai'].filter(Boolean).join(' ') || null },
                avatar(item.pessoa),
                h('span', { class: 'pessoa-nome' },
                    nomeCurto(item.pessoa, 'Pessoa'),
                    item.pessoa_id === meuId && h('span', { class: 'sr-only' }, ' (você)')),
                naoVai(item)
                    ? h('span', { class: 'pessoa-instrumento pessoa-nao-vai' }, 'Não vai')
                    : h('span', { class: 'pessoa-instrumento' },
                        item.instrumento_exibido.filter((i) => i !== FUNCAO_MESA).join(' · ') || '—'),
            )),
        ),
        mesa.length > 0 && h('p', { class: 'cartao-mesa' },
            h('span', null, 'Mesa de som'),
            h('strong', null, mesa.map((item) => nomeCurto(item.pessoa, 'Pessoa')).join(', '))),
    );
}

// --- Semanas (D43) -----------------------------------------------------------
const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const reduzirMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function semanaEmBlocos(semana, s, meuId, extras, proximoIndice, seletores, abrirPrimeiro) {
    const painelId = `painel-semana-${semana.domingo}`;
    const blocos = semana.cultos.map((culto) => blocoDoDia(culto, meuId, painelId));
    const detalhes = semana.cultos.map((culto, j) => {
        const cartao = cartaoCulto(culto, meuId, proximoIndice(), { ...extras, anterior: semana.cultos[j - 1] });
        cartao.dataset.culto = culto.id;
        cartao.inert = true;
        return cartao;
    });
    const palco = h('div', { class: 'palco-semana' }, detalhes);
    const painel = h('div', { class: 'painel-semana', id: painelId }, h('div', { class: 'painel-semana-dentro' }, palco));

    let escolhido = null;
    let ultimo = null; // continua no fluxo enquanto o painel fecha
    function escolher(id, manter = false) {
        const novo = escolhido === id && !manter ? null : id;
        const alturaAntes = escolhido ? palco.offsetHeight : 0;
        escolhido = novo;
        if (novo) ultimo = novo;
        for (const b of blocos) {
            const on = b.dataset.culto === escolhido;
            b.classList.toggle('sel', on);
            b.setAttribute('aria-expanded', String(on));
        }
        for (const d of detalhes) {
            const on = d.dataset.culto === escolhido;
            d.classList.toggle('vis', on);
            d.classList.toggle('no-fluxo', d.dataset.culto === ultimo);
            d.inert = !on;
        }
        painel.classList.toggle('aberto', Boolean(escolhido));
        // Trocar de dia com o painel aberto: a altura desliza em vez de pular
        if (alturaAntes && escolhido && !reduzirMovimento()) {
            const alturaDepois = palco.offsetHeight;
            if (alturaAntes !== alturaDepois) {
                palco.animate([{ height: `${alturaAntes}px` }, { height: `${alturaDepois}px` }], { duration: 480, easing: EASE_IOS });
            }
        }
    }
    blocos.forEach((b) => b.addEventListener('click', () => escolher(b.dataset.culto)));
    for (const c of semana.cultos) seletores.set(c.id, () => escolher(c.id, true));
    if (abrirPrimeiro) {
        const proximo = semana.cultos.find((c) => c.estado !== 'cancelado') ?? semana.cultos[0];
        escolher(proximo.id);
    }

    const grupo = grupoDaSemana(semana);
    return h('section', { class: 'semana-escala', style: { '--i': Math.min(s, 6) }, 'aria-label': tituloDaSemana(semana) },
        h('header', { class: 'semana-escala-topo' },
            h('h2', { class: 'semana-escala-titulo' }, tituloDaSemana(semana)),
            grupo && h('span', { class: 'semana-escala-grupo' }, grupo)),
        h('div', { class: 'dias-semana' }, blocos),
        painel,
    );
}

// Um bloco por culto: dia, hora e quem toca. O detalhe fica no painel.
function blocoDoDia(culto, meuId, painelId) {
    const escala = escalaDo(culto);
    const cancelado = culto.estado === 'cancelado';
    const partes = partesDaData(culto.data);
    const itens = escala?.escala_item ?? [];
    const meu = itens.find((item) => item.pessoa_id === meuId);
    const toco = Boolean(meu) && !naoVai(meu) && escala?.estado === 'publicada';
    const rostos = itens.filter((item) => !naoVai(item)).slice(0, 3);
    const estado = cancelado ? 'cancelado' : toco ? 'você toca' : escala?.estado === 'rascunho' ? 'rascunho' : null;
    return h('button', {
        type: 'button',
        class: `bloco-dia${cancelado ? ' cancelado' : ''}${toco ? ' comigo' : ''}`,
        'data-culto': culto.id,
        'aria-expanded': 'false',
        'aria-controls': painelId,
        'aria-label': [culto.nome, rotuloDoDia(culto.data), formatarHorario(culto.horario), estado].filter(Boolean).join(', '),
    },
        h('span', { class: 'bloco-dia-semana' }, partes.semana),
        h('span', { class: 'bloco-dia-num' }, partes.dia),
        h('span', { class: 'bloco-dia-hora' }, cancelado ? 'Cancelado' : formatarHorario(culto.horario)),
        !cancelado && rostos.length > 0 && h('span', { class: 'bloco-dia-rostos' }, rostos.map((item) => avatar(item.pessoa))),
        toco && h('span', { class: 'bloco-dia-eu' }, 'Você'),
    );
}

// A semana começa no domingo, como na planilha do líder e na tela Montar
function semanasDe(cultos) {
    const semanas = [];
    for (const c of cultos) {
        const dia = new Date(`${c.data}T12:00:00Z`).getUTCDay();
        const domingo = somarDias(c.data, -dia);
        if (semanas.at(-1)?.domingo !== domingo) semanas.push({ domingo, cultos: [] });
        semanas.at(-1).cultos.push(c);
    }
    return semanas;
}
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaMes = (d) => DIA_MES.format(new Date(`${d}T12:00:00Z`)).replace('.', '').replace(' de ', ' ');
function tituloDaSemana(semana) {
    const hoje = hojeEmBrasilia();
    const fim = somarDias(semana.domingo, 6);
    if (hoje >= semana.domingo && hoje <= fim) return 'Esta semana';
    if (somarDias(hoje, 7) >= semana.domingo && somarDias(hoje, 7) <= fim) return 'Semana que vem';
    return `Semana de ${diaMes(semana.domingo)} a ${diaMes(fim)}`;
}
// O grupo que aparece na maioria dos cultos da semana (o "grupo da semana")
function grupoDaSemana(semana) {
    const conta = new Map();
    for (const c of semana.cultos) {
        if (c.estado === 'cancelado') continue;
        const e = escalaDo(c);
        if (!e || e.estado !== 'publicada') continue;
        for (const g of e.escala_grupo) if (g.grupo?.nome) conta.set(g.grupo.nome, (conta.get(g.grupo.nome) ?? 0) + 1);
    }
    const [nome] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return nome ?? null;
}
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (d) => DIAS_SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];
function mesmaEscala(a, b) {
    const chave = (e) => e.escala_item.map((i) => `${i.pessoa_id}:${[...i.instrumento_exibido].sort().join(',')}:${naoVai(i)}`).sort().join('|');
    return chave(a) === chave(b);
}

// "Não vou poder ir" / "Vou sim" (D35): só para quem está na escala publicada,
// até o culto começar. Avisa o líder do grupo e o líder de louvor na hora.
function blocoPresenca(culto, escala, meuItem, recarregar) {
    if (!meuItem || escala?.estado !== 'publicada' || cultoJaComecou(culto)) return null;
    const saiu = naoVai(meuItem);
    const botao = h('button', { type: 'button', class: saiu ? 'botao-principal botao-pequeno' : 'botao-secundario botao-pequeno' },
        saiu ? 'Vou poder ir sim' : 'Não vou poder ir');
    botao.addEventListener('click', async () => {
        if (!saiu) {
            const ok = await confirmar({
                titulo: 'Não vai poder ir?',
                texto: 'O líder do grupo e o líder de louvor recebem um aviso agora. Você continua na escala, riscado, e pode voltar atrás até o culto começar.',
                botao: 'Avisar que não vou',
                perigo: true,
            });
            if (!ok) return;
        }
        await comCarregando(botao, async () => {
            const { error } = await supabase.rpc('marcar_presenca', { p_escala: escala.id, p_vai: saiu });
            if (error) return avisar(mensagemDoBanco(error));
            avisar(saiu ? 'Que bom! Os líderes foram avisados.' : 'Os líderes foram avisados.');
            await recarregar();
        });
    });
    return h('div', { class: `presenca${saiu ? ' presenca-saiu' : ''}` },
        saiu && h('p', { class: 'presenca-texto' }, 'Você avisou que não vai.'),
        botao);
}

function faixaSemConexao(salvaEm, tentarDeNovo) {
    const quando = new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    }).format(new Date(salvaEm));
    const botao = h('button', { type: 'button', class: 'faixa-offline-botao' }, 'Atualizar');
    botao.addEventListener('click', () => comCarregando(botao, tentarDeNovo));
    return h('div', { class: 'faixa-offline' },
        h('span', { class: 'faixa-offline-ponto', 'aria-hidden': 'true' }),
        h('span', null, h('strong', null, 'Sem conexão. '), `Mostrando a escala de ${quando}.`),
        botao,
    );
}

function estadoVazio(titulo, texto, acao) {
    return h('div', { class: 'estado-vazio' },
        h('div', { class: 'estado-vazio-icone', 'aria-hidden': 'true' }, icone('musica')),
        h('p', { class: 'estado-vazio-titulo' }, titulo),
        h('p', { class: 'estado-vazio-texto' }, texto),
        acao,
    );
}

function botaoAcao(texto, acao) {
    const botao = h('button', { type: 'button', class: 'botao-principal' }, texto);
    botao.addEventListener('click', () => comCarregando(botao, acao));
    return botao;
}

function alertaInline(onde, texto) {
    onde.querySelector('.aviso-form')?.remove();
    onde.append(h('p', { class: 'aviso-form', role: 'alert', 'data-tipo': 'erro' }, texto));
}

// Cartões "fantasma" enquanto carrega: a tela não pula quando os dados chegam
function esqueleto() {
    return [0, 1, 2].map(() => h('div', { class: 'cartao-culto esqueleto', 'aria-hidden': 'true' },
        h('div', { class: 'cartao-topo' },
            h('div', { class: 'cartao-data' }),
            h('div', { class: 'cartao-titulos' }, h('span', { class: 'linha l1' }), h('span', { class: 'linha l2' })),
        ),
        h('span', { class: 'linha l3' }),
    ));
}

// "Ativar avisos": só aparece enquanto dá para ativar. No iPhone o pedido de
// permissão precisa sair de um toque, por isso é um botão e não automático.
function cartaoAvisos() {
    if (estadoDoPush() !== 'pode-ativar') return null;
    const ativar = h('button', { type: 'button', class: 'botao-principal botao-pequeno' }, 'Ativar');
    const agoraNao = h('button', { type: 'button', class: 'link-discreto' }, 'Agora não');
    const cartao = h('section', { class: 'cartao-avisos', 'aria-label': 'Avisos no celular' },
        h('div', { class: 'cartao-avisos-icone', 'aria-hidden': 'true' }, icone('sino')),
        h('div', { class: 'cartao-avisos-textos' },
            h('strong', null, 'Receba avisos da escala'),
            h('span', null, 'Quando você entrar, sair ou o repertório mudar, o celular avisa.')),
        h('div', { class: 'cartao-avisos-acoes' }, agoraNao, ativar),
    );
    const sumir = () => {
        cartao.classList.add('saindo');
        setTimeout(() => cartao.remove(), 350);
    };
    agoraNao.addEventListener('click', () => { sessionStorage.setItem('iejb-hub-avisos-depois', '1'); sumir(); });
    ativar.addEventListener('click', () => comCarregando(ativar, async () => {
        try {
            const resposta = await ativarPush();
            if (resposta === 'default') return; // fechou a pergunta: o cartão fica
            if (resposta === 'granted') {
                cartao.replaceChildren(h('div', { class: 'cartao-avisos-icone ok', 'aria-hidden': 'true' }, icone('certo')),
                    h('div', { class: 'cartao-avisos-textos', role: 'status' }, h('strong', null, 'Avisos ativados!'),
                        h('span', null, 'Você vai saber das mudanças na hora.')));
                setTimeout(sumir, 2500);
            } else {
                cartao.replaceChildren(h('div', { class: 'cartao-avisos-textos', role: 'status' },
                    h('strong', null, 'Avisos bloqueados'),
                    h('span', null, 'Para ativar depois: Ajustes do celular → Notificações → IEJB Hub.')));
            }
        } catch (erro) {
            console.error(erro);
            cartao.querySelector('.cartao-avisos-textos span').textContent = 'Não deu para ativar agora. Tente de novo.';
        }
    }));
    if (sessionStorage.getItem('iejb-hub-avisos-depois')) return null;
    return cartao;
}
