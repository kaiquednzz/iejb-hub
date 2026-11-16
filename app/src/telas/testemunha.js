// Tela da testemunha da contagem (D61). Abre pelo QR, SEM login e sem
// precisar instalar o app (quem ajuda a contar só aponta a câmera).
//
// Contagem cega: a pessoa digita o que ELA contou e nunca vê o número de quem
// pediu. O banco compara e só responde "bateu" ou "não bateu em tal parte".
// Depois que bate, o QR morre: esta tela não mostra mais nada, e a pessoa não
// tem como ver caixa, saldo ou lançamento (nem antes, nem depois).
import { h, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { molduraEntrada, caixaDeAviso } from './moldura.js';
import { lerReais } from './financeiro/util.js';
import { comemorar } from '../util/comemorar.js';

const DATA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export function telaTestemunha(token) {
    const conteudo = h('div', { 'aria-busy': 'true' }, h('p', { class: 'entrada-subtitulo' }, 'Abrindo…'));
    const tela = molduraEntrada({ titulo: 'Conferir a contagem', conteudo });
    abrir();
    return tela;

    function fim(titulo, texto) {
        tela.querySelector('h1').textContent = titulo;
        conteudo.removeAttribute('aria-busy');
        conteudo.replaceChildren(h('p', { class: 'entrada-subtitulo' }, texto));
    }

    async function abrir() {
        const { data, error } = await supabase.rpc('testemunha_abrir', { p_token: token });
        if (error) return fim('Sem conexão', 'Confira a internet e leia o QR de novo.');
        if (data.situacao === 'vencido') return fim('QR vencido', 'Peça um QR novo.');
        if (data.situacao !== 'ok') return fim('QR já usado', 'Esta contagem já foi conferida.');
        conteudo.removeAttribute('aria-busy');
        conteudo.replaceChildren(formulario(data));
    }

    function formulario(info) {
        const quando = DATA.format(new Date(`${info.data}T12:00:00Z`));
        const aviso = caixaDeAviso();
        const nome = campoTexto('Seu nome', 'nome', { autocomplete: 'name', maxlength: 60 });
        const dizimos = campoDinheiro('Dízimos', 'dizimos');
        const ofertas = campoDinheiro('Ofertas', 'ofertas');
        const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Conferir');

        const form = h('form', { class: 'form', novalidate: true },
            h('p', { class: 'entrada-subtitulo' },
                `${info.quem} pediu sua ajuda para conferir o dinheiro ${info.culto ? `do ${info.culto}` : `de ${quando}`}.`),
            h('p', { class: 'testemunha-regra' }, h('strong', null, 'Digite quanto VOCÊ contou.')),
            nome.elemento, h('div', { class: 'fin-dois' }, dizimos.elemento, ofertas.elemento), aviso.elemento, botao);

        form.addEventListener('submit', (evento) => {
            evento.preventDefault();
            aviso.limpar();
            const n = nome.entrada.value.trim();
            const d = dizimos.entrada.value.trim() === '' ? 0 : lerReais(dizimos.entrada.value);
            const o = ofertas.entrada.value.trim() === '' ? 0 : lerReais(ofertas.entrada.value);
            if (n.length < 2) { aviso.mostrar('Digite seu nome.'); return nome.entrada.focus(); }
            if (d === null || o === null) return aviso.mostrar('Algum valor não está certo. Ex.: 150 ou 1.250,90');
            if (d + o === 0) return aviso.mostrar('Digite quanto você contou.');
            comCarregando(botao, async () => {
                const { data, error } = await supabase.rpc('testemunha_conferir', { p_token: token, p_nome: n, p_dizimos: d, p_ofertas: o });
                if (error) return aviso.mostrar('Não deu para conferir agora. Confira a internet e tente de novo.');
                if (data.situacao === 'bateu') {
                    comemorar('Bateu!', 'Obrigado pela ajuda!');
                    return fim('Conferido', 'Obrigado! Pode fechar esta página.');
                }
                if (data.situacao === 'vencido') return fim('QR vencido', 'Peça um QR novo.');
                if (data.situacao === 'esgotado') return fim('Muitas tentativas', 'Contem de novo e peça um QR novo.');
                if (data.situacao !== 'nao_bateu') return fim('QR já usado', 'Essa contagem já foi conferida ou cancelada.');
                const partes = [!data.dizimos && 'nos dízimos', !data.ofertas && 'nas ofertas'].filter(Boolean).join(' e ');
                aviso.mostrar(`Não bateu ${partes}. Contem de novo.`);
            });
        });
        return form;
    }
}

function campoTexto(rotulo, nome, extra) {
    const id = `testemunha-${nome}`;
    const entrada = h('input', { id, name: nome, type: 'text', class: 'fin-entrada', required: true, ...extra });
    return { elemento: h('div', { class: 'campo' }, h('label', { for: id }, rotulo), entrada), entrada };
}

function campoDinheiro(rotulo, nome) {
    const id = `testemunha-${nome}`;
    const entrada = h('input', { id, name: nome, class: 'fin-valor-campo', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00' });
    return {
        elemento: h('div', { class: 'campo' }, h('label', { for: id }, rotulo),
            h('div', { class: 'fin-valor' }, h('span', { 'aria-hidden': 'true' }, 'R$'), entrada)),
        entrada,
    };
}
