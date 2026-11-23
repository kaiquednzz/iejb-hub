// Título na igreja (D71): quem a pessoa é, separado de onde serve
// (ministérios) e do que pode no app (permissões). Só o admin muda.
export const TITULOS = [
    ['membro', 'Membro'],
    ['diacono', 'Diácono'],
    ['diaconisa', 'Diaconisa'],
    ['presbitero', 'Presbítero'],
    ['evangelista', 'Evangelista'],
    ['missionario', 'Missionário'],
    ['missionaria', 'Missionária'],
    ['pastor', 'Pastor'],
    ['pastora', 'Pastora'],
];
const NOMES = Object.fromEntries(TITULOS);
export const nomeDoTitulo = (titulo) => NOMES[titulo] ?? 'Membro';
export const tituloDePastor = (titulo) => titulo === 'pastor' || titulo === 'pastora';

// Permissões no app (cargo_pessoa). "Pastor" deixou de ser permissão: o
// caixa só abre para a Tesouraria e para quem o admin marcar "Vê o caixa".
export const PERMISSOES = [
    ['tesouraria', 'Tesouraria', 'Lança e edita o financeiro.'],
    ['ve_financeiro', 'Vê o caixa', 'Vê o financeiro sem editar. Para o pastor que acompanha as contas.'],
    ['comunicacao', 'Comunicação', 'Publica no mural e cuida dos eventos do site.'],
];
export const nomeDaPermissao = (c) => PERMISSOES.find(([id]) => id === c)?.[1] ?? c;

// Seletor nativo de título (vira a roda do sistema no celular)
import { h } from './dom.js';
export function seletorDeTitulo({ id = 'titulo', valor = 'membro' } = {}) {
    return h('select', { id, name: 'titulo', class: 'campo-select' },
        TITULOS.map(([v, nome]) => h('option', { value: v, selected: v === valor }, nome)));
}
