// Verificação em duas etapas (D57): o código de 6 dígitos do app autenticador.
//
// O banco é quem manda: o financeiro e a troca de cargos só funcionam numa
// sessão "aal2" (confirmada com código). Aqui é só o caminho até lá:
//   - já confirmou nesta sessão → segue direto, sem perguntar nada;
//   - já tem o app cadastrado   → pede o código;
//   - nunca cadastrou           → mostra como cadastrar e confirma o 1º código.
// A sessão confirmada dura tanto quanto o login (o Supabase renova o token
// mantendo o aal2), então o código é pedido uma vez por login, não toda hora.
//
// Padrão TOTP: funciona com o app Senhas do iPhone, Google Authenticator,
// Microsoft Authenticator etc. Nada de SMS (custa e é fácil de interceptar).
import { h, icone, marcarCopiado } from './dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, avisar, anunciar } from './folha.js';
import { caixaDeAviso } from '../telas/moldura.js';
import { comemorar } from './comemorar.js';

const ERRO_CODIGO = 'Código errado ou vencido. Confira no app e tente de novo.';
let pedindo = null; // uma folha por vez, mesmo que duas telas peçam juntas

export async function sessaoConfirmada() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === 'aal2';
}

// Devolve true quando a sessão está confirmada (já estava ou acabou de ficar).
// `para` completa a frase "Para ..., confirme com o código".
export function garantirCodigo(para) {
    pedindo ??= (async () => {
        try {
            if (await sessaoConfirmada()) return true;
        } catch (e) {
            console.error(e);
            avisar('Não deu para conferir sua conta. Tente de novo.');
            pedindo = null;
            return false;
        }
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) { avisar('Não deu para conferir sua conta. Tente de novo.'); return false; }
            const fator = data.totp[0]; // listFactors só põe em `totp` os já confirmados
            return fator ? await pedirCodigo(fator.id, para) : await cadastrar(data.all, para);
        } finally {
            pedindo = null;
        }
    })();
    return pedindo;
}

// Campo do código. autocomplete=one-time-code: no iPhone, o app Senhas sugere
// o código em cima do teclado, sem precisar trocar de app.
function campoCodigo(aoCompletar) {
    const entrada = h('input', {
        id: 'codigo-mfa', name: 'codigo', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code',
        maxlength: 7, required: true, class: 'codigo-entrada', 'aria-describedby': 'codigo-mfa-dica', placeholder: '000 000',
    });
    entrada.addEventListener('input', () => {
        const digitos = entrada.value.replace(/\D/g, '').slice(0, 6);
        entrada.value = digitos.length > 3 ? `${digitos.slice(0, 3)} ${digitos.slice(3)}` : digitos;
        if (digitos.length === 6) aoCompletar(digitos);
    });
    return {
        entrada,
        valor: () => entrada.value.replace(/\D/g, ''),
        elemento: h('div', { class: 'campo' },
            h('label', { for: 'codigo-mfa' }, 'Código de 6 dígitos'),
            entrada,
            h('p', { class: 'campo-dica', id: 'codigo-mfa-dica' }, 'Ele muda a cada 30 segundos. Vale o que está aparecendo agora.')),
    };
}

// Formulário comum às duas folhas: campo + botão + aviso de erro
function formularioDoCodigo(fatorId, aoConfirmar) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Confirmar');
    let ocupado = false;
    async function enviar(codigo) {
        if (ocupado) return;
        if (codigo.length !== 6) { aviso.mostrar('Digite os 6 números.'); campo.entrada.focus(); return; }
        ocupado = true; botao.disabled = true; aviso.limpar();
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo });
        ocupado = false; botao.disabled = false;
        if (error) {
            console.error(error);
            aviso.mostrar(/invalid|verification|expired/i.test(error.message) ? ERRO_CODIGO : 'Não deu para confirmar agora. Tente de novo.');
            campo.entrada.select();
            return;
        }
        aoConfirmar();
    }
    const campo = campoCodigo(enviar);
    const form = h('form', { class: 'form codigo-form', novalidate: true }, campo.elemento, aviso.elemento, botao);
    form.addEventListener('submit', (e) => { e.preventDefault(); enviar(campo.valor()); });
    return { form, campo };
}

