// Início (D40, redesign v2): a porta de entrada do Hub. Mostra o que importa
// para a pessoa HOJE, e muda com o ritmo da semana da igreja:
//   * semana normal: o próximo compromisso, num cartão vermelho;
//   * véspera ("Amanhã você toca") e dia de culto ("Hoje você toca"): o
//     cartão vira uma capa com a contagem, a ordem do louvor com os tons e
//     os rostos de quem toca junto (a cor do topo do celular fica vermelha);
//   * depois do culto: um agradecimento e o que vocês tocaram.
// Cultos são da igreja toda; a participação pessoal continua vindo da escala.
//
// Ordem da tela: saudação → "precisa da sua atenção" (só se houver: contagem
// para conferir, pedidos de acesso) → próximo culto →
// Mural (D68) → Vem aí (eventos do site).
// Ministérios e áreas ficam na aba Ministérios.
import { iconeInstrumento, instrumentosComIcone } from '../util/instrumentos.js';
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { hojeEmBrasilia, rotuloDoDia, formatarHorario, diasEntre } from '../util/datas.js';
import { escalaGuardada } from '../offline.js';
import { naoVai, FUNCAO_MESA } from '../util/escala.js';
import { cabecalhoApp, avatar } from './moldura.js';
import { nomeCurto } from '../sessao.js';
import { blocoConferir } from './financeiro/conferir.js';
import { blocoEventos } from './inicio-eventos.js';
import { blocoMural } from './mural.js';
import { blocoAniversarios } from './aniversarios.js';
import { pedidosSemResposta } from './oracao.js';
import { mostrarBoasVindasSePrimeiraVez } from './tour.js';
import { filaDoYoutube } from '../util/musica.js';
import { chama, marcarEscalado } from '../util/chama.js';
import { botaoWhatsRepertorio } from '../util/compartilhar.js';
import { corDoTopo } from '../util/tema.js';
import { proximosEventos, eventoDoCulto } from '../util/eventos.js';

const DURACAO_DO_CULTO_MIN = 150; // depois disso o culto conta como encerrado

function saudacao() {
    const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()));
    return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataDeHoje() {
    const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
}

export function telaInicio(conta) {
    const primeiroNome = conta.pessoa?.apelido?.trim() || (conta.pessoa?.nome || conta.nome_informado || '').split(' ')[0];
    // O cartão do culto avisa qual evento ele já mostra, para o "Vem aí" não repetir
    let avisarEventoDoCartao;
    const eventoDoCartao = new Promise((r) => { avisarEventoDoCartao = r; });
    const destaque = h('div', { class: 'inicio-destaque', 'aria-live': 'polite' },
        h('div', { class: 'inicio-compromisso esqueleto' }));
    const avisosAdmin = h('div', { class: 'inicio-avisos' });
    const conferir = blocoConferir(conta); // contagem esperando esta pessoa conferir (D48)

    const tela = h('div', { class: 'tela tela-app tela-inicio' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'inicio-ola-area' },
                h('p', { class: 'inicio-data' }, dataDeHoje()),
                h('h1', { tabindex: -1, class: 'titulo-tela inicio-ola' }, `${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}`)),
            conferir,
            avisosAdmin,
            blocoAniversarios(),
            destaque,
            blocoMural(conta),
            blocoEventos({ semEste: eventoDoCartao }),
        ),
    );

    carregarCompromisso(conta, destaque).then(avisarEventoDoCartao, () => avisarEventoDoCartao(null));
    if (conta.e_administrador) carregarPedidos(avisosAdmin);
    carregarOracao(conta, avisosAdmin);
    mostrarBoasVindasSePrimeiraVez(conta);
    return tela;
}

// --- Tempo -------------------------------------------------------------------
// Minutos de agora até o começo do culto (negativo: já começou), no relógio
// de Brasília, para o celular em outro fuso não errar a contagem.
function minutosAte(culto) {
    const agora = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date()).replace(' ', 'T');
    return Math.round((Date.parse(`${culto.data}T${culto.horario.slice(0, 5)}Z`) - Date.parse(`${agora}Z`)) / 60000);
}

function textoContagem(min) {
    if (min <= 0) return null;
    const horas = Math.floor(min / 60);
    const resto = min % 60;
    if (horas === 0) return `${resto} min`;
    if (horas < 24) return `${horas}h ${String(resto).padStart(2, '0')}min`;
    return null;
}

