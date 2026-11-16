// Pedido de acesso (D23): a pessoa cria login e senha e a conta nasce PENDENTE.
// Ela não vê nada até um administrador aprovar e ligar a conta a uma pessoa.
import { senhaVazou, AVISO_SENHA_VAZADA } from '../util/senha.js';
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { mensagemDeErro } from '../sessao.js';
import { molduraEntrada, campo, caixaDeAviso, blocoGoogle } from './moldura.js';

const SENHA_MINIMA = 8;

export function telaPedirAcesso() {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Pedir acesso');

    const form = h('form', {
        class: 'form', novalidate: true,
        onsubmit: async (evento) => {
            evento.preventDefault();
            aviso.limpar();
            const dados = new FormData(form);
            const nome = String(dados.get('nome')).trim();
            const email = String(dados.get('email')).trim();
            const senha = String(dados.get('senha'));

            if (nome.length < 2) return aviso.mostrar('Escreva seu nome, para o administrador te reconhecer.');
            if (!email.includes('@')) return aviso.mostrar('Confira o e-mail.');
            if (senha.length < SENHA_MINIMA) return aviso.mostrar(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);

            await comCarregando(botao, async () => {
                // O "nome" vai em options.data → raw_user_meta_data no banco,
                // e o gatilho criar_conta guarda em conta.nome_informado.
                if (await senhaVazou(senha)) return aviso.mostrar(AVISO_SENHA_VAZADA);
                const { data, error } = await supabase.auth.signUp({
                    email, password: senha, options: { data: { nome } },
                });
                if (error) return aviso.mostrar(mensagemDeErro(error));
                // Com "Confirm email" desligado o Supabase já devolve a sessão e o
                // main.js leva para a tela de espera. Se vier sem sessão, é porque
                // a confirmação por e-mail ainda está ligada no painel.
                if (!data.session) {
                    aviso.mostrar('Pedido enviado. Avise o administrador para liberar seu acesso.', 'ok');
                    form.reset();
                }
            });
        },
    },
        campo({ rotulo: 'Seu nome', nome: 'nome', autocomplete: 'name', maxlength: 80 }),
        campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', autocomplete: 'username', inputmode: 'email',
            dica: 'Serve só como login. O Hub não manda e-mail.' }),
        campo({ rotulo: 'Crie uma senha', nome: 'senha', tipo: 'password', autocomplete: 'new-password',
            minlength: SENHA_MINIMA, dica: `Pelo menos ${SENHA_MINIMA} caracteres.` }),
        aviso.elemento,
        botao,
        h('p', { class: 'campo-dica pedir-aceite' }, 'Ao pedir acesso você concorda com os ',
            h('a', { href: '#/termos' }, 'termos de uso'), ' e a ', h('a', { href: '#/privacidade' }, 'política de privacidade'), '.'),
    );

    return molduraEntrada({
        titulo: 'Pedir acesso',
        subtitulo: 'Um administrador confere e libera sua conta.',
        // Com Google o pedido nasce do mesmo jeito (conta pendente, com o nome do Google)
        conteudo: h('div', null, blocoGoogle('Pedir acesso com Google', aviso), form),
        rodape: h('span', null, 'Já tem conta? ', h('a', { href: '#/entrar' }, 'Entrar')),
    });
}
