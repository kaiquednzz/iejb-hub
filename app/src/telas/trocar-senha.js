// Primeira entrada com senha temporária (RN-10, RN-65): troca obrigatória.
// Quando a senha muda, o gatilho limpar_senha_temporaria (no banco) desmarca
// a conta, e o evento USER_UPDATED faz o main.js levar para a escala.
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { mensagemDeErro, nomeCurto } from '../sessao.js';
import { molduraEntrada, campo, caixaDeAviso } from './moldura.js';

const SENHA_MINIMA = 8;

export function telaTrocarSenha(conta) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar nova senha');

    const form = h('form', {
        class: 'form', novalidate: true,
        onsubmit: async (evento) => {
            evento.preventDefault();
            aviso.limpar();
            const dados = new FormData(form);
            const senha = String(dados.get('senha'));
            const repetida = String(dados.get('repetir'));
            if (senha.length < SENHA_MINIMA) return aviso.mostrar(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
            if (senha !== repetida) return aviso.mostrar('As duas senhas não são iguais.');

            await comCarregando(botao, async () => {
                const { error } = await supabase.auth.updateUser({ password: senha });
                if (error) aviso.mostrar(mensagemDeErro(error));
            });
        },
    },
        campo({ rotulo: 'Nova senha', nome: 'senha', tipo: 'password', autocomplete: 'new-password', minlength: SENHA_MINIMA,
            dica: `Pelo menos ${SENHA_MINIMA} caracteres.` }),
        campo({ rotulo: 'Repita a nova senha', nome: 'repetir', tipo: 'password', autocomplete: 'new-password' }),
        aviso.elemento,
        botao,
        h('button', { type: 'button', class: 'link-discreto', onclick: () => supabase.auth.signOut() }, 'Sair'),
    );

    return molduraEntrada({
        titulo: `Oi, ${nomeCurto(conta.pessoa, 'tudo bem')}!`,
        subtitulo: 'Sua senha atual é temporária. Crie uma só sua para continuar.',
        conteudo: form,
    });
}
