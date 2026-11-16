// Função de servidor "agenda" (D56): os cultos de uma pessoa como calendário
// (.ics) para a agenda do celular ASSINAR.
//
//   GET /functions/v1/agenda?t=<link secreto>  ->  text/calendar
//
// Aberta (verify_jwt desligado): o Calendário do iPhone e o Google Agenda
// buscam o endereço sozinhos, sem login. Quem protege é o link: 64 caracteres
// aleatórios, criados por meu_link_da_agenda(), que a pessoa pode trocar.
// Link inválido ou trocado devolve um calendário vazio (e não um erro), para
// a agenda simplesmente limpar os eventos em vez de ficar mostrando aviso.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENDERECO = 'IEJB - Igreja Evangélica do Jardim Brasil, Rua Ceará, 128 - Jardim Brasil, Araçariguama - SP, 18147-000';
const DURACAO_MIN = 120;
const TOKEN = /^[0-9a-f]{64}$/;

// Texto do .ics: escapa \ ; , e quebra de linha (RFC 5545, 3.3.11)
const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Linhas com mais de 75 bytes são dobradas (continuação começa com espaço)
function dobrar(linha: string): string {
    const bytes = new TextEncoder().encode(linha);
    if (bytes.length <= 75) return linha;
    const partes: string[] = [];
    let atual = '';
    let tamanho = 0;
    for (const ch of linha) {
        const n = new TextEncoder().encode(ch).length;
        if (tamanho + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; tamanho = 0; }
        atual += ch;
        tamanho += n;
    }
    partes.push(atual);
    return partes.join('\r\n ');
}

// "2026-11-22" + "18:00:00" (+ minutos) -> "20261122T180000" no relógio de Brasília
function horaLocal(data: string, horario: string, somarMin = 0): string {
    const [a, m, d] = data.split('-').map(Number);
    const [hh, mm] = horario.split(':').map(Number);
    const t = new Date(Date.UTC(a, m - 1, d, hh, mm + somarMin));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
}

type Culto = { culto_id: string; nome: string; rotulo: string | null; data: string; horario: string; instrumentos: string[]; grupos: string | null };

function calendario(cultos: Culto[]): string {
    const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IEJB//Hub//PT',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:IEJB · Minha escala',
        'X-WR-CALDESC:Os cultos em que você está na escala do Louvor (IEJB Hub)',
        'X-WR-TIMEZONE:America/Sao_Paulo',
        // Pede para a agenda buscar de novo a cada 6 h (o Google decide sozinho, em geral 8 a 24 h)
        'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
        'X-PUBLISHED-TTL:PT6H',
        // Brasília sem horário de verão desde 2019
        'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo',
        'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD',
        'END:VTIMEZONE',
    ];
    for (const c of cultos) {
        const funcoes = c.instrumentos.filter(Boolean).map((x) => (x === 'Mesa' ? 'Mesa de som' : x));
        const titulo = `${c.nome}${c.rotulo ? ` (${c.rotulo})` : ''}${funcoes.length ? ` · ${funcoes.join(', ')}` : ''}`;
        const descricao = [
            `Você está na escala do Louvor${funcoes.length ? `: ${funcoes.join(', ')}` : ''}.`,
            c.grupos ? `Grupo: ${c.grupos}.` : '',
            'Escala e repertório: https://app.iejb.com.br/#/escala',
        ].filter(Boolean).join('\n');
        linhas.push(
            'BEGIN:VEVENT',
            `UID:culto-${c.culto_id}@app.iejb.com.br`,
            `DTSTAMP:${agora}`,
            `DTSTART;TZID=America/Sao_Paulo:${horaLocal(c.data, c.horario)}`,
            `DTEND;TZID=America/Sao_Paulo:${horaLocal(c.data, c.horario, DURACAO_MIN)}`,
            `SUMMARY:${esc(titulo)}`,
            `LOCATION:${esc(ENDERECO)}`,
            `DESCRIPTION:${esc(descricao)}`,
            'URL:https://app.iejb.com.br/#/escala',
            'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(titulo)}`, 'TRIGGER:-PT2H', 'END:VALARM',
            'END:VEVENT',
        );
    }
    linhas.push('END:VCALENDAR');
    return linhas.map(dobrar).join('\r\n') + '\r\n';
}

const responder = (corpo: string, status = 200) => new Response(corpo, {
    status,
    headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="iejb-minha-escala.ics"',
        'Cache-Control': 'private, max-age=900',
        'X-Robots-Tag': 'noindex',
    },
});

Deno.serve(async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não aceito', { status: 405 });
    const token = new URL(req.url).searchParams.get('t') ?? '';
    if (!TOKEN.test(token)) return responder(calendario([]));

    const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false },
    });
    const { data, error } = await banco.rpc('agenda_do_link', { p_token: token });
    if (error) {
        console.error(error);
        // Erro nosso: 503 faz a agenda tentar de novo depois, sem apagar os eventos
        return new Response('Agenda indisponível agora', { status: 503 });
    }
    return responder(calendario(data as Culto[]));
});