// "em 5 dias" (hoje e amanhã já aparecem na própria data)
function quantoFalta(dataISO) {
    const dias = diasEntre(hojeEmBrasilia(), dataISO);
    if (dias <= 1) return null;
    if (dias < 7) return `em ${dias} dias`;
    const semanas = Math.round(dias / 7);
    return semanas === 1 ? 'semana que vem' : `em ${semanas} semanas`;
}

// --- Compromisso -------------------------------------------------------------
const CONSULTA_DO_DIA = `
    id, nome, rotulo, data, horario, estado,
    escala ( estado, escala_item ( pessoa_id, instrumento_exibido, saiu_em, pessoa:pessoa_id ( nome, apelido, foto ) ) ),
    repertorio_item ( posicao, tom, musica:musica_id ( id, titulo, artista, link, links_streaming ) )
`;

async function carregarCompromisso(conta, destaque) {
    const meuId = conta.pessoa?.id;
    const hoje = hojeEmBrasilia();
    let cultos;
    let consulta = supabase.from('culto')
        .select('id, nome, rotulo, data, horario, estado, escala ( estado, escala_item ( pessoa_id, instrumento_exibido, saiu_em ) )')
        .eq('estado', 'ativo').gte('data', hoje)
        .order('data').order('horario').limit(40);
    // O culto continua vindo mesmo sem escala da pessoa; os itens embutidos
    // ficam limitados à própria conta, como na consulta anterior.
    if (meuId) consulta = consulta.eq('escala.escala_item.pessoa_id', meuId);
    const { data, error } = await consulta;
    const offline = Boolean(error);
    cultos = offline ? (escalaGuardada(conta.id)?.cultos ?? []) : data;

    const escalado = (c) => Boolean(c.escala?.some((e) => e.estado === 'publicada' &&
        e.escala_item.some((i) => i.pessoa_id === meuId && !naoVai(i))));
    const jaAcabou = (c) => c.data === hoje && minutosAte(c) < -DURACAO_DO_CULTO_MIN;
    const encerradoHoje = cultos.find((c) => c.data === hoje && escalado(c) && jaAcabou(c));
    const proximo = cultos.find((c) => c.data >= hoje && !jaAcabou(c));
    // O próximo culto em que a pessoa serve pode não ser o próximo da igreja
    // (a EBD das 9h vem antes do culto das 18h): a capa de hoje/amanhã é dele
    const meu = cultos.find((c) => c.data >= hoje && escalado(c) && !jaAcabou(c));
    marcarEscalado(meu?.data ?? null);
    // Evento do site no mesmo horário (Cantata, Ceia especial): o cartão
    // mostra o nome do evento, como a Agenda (sem rede, fica o nome do culto)
    const eventos = offline ? [] : await proximosEventos().catch(() => []);
    const comEvento = (c) => (c ? { ...c, evento: eventoDoCulto(c, eventos) } : c);

    if (encerradoHoje) {
        const completo = await cultoCompleto(conta, encerradoHoje, offline);
        destaque.replaceChildren(cartaoDepois(comEvento(completo)));
        if (proximo) destaque.append(cartaoNormal(comEvento(proximo), meuId, escalado(proximo)));
        return proximo ? eventoDoCulto(proximo, eventos) : null;
    }
    if (meu && diasEntre(hoje, meu.data) <= 1) {
        const dias = diasEntre(hoje, meu.data);
        const completo = await cultoCompleto(conta, meu, offline);
        destaque.replaceChildren(cartaoDoDia(comEvento(completo), meuId, dias === 0 ? 'dia' : 'vespera'));
        corDoTopo('#8F0D0B'); // o topo do celular acompanha a capa vermelha
        return eventoDoCulto(meu, eventos);
    }
    if (!proximo) {
        destaque.remove();
        return null;
    }
    destaque.replaceChildren(cartaoNormal(comEvento(proximo), meuId, escalado(proximo)));
    return eventoDoCulto(proximo, eventos);
}

