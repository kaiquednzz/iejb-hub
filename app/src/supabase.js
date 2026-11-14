// Um único cliente do Supabase para o app inteiro.
// As variáveis VITE_* vêm do arquivo .env e são embutidas no build pelo Vite.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chave) {
    throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env');
}

export const supabase = createClient(url, chave, {
    auth: {
        // Mantém a pessoa logada entre aberturas do app (fica no localStorage)
        persistSession: true,
        autoRefreshToken: true,
        // Não usamos login por link mágico nem OAuth (D19, D23)
        detectSessionInUrl: false,
    },
});
