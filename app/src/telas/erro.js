import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { mensagemDeErro } from '../sessao.js';
import { molduraEntrada } from './moldura.js';

export function telaErro(erro, tentarDeNovo) {
    console.error(erro);
    const botao = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Tentar de novo');
    botao.addEventListener('click', () => comCarregando(botao, tentarDeNovo));
    return molduraEntrada({
        titulo: 'Não deu para abrir',
        subtitulo: mensagemDeErro(erro),
        conteudo: h('div', { class: 'form' },
            botao,
            h('button', { type: 'button', class: 'link-discreto', onclick: () => supabase.auth.signOut() }, 'Sair'),
        ),
    });
}