function pedirCodigo(fatorId, para) {
    return new Promise((resolver) => {
        let ok = false;
        const { form } = formularioDoCodigo(fatorId, () => { ok = true; folha.fechar(); });
        const folha = abrirFolha({
            titulo: 'Confirme que é você',
            conteudo: h('div', { class: 'codigo-folha' },
                h('p', { class: 'folha-texto' }, `Para ${para}, digite o código que aparece no seu app autenticador (o mesmo onde você guardou o “IEJB Hub”).`),
                form,
                h('p', { class: 'codigo-ajuda' }, icone('info', 'icone icone-p'),
                    'Trocou ou perdeu o celular? Fale com um administrador do Hub para cadastrar de novo.')),
            aoFechar: () => resolver(ok),
        });
    });
}

async function cadastrar(fatores, para) {
    // Um cadastro que ficou pela metade (fechou a folha antes do código)
    // trava um novo: apaga antes de começar.
    for (const f of fatores.filter((f) => f.factor_type === 'totp' && f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'IEJB Hub', friendlyName: 'IEJB Hub' });
    if (error) {
        console.error(error);
        avisar('Não deu para começar o cadastro do código. Tente de novo.');
        return false;
    }
    const { id, totp } = data;
    // O Supabase manda o QR como SVG cru dentro de "data:...;utf-8,<svg ...>".
    // Caracteres como # e % quebram esse formato em alguns navegadores:
    // recodifica do jeito certo antes de pôr na <img>.
    const svg = totp.qr_code.slice(totp.qr_code.indexOf(',') + 1);
    const qr = svg.trimStart().startsWith('<')
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        : totp.qr_code;

    return new Promise((resolver) => {
        let ok = false;
        const chave = totp.secret.replace(/(.{4})(?=.)/g, '$1 ');
        const copiar = h('button', { type: 'button', class: 'botao-texto' }, icone('copiar', 'icone icone-p'), 'Copiar a chave');
        copiar.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(totp.secret); marcarCopiado(copiar); anunciar('Chave copiada.'); }
            catch { avisar('Não deu para copiar neste aparelho.'); }
        });
        const { form } = formularioDoCodigo(id, () => {
            ok = true;
            folha.fechar();
            comemorar('Conta protegida!', 'Daqui pra frente, o Hub pede o código nas partes sensíveis.');
        });

        const folha = abrirFolha({
            titulo: 'Proteja sua conta',
            conteudo: h('div', { class: 'codigo-folha' },
                h('p', { class: 'folha-texto' },
                    `Para ${para}, o Hub pede, além da senha, um código que muda a cada 30 segundos. `
                    + 'Assim, mesmo que alguém descubra sua senha, não mexe no dinheiro da igreja. É só configurar uma vez.'),
                h('ol', { class: 'codigo-passos' },
                    h('li', {},
                        h('strong', {}, 'Guarde o Hub no seu app de códigos'),
                        h('a', { class: 'botao-secundario botao-largo', href: totp.uri }, icone('chave', 'icone icone-p'), 'Abrir no app de códigos'),
                        h('img', { class: 'codigo-qr', src: qr, alt: 'QR code para ler com o app autenticador', width: 180, height: 180 }),
                        h('p', { class: 'codigo-ajuda' },
                            'No iPhone, abre o app Senhas. No Android, use o Google Authenticator. '
                            + 'No computador, leia o QR code com o celular. Se nada abrir, adicione à mão com esta chave:'),
                        h('div', { class: 'codigo-chave' }, h('code', {}, chave), copiar)),
                    h('li', {},
                        h('strong', {}, 'Digite o código que apareceu lá'),
                        form)),
            ),
            aoFechar: () => resolver(ok),
        });
    });
}
