// Conta que existe mas não está ativa. Não mostra nenhum dado da igreja.
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { molduraEntrada, campo, caixaDeAviso } from './moldura.js';
import { blocoFoto } from './equipe/pecas.js';
import { avisar } from '../util/folha.js';
import { chama } from '../util/chama.js';
import { seletorDeTitulo } from '../util/titulos.js';

const TEXTOS = {
    pendente: {
        titulo: 'Pedido enviado',
        corpo: 'Recebemos você. Assim que a liderança liberar, é só abrir o Hub de novo.',
    },
    recusada: {
        titulo: 'Acesso não liberado',
        corpo: 'Seu pedido não foi aprovado. Se achar que foi engano, fale com a liderança do ministério.',
    },
    desativada: {
        titulo: 'Conta desativada',
        corpo: 'Esta conta foi desativada. Fale com o administrador do Hub se precisar voltar.',
    },
};

export function telaAguardando(conta, conferirDeNovo) {
    if (conta.estado === 'pendente' && !conta.apresentou_em) return telaApresentar(conta, conferirDeNovo);
    const texto = TEXTOS[conta.estado] ?? TEXTOS.pendente;
    const botaoConferir = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Conferir de novo');
    botaoConferir.addEventListener('click', () => comCarregando(botaoConferir, conferirDeNovo));

    return molduraEntrada({
        titulo: texto.titulo,
        subtitulo: texto.corpo,
        conteudo: h('div', { class: 'form' },
            h('p', { class: 'login-atual' }, 'Conta: ', h('strong', null, conta.login)),
            conta.estado === 'pendente' && botaoConferir,
            h('button', { type: 'button', class: 'botao-secundario botao-largo', onclick: () => supabase.auth.signOut() }, 'Sair'),
        ),
    });
}

// Primeiro acesso (D62): como quer ser chamado e, se quiser, uma foto.
// Assim o admin reconhece quem pediu. Curto de propósito: um campo e um botão.
function telaApresentar(conta, depois) {
    let foto = conta.foto_informada ?? null;
    const aviso = caixaDeAviso();
    const nome = campo({ rotulo: 'Como quer ser chamado?', nome: 'nome', autocomplete: 'name', maxlength: 60, value: conta.nome_informado ?? '' });
    const destino = { pasta: `contas/${conta.id}`, definir: async (caminho) => { foto = caminho; return { error: null }; } };
    const continuar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Enviar e entrar na fila');

    // O que faz na igreja (opcional). É só um pedido: o admin aprova.
    // D68: o Hub é da igreja toda. Não servir em nenhuma área é resposta válida.
    // D71: os ministérios são os que existem de verdade (vêm do banco), e o
    // título na igreja é uma pergunta à parte.
    const titulo = seletorDeTitulo({ id: 'apresentar-titulo' });
    titulo.options[0].textContent = 'Membro (sem cargo)';
    const lugarFuncoes = h('div', { class: 'apresentar-funcoes' });
    let funcoes = null;
    let louvorId = null;
    const instrumentos = fichasMultiplas('Toca ou canta o quê?', INSTRUMENTOS);
    instrumentos.elemento.hidden = true;
    supabase.rpc('ministerios_para_escolher').then(({ data }) => {
        louvorId = (data ?? []).find((m) => m.nome === 'Louvor')?.id ?? null;
        funcoes = fichasMultiplas('Você serve em alguma área?',
            [...(data ?? []).map((m) => [`m:${m.id}`, m.nome]), ...FUNCOES],
            'Não serve em nenhuma? Pode deixar em branco: você entra como membro e vê o mural e os eventos da igreja.');
        funcoes.aoMudar(() => { instrumentos.elemento.hidden = !funcoes.valores().includes(`m:${louvorId}`); });
        lugarFuncoes.replaceChildren(funcoes.elemento);
    });

    const form = h('form', { class: 'form', novalidate: true },
        blocoFoto({ id: conta.id, nome: conta.nome_informado || conta.login, foto }, null, destino),
        h('p', { class: 'campo-dica apresentar-dica' }, 'A foto é opcional.'),
        nome,
        h('div', { class: 'campo' }, h('label', { for: 'apresentar-titulo' }, 'Tem algum cargo na igreja?'), titulo),
        lugarFuncoes, instrumentos.elemento, aviso.elemento, continuar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const n = form.querySelector('[name=nome]').value.trim();
        if (n.length < 2) return aviso.mostrar('Escreva seu nome.');
        comCarregando(continuar, async () => {
            const escolhidas = funcoes?.valores() ?? [];
            const ministerios = escolhidas.filter((f) => f.startsWith('m:')).map((f) => f.slice(2));
            const { error } = await supabase.rpc('apresentar_me', {
                p_nome: n, p_foto: foto,
                p_titulo: titulo.value,
                p_ministerios: ministerios,
                p_cargos: escolhidas.filter((f) => !f.startsWith('m:')),
                p_instrumentos: ministerios.includes(louvorId) ? instrumentos.valores() : [],
            });
            if (error) return avisar('Não deu para salvar. Tente de novo.');
            await depois();
        });
    });

    // Acolhimento (redesign v2): a pessoa é recebida como quem chega na
    // igreja, não como quem preenche cadastro. A chama acende no título.
    return molduraEntrada({
        titulo: [chama('chama-boas-vindas'), 'Que bom que você chegou'],
        subtitulo: 'Conta pra gente quem é você. A liderança confere e libera o seu acesso.',
        conteudo: form,
    });
}

// Além dos ministérios: as duas áreas que dão permissão no app (D71)
const FUNCOES = [['tesouraria', 'Tesouraria'], ['comunicacao', 'Comunicação']];
const INSTRUMENTOS = ['Voz', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Cajón', 'Mesa'].map((i) => [i, i]);

// Fichas que ligam e desligam (várias ao mesmo tempo)
function fichasMultiplas(rotulo, opcoes, dica = null) {
    const marcadas = new Set();
    let aviso = null;
    const grupo = h('div', { class: 'fichas', role: 'group', 'aria-label': rotulo },
        opcoes.map(([id, nome]) => {
            const f = h('button', { type: 'button', class: 'ficha', 'aria-pressed': 'false' }, nome);
            f.addEventListener('click', () => {
                if (marcadas.has(id)) marcadas.delete(id); else marcadas.add(id);
                f.setAttribute('aria-pressed', String(marcadas.has(id)));
                aviso?.();
            });
            return f;
        }));
    return {
        elemento: h('fieldset', { class: 'campo' }, h('legend', null, rotulo), grupo, dica && h('p', { class: 'campo-dica' }, dica)),
        valores: () => [...marcadas],
        aoMudar: (fn) => { aviso = fn; },
    };
}
