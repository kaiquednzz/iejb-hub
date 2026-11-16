// Tudo o que a tela Equipe precisa, numa leva só (4 consultas em paralelo).
//
// O que cada um recebe quem decide é o RLS:
//   - pessoas e grupos: qualquer integrante ativo vê (contato é público, Q22);
//   - a conta embutida em cada pessoa: só o admin recebe (os outros ganham null);
//   - pedidos de acesso: só o admin recebe.
// Por isso não há "if admin" nas consultas: a tela só olha o que chegou.
import { supabase } from '../../supabase.js';

export async function carregarEquipe(conta) {
    const [pessoas, grupos, ministerio, pedidos] = await Promise.all([
        supabase.from('pessoa')
            .select(`id, nome, apelido, contato, instrumentos, ativa, foto,
                     membro_ministerio ( ministerio_id, e_lider, ativo ),
                     cargo_pessoa ( id, cargo ),
                     conta ( id, login, estado, e_administrador, senha_temporaria )`)
            .order('nome'),
        // "!grupo_membro_grupo_id_fkey": grupo e grupo_membro se ligam por DUAS
        // chaves (o membro aponta pro grupo; o líder do grupo aponta pro membro,
        // a trava da RN-12). Sem dizer qual usar, o PostgREST recusa (erro 300).
        supabase.from('grupo')
            .select('id, nome, ministerio_id, lider_pessoa_id, grupo_membro!grupo_membro_grupo_id_fkey ( id, pessoa_id, instrumentos )')
            .eq('ativo', true)
            .order('nome'),
        supabase.from('ministerio').select('id').eq('nome', 'Louvor').maybeSingle(),
        conta.e_administrador
            ? supabase.from('conta')
                .select('id, login, nome_informado, foto_informada, estado, criado_em')
                .in('estado', ['pendente', 'recusada'])
                .order('criado_em', { ascending: false })
            : Promise.resolve({ data: [] }),
    ]);

    const erro = pessoas.error || grupos.error || ministerio.error || pedidos.error;
    if (erro) return { erro };

    const listaPessoas = pessoas.data.map((p) => ({
        ...p,
        // Conta é 1 para 1 com pessoa; conforme a versão o PostgREST manda objeto ou lista
        conta: Array.isArray(p.conta) ? (p.conta[0] ?? null) : p.conta,
    }));
    const porId = new Map(listaPessoas.map((p) => [p.id, p]));
    const ministerioId = ministerio.data?.id ?? null;
    const minhaPessoa = conta.pessoa?.id;
    const eu = porId.get(minhaPessoa);

    const liderLouvor = !!eu?.membro_ministerio.some((m) => m.ministerio_id === ministerioId && m.e_lider && m.ativo);
    const papeis = {
        admin: conta.e_administrador,
        liderLouvor,
        // Admin e líder de louvor cuidam do cadastro de pessoas e de todos os grupos
        gerePessoas: conta.e_administrador || liderLouvor,
        gruposQueLidero: new Set(grupos.data.filter((g) => g.lider_pessoa_id === minhaPessoa).map((g) => g.id)),
    };

    return {
        dados: {
            pessoas: listaPessoas,
            porId,
            grupos: grupos.data,
            ministerioId,
            pedidos: pedidos.data,
            minhaPessoa,
            papeis,
        },
    };
}

// Pessoas do Louvor (ativas e com vínculo ativo): as únicas que podem entrar num grupo
export function pessoasDoLouvor(dados) {
    return dados.pessoas.filter((p) => p.ativa &&
        p.membro_ministerio.some((m) => m.ministerio_id === dados.ministerioId && m.ativo));
}

export function eLiderDeLouvor(pessoa, ministerioId) {
    return pessoa.membro_ministerio.some((m) => m.ministerio_id === ministerioId && m.e_lider && m.ativo);
}

// Instrumentos que aparecem como sugestão: os comuns + tudo o que já foi usado,
// para ninguém escrever "Violao" e "violão" como coisas diferentes.
// "Mesa" é quem opera o som: marcar aqui faz a pessoa aparecer primeiro na escolha da mesa
const COMUNS = ['Voz', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Cajón', 'Mesa'];
export function sugestoesDeInstrumento(dados) {
    const vistos = new Map(COMUNS.map((i) => [chave(i), i]));
    const juntar = (lista) => lista.forEach((i) => { if (!vistos.has(chave(i))) vistos.set(chave(i), i); });
    dados.pessoas.forEach((p) => juntar(p.instrumentos));
    dados.grupos.forEach((g) => g.grupo_membro.forEach((m) => juntar(m.instrumentos)));
    return [...vistos.values()];
}

export function chave(texto) {
    return texto.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}