// O culto com toda a escala publicada e o repertório, usado só quando a pessoa
// participa. Sem internet, usa a cópia guardada da Escala.
async function cultoCompleto(conta, culto, offline) {
    if (!offline) {
        const { data, error } = await supabase.from('culto').select(CONSULTA_DO_DIA).eq('id', culto.id)
            .order('posicao', { referencedTable: 'repertorio_item' }).maybeSingle();
        if (!error && data) return data;
    }
    return escalaGuardada(conta.id)?.cultos.find((c) => c.id === culto.id) ?? culto;
}

function meusInstrumentos(culto, meuId) {
    const eu = culto.escala.flatMap((e) => e.escala_item).find((i) => i.pessoa_id === meuId);
    const lista = eu ? eu.instrumento_exibido.filter((x) => x !== FUNCAO_MESA) : [];
    if (eu?.instrumento_exibido.includes(FUNCAO_MESA)) lista.push('Mesa de som');
    return lista;
}

// Nome que aparece: o do evento, se houver um no mesmo horário
const nomeDoCulto = (c) => (c.evento ? c.evento.titulo : [c.nome, c.rotulo].filter(Boolean).join(' · '));

function cartaoNormal(proximo, meuId, participa) {
    const falta = quantoFalta(proximo.data);
    return h('a', { class: 'inicio-compromisso', href: participa ? '#/escala' : '#/agenda' },
        h('span', { class: 'compromisso-rotulo' },
            h('span', null, 'Próximo culto'),
            falta && h('span', { class: 'compromisso-falta' }, falta)),
        h('span', { class: 'compromisso-titulo' }, nomeDoCulto(proximo)),
        h('span', { class: 'compromisso-quando' }, `${rotuloDoDia(proximo.data)} · ${formatarHorario(proximo.horario)}`),
        participa && h('span', { class: 'compromisso-chips' }, meusInstrumentos(proximo, meuId).map((x) => h('span', { class: 'compromisso-chip' }, iconeInstrumento(x), x))),
        h('span', { class: 'compromisso-acao' }, participa ? 'Ver escala e repertório' : 'Ver agenda', icone('seta', 'icone icone-p')));
}

// A capa do dia de culto (e da véspera): o momento mais importante da semana
// de quem toca. Linguagem de boletim: seções numeradas, filetes, tons grandes.
function cartaoDoDia(culto, meuId, modo) {
    const itens = culto.repertorio_item ?? [];
    const pessoas = culto.escala.filter((e) => e.estado === 'publicada').flatMap((e) => e.escala_item)
        .filter((i) => !naoVai(i) && i.pessoa_id !== meuId);
    const fila = filaDoYoutube(itens.map((i) => i.musica));

    const contagem = h('p', { class: 'dia-contagem', 'aria-live': 'off' });
    const estado = h('p', { class: 'dia-estado' });
    const atualizar = () => {
        const min = minutosAte(culto);
        if (modo === 'vespera') {
            estado.replaceChildren('Amanhã às ', formatarHorario(culto.horario));
            contagem.textContent = '';
            return;
        }
        if (min > 0) {
            estado.replaceChildren(h('span', { class: 'dia-ponto', 'aria-hidden': 'true' }), 'Começa em');
            contagem.textContent = textoContagem(min) ?? formatarHorario(culto.horario);
        } else {
            estado.replaceChildren(h('span', { class: 'dia-ponto agora', 'aria-hidden': 'true' }), 'Acontecendo agora');
            contagem.textContent = '';
        }
    };
    atualizar();
    // Atualiza a cada 30 s enquanto a tela está aberta; para sozinho ao sair
    const relogio = setInterval(() => (contagem.isConnected ? atualizar() : clearInterval(relogio)), 30000);

    const instrumentos = meusInstrumentos(culto, meuId);
    const MAX_ROSTOS = 6;
    return h('article', { class: `inicio-compromisso inicio-dia${modo === 'vespera' ? ' vespera' : ''}`, 'aria-label': `${modo === 'dia' ? 'Hoje' : 'Amanhã'} você toca: ${nomeDoCulto(culto)}` },
        h('p', { class: 'dia-rotulo' }, chama('chama-dia'), modo === 'dia' ? 'Hoje você toca' : 'Amanhã você toca'),
        h('h2', { class: 'dia-titulo' }, culto.evento ? culto.evento.titulo : culto.nome, !culto.evento && culto.rotulo ? h('span', null, ` · ${culto.rotulo}`) : null),
        instrumentos.length ? h('p', { class: 'dia-voce' }, h('span', null, 'Você'), instrumentos.map((x) => h('span', { class: 'compromisso-chip' }, iconeInstrumento(x), x))) : null,
        estado,
        contagem,

        h('h3', { class: 'dia-secao' }, h('span', { 'aria-hidden': 'true' }, 'I. '), 'Ordem do louvor'),
        itens.length
            ? h('ol', { class: 'dia-musicas' }, itens.map((item, i) => h('li', null,
                h('span', { class: 'dia-musica-n', 'aria-hidden': 'true' }, i + 1),
                h('span', { class: 'dia-musica-titulo' }, item.musica.titulo,
                    item.musica.artista ? h('span', { class: 'dia-musica-artista' }, item.musica.artista) : null),
                item.tom ? h('span', { class: 'dia-musica-tom' }, h('span', { class: 'sr-only' }, 'tom '), item.tom) : null)))
            : h('p', { class: 'dia-vazio' }, 'O repertório ainda não foi montado.'),

        pessoas.length ? h('h3', { class: 'dia-secao' }, h('span', { 'aria-hidden': 'true' }, 'II. '), 'Quem toca com você') : null,
        pessoas.length ? h('ul', { class: 'dia-rostos' },
            pessoas.slice(0, MAX_ROSTOS).map((i) => h('li', { title: nomeCurto(i.pessoa, 'Pessoa') },
                avatar(i.pessoa, 'pessoa-avatar dia-rosto'),
                h('span', { class: 'dia-rosto-nome' }, nomeCurto(i.pessoa, 'Pessoa')),
                // o que a pessoa toca, só em ícones (o nome vai no title e no leitor de tela)
                instrumentosComIcone(i.instrumento_exibido, { classe: 'dia-rosto-inst', soIcones: true }))),
            pessoas.length > MAX_ROSTOS ? h('li', { class: 'dia-rostos-mais' }, `+${pessoas.length - MAX_ROSTOS}`) : null) : null,

        h('div', { class: 'dia-acoes' },
            h('a', { class: 'dia-botao dia-botao-claro', href: '#/escala' }, icone('calendario', 'icone icone-p'), 'Ver a escala'),
            fila.url ? h('a', { class: 'dia-botao', href: fila.url, target: '_blank', rel: 'noopener noreferrer' }, icone('play', 'icone icone-p'), 'Ouvir tudo') : null,
            itens.length ? botaoWhatsRepertorio(culto, 'dia-whats') : null),
    );
}

