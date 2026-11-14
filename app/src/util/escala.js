// Regras de exibição da escala que valem em mais de uma tela.

// A mesa de som entra na escala como uma "função", igual a um instrumento.
// O nome precisa bater com o usado no banco (migração 11, definir_mesa).
export const FUNCAO_MESA = 'Mesa';

export const fazMesa = (item) => item.instrumento_exibido.includes(FUNCAO_MESA);

// Separa quem toca de quem está na mesa. Quem toca E opera a mesa aparece nos dois.
export function separarMesa(itens) {
    return {
        tocam: itens.filter((i) => i.instrumento_exibido.some((x) => x !== FUNCAO_MESA) || !fazMesa(i)),
        mesa: itens.filter(fazMesa),
    };
}

// "Não vou poder ir" (D35): a pessoa continua na escala, riscada
export const naoVai = (item) => Boolean(item.saiu_em);

// O culto já começou? Comparado no relógio de Brasília (o banco faz igual)
export function cultoJaComecou(culto) {
    const agora = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(new Date()).replace(' ', 'T');
    return `${culto.data}T${culto.horario}` <= agora;
}
