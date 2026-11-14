// Repertório do culto: ver, ouvir e (para quem pode) montar.
//
// Quem monta (RN-56, Q21): o líder de um grupo escalado, depois que a escala
// foi publicada; o líder de louvor e o admin, sempre. O banco confere isso em
// privado.pode_editar_repertorio; aqui só decide se mostra o botão.
// A música é cadastrada uma vez e reaproveitada (RN-52); o tom é do culto (RN-51).
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { rotuloDoDia, formatarHorario } from '../util/datas.js';
import { linksDeBusca, filaDoYoutube, idDoYoutube, linkSeguro, termoDeBusca, TONS } from '../util/musica.js';
import { eLiderDeLouvor } from '../sessao.js';
import { campo, caixaDeAviso } from './moldura.js';

export function podeEditarRepertorio(culto, conta) {
    if (conta.e_administrador || eLiderDeLouvor(conta)) return true;
    const escala = culto.escala?.[0];
    return escala?.estado === 'publicada' &&
        escala.escala_grupo.some((g) => g.grupo?.lider_pessoa_id === conta.pessoa?.id);
}

// ---------------------------------------------------------------------------
// Bloco dentro do cartão do culto (tela Escala)
// ---------------------------------------------------------------------------
export function blocoRepertorio(culto, conta, aoMudar, offline = false) {
    const itens = culto.repertorio_item ?? [];
    const pode = !offline && culto.estado === 'ativo' && podeEditarRepertorio(culto, conta);
    if (itens.length === 0 && !pode) return null;

    const musicas = itens.map((i) => i.musica);
    const fila = filaDoYoutube(musicas);
    const editar = pode && h('button', { type: 'button', class: 'botao-secundario botao-pequeno' },
        icone('musica', 'icone icone-p'), itens.length ? 'Editar repertório' : 'Montar repertório');
    if (editar) editar.addEventListener('click', () => abrirEditor(culto, aoMudar));

    return h('details', { class: 'repertorio' },
        h('summary', null,
            icone('musica', 'icone icone-p'),
            itens.length ? `Repertório · ${itens.length} ${itens.length === 1 ? 'música' : 'músicas'}` : 'Repertório · falta montar'),
        itens.length > 0 && h('ol', { class: 'lista-musicas' }, itens.map((item) => {
            const ouvir = h('button', { type: 'button', class: 'musica-ouvir', 'aria-label': `Ouvir ${item.musica.titulo}` }, icone('fone', 'icone icone-p'));
            ouvir.addEventListener('click', () => folhaOuvir(item.musica));
            return h('li', null,
                h('span', { class: 'musica-titulo' }, item.musica.titulo),
                item.musica.artista && h('span', { class: 'musica-artista' }, item.musica.artista),
                item.tom && h('span', { class: 'musica-tom', title: 'Tom' }, item.tom),
                ouvir,
            );
        })),
        itens.length > 0 && h('div', { class: 'repertorio-acoes' },
            fila.url
                ? h('a', { class: 'botao-youtube', href: fila.url, target: '_blank', rel: 'noopener noreferrer' },
                    icone('play', 'icone icone-p'), 'Tocar no YouTube',
                    h('span', { class: 'botao-youtube-conta' }, `${fila.ids.length} de ${itens.length}`))
                : h('p', { class: 'repertorio-nota' }, 'Nenhuma música com link do YouTube ainda.'),
            fila.url && fila.ids.length < itens.length && h('p', { class: 'repertorio-nota' },
                `${itens.length - fila.ids.length} sem link do YouTube ${itens.length - fila.ids.length === 1 ? 'fica' : 'ficam'} fora da fila.`),
        ),
        editar && h('div', { class: 'repertorio-editar' }, editar),
    );
}

