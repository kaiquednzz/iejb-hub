// Início (D40): a porta de entrada do Hub. O app vai ter vários módulos
// (Louvor hoje; Pregações, Kids, Financeiro depois), então ao entrar a pessoa
// vê primeiro o que importa para ELA (o próximo compromisso, pedidos
// esperando) e depois a grade de módulos.
//
// Módulos:
//   * cada um declara quem vê (pode) e para onde vai (rota);
//   * "em breve" vira uma linha discreta no fim (decisão de Kaique: mostrar
//     para onde o Hub vai, mas sem pesar como o que já funciona).
//     Um módulo novo é uma linha em MODULOS.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { hojeEmBrasilia, rotuloDoDia, formatarHorario, diasEntre } from '../util/datas.js';
import { escalaGuardada } from '../offline.js';
import { naoVai, FUNCAO_MESA } from '../util/escala.js';
import { cabecalhoApp } from './moldura.js';
import { linhaLista } from './voce.js';
import { veFinanceiro, cuidaDosEventos } from '../sessao.js';
import { contadorDePedidos } from './moldura.js';
import { blocoConferir } from './financeiro/conferir.js';
import { blocoEventos } from './inicio-eventos.js';

const MODULOS = [
    { id: 'louvor', nome: 'Louvor', texto: 'Escala, repertórios e equipe', icone: 'musica', rota: '#/escala', pode: () => true },
    { id: 'eventos', nome: 'Eventos do site', texto: 'Agenda de iejb.com.br', icone: 'megafone', rota: '#/eventos', pode: cuidaDosEventos },
    { id: 'pregacoes', nome: 'Pregações', texto: 'Mensagens e acervo', icone: 'livro', emBreve: true },
    { id: 'kids', nome: 'Kids', texto: 'Turmas e escalas', icone: 'crianca', emBreve: true },
    { id: 'financeiro', nome: 'Financeiro', texto: 'Caixa da igreja', icone: 'moeda', rota: '#/financeiro', pode: veFinanceiro },
    // Só o admin: aprovar acessos, cadastro, cargos (antes ficava escondido dentro do Louvor)
    { id: 'pessoas', nome: 'Pessoas', texto: 'Acessos e cadastro', icone: 'chave', rota: '#/pessoas', pode: (c) => c.e_administrador },
];

function saudacao() {
    const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()));
    return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataDeHoje() {
    const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// Ordem da tela (redesign, etapa 3), do mais pessoal para o mais geral:
//   1. saudação;
//   2. "precisa da sua atenção": só aparece se houver algo (contagem para
//      conferir, pedidos de acesso para o admin). É aqui que o admin vê a
//      diferença, e não num selo;
//   3. o próximo compromisso (o único destaque vermelho da tela);
//   4. Vem aí (eventos do site, em lista);
//   5. suas áreas (só as que a pessoa pode abrir) e, numa linha, as que vêm aí.
export function telaInicio(conta) {
    const primeiroNome = (conta.pessoa?.apelido || conta.pessoa?.nome || conta.nome_informado || '').split(' ')[0];
    const destaque = h('div', { class: 'inicio-destaque', 'aria-live': 'polite' }, h('div', { class: 'inicio-compromisso esqueleto' }));
    const avisosAdmin = h('div', { class: 'inicio-avisos' });
    // Contagem do culto esperando a conferência desta pessoa (D48)
    const conferir = blocoConferir(conta);

    const ativos = MODULOS.filter((m) => !m.emBreve && m.pode(conta));
    const emBreve = MODULOS.filter((m) => m.emBreve).map((m) => m.nome);
    const areas = ativos.map((m) => linhaLista({ href: m.rota, nome: m.nome, texto: m.texto, nomeIcone: m.icone }));
    ativos.forEach((m, i) => {
        areas[i].style.setProperty('--i', i);
        if (m.id === 'pessoas') contadorDePedidos(areas[i].querySelector('.item-nome'), 'item-contador');
    });

    const tela = h('div', { class: 'tela tela-app tela-inicio' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'inicio-ola-area' },
                h('p', { class: 'inicio-data' }, dataDeHoje()),
                h('h1', { tabindex: -1, class: 'titulo-tela inicio-ola' }, `${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}`)),
            conferir,
            avisosAdmin,
            destaque,
            blocoEventos(),
            h('h2', { class: 'rotulo-secao' }, 'Suas áreas'),
            h('ul', { class: 'grupo-lista inicio-areas' }, areas),
            emBreve.length ? h('p', { class: 'inicio-em-breve' }, `Em breve no Hub: ${listaNatural(emBreve)}`) : null,
        ),
    );

    carregarCompromisso(conta, destaque);
    if (conta.e_administrador) carregarPedidos(avisosAdmin);
    return tela;
}

