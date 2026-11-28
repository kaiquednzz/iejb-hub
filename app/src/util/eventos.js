// Eventos do site no Hub (D50): a mesma regra do iejb.com.br para "já
// passou", para o app e o site nunca discordarem.
//   - evento de um dia: sai 3h depois do horário de início;
//   - evento de vários dias: sai no fim do último dia (data_fim).
// Tudo no relógio de Brasília, como o resto do app.
import { supabase } from '../supabase.js';

export const SITE = 'https://iejb.com.br';
const FUSO = 'America/Sao_Paulo';
const DURACAO_HORAS = 3;

// "AAAA-MM-DDTHH:MM" de agora em Brasília (comparável como texto)
function agoraEmBrasilia() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Conta feita em UTC sobre o horário "de parede", então não sofre com fuso
function somarHoras(data, horario, horas) {
    const d = new Date(`${data}T${horario.slice(0, 5)}:00Z`);
    d.setUTCHours(d.getUTCHours() + horas);
    return d.toISOString().slice(0, 16);
}

export const inicioDoEvento = (e) => `${e.data}T${e.horario.slice(0, 5)}`;
export const fimDoEvento = (e) => (e.data_fim ? `${e.data_fim}T23:59` : somarHoras(e.data, e.horario, DURACAO_HORAS));

export function situacaoDoEvento(e, agora = agoraEmBrasilia()) {
    if (agora >= fimDoEvento(e)) return 'passou';
    if (agora >= inicioDoEvento(e)) return 'agora';
    return 'vem';
}

export function urlDaImagem(imagem) {
    if (!imagem) return null;
    if (imagem.startsWith('images/')) return `${SITE}/${imagem}`;
    return supabase.storage.from('eventos').getPublicUrl(imagem).data.publicUrl;
}

// Mesmo id que o site dá ao cartão (visita.js): evento-AAAA-MM-DD-<título>
export function enderecoNoSite(e) {
    const slug = e.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${SITE}/#evento-${e.data}-${slug}`;
}

// Evento do site marcado no mesmo dia e hora de um culto, na IEJB (ex.: a
// Cantata no domingo às 18h). É o mesmo encontro: o app mostra um só, com o
// nome do evento. Mesma ideia do eventoNoHorario do site.
export function eventoDoCulto(culto, eventos) {
    return eventos?.find((e) => e.data === culto.data && !e.local_nome
        && e.horario?.slice(0, 5) === culto.horario?.slice(0, 5)) ?? null;
}

// Os publicados que ainda não acabaram, pela mesma função que o site usa
export async function proximosEventos() {
    const { data, error } = await supabase.rpc('eventos_do_site');
    if (error) throw error;
    const agora = agoraEmBrasilia();
    return data
        .map((e) => ({ ...e, situacao: situacaoDoEvento(e, agora) }))
        .filter((e) => e.situacao !== 'passou');
}