// Ouvir uma música: abre a busca de cada plataforma (ou o vídeo cadastrado)
export function folhaOuvir(musica) {
    const video = linkSeguro(musica.link);
    abrirFolha({
        titulo: musica.titulo,
        conteudo: h('div', { class: 'form' },
            musica.artista && h('p', { class: 'folha-texto' }, musica.artista),
            video && h('a', { class: 'botao-principal botao-largo', href: video, target: '_blank', rel: 'noopener noreferrer' },
                icone('play'), idDoYoutube(video) ? 'Abrir o vídeo cadastrado' : 'Abrir o link cadastrado'),
            h('div', { class: 'grade-streaming' }, linksDeBusca(musica).map((l) =>
                h('a', { class: `botao-streaming streaming-${l.classe}`, href: l.url, target: '_blank', rel: 'noopener noreferrer' },
                    h('span', { class: 'streaming-ponto', 'aria-hidden': 'true' }), l.nome))),
            h('p', { class: 'folha-texto folha-texto-pequeno' }, `Abre a busca por “${termoDeBusca(musica)}” no app escolhido.`),
        ),
    });
}

// ---------------------------------------------------------------------------
// Editor: lista ordenada + busca no catálogo + cadastro de música nova
// ---------------------------------------------------------------------------
export async function abrirEditor(culto, aoMudar) {
    let estado = null;
    let mudou = false;
    let termo = '';

    const folha = abrirFolha({
        titulo: 'Repertório',
        conteudo: h('p', { class: 'folha-texto' }, 'Carregando…'),
        aoFechar: () => { if (mudou) aoMudar?.(); },
    });

    await recarregar();

    async function recarregar() {
        const [itens, musicas, ministerio] = await Promise.all([
            supabase.from('repertorio_item')
                .select('id, posicao, tom, musica:musica_id ( id, titulo, artista, link )')
                .eq('culto_id', culto.id).order('posicao'),
            supabase.from('musica').select('id, titulo, artista, link').eq('ativa', true).order('titulo'),
            estado?.ministerioId ? Promise.resolve({ data: { id: estado.ministerioId } })
                : supabase.from('ministerio').select('id').eq('nome', 'Louvor').maybeSingle(),
        ]);
        const erro = itens.error || musicas.error || ministerio.error;
        if (erro) {
            folha.trocarConteudo(h('p', { class: 'aviso-form', 'data-tipo': 'erro' }, mensagemDoBanco(erro)));
            return;
        }
        estado = { itens: itens.data, musicas: musicas.data, ministerioId: ministerio.data?.id };
        desenhar();
    }

    async function fazer(acao, sucesso) {
        const { error } = await acao();
        if (error) { avisar(mensagemDoBanco(error)); return false; }
        mudou = true;
        if (sucesso) avisar(sucesso);
        await recarregar();
        return true;
    }

    function desenhar() {
        const { itens } = estado;
        const fila = filaDoYoutube(itens.map((i) => i.musica));

        const lista = itens.length === 0
            ? h('p', { class: 'cartao-vazio' }, 'Nenhuma música ainda. Procure abaixo ou cadastre uma nova.')
            : h('ol', { class: 'lista-editor' }, itens.map((item, i) => {
                const subir = h('button', { type: 'button', class: 'mover', 'aria-label': `Subir ${item.musica.titulo}`, disabled: i === 0 }, icone('seta', 'icone icone-p seta-cima'));
                const descer = h('button', { type: 'button', class: 'mover', 'aria-label': `Descer ${item.musica.titulo}`, disabled: i === itens.length - 1 }, icone('seta', 'icone icone-p seta-baixo'));
                subir.addEventListener('click', () => mover(item, item.posicao - 1, subir));
                descer.addEventListener('click', () => mover(item, item.posicao + 1, descer));
                const abrir = h('button', { type: 'button', class: 'editor-musica' },
                    h('span', { class: 'editor-numero' }, String(i + 1)),
                    h('span', { class: 'linha-textos' },
                        h('span', { class: 'linha-nome' }, item.musica.titulo),
                        h('span', { class: 'linha-detalhe' }, [item.musica.artista, !idDoYoutube(item.musica.link) && 'sem link do YouTube'].filter(Boolean).join(' · ') || ' ')),
                    h('span', { class: `musica-tom${item.tom ? '' : ' sem-tom'}` }, item.tom || 'tom'));
                abrir.addEventListener('click', () => folhaItem(item));
                return h('li', { class: 'linha-editor' }, abrir, h('span', { class: 'mover-par' }, subir, descer));
            }));

        // Busca no catálogo: filtra enquanto digita, sem ir ao servidor
        const busca = h('input', {
            type: 'search', class: 'busca-musica', placeholder: 'Procurar música ou artista',
            'aria-label': 'Procurar música', autocomplete: 'off', enterkeyhint: 'search', value: termo,
        });
        const resultados = h('div', { class: 'resultados-musica', 'aria-live': 'polite' });
        busca.addEventListener('input', () => { termo = busca.value; mostrarResultados(); });

        function mostrarResultados() {
            const t = normalizar(termo);
            const usadas = new Set(estado.itens.map((i) => i.musica.id));
            const achadas = t
                ? estado.musicas.filter((m) => !usadas.has(m.id) && normalizar(`${m.titulo} ${m.artista ?? ''}`).includes(t)).slice(0, 6)
                : [];
            const nova = h('button', { type: 'button', class: 'resultado-novo' }, icone('mais', 'icone icone-p'),
                termo.trim() ? `Cadastrar “${termo.trim()}”` : 'Cadastrar música nova');
            nova.addEventListener('click', () => folhaNovaMusica(termo.trim()));
            resultados.replaceChildren(
                ...achadas.map((m) => {
                    const b = h('button', { type: 'button', class: 'resultado-musica' },
                        h('span', { class: 'linha-textos' }, h('span', { class: 'linha-nome' }, m.titulo),
                            m.artista && h('span', { class: 'linha-detalhe' }, m.artista)),
                        icone('mais', 'icone icone-p'));
                    b.addEventListener('click', () => comCarregando(b, async () => {
                        termo = '';
                        await fazer(() => supabase.from('repertorio_item').insert({
                            culto_id: culto.id, ministerio_id: estado.ministerioId, musica_id: m.id,
                        }), `${m.titulo} entrou.`);
                    }));
                    return b;
                }),
                nova,
            );
        }
        mostrarResultados();

        folha.trocarConteudo(h('div', { class: 'folha-pilha' },
            h('p', { class: 'folha-texto' }, `${culto.nome} · ${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
            lista,
            itens.length > 0 && h('p', { class: 'repertorio-nota' },
                `${fila.ids.length} de ${itens.length} com link do YouTube (entram no "Tocar no YouTube").`),
            h('section', { class: 'bloco' },
                h('h3', { class: 'bloco-titulo' }, 'Adicionar'),
                busca, resultados),
        ));
    }

    async function mover(item, nova, botao) {
        await comCarregando(botao, () => fazer(() => supabase.rpc('mover_musica_no_repertorio', { p_item: item.id, p_nova_posicao: nova })));
        folha.elemento.querySelector(`[aria-label="${botao.getAttribute('aria-label')}"]`)?.focus();
    }

    // Tom neste culto + dados da música + tirar
    function folhaItem(item) {
        const aviso = caixaDeAviso();
        const campoTom = h('input', { type: 'text', class: 'campo-tom', value: item.tom ?? '', maxlength: 12, 'aria-label': 'Tom', autocapitalize: 'none', placeholder: 'Ex.: G' });
        const tons = h('div', { class: 'fichas fichas-tom' }, TONS.map((t) => {
            const f = h('button', { type: 'button', class: 'ficha', 'aria-pressed': String(item.tom === t) }, t);
            f.addEventListener('click', () => {
                campoTom.value = t;
                tons.querySelectorAll('.ficha').forEach((x) => x.setAttribute('aria-pressed', String(x === f)));
            });
            return f;
        }));
        const salvar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Salvar tom');
        salvar.addEventListener('click', () => comCarregando(salvar, async () => {
            const tom = campoTom.value.trim() || null;
            if (await fazer(() => supabase.from('repertorio_item').update({ tom }).eq('id', item.id))) sub.fechar();
        }));
        const editarMusica = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Editar música (nome, artista, link)');
        editarMusica.addEventListener('click', () => { sub.fechar(); folhaMusica(item.musica); });
        const tirar = h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Tirar do repertório');
        tirar.addEventListener('click', () => comCarregando(tirar, async () => {
            if (await fazer(() => supabase.from('repertorio_item').delete().eq('id', item.id), 'Tirada.')) sub.fechar();
        }));
        const sub = abrirFolha({
            titulo: item.musica.titulo,
            conteudo: h('div', { class: 'form' },
                h('p', { class: 'folha-texto' }, 'Tom neste culto (pode ser diferente em outro culto).'),
                tons, campoTom, aviso.elemento, salvar, editarMusica,
                h('div', { class: 'bloco bloco-final' }, tirar)),
        });
    }

    // Cadastrar música nova (e já pôr no repertório)
    function folhaNovaMusica(titulo) {
        folhaMusica({ titulo }, true);
    }

    function folhaMusica(musica, nova = false) {
        const aviso = caixaDeAviso();
        const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, nova ? 'Cadastrar e adicionar' : 'Salvar');
        const procurar = h('a', { class: 'link-discreto', target: '_blank', rel: 'noopener noreferrer' }, 'Procurar no YouTube');
        const form = h('form', { class: 'form', novalidate: true },
            campo({ rotulo: 'Nome da música', nome: 'titulo', autocomplete: 'off', autocapitalize: 'sentences', value: musica.titulo ?? '' }),
            campo({ rotulo: 'Artista', nome: 'artista', autocomplete: 'off', autocapitalize: 'words', required: false, value: musica.artista ?? '',
                dica: 'Opcional, mas ajuda a achar a versão certa nas plataformas.' }),
            campo({ rotulo: 'Link do YouTube', nome: 'link', tipo: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', required: false,
                value: musica.link ?? '', dica: 'Opcional. Com ele a música entra no "Tocar no YouTube".' }),
            procurar,
            aviso.elemento,
            botao,
        );
        const atualizarBusca = () => {
            procurar.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(termoDeBusca({
                titulo: form.elements.titulo.value, artista: form.elements.artista.value }))}`;
        };
        form.addEventListener('input', atualizarBusca);
        atualizarBusca();

        form.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            aviso.limpar();
            const valores = {
                titulo: form.elements.titulo.value.trim().replace(/\s+/g, ' '),
                artista: form.elements.artista.value.trim() || null,
                link: form.elements.link.value.trim() || null,
            };
            if (!valores.titulo) return aviso.mostrar('Escreva o nome da música.');
            if (valores.link && !/^https?:\/\//i.test(valores.link)) return aviso.mostrar('O link precisa começar com https://');
            if (valores.link && !idDoYoutube(valores.link)) {
                aviso.mostrar('Esse link não parece ser de um vídeo do YouTube. Ele fica salvo, mas não entra na fila.', 'ok');
            }
            await comCarregando(botao, async () => {
                if (nova) {
                    const { data, error } = await supabase.from('musica').insert(valores).select('id').single();
                    if (error) {
                        return aviso.mostrar(error.code === '23505'
                            ? 'Essa música já está cadastrada: procure pelo nome na busca.' : mensagemDoBanco(error));
                    }
                    termo = '';
                    const ok = await fazer(() => supabase.from('repertorio_item').insert({
                        culto_id: culto.id, ministerio_id: estado.ministerioId, musica_id: data.id,
                    }), `${valores.titulo} entrou.`);
                    if (ok) sub.fechar();
                } else {
                    const ok = await fazer(() => supabase.from('musica').update(valores).eq('id', musica.id), 'Música salva.');
                    if (ok) sub.fechar();
                }
            });
        });
        const sub = abrirFolha({ titulo: nova ? 'Música nova' : 'Editar música', conteudo: form });
    }
}

function normalizar(texto) {
    return texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

