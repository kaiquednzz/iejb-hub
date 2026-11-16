// Início (D40): a porta de entrada do Hub. O app vai ter vários módulos
// (Louvor hoje; Pregações, Kids, Financeiro depois), então ao entrar a pessoa
// vê primeiro o que importa para ELA (o próximo compromisso, pedidos
// esperando) e depois a grade de módulos.
//
// Módulos:
//   * cada um declara quem vê (pode) e para onde vai (rota);
//   * "em breve" aparece apagado, com aviso ao tocar (decisão de Kaique:
//     mostra para onde o Hub vai). Um módulo novo é uma linha em MODULOS.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { avisar } from '../util/folha.js';
import { hojeEmBrasilia, rotuloDoDia, formatarHorario, partesDaData } from '../util/datas.js';
import { escalaGuardada } from '../offline.js';
import { naoVai, FUNCAO_MESA } from '../util/escala.js';
import { cabecalhoApp } from './moldura.js';
import { veFinanceiro, cuidaDosEventos } from '../sessao.js';
import { blocoConferir } from './financeiro/conferir.js';

const MODULOS = [
    { id: 'louvor', nome: 'Louvor', texto: 'Escala, repertórios e equipe', icone: 'musica', rota: '#/escala', pode: () => true },
    { id: 'eventos', nome: 'Eventos do site', texto: 'Agenda de iejb.com.br', icone: 'megafone', rota: '#/eventos', pode: cuidaDosEventos },
    { id: 'pregacoes', nome: 'Pregações', texto: 'Mensagens e acervo', icone: 'livro', emBreve: true },
    { id: 'kids', nome: 'Kids', texto: 'Turmas e escalas', icone: 'crianca', emBreve: true },
    { id: 'financeiro', nome: 'Financeiro', texto: 'Caixa da igreja', icone: 'moeda', rota: '#/financeiro', pode: veFinanceiro },
];

function saudacao() {
    const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()));
    return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function dataDeHoje() {
    const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
}

export function telaInicio(conta) {
    const primeiroNome = (conta.pessoa?.apelido || conta.pessoa?.nome || conta.nome_informado || '').split(' ')[0];
    const destaque = h('div', { class: 'inicio-destaque', 'aria-live': 'polite' }, h('div', { class: 'inicio-compromisso esqueleto' }));
    const avisosAdmin = h('div', { class: 'inicio-avisos' });
    // Contagem do culto esperando a conferência desta pessoa (D48)
    const conferir = blocoConferir(conta);

    const tela = h('div', { class: 'tela tela-app tela-inicio' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'inicio-aurora', 'aria-hidden': 'true' }, h('span'), h('span')),
            h('p', { class: 'inicio-data' }, dataDeHoje()),
            h('h1', { tabindex: -1, class: 'titulo-tela inicio-ola' }, `${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}!`),
            destaque,
            conferir,
            avisosAdmin,
            h('h2', { class: 'inicio-secao' }, 'Ministérios e áreas'),
            h('ul', { class: 'grade-modulos' }, MODULOS.filter((m) => m.emBreve || m.pode(conta)).map(cartaoModulo)),
            h('p', { class: 'inicio-rodape' }, 'IEJB · Igreja Evangélica do Jardim Brasil'),
        ),
    );

    carregarCompromisso(conta, destaque);
    if (conta.e_administrador) carregarPedidos(avisosAdmin);
    return tela;
}

function cartaoModulo(modulo, i) {
    const conteudo = [
        h('span', { class: 'modulo-icone', 'aria-hidden': 'true' }, icone(modulo.icone)),
        h('span', { class: 'modulo-textos' },
            h('span', { class: 'modulo-nome' }, modulo.nome),
            h('span', { class: 'modulo-texto' }, modulo.texto)),
        modulo.emBreve ? h('span', { class: 'modulo-em-breve' }, 'Em breve') : icone('seta', 'icone icone-p modulo-seta'),
    ];
    if (modulo.emBreve) {
        const b = h('button', { type: 'button', class: `modulo modulo-${modulo.id} em-breve`, 'aria-label': `${modulo.nome}: em breve` }, ...conteudo);
        b.addEventListener('click', () => {
            b.classList.remove('balancar');
            void b.offsetWidth;   // reinicia a animação se tocar de novo
            b.classList.add('balancar');
            avisar(`${modulo.nome} ainda está sendo construído. Logo chega ao Hub!`);
        });
        return h('li', { style: { '--i': i } }, b);
    }
    return h('li', { style: { '--i': i } }, h('a', { class: `modulo modulo-${modulo.id}`, href: modulo.rota }, ...conteudo));
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
            h('span', { class: 'compromisso-rotulo' }, icone('calendario', 'icone icone-p'), 'Sua agenda'),
            h('span', { class: 'compromisso-titulo' }, 'Nenhuma escala sua pela frente'),
            h('span', { class: 'compromisso-acao' }, 'Ver a escala do Louvor', icone('seta', 'icone icone-p'))));
        return;
    }
    const eu = proximo.escala.flatMap((e) => e.escala_item).find((i) => i.pessoa_id === meuId);
    const instrumentos = eu.instrumento_exibido.filter((x) => x !== FUNCAO_MESA);
    const naMesa = eu.instrumento_exibido.includes(FUNCAO_MESA);
    const partes = partesDaData(proximo.data);
    destaque.replaceChildren(h('a', { class: 'inicio-compromisso', href: '#/escala' },
        h('span', { class: 'compromisso-rotulo' }, icone('estrela', 'icone icone-p'), 'Seu próximo compromisso'),
        h('span', { class: 'compromisso-linha' },
            h('span', { class: 'compromisso-data', 'aria-hidden': 'true' },
                h('span', null, partes.semana), h('strong', null, partes.dia), h('span', null, partes.mes)),
            h('span', { class: 'compromisso-textos' },
                h('span', { class: 'compromisso-titulo' }, `${rotuloDoDia(proximo.data)} · ${formatarHorario(proximo.horario)}`),
                h('span', { class: 'compromisso-culto' }, proximo.nome, proximo.rotulo ? ` · ${proximo.rotulo}` : ''),
                h('span', { class: 'compromisso-chips' },
                    [...instrumentos, ...(naMesa ? ['Mesa de som'] : [])].map((x) => h('span', { class: 'compromisso-chip' }, x))))),
        h('span', { class: 'compromisso-acao' }, 'Ver escala e repertório', icone('seta', 'icone icone-p'))));
}

async function carregarPedidos(lugar) {
    const { count } = await supabase.from('conta').select('id', { count: 'exact', head: true }).eq('estado', 'pendente');
    if (!count) return;
    lugar.replaceChildren(h('a', { class: 'inicio-pedidos', href: '#/equipe' },
        h('span', { class: 'pedidos-numero' }, String(count)),
        h('span', null, count === 1 ? 'pessoa pedindo acesso ao Hub' : 'pessoas pedindo acesso ao Hub'),
        icone('seta', 'icone icone-p')));
}
