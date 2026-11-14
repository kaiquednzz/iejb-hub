// Pessoas do Louvor. Admin e líder de louvor cadastram e editam (RN-14);
// o admin também cuida do acesso ao Hub de cada um (RN-10, RN-65).
// Os demais veem a lista com o contato (Q22).
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, confirmar, avisar } from '../../util/folha.js';
import { mensagemDoBanco, mensagemDaFuncao } from '../../util/erros.js';
import { campo, caixaDeAviso } from '../moldura.js';
import { sugestoesDeInstrumento, eLiderDeLouvor } from './dados.js';
import {
    seletorInstrumentos, interruptor, linhaPessoa, selo, vazio,
    gerarSenhaTemporaria, mensagemDeAcesso,
} from './pecas.js';

export function secaoPessoas(dados, ctx) {
    const { papeis } = dados;
    const ativas = dados.pessoas.filter((p) => p.ativa);
    const inativas = dados.pessoas.filter((p) => !p.ativa);

    const linha = (pessoa) => linhaPessoa({
        pessoa,
        sou: pessoa.id === dados.minhaPessoa,
        detalhe: pessoa.instrumentos.join(', '),
        selos: selosDaPessoa(pessoa, dados),
        aoTocar: () => (papeis.gerePessoas ? folhaPessoa(pessoa, dados, ctx) : folhaContato(pessoa)),
    });

    const novo = papeis.gerePessoas
        ? h('button', { type: 'button', class: 'botao-secundario botao-largo botao-novo' }, icone('mais'), 'Cadastrar pessoa')
        : null;
    novo?.addEventListener('click', () => folhaPessoa(null, dados, ctx));

    return h('div', { class: 'secao' },
        novo,
        ativas.length === 0
            ? vazio('Ninguém cadastrado ainda.', papeis.gerePessoas ? 'Comece cadastrando quem toca e canta no Louvor.' : null)
            : h('ul', { class: 'lista-linhas' }, ativas.map(linha)),
        inativas.length > 0 && h('details', { class: 'grupo-recolhido' },
            h('summary', null, `Desativadas (${inativas.length})`),
            h('ul', { class: 'lista-linhas' }, inativas.map(linha)),
        ),
    );
}

function selosDaPessoa(pessoa, dados) {
    const selos = [];
    if (eLiderDeLouvor(pessoa, dados.ministerioId)) selos.push(selo('Líder de louvor'));
    // A conta só chega para o admin (RLS); para os outros, isto fica em branco
    if (pessoa.conta?.e_administrador) selos.push(selo('Admin', 'admin'));
    if (dados.papeis.admin && pessoa.ativa) {
        if (!pessoa.conta) selos.push(selo('Sem acesso', 'neutro'));
        else if (pessoa.conta.estado === 'desativada') selos.push(selo('Acesso desligado', 'neutro'));
        else if (pessoa.conta.senha_temporaria) selos.push(selo('Senha temporária', 'rascunho'));
    }
    return selos;
}

// Integrante comum: só ver o contato
function folhaContato(pessoa) {
    const contato = pessoa.contato;
    const digitos = contato?.replace(/\D/g, '') ?? '';
    const pareceCelular = digitos.length >= 10 && digitos.length <= 13;
    const whatsapp = pareceCelular && `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`;

    abrirFolha({
        titulo: pessoa.apelido || pessoa.nome,
        conteudo: h('div', { class: 'form' },
            pessoa.apelido && h('p', { class: 'folha-texto' }, pessoa.nome),
            pessoa.instrumentos.length > 0 && h('p', { class: 'folha-texto' }, pessoa.instrumentos.join(', ')),
            contato
                ? h('p', { class: 'folha-contato' }, contato)
                : h('p', { class: 'folha-texto' }, 'Sem contato cadastrado.'),
            whatsapp && h('a', { class: 'botao-principal botao-largo', href: whatsapp, target: '_blank', rel: 'noopener noreferrer' },
                icone('whatsapp'), 'Chamar no WhatsApp'),
        ),
    });
}