// Depois do culto: um obrigado e o que foi tocado, como lembrança
function cartaoDepois(culto) {
    const itens = culto.repertorio_item ?? [];
    return h('article', { class: 'inicio-depois' },
        h('p', { class: 'depois-rotulo' }, chama('chama-depois'), 'Culto encerrado'),
        h('h2', { class: 'depois-titulo' }, 'Obrigado por tocar hoje.'),
        h('p', { class: 'depois-texto' }, `${nomeDoCulto(culto)} · ${formatarHorario(culto.horario)}`),
        itens.length ? h('ol', { class: 'depois-musicas' }, itens.map((i) => h('li', null, i.musica.titulo, i.tom ? h('span', null, ` · ${i.tom}`) : null))) : null);
}

// Pastor com pedido esperando: uma linha de atenção no topo, como os pedidos de acesso
async function carregarOracao(conta, lugar) {
    const n = await pedidosSemResposta(conta);
    if (!n) return;
    lugar.append(h('a', { class: 'atencao', href: '#/oracao' },
        h('span', { class: 'atencao-ponto', 'aria-hidden': 'true' }),
        h('span', { class: 'atencao-texto' }, n === 1 ? '1 pedido de oração para você' : `${n} pedidos de oração para você`),
        icone('seta', 'icone icone-p item-seta')));
}

async function carregarPedidos(lugar) {
    const { count } = await supabase.from('conta').select('id', { count: 'exact', head: true }).eq('estado', 'pendente');
    if (!count) return;
    lugar.prepend(h('a', { class: 'atencao', href: '#/pessoas' },
        h('span', { class: 'atencao-ponto', 'aria-hidden': 'true' }),
        h('span', { class: 'atencao-texto' }, count === 1 ? '1 pessoa pedindo acesso ao Hub' : `${count} pessoas pedindo acesso ao Hub`),
        icone('seta', 'icone icone-p item-seta')));
}
