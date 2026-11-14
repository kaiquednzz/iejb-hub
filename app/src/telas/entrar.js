import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { mensagemDeErro } from '../sessao.js';
import { molduraEntrada, campo, caixaDeAviso, blocoGoogle } from './moldura.js';
import { erroDoGoogle } from '../util/google.js';

export function telaEntrar() {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Entrar');
    const ajuda = h('p', { class: 'ajuda-senha', hidden: true },
        'O Hub não manda e-mail. Fale com o administrador: ele redefine sua senha e te passa uma temporária.');

    const form = h('form', {
        class: 'form', novalidate: true,
        onsubmit: async (evento) => {
            evento.preventDefault();
            aviso.limpar();
            const dados = new FormData(form);
            const email = String(dados.get('email')).trim();
            const senha = String(dados.get('senha'));
            if (!email || !senha) return aviso.mostrar('Preencha e-mail e senha.');

            await comCarregando(botao, async () => {
                const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
                // Deu certo: o main.js percebe o login e troca a tela sozinho
                if (error) aviso.mostrar(mensagemDeErro(error));
            });
        },
    },
        campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', autocomplete: 'username', inputmode: 'email' }),
        campo({ rotulo: 'Senha', nome: 'senha', tipo: 'password', autocomplete: 'current-password' }),
        aviso.elemento,
        botao,
        h('button', {
            type: 'button', class: 'link-discreto',
            onclick: () => { ajuda.hidden = !ajuda.hidden; },
        }, 'Esqueci minha senha'),
        ajuda,
    );

    const erroGoogle = erroDoGoogle();
    if (erroGoogle) aviso.mostrar(erroGoogle);

    return molduraEntrada({
        titulo: 'Entrar',
        subtitulo: 'Escalas e repertório do Louvor.',
        conteudo: h('div', null, blocoGoogle('Entrar com Google', aviso), form),
        rodape: h('span', null, 'Ainda não tem acesso? ', h('a', { href: '#/pedir-acesso' }, 'Pedir acesso')),
    });
}