// Cadastro e edição. pessoa = null para cadastrar uma nova.
function folhaPessoa(pessoa, dados, ctx) {
    const nova = !pessoa;
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, nova ? 'Cadastrar' : 'Salvar');
    const instrumentos = seletorInstrumentos({
        sugestoes: sugestoesDeInstrumento(dados),
        marcados: pessoa?.instrumentos ?? [],
        rotulo: 'O que toca ou canta',
    });

    const form = h('form', { class: 'form', novalidate: true },
        campo({ rotulo: 'Nome completo', nome: 'nome', autocomplete: 'off', autocapitalize: 'words', value: pessoa?.nome ?? '' }),
        campo({ rotulo: 'Como é chamada no Louvor', nome: 'apelido', autocomplete: 'off', required: false,
            dica: 'Opcional. É o nome que aparece na escala.', value: pessoa?.apelido ?? '' }),
        campo({ rotulo: 'Contato', nome: 'contato', tipo: 'tel', autocomplete: 'off', required: false,
            dica: 'Opcional. Todo o Louvor consegue ver.', value: pessoa?.contato ?? '' }),
        instrumentos.elemento,
        aviso.elemento,
        botao,
    );

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const valores = {
            nome: form.elements.nome.value.trim().replace(/\s+/g, ' '),
            apelido: form.elements.apelido.value.trim() || null,
            contato: form.elements.contato.value.trim() || null,
            instrumentos: instrumentos.valores(),
        };
        if (!valores.nome) return aviso.mostrar('Escreva o nome.');

        await comCarregando(botao, async () => {
            const { error } = nova
                ? await supabase.rpc('cadastrar_pessoa', {
                    p_nome: valores.nome, p_apelido: valores.apelido, p_contato: valores.contato,
                    p_instrumentos: valores.instrumentos, p_ministerio: dados.ministerioId,
                })
                : await supabase.from('pessoa').update(valores).eq('id', pessoa.id);
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            avisar(nova ? `${valores.apelido || valores.nome} cadastrada.` : 'Alterações salvas.');
            await ctx.recarregar();
        });
    });

    const extras = !nova && [
        dados.papeis.admin && pessoa.ativa && blocoAcesso(pessoa, dados, ctx, () => folha),
        dados.papeis.admin && pessoa.ativa && blocoLideranca(pessoa, dados, ctx),
        pessoa.id !== dados.minhaPessoa && blocoAtivar(pessoa, ctx, () => folha),
    ];

    const folha = abrirFolha({
        titulo: nova ? 'Cadastrar pessoa' : (pessoa.apelido || pessoa.nome),
        conteudo: h('div', { class: 'folha-pilha' }, form, extras),
    });
}

// ---------------------------------------------------------------------------
// Acesso ao Hub (só admin)
// ---------------------------------------------------------------------------
function blocoAcesso(pessoa, dados, ctx, pegarFolha) {
    const conta = pessoa.conta;
    const souEu = pessoa.id === dados.minhaPessoa;
    const caixa = h('section', { class: 'bloco', 'aria-labelledby': `acesso-${pessoa.id}` },
        h('h3', { id: `acesso-${pessoa.id}`, class: 'bloco-titulo' }, icone('chave', 'icone icone-p'), 'Acesso ao Hub'));

    if (!conta) {
        const criar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Criar acesso');
        criar.addEventListener('click', () => folhaCriarAcesso(pessoa, ctx, pegarFolha()));
        caixa.append(
            h('p', { class: 'bloco-texto' }, 'Ainda não tem login. Você cria com uma senha temporária e passa para a pessoa, ou ela usa "Pedir acesso" no app.'),
            criar,
        );
        return caixa;
    }

    caixa.append(h('p', { class: 'bloco-texto' }, 'Entra com ', h('strong', null, conta.login)));

    if (conta.estado !== 'ativa') {
        const religar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Ligar o acesso de novo');
        religar.addEventListener('click', () => comCarregando(religar, async () => {
            const { error } = await supabase.rpc('aprovar_conta', { p_conta: conta.id, p_pessoa: pessoa.id });
            if (error) return avisar(mensagemDoBanco(error));
            pegarFolha().fechar();
            avisar('Acesso ligado.');
            await ctx.recarregar();
        }));
        caixa.append(h('p', { class: 'bloco-texto' }, 'O acesso está desligado: a pessoa não consegue entrar.'), religar);
        return caixa;
    }

    if (conta.senha_temporaria) {
        caixa.append(h('p', { class: 'bloco-texto' }, 'Ainda não trocou a senha temporária.'));
    }

    caixa.append(interruptor({
        rotulo: 'Administrador do Hub',
        descricao: souEu ? 'Para deixar de ser admin, outro admin precisa tirar.' : 'Aprova acessos e cuida de tudo.',
        ligado: conta.e_administrador,
        aoMudar: async (valor) => {
            const { error } = await supabase.rpc('definir_administrador', { p_conta: conta.id, p_valor: valor });
            if (error) { avisar(mensagemDoBanco(error)); return false; }
            avisar(valor ? 'Agora é administrador.' : 'Não é mais administrador.');
            ctx.recarregar();
            return true;
        },
    }));

    if (!souEu) {
        const senha = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Redefinir senha');
        senha.addEventListener('click', () => folhaRedefinirSenha(pessoa, ctx, pegarFolha()));
        const desligar = h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Desligar acesso');
        desligar.addEventListener('click', async () => {
            const ok = await confirmar({
                titulo: 'Desligar o acesso?',
                texto: `${pessoa.apelido || pessoa.nome} não vai mais conseguir entrar no Hub. Continua no cadastro e nas escalas. Dá para ligar de novo depois.`,
                botao: 'Desligar acesso', perigo: true,
            });
            if (!ok) return;
            const { error } = await supabase.rpc('desativar_conta', { p_conta: conta.id });
            if (error) return avisar(mensagemDoBanco(error));
            pegarFolha().fechar();
            avisar('Acesso desligado.');
            await ctx.recarregar();
        });
        caixa.append(senha, desligar);
    }
    return caixa;
}

