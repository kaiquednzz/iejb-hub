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