// ['Pregações', 'Kids'] → 'Pregações e Kids'
function listaNatural(itens) {
    return itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}

// "em 5 dias" (hoje e amanhã já aparecem na própria data)
function quantoFalta(dataISO) {
    const dias = diasEntre(hojeEmBrasilia(), dataISO);
    if (dias <= 1) return null;
    if (dias < 7) return `em ${dias} dias`;
    const semanas = Math.round(dias / 7);
    return semanas === 1 ? 'semana que vem' : `em ${semanas} semanas`;
}

// Próximo culto em que a pessoa toca (publicado, não marcou "não vou")
async function carregarCompromisso(conta, destaque) {
    const meuId = conta.pessoa?.id;
    const hoje = hojeEmBrasilia();
    let cultos = null;
    const { data, error } = await supabase.from('culto')
        .select('id, nome, rotulo, data, horario, escala!inner ( estado, escala_item!inner ( pessoa_id, instrumento_exibido, saiu_em ) )')
        .eq('estado', 'ativo').gte('data', hoje)
        .eq('escala.estado', 'publicada').eq('escala.escala_item.pessoa_id', meuId)
        .order('data').order('horario').limit(3);
    if (!error) cultos = data;
    else cultos = escalaGuardada(conta.id)?.cultos ?? [];   // sem internet: usa a cópia da escala

    const proximo = cultos.find((c) => c.data >= hoje && c.escala?.some((e) => e.estado === 'publicada' &&
        e.escala_item.some((i) => i.pessoa_id === meuId && !naoVai(i))));
    if (!proximo) {
        destaque.replaceChildren(h('a', { class: 'inicio-compromisso vazio', href: '#/escala' },
            h('span', { class: 'compromisso-rotulo' }, 'Sua agenda'),
            h('span', { class: 'compromisso-titulo' }, 'Nenhuma escala sua pela frente'),
            h('span', { class: 'compromisso-acao' }, 'Ver a escala do Louvor', icone('seta', 'icone icone-p'))));
        return;
    }
    const eu = proximo.escala.flatMap((e) => e.escala_item).find((i) => i.pessoa_id === meuId);
    const instrumentos = eu.instrumento_exibido.filter((x) => x !== FUNCAO_MESA);
    const naMesa = eu.instrumento_exibido.includes(FUNCAO_MESA);
    const falta = quantoFalta(proximo.data);
    // O nome do culto é o título; a data vem numa linha só, embaixo
    // (antes ela aparecia duas vezes: no bloco "DOM 22 NOV" e no título).
    destaque.replaceChildren(h('a', { class: 'inicio-compromisso', href: '#/escala' },
        h('span', { class: 'compromisso-rotulo' },
            h('span', null, 'Próximo compromisso'),
            falta && h('span', { class: 'compromisso-falta' }, falta)),
        h('span', { class: 'compromisso-titulo' }, proximo.nome, proximo.rotulo ? ` · ${proximo.rotulo}` : ''),
        h('span', { class: 'compromisso-quando' }, `${rotuloDoDia(proximo.data)} · ${formatarHorario(proximo.horario)}`),
        h('span', { class: 'compromisso-chips' },
            [...instrumentos, ...(naMesa ? ['Mesa de som'] : [])].map((x) => h('span', { class: 'compromisso-chip' }, x))),
        h('span', { class: 'compromisso-acao' }, 'Ver escala e repertório', icone('seta', 'icone icone-p'))));
}

async function carregarPedidos(lugar) {
    const { count } = await supabase.from('conta').select('id', { count: 'exact', head: true }).eq('estado', 'pendente');
    if (!count) return;
    lugar.replaceChildren(h('a', { class: 'atencao', href: '#/pessoas' },
        h('span', { class: 'atencao-ponto', 'aria-hidden': 'true' }),
        h('span', { class: 'atencao-texto' }, count === 1 ? '1 pessoa pedindo acesso ao Hub' : `${count} pessoas pedindo acesso ao Hub`),
        icone('seta', 'icone icone-p item-seta')));
}