// Pede e-mail, sugere uma senha temporária e chama a função de servidor
function folhaCriarAcesso(pessoa, ctx, folhaPessoa) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Criar acesso');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `O login de ${pessoa.apelido || pessoa.nome} vai ser o e-mail. A senha é temporária: no primeiro acesso o app pede uma nova.`),
        campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', autocomplete: 'off', inputmode: 'email', autocapitalize: 'none' }),
        campoSenhaTemporaria(),
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const email = form.elements.email.value.trim().toLowerCase();
        const senha = form.elements.senha.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return aviso.mostrar('Confira o e-mail.');
        if (senha.length < 8) return aviso.mostrar('A senha precisa ter pelo menos 8 caracteres.');

        await comCarregando(botao, async () => {
            const { error } = await supabase.functions.invoke('admin-acesso', {
                body: { acao: 'criar_acesso', pessoa_id: pessoa.id, email, senha },
            });
            if (error) return aviso.mostrar(await mensagemDaFuncao(error));
            folhaPessoa.fechar();
            ctx.recarregar();
            folha.trocarConteudo(resultadoDoAcesso(email, senha, 'Acesso criado!', folha));
        });
    });
    const folha = abrirFolha({ titulo: 'Criar acesso', conteudo: form });
}

function folhaRedefinirSenha(pessoa, ctx, folhaPessoa) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Redefinir senha');
    const form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'folha-texto' }, `A senha atual de ${pessoa.apelido || pessoa.nome} para de funcionar. No próximo acesso o app pede para criar uma nova.`),
        campoSenhaTemporaria(),
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const senha = form.elements.senha.value.trim();
        if (senha.length < 8) return aviso.mostrar('A senha precisa ter pelo menos 8 caracteres.');
        await comCarregando(botao, async () => {
            const { error } = await supabase.functions.invoke('admin-acesso', {
                body: { acao: 'redefinir_senha', conta_id: pessoa.conta.id, senha },
            });
            if (error) return aviso.mostrar(await mensagemDaFuncao(error));
            folhaPessoa.fechar();
            ctx.recarregar();
            folha.trocarConteudo(resultadoDoAcesso(pessoa.conta.login, senha, 'Senha redefinida!', folha));
        });
    });
    const folha = abrirFolha({ titulo: 'Redefinir senha', conteudo: form });
}

function campoSenhaTemporaria() {
    const elemento = campo({
        rotulo: 'Senha temporária', nome: 'senha', autocomplete: 'off', autocapitalize: 'none',
        spellcheck: 'false', value: gerarSenhaTemporaria(), dica: 'Já sugerimos uma. Pode trocar se quiser.',
    });
    const outra = h('button', { type: 'button', class: 'link-discreto' }, 'Sugerir outra');
    outra.addEventListener('click', () => { elemento.querySelector('input').value = gerarSenhaTemporaria(); });
    elemento.append(outra);
    return elemento;
}

