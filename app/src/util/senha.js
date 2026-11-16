// Senha que já vazou na internet? (substitui a "leaked password protection"
// do Supabase, que só existe no plano pago)
//
// Usa a API pública e gratuita do Have I Been Pwned com "k-anonimato": a
// senha nunca sai do celular. Calculamos o SHA-1 dela aqui, mandamos só os 5
// primeiros caracteres do hash e o serviço devolve centenas de hashes que
// começam assim; quem confere se o nosso está na lista é o próprio app.
// O cabeçalho Add-Padding faz a resposta ter sempre tamanho parecido, para
// nem o tamanho dela entregar alguma coisa.
//
// É uma checagem de cortesia, feita no app (quem chamasse a API do Supabase
// direto passaria por cima). Se o serviço não responder em 4 s, deixa passar:
// melhor não travar o cadastro por causa de um serviço de fora.
export async function senhaVazou(senha) {
    try {
        const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(senha));
        const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        const resposta = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
            headers: { 'Add-Padding': 'true' },
            signal: AbortSignal.timeout(4000),
        });
        if (!resposta.ok) return false;
        const resto = hash.slice(5);
        return (await resposta.text()).split('\n').some((linha) => {
            const [sufixo, vezes] = linha.trim().split(':');
            return sufixo === resto && Number(vezes) > 0;   // as de enchimento vêm com 0
        });
    } catch {
        return false;
    }
}

export const AVISO_SENHA_VAZADA = 'Essa senha já apareceu em vazamentos de outros sites, então é fácil de adivinhar. Escolha outra.';
