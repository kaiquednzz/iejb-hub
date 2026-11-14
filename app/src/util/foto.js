// Fotos de perfil: comprimir no aparelho, subir, mostrar.
//
// Por que comprimir aqui e não no servidor? A foto de um iPhone tem 3 a 5 MB;
// recortada em quadrado de 320 px e salva em WebP/JPEG ela fica com ~25 KB.
// O plano gratuito do Supabase tem 1 GB de arquivos e 5 GB de tráfego por mês
// (e redimensionar no servidor é recurso pago). O bucket também recusa
// qualquer coisa acima de 200 KB, então ninguém fura isso pelo console.
//
// Cada troca gera um NOME NOVO de arquivo. Como o arquivo nunca muda, ele pode
// ficar no cache do aparelho por um ano: a foto só é baixada uma vez.
import { supabase } from '../supabase.js';
import { h } from './dom.js';

const LADO = 320;
const UM_ANO = String(60 * 60 * 24 * 365);

export function urlDaFoto(caminho) {
    if (!caminho) return null;
    return supabase.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

// Círculo da pessoa: a foto, ou as iniciais se não tiver (ou se a foto falhar)
export function avatar(pessoa, classe = 'pessoa-avatar') {
    const caixa = h('span', { class: classe, 'aria-hidden': 'true' }, iniciais(pessoa));
    const url = urlDaFoto(pessoa?.foto);
    if (url) {
        const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async', width: 64, height: 64 });
        img.addEventListener('error', () => img.remove()); // volta para as iniciais
        img.addEventListener('load', () => caixa.classList.add('com-foto'));
        caixa.append(img);
    }
    return caixa;
}

export function iniciais(pessoa) {
    const partes = (pessoa?.apelido || pessoa?.nome || '?').trim().split(/\s+/);
    return (partes[0][0] + (partes.length > 1 ? partes.at(-1)[0] : '')).toUpperCase();
}

// Recorta no centro, reduz e comprime. WebP quando o navegador sabe gerar
// (Chrome, Android); o Safari do iPhone devolve PNG nesse caso, aí vai JPEG.
export async function comprimirFoto(arquivo) {
    const imagem = await carregar(arquivo);
    const lado = Math.min(imagem.width, imagem.height);
    const tela = document.createElement('canvas');
    tela.width = LADO;
    tela.height = LADO;
    const ctx = tela.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
    imagem.close?.();

    let blob = await paraBlob(tela, 'image/webp', 0.82);
    if (blob?.type !== 'image/webp') blob = await paraBlob(tela, 'image/jpeg', 0.82);
    if (!blob) throw new Error('Não deu para processar a foto.');
    return blob;
}

// createImageBitmap já respeita a rotação da foto (EXIF) nos navegadores atuais
async function carregar(arquivo) {
    if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem.');
    try {
        return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch {
        // Reserva para navegadores sem createImageBitmap com arquivo
        const url = URL.createObjectURL(arquivo);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            return img;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}

const paraBlob = (tela, tipo, qualidade) => new Promise((ok) => tela.toBlob(ok, tipo, qualidade));

// Sobe a foto nova, aponta a pessoa para ela e apaga a antiga.
// Devolve o caminho novo (ou null quando removeu).
export async function trocarFoto(pessoa, arquivo) {
    const anterior = pessoa.foto;
    let caminho = null;
    if (arquivo) {
        const blob = await comprimirFoto(arquivo);
        const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
        caminho = `${pessoa.id}/${crypto.randomUUID()}.${extensao}`;
        const { error } = await supabase.storage.from('fotos')
            .upload(caminho, blob, { contentType: blob.type, cacheControl: UM_ANO, upsert: false });
        if (error) throw error;
    }
    const { error } = await supabase.rpc('definir_foto', { p_pessoa: pessoa.id, p_caminho: caminho });
    if (error) {
        if (caminho) await supabase.storage.from('fotos').remove([caminho]);
        throw error;
    }
    // A antiga não serve mais para nada: libera o espaço (erro aqui não importa)
    if (anterior) supabase.storage.from('fotos').remove([anterior]);
    return caminho;
}

// Imagem de evento (vai para o Google pelo site): sem cortar, só reduz para
// no máximo 1200 px no lado maior. Fica entre 80 e 200 KB; o bucket aceita 400.
export async function reduzirImagem(arquivo, maior = 1200) {
    const imagem = await carregar(arquivo);
    const escala = Math.min(1, maior / Math.max(imagem.width, imagem.height));
    const tela = document.createElement('canvas');
    tela.width = Math.round(imagem.width * escala);
    tela.height = Math.round(imagem.height * escala);
    const ctx = tela.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
    imagem.close?.();

    for (const qualidade of [0.82, 0.7, 0.55]) {
        let blob = await paraBlob(tela, 'image/webp', qualidade);
        if (blob?.type !== 'image/webp') blob = await paraBlob(tela, 'image/jpeg', qualidade);
        if (blob && blob.size <= 400 * 1024) return blob;
    }
    throw new Error('A imagem ficou grande demais. Tente outra.');
}
