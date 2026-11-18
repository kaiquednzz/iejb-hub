// Datas sempre no horário de Brasília (mesma ideia do agoraEmBrasilia do site):
// quem estiver com o celular em outro fuso ainda vê "hoje" e "amanhã" certos.

const FUSO = 'America/Sao_Paulo';

// 'AAAA-MM-DD' de hoje em Brasília. O formato en-CA já sai nesse padrão.
export function hojeEmBrasilia() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

// Soma dias numa data 'AAAA-MM-DD' (conta em UTC para não sofrer com horário de verão)
export function somarDias(dataISO, dias) {
    const d = new Date(`${dataISO}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

export function diasEntre(a, b) {
    return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

// "Hoje", "Amanhã" ou "Domingo, 15 de nov."
export function rotuloDoDia(dataISO) {
    const diferenca = diasEntre(hojeEmBrasilia(), dataISO);
    if (diferenca === 0) return 'Hoje';
    if (diferenca === 1) return 'Amanhã';
    const texto = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC',
    }).format(new Date(`${dataISO}T12:00:00Z`));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Partes separadas para o "calendário" do cartão: { dia: '15', mes: 'nov', semana: 'dom' }
export function partesDaData(dataISO) {
    const d = new Date(`${dataISO}T12:00:00Z`);
    const f = (op) => new Intl.DateTimeFormat('pt-BR', { ...op, timeZone: 'UTC' }).format(d).replace('.', '');
    return { dia: f({ day: 'numeric' }), mes: f({ month: 'short' }), semana: f({ weekday: 'short' }) };
}

// '19:30:00' → '19h30'; '18:00:00' → '18h' (mesmo jeito que o site escreve)
export function formatarHorario(horario) {
    const [h, m] = horario.split(':');
    return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
