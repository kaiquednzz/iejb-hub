// "Eventos" (só administrador, D34): os eventos do site iejb.com.br.
//
// O Hub não mexe no site diretamente. Ele só guarda os eventos; quem leva
// para o site é um GitHub Action do repositório do site, que a cada 15 min
// lê os PUBLICADOS e reescreve o bloco de eventos do index.html no mesmo
// formato que era escrito à mão. Por isso:
//   * "Mostrar no site" desligado = rascunho, ninguém fora do Hub vê;
//   * a mudança aparece no site em até ~15 minutos, não na hora;
//   * evento que passou sai do site sozinho (não precisa apagar).
//
// O formulário segue os campos do cartão do site, e a prévia no topo da
// folha mostra o cartão como ele vai ficar.
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, confirmar, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { hojeEmBrasilia, formatarHorario, rotuloDoDia } from '../util/datas.js';
import { reduzirImagem } from '../util/foto.js';
import { cabecalhoApp, campo, caixaDeAviso } from './moldura.js';
import { interruptor } from './equipe/pecas.js';
import { situacaoDoEvento, urlDaImagem, enderecoNoSite } from '../util/eventos.js';

const CATEGORIAS = ['Culto especial', 'Culto de Jovens', 'Conferência', 'Retiro', 'Fim de ano'];
const UM_ANO = String(60 * 60 * 24 * 365);
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function telaEventos(conta) {
    const area = h('div', { class: 'eventos-area', 'aria-busy': 'true' }, esqueleto());
    const novo = h('button', { type: 'button', class: 'botao-principal botao-largo' }, icone('mais'), 'Novo evento');
    novo.addEventListener('click', () => abrirEvento(null, carregar));

    const tela = h('div', { class: 'tela tela-app tela-eventos' },
        cabecalhoApp(conta, { modulo: 'Eventos do site' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Eventos do site'),
            h('p', { class: 'subtitulo-tela' }, 'O que estiver publicado aqui aparece na agenda de iejb.com.br em até 15 minutos.'),
            novo,
            area,
        ),
    );

    carregar();
    return tela;

    async function carregar() {
        const { data, error } = await supabase.from('evento').select('*').order('data').order('horario');
        area.removeAttribute('aria-busy');
        if (error) {
            console.error(error);
            const botao = h('button', { type: 'button', class: 'botao-principal' }, 'Tentar de novo');
            botao.addEventListener('click', () => comCarregando(botao, carregar));
            area.replaceChildren(h('div', { class: 'estado-vazio' },
                h('p', { class: 'estado-vazio-titulo' }, 'Não deu para carregar os eventos.'),
                h('p', { class: 'estado-vazio-texto' }, mensagemDoBanco(error)), botao));
            return;
        }
        // Mesma regra do site: sai 3h depois do início (ou no fim do último dia)
        const passou = (e) => situacaoDoEvento(e) === 'passou';
        const proximos = data.filter((e) => !passou(e));
        const antigos = data.filter(passou).reverse().slice(0, 12);

        const partes = [];
        if (!proximos.length) {
            partes.push(h('div', { class: 'estado-vazio' },
                h('div', { class: 'estado-vazio-icone', 'aria-hidden': 'true' }, icone('megafone')),
                h('p', { class: 'estado-vazio-titulo' }, 'Nenhum evento pela frente'),
                h('p', { class: 'estado-vazio-texto' }, 'Sem eventos, o site mostra "Em breve novos eventos por aqui".')));
        } else {
            partes.push(h('ul', { class: 'lista-eventos' }, proximos.map((e, i) => itemEvento(e, i, false))));
        }
        if (antigos.length) {
            partes.push(h('details', { class: 'eventos-antigos' },
                h('summary', null, `Já aconteceram (${antigos.length})`),
                h('ul', { class: 'lista-eventos' }, antigos.map((e, i) => itemEvento(e, i, true)))));
        }
        area.replaceChildren(...partes);
    }

    function itemEvento(evento, i, passou) {
        const [, mes, dia] = evento.data.split('-');
        const estado = passou ? ['Já passou', 'estado-cancelado']
            : evento.publicado ? ['No site', 'estado-publicada'] : ['Rascunho', 'estado-rascunho'];
        const botao = h('button', { type: 'button', class: 'evento-linha' },
            h('span', { class: 'mini-data', 'aria-hidden': 'true' },
                h('span', null, MESES[Number(mes) - 1].slice(0, 3)), h('strong', null, dia)),
            h('span', { class: 'evento-linha-textos' },
                h('span', { class: 'evento-linha-categoria' }, evento.categoria),
                h('span', { class: 'evento-linha-titulo' }, evento.titulo),
                h('span', { class: 'evento-linha-detalhe' },
                    `${rotuloDoDia(evento.data)}, ${formatarHorario(evento.horario)}`,
                    evento.local_nome ? ` · ${evento.local_nome}` : ''),
            ),
            h('span', { class: `estado-pill ${estado[1]}` }, estado[0]),
            icone('seta', 'icone icone-p linha-seta'),
        );
        botao.addEventListener('click', () => abrirEvento(evento, carregar));
        return h('li', { style: { '--i': i } }, botao);
    }
}

// -----------------------------------------------------------------------------
// Folha de criar/editar
// -----------------------------------------------------------------------------
function abrirEvento(evento, aoMudar) {
    const editando = Boolean(evento);
    const hoje = hojeEmBrasilia();
    const aviso = caixaDeAviso();
    let imagemAtual = evento?.imagem ?? null;   // o que está salvo
    let imagemNova = null;                     // Blob escolhido agora
    let tirarImagem = false;

    const variosDias = { ligado: Boolean(evento?.data_fim) };
    const fora = { ligado: Boolean(evento?.local_nome) };
    const publicar = { ligado: evento ? evento.publicado : true };

    const form = h('form', { class: 'form', novalidate: true });
    const previa = h('div', { class: 'previa-evento', 'aria-hidden': 'true' });

    const campoTitulo = campo({ rotulo: 'Título', nome: 'titulo', autocomplete: 'off', autocapitalize: 'sentences',
        maxlength: 80, placeholder: 'Ex.: Cantata de Natal', value: evento?.titulo ?? '' });
    const campoDestaque = campo({ rotulo: 'Palavra em destaque (opcional)', nome: 'destaque', autocomplete: 'off',
        required: false, maxlength: 40, placeholder: 'Ex.: Natal', value: evento?.destaque ?? '',
        dica: 'Fica em negrito no site. Precisa ser uma parte do título.' });
    const campoCategoria = campo({ rotulo: 'Categoria', nome: 'categoria', autocomplete: 'off', autocapitalize: 'sentences',
        maxlength: 40, value: evento?.categoria ?? 'Culto especial' });
    const fichas = h('div', { class: 'fichas' }, CATEGORIAS.map((c) => {
        const f = h('button', { type: 'button', class: 'ficha' }, c);
        f.addEventListener('click', () => { form.elements.categoria.value = c; atualizarPrevia(); });
        return f;
    }));

    const descricao = h('textarea', { id: 'campo-descricao', name: 'descricao', class: 'campo-texto', rows: 3,
        maxlength: 300, required: true, autocapitalize: 'sentences', 'aria-describedby': 'contador-descricao',
        placeholder: 'Uma ou duas frases convidando para o evento.' });
    descricao.value = evento?.descricao ?? '';
    const contador = h('p', { class: 'campo-dica contador', id: 'contador-descricao' });

    const campoData = campo({ rotulo: 'Data', nome: 'data', tipo: 'date', min: editando ? null : hoje, value: evento?.data ?? '' });
    const campoHorario = campo({ rotulo: 'Horário', nome: 'horario', tipo: 'time', value: evento?.horario?.slice(0, 5) ?? '19:30' });
    const campoFim = campo({ rotulo: 'Último dia', nome: 'data_fim', tipo: 'date', required: false, value: evento?.data_fim ?? '' });
    const blocoFim = h('div', { class: 'campo-revelado', hidden: !variosDias.ligado }, campoFim);

    const blocoLocal = h('div', { class: 'campo-revelado campos-lado', hidden: !fora.ligado },
        campo({ rotulo: 'Lugar', nome: 'local_nome', required: false, maxlength: 60, autocapitalize: 'words',
            placeholder: 'Ex.: Chácara Recanto', value: evento?.local_nome ?? '' }),
        campo({ rotulo: 'Cidade', nome: 'local_cidade', required: false, maxlength: 40, autocapitalize: 'words',
            placeholder: 'Ex.: Mairinque', value: evento?.local_cidade ?? '' }),
    );

    const campoLink = campo({ rotulo: 'Link de inscrição (opcional)', nome: 'link_inscricao', // text, não url: o navegador pintaria de vermelho "forms.gle/..." sem https, que o app completa sozinho
        tipo: 'text', required: false,
        inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', maxlength: 300,
        placeholder: 'https://forms.gle/...', value: evento?.link_inscricao ?? '',
        dica: 'Se tiver, o cartão ganha o botão "Inscreva-se".' });

    // Imagem: só vai para o Google (resultado de busca do evento), o cartão do site não mostra
    const entradaImagem = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', tabindex: -1, 'aria-hidden': 'true' });
    const miniatura = h('div', { class: 'evento-imagem' });
    const botaoImagem = h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, icone('imagem'), 'Escolher imagem');
    const tirar = h('button', { type: 'button', class: 'link-discreto' }, 'Tirar imagem');
    botaoImagem.addEventListener('click', () => entradaImagem.click());
    const blocoImagem = h('fieldset', { class: 'campo' },
        h('legend', null, 'Imagem para o Google (opcional)'),
        miniatura,
        h('div', { class: 'foto-acoes' }, botaoImagem, tirar),
        entradaImagem,
    );
    entradaImagem.addEventListener('change', async () => {
        const arquivo = entradaImagem.files[0];
        entradaImagem.value = '';
        if (!arquivo) return;
        try {
            botaoImagem.classList.add('carregando');
            imagemNova = await reduzirImagem(arquivo);
            tirarImagem = false;
            desenharImagem();
        } catch (erro) {
            aviso.mostrar(erro.message || 'Não deu para usar essa imagem.');
        } finally {
            botaoImagem.classList.remove('carregando');
        }
    });
    tirar.addEventListener('click', () => { imagemNova = null; tirarImagem = true; desenharImagem(); });

    const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, editando ? 'Salvar' : 'Criar evento');
    const apagar = editando ? h('button', { type: 'button', class: 'botao-perigo botao-largo' }, icone('lixeira'), 'Apagar evento') : null;

    // append converteria null em texto "null": filtra antes
    form.append(...[
        previa,
        campoTitulo, campoDestaque,
        campoCategoria, fichas,
        h('div', { class: 'campo' }, h('label', { for: 'campo-descricao' }, 'Descrição'), descricao, contador),
        h('div', { class: 'campos-lado' }, campoData, campoHorario),
        interruptor({ rotulo: 'Mais de um dia', descricao: 'Retiro, conferência...', ligado: variosDias.ligado,
            aoMudar: (v) => { variosDias.ligado = v; mostrar(blocoFim, v); atualizarPrevia(); return true; } }),
        blocoFim,
        interruptor({ rotulo: 'Fora da igreja', descricao: 'Sem isso, o local é "IEJB - Araçariguama".', ligado: fora.ligado,
            aoMudar: (v) => { fora.ligado = v; mostrar(blocoLocal, v); atualizarPrevia(); return true; } }),
        blocoLocal,
        campoLink,
        blocoImagem,
        interruptor({ rotulo: 'Mostrar no site', descricao: 'Desligado, fica como rascunho só aqui no Hub.', ligado: publicar.ligado,
            aoMudar: (v) => { publicar.ligado = v; return true; } }),
        editando && evento.publicado ? linkDoSite(evento) : null,
        aviso.elemento,
        salvar,
        apagar,
    ].filter(Boolean));

    form.addEventListener('input', atualizarPrevia);
    form.addEventListener('submit', (e) => { e.preventDefault(); comCarregando(salvar, enviar); });
    apagar?.addEventListener('click', apagarEvento);

    desenharImagem();
    atualizarPrevia();
    const folha = abrirFolha({ titulo: editando ? 'Editar evento' : 'Novo evento', conteudo: form });

    function mostrar(bloco, sim) {
        bloco.hidden = !sim;
        if (sim) bloco.querySelector('input')?.focus();
    }

    function desenharImagem() {
        const url = imagemNova ? URL.createObjectURL(imagemNova) : (!tirarImagem && urlDaImagem(imagemAtual));
        miniatura.replaceChildren(url
            ? h('img', { src: url, alt: 'Imagem escolhida', class: 'foto-nova' })
            : h('span', { class: 'evento-imagem-vazia' }, icone('imagem'), 'Sem imagem'));
        tirar.hidden = !url;
    }

    function lerFormulario() {
        const v = (nome) => form.elements[nome].value.trim();
        let link = v('link_inscricao');
        if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
        return {
            titulo: v('titulo').replace(/\s+/g, ' '),
            destaque: v('destaque') || null,
            categoria: v('categoria'),
            descricao: descricao.value.trim().replace(/\s+/g, ' '),
            data: v('data'),
            horario: v('horario'),
            data_fim: variosDias.ligado ? (v('data_fim') || null) : null,
            local_nome: fora.ligado ? (v('local_nome') || null) : null,
            local_cidade: fora.ligado ? (v('local_cidade') || null) : null,
            link_inscricao: link || null,
            publicado: publicar.ligado,
        };
    }

    function problema(d) {
        if (d.titulo.length < 3) return 'Escreva o título do evento.';
        if (d.destaque && !d.titulo.includes(d.destaque)) return 'A palavra em destaque precisa estar escrita igual no título.';
        if (d.categoria.length < 2) return 'Escolha ou escreva uma categoria.';
        if (d.descricao.length < 10) return 'Escreva uma descrição curta (pelo menos uma frase).';
        if (!d.data || !d.horario) return 'Escolha a data e o horário.';
        if (variosDias.ligado && (!d.data_fim || d.data_fim <= d.data)) return 'O último dia precisa ser depois do primeiro.';
        if (fora.ligado && (!d.local_nome || !d.local_cidade)) return 'Preencha o lugar e a cidade.';
        if (d.link_inscricao && !/^https:\/\/[^\s<>"'`]+$/.test(d.link_inscricao)) return 'O link precisa começar com https://';
        return null;
    }

    async function enviar() {
        aviso.limpar();
        const dados = lerFormulario();
        const erro = problema(dados);
        if (erro) return aviso.mostrar(erro);

        // Sobe a imagem nova antes; se salvar falhar, apaga ela de volta
        let subida = null;
        if (imagemNova) {
            subida = `${crypto.randomUUID()}.${imagemNova.type === 'image/webp' ? 'webp' : 'jpg'}`;
            const { error } = await supabase.storage.from('eventos')
                .upload(subida, imagemNova, { contentType: imagemNova.type, cacheControl: UM_ANO, upsert: false });
            if (error) return aviso.mostrar(mensagemDoBanco(error, 'Não deu para subir a imagem.'));
        }
        dados.imagem = subida ?? (tirarImagem ? null : imagemAtual);

        const { error } = editando
            ? await supabase.from('evento').update(dados).eq('id', evento.id)
            : await supabase.from('evento').insert(dados);
        if (error) {
            if (subida) supabase.storage.from('eventos').remove([subida]);
            return aviso.mostrar(mensagemDoBanco(error));
        }
        // A antiga não serve mais (as do próprio site, images/..., não são do Hub)
        if (imagemAtual && dados.imagem !== imagemAtual && !imagemAtual.startsWith('images/')) {
            supabase.storage.from('eventos').remove([imagemAtual]);
        }
        folha.fechar();
        avisar(dados.publicado ? 'Salvo. Aparece no site em até 15 minutos.' : 'Salvo como rascunho.');
        aoMudar();
    }

    async function apagarEvento() {
        const ok = await confirmar({
            titulo: 'Apagar evento?',
            texto: evento.publicado ? 'Ele sai do site em até 15 minutos. Links já enviados dele vão abrir a agenda sem o evento.' : 'O rascunho some do Hub.',
            botao: 'Apagar', perigo: true,
        });
        if (!ok) return;
        const { error } = await supabase.from('evento').delete().eq('id', evento.id);
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        if (imagemAtual && !imagemAtual.startsWith('images/')) supabase.storage.from('eventos').remove([imagemAtual]);
        folha.fechar();
        avisar('Evento apagado.');
        aoMudar();
    }

    // O cartão do site, em miniatura, atualizando enquanto digita
    function atualizarPrevia() {
        const d = lerFormulario();
        contador.textContent = `${descricao.value.length}/300`;
        const data = d.data ? new Date(`${d.data}T12:00:00Z`) : null;
        const fim = d.data_fim ? new Date(`${d.data_fim}T12:00:00Z`) : null;
        previa.replaceChildren(
            h('p', { class: 'previa-rotulo' }, 'Como fica no site'),
            h('div', { class: 'previa-cartao' },
                h('div', { class: 'previa-data' },
                    h('strong', null, data ? String(data.getUTCDate()).padStart(2, '0') : '--'),
                    h('span', null, data ? MESES[data.getUTCMonth()] : 'Mês'),
                    h('span', null, data ? SEMANA[data.getUTCDay()] : 'Dia'),
                ),
                h('div', { class: 'previa-textos' },
                    h('span', { class: 'previa-categoria' }, d.categoria || 'Categoria'),
                    h('span', { class: 'previa-titulo' }, tituloComDestaque(d.titulo || 'Título do evento', d.destaque)),
                    h('span', { class: 'previa-descricao' }, d.descricao || 'Descrição do evento.'),
                    h('span', { class: 'previa-info' },
                        icone('relogio', 'icone icone-p'), d.horario ? formatarHorario(`${d.horario}:00`) : '--',
                        fim ? ` até ${String(fim.getUTCDate()).padStart(2, '0')}/${String(fim.getUTCMonth() + 1).padStart(2, '0')}` : '',
                        icone('local', 'icone icone-p'),
                        fora.ligado ? `${d.local_nome || 'Lugar'} - ${d.local_cidade || 'Cidade'}` : 'IEJB - Araçariguama'),
                    d.link_inscricao ? h('span', { class: 'previa-botao' }, 'Inscreva-se') : null,
                ),
            ),
        );
    }
}

// Igual ao gerador do site: negrito na última vez que o destaque aparece
function tituloComDestaque(titulo, destaque) {
    const pos = destaque ? titulo.lastIndexOf(destaque) : -1;
    if (pos < 0) return titulo;
    return [titulo.slice(0, pos), h('strong', null, destaque), titulo.slice(pos + destaque.length)];
}

function linkDoSite(evento) {
    return h('a', { class: 'link-site', href: enderecoNoSite(evento), target: '_blank', rel: 'noopener' },
        icone('externo', 'icone icone-p'), 'Ver no site');
}

function esqueleto() {
    return h('ul', { class: 'lista-eventos', 'aria-hidden': 'true' },
        [0, 1, 2].map((i) => h('li', { style: { '--i': i } }, h('div', { class: 'evento-linha esqueleto' }))));
}
