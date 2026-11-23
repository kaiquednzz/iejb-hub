// Função de servidor "limpar-mural" (D70). O pg_cron chama uma vez por dia.
//
// Apaga as fotos de membro com mais de 90 dias que a Comunicação não marcou
// para guardar: primeiro o arquivo (e a miniatura) no bucket privado, depois
// o post. Nessa ordem: se o arquivo falhar, o post fica e a próxima rodada
// tenta de novo (nunca sobra arquivo sem post apontando, que ninguém acharia).
//
// Por que não exige login? Ela só apaga o que já venceu pela regra do banco
// (fotos_de_membro_vencidas, que só a chave de serviço lê). Chamar à toa não
// apaga nada fora da regra.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sistema = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const miniatura = (nome: string) => nome.replace(/\.(webp|jpg)$/, '-mini.$1');

Deno.serve(async () => {
    try {
        const { data: vencidas, error } = await sistema.rpc('fotos_de_membro_vencidas');
        if (error) throw error;
        let apagadas = 0;
        for (const p of vencidas ?? []) {
            const arquivos = (p.fotos as string[]).flatMap((f) => [f, miniatura(f)]);
            // A palavra (D72) não tem arquivo: só apaga o post
            if (arquivos.length) {
                const { error: erroArquivo } = await sistema.storage.from('mural').remove(arquivos);
                if (erroArquivo) { console.error(p.id, erroArquivo); continue; }
            }
            const { error: erroPost } = await sistema.from('mural_publicacao').delete().eq('id', p.id);
            if (erroPost) { console.error(p.id, erroPost); continue; }
            apagadas++;
        }
        return new Response(JSON.stringify({ apagadas }), { headers: { 'Content-Type': 'application/json' } });
    } catch (erro) {
        console.error(erro);
        return new Response(JSON.stringify({ erro: 'Falha na limpeza.' }), { status: 500 });
    }
});
