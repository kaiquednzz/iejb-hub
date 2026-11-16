// Conta que existe mas não está ativa. Não mostra nenhum dado da igreja.
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { molduraEntrada, campo, caixaDeAviso } from './moldura.js';
import { blocoFoto } from './equipe/pecas.js';
import { avisar } from '../util/folha.js';

const TEXTOS = {
    pendente: {
        titulo: 'Pedido enviado',
        corpo: 'Agora é só esperar a liberação. Depois, abra o Hub de novo.',
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
    const continuar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Continuar');

    // O que faz na igreja (opcional). É só um pedido: o admin aprova.
    const funcoes = fichasMultiplas('O que você faz na igreja?', FUNCOES);
    const instrumentos = fichasMultiplas('Toca ou canta o quê?', INSTRUMENTOS);
    instrumentos.elemento.hidden = true;
    funcoes.aoMudar(() => { instrumentos.elemento.hidden = !funcoes.valores().includes('louvor'); });

    const form = h('form', { class: 'form', novalidate: true },
        blocoFoto({ id: conta.id, nome: conta.nome_informado || conta.login, foto }, null, destino),
        h('p', { class: 'campo-dica apresentar-dica' }, 'A foto é opcional.'),
        nome, funcoes.elemento, instrumentos.elemento, aviso.elemento, continuar);
    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const n = form.querySelector('[name=nome]').value.trim();
        if (n.length < 2) return aviso.mostrar('Escreva seu nome.');
        comCarregando(continuar, async () => {
            const escolhidas = funcoes.valores();
            const { error } = await supabase.rpc('apresentar_me', {
                p_nome: n, p_foto: foto,
                p_cargos: escolhidas.filter((f) => f !== 'louvor'),
                p_louvor: escolhidas.includes('louvor'),
                p_instrumentos: escolhidas.includes('louvor') ? instrumentos.valores() : [],
            });
            if (error) return avisar('Não deu para salvar. Tente de novo.');
            await depois();
        });
    });

    return molduraEntrada({ titulo: 'Quase lá!', conteudo: form });
}

const FUNCOES = [['louvor', 'Louvor'], ['tesouraria', 'Tesouraria'], ['comunicacao', 'Comunicação'], ['pastor', 'Pastor']];
const INSTRUMENTOS = ['Voz', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Cajón', 'Mesa'].map((i) => [i, i]);

// Fichas que ligam e desligam (várias ao mesmo tempo)
function fichasMultiplas(rotulo, opcoes) {
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
        elemento: h('fieldset', { class: 'campo' }, h('legend', null, rotulo), grupo),
        valores: () => [...marcadas],
        aoMudar: (fn) => { aviso = fn; },
    };
}
