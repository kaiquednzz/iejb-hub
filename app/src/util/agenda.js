// "Meus cultos na agenda" (D56): assinatura de calendário.
//
// Em vez de baixar um arquivo .ics (que no iPhone, com o app instalado, nem
// sempre abre, e fica velho na primeira troca de escala), a agenda do
// celular ASSINA um endereço e busca de novo sozinha: entrou numa escala,
// marcou "não vou" ou o culto foi cancelado, a agenda acompanha.
//
//   iPhone/Mac: webcal://... abre o "Assinar calendário" do sistema
//   Android:    o Google Agenda assina pelo link ?cid= (no app aparece depois
//               da sincronização, às vezes leva alguns minutos)
//
// O endereço leva um segredo da pessoa (meu_link_da_agenda). "Trocar o link"
// gera outro e a assinatura antiga para de receber cultos.
import { h, icone, comCarregando } from './dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar, confirmar } from './folha.js';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agenda`;
const eApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

const enderecos = (token) => {
    const https = `${BASE}?t=${token}`;
    const webcal = https.replace(/^https:/, 'webcal:');
    return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
};

// Depois que a pessoa assina neste aparelho, o convite some da escala e fica
// só o link discreto no fim da página (para refazer ou trocar o link).
const JA_ASSINOU = 'iejb-agenda-assinada';
const jaAssinou = () => { try { return localStorage.getItem(JA_ASSINOU) === '1'; } catch { return false; } };
const marcarAssinada = () => { try { localStorage.setItem(JA_ASSINOU, '1'); } catch { /* sem armazenamento: o convite continua */ } };

// Convite no topo da escala: uma linha fina, só enquanto não assinou
export function conviteAgenda() {
    if (jaAssinou()) return null;
    const botao = h('button', { type: 'button', class: 'convite-agenda' },
        icone('calendario', 'icone icone-p'),
        h('span', null, 'Adicionar à agenda do celular'),
        icone('seta', 'icone icone-p'));
    botao.addEventListener('click', () => comCarregando(botao, () => abrir(() => botao.remove())));
    return botao;
}

// Link discreto no fim da escala, sempre disponível
export function linkAgenda() {
    const botao = h('button', { type: 'button', class: 'link-discreto link-agenda' },
        icone('calendario', 'icone icone-p'), 'Agenda do celular');
    botao.addEventListener('click', () => comCarregando(botao, () => abrir()));
    return botao;
}

async function abrir(aoAssinar) {
    const { data: token, error } = await supabase.rpc('meu_link_da_agenda');
    if (error) {
        console.error(error);
        avisar('Não deu para criar o link agora. Tente de novo.');
        return;
    }
    let link = enderecos(token);

    const apple = h('a', { class: 'botao-principal botao-largo', href: link.webcal }, icone('calendario'), 'Calendário do iPhone');
    const google = h('a', { class: `${eApple ? 'botao-secundario' : 'botao-principal'} botao-largo`, href: link.google, target: '_blank', rel: 'noopener' },
        icone('calendario'), 'Google Agenda');
    const copiar = h('button', { type: 'button', class: 'botao-texto' }, icone('copiar', 'icone icone-p'), 'Copiar o link');
    const trocar = h('button', { type: 'button', class: 'botao-texto' }, 'Trocar o link');

    // Tocou para assinar: o convite do topo já pode sumir
    for (const a of [apple, google]) {
        a.addEventListener('click', () => { marcarAssinada(); aoAssinar?.(); });
    }

    copiar.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(link.https);
            avisar('Link copiado');
        } catch {
            avisar('Não deu para copiar neste aparelho.');
        }
    });
    trocar.addEventListener('click', async () => {
        const sim = await confirmar({
            titulo: 'Trocar o link da agenda?',
            texto: 'O link antigo para de funcionar: a agenda que o usa deixa de receber os cultos. Use se alguém mais tiver o seu link.',
            botao: 'Trocar',
        });
        if (!sim) return;
        const novo = await supabase.rpc('meu_link_da_agenda', { p_trocar: true });
        if (novo.error) return avisar('Não deu para trocar agora.');
        link = enderecos(novo.data);
        apple.href = link.webcal;
        google.href = link.google;
        avisar('Link trocado. Assine a agenda de novo.');
    });

    abrirFolha({
        titulo: 'Meus cultos na agenda',
        conteudo: h('div', { class: 'form agenda-folha' },
            h('p', { class: 'folha-texto' }, 'Os cultos em que você está na escala vão para a agenda do seu celular, com horário e endereço. Se a escala mudar, a agenda se atualiza sozinha (pode levar algumas horas).'),
            ...(eApple ? [apple, google] : [google, apple]),
            h('p', { class: 'campo-dica' }, eApple
                ? 'No iPhone, toque em "Assinar" na janela que abrir.'
                : 'No Android, confirme "Adicionar" no Google Agenda. No app, a agenda nova aparece depois de sincronizar.'),
            h('div', { class: 'agenda-mais' }, copiar, trocar),
            h('p', { class: 'campo-dica' }, 'O link é só seu: quem o tiver vê os seus cultos. Para parar, apague a agenda "IEJB · Minha escala" no celular.'),
        ),
    });
}