// Depois de criar/redefinir: mostra o que passar para a pessoa, com atalhos
function resultadoDoAcesso(email, senha, titulo, folha) {
    const texto = mensagemDeAcesso(email, senha);
    const copiar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, icone('copiar'), 'Copiar mensagem');
    copiar.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(texto);
            avisar('Mensagem copiada.');
        } catch {
            avisar('Não deu para copiar. Selecione o texto acima.');
        }
    });
    const pronto = h('button', { type: 'button', class: 'link-discreto' }, 'Pronto');
    pronto.addEventListener('click', () => folha.fechar());

    return h('div', { class: 'form resultado-acesso' },
        h('div', { class: 'resultado-icone', 'aria-hidden': 'true' }, icone('certo')),
        h('p', { class: 'resultado-titulo', role: 'status' }, titulo),
        h('p', { class: 'folha-texto' }, 'Passe estes dados para a pessoa. A senha não fica guardada em lugar nenhum do app depois que você fechar aqui.'),
        h('dl', { class: 'credenciais' },
            h('dt', null, 'E-mail'), h('dd', null, email),
            h('dt', null, 'Senha temporária'), h('dd', { class: 'credenciais-senha' }, senha),
        ),
        h('a', {
            class: 'botao-principal botao-largo', target: '_blank', rel: 'noopener noreferrer',
            href: `https://wa.me/?text=${encodeURIComponent(texto)}`,
        }, icone('whatsapp'), 'Mandar no WhatsApp'),
        copiar,
        pronto,
    );
}

// ---------------------------------------------------------------------------
// Liderança (só admin designa o líder de louvor, RN-02)
// ---------------------------------------------------------------------------
function blocoLideranca(pessoa, dados, ctx) {
    const vinculo = pessoa.membro_ministerio.find((m) => m.ministerio_id === dados.ministerioId);
    if (!vinculo) return null;
    return h('section', { class: 'bloco' },
        h('h3', { class: 'bloco-titulo' }, icone('escudo', 'icone icone-p'), 'Liderança'),
        interruptor({
            rotulo: 'Líder de louvor',
            descricao: 'Monta e publica as escalas e cuida dos grupos.',
            ligado: vinculo.e_lider,
            aoMudar: async (valor) => {
                const { error } = await supabase.from('membro_ministerio')
                    .update({ e_lider: valor })
                    .eq('pessoa_id', pessoa.id).eq('ministerio_id', dados.ministerioId);
                if (error) { avisar(mensagemDoBanco(error)); return false; }
                avisar(valor ? 'Agora é líder de louvor.' : 'Não é mais líder de louvor.');
                ctx.recarregar();
                return true;
            },
        }),
    );
}

// ---------------------------------------------------------------------------
// Desativar / reativar (RN-13: nunca apaga)
// ---------------------------------------------------------------------------
function blocoAtivar(pessoa, ctx, pegarFolha) {
    const nome = pessoa.apelido || pessoa.nome;
    const botao = h('button', { type: 'button', class: pessoa.ativa ? 'botao-texto-perigo' : 'botao-secundario botao-largo' },
        pessoa.ativa ? 'Desativar pessoa' : 'Reativar pessoa');
    botao.addEventListener('click', async () => {
        if (pessoa.ativa) {
            const ok = await confirmar({
                titulo: `Desativar ${nome}?`,
                texto: 'Não entra mais em escalas novas e perde o acesso ao Hub. As escalas já montadas continuam mostrando o nome. Dá para reativar depois.',
                botao: 'Desativar', perigo: true,
            });
            if (!ok) return;
        }
        await comCarregando(botao, async () => {
            const { error } = await supabase.rpc('definir_pessoa_ativa', { p_pessoa: pessoa.id, p_ativa: !pessoa.ativa });
            if (error) return avisar(mensagemDoBanco(error));
            pegarFolha().fechar();
            avisar(pessoa.ativa ? `${nome} desativada.` : `${nome} reativada.`);
            await ctx.recarregar();
        });
    });
    return h('div', { class: 'bloco bloco-final' }, botao);
}
