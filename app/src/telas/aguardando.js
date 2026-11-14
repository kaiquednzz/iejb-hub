// Conta que existe mas não está ativa. Não mostra nenhum dado da igreja.
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { molduraEntrada } from './moldura.js';

const TEXTOS = {
    pendente: {
        titulo: 'Pedido recebido',
        corpo: 'Um administrador precisa liberar sua conta. Quando ele aprovar, é só abrir o Hub de novo.',
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
