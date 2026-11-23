// Pessoas. Duas portas para a mesma lista (D71):
//   - no Louvor (Equipe): só quem é do Louvor; líder de louvor e admin
//     cadastram, e quem cadastra aqui já entra no Louvor;
//   - em Pessoas (admin): a igreja toda, com filtro por ministério, título
//     na igreja, ministérios, permissões no app e o Gmail de convite.
// Os demais veem a lista (o contato só aparece para quem serve, D68).
import { instrumentosComIcone } from '../../util/instrumentos.js';
import { h, icone, comCarregando, marcarCopiado } from '../../util/dom.js';
import { botaoWhats, linkDoWhatsApp } from '../../util/compartilhar.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, confirmar, avisar, anunciar } from '../../util/folha.js';
import { mensagemDoBanco, mensagemDaFuncao } from '../../util/erros.js';
import { campo, caixaDeAviso } from '../moldura.js';
import { sugestoesDeInstrumento } from './dados.js';
import {
    seletorInstrumentos, interruptor, linhaPessoa, selo, vazio,
    gerarSenhaTemporaria, mensagemDeAcesso, blocoFoto,
} from './pecas.js';
import { avatar } from '../../util/foto.js';
import { nomeDoTitulo, nomeDaPermissao, PERMISSOES, seletorDeTitulo } from '../../util/titulos.js';

const ehDoLouvor = (pessoa, dados) => pessoa.membro_ministerio.some((m) => m.ministerio_id === dados.ministerioId);
const nomeDoMinisterio = (dados, id) => dados.ministerios.find((m) => m.id === id)?.nome ?? '';

// "Diaconisa · Kids, Recepção" (ou só "Membro" de quem não serve em área)
function resumoNaIgreja(pessoa, dados) {
    const onde = pessoa.membro_ministerio.filter((m) => m.ativo).map((m) => nomeDoMinisterio(dados, m.ministerio_id)).filter(Boolean);
    const titulo = pessoa.titulo && pessoa.titulo !== 'membro' ? nomeDoTitulo(pessoa.titulo) : null;
    return [titulo, onde.join(', ')].filter(Boolean).join(' · ') || 'Membro';
}

export function secaoPessoas(dados, ctx) {
    const { papeis } = dados;
    const daIgreja = ctx.area === 'pessoas'; // a igreja toda (admin) ou só o Louvor
    const doLugar = daIgreja ? dados.pessoas : dados.pessoas.filter((p) => ehDoLouvor(p, dados));
    let filtro = 'todos';
    const passa = (p) => filtro === 'todos'
        || (filtro === 'sem' && !p.membro_ministerio.some((m) => m.ativo))
        || p.membro_ministerio.some((m) => m.ativo && m.ministerio_id === filtro);

    const linha = (pessoa) => linhaPessoa({
        pessoa,
        sou: pessoa.id === dados.minhaPessoa,
        detalhe: daIgreja ? resumoNaIgreja(pessoa, dados) : pessoa.instrumentos.join(', '),
        selos: selosDaPessoa(pessoa, dados),
        aoTocar: () => {
            if (papeis.gerePessoas) folhaPessoa(pessoa, dados, ctx);
            else if (pessoa.id === dados.minhaPessoa) folhaMeuPerfil(pessoa, ctx);
            else folhaContato(pessoa);
        },
    });

    const novo = papeis.gerePessoas
        ? h('button', { type: 'button', class: 'botao-secundario botao-largo botao-novo' }, icone('mais'), daIgreja ? 'Cadastrar pessoa' : 'Cadastrar no Louvor')
        : null;
    novo?.addEventListener('click', () => folhaPessoa(null, dados, ctx));

    const lista = h('div', { class: 'pessoas-lista' });
    const desenharLista = () => {
        const ativas = doLugar.filter((p) => p.ativa && passa(p));
        const inativas = doLugar.filter((p) => !p.ativa && passa(p));
        lista.replaceChildren(...[
            ativas.length === 0
                ? vazio(filtro === 'todos' ? 'Ninguém cadastrado ainda.' : 'Ninguém aqui.',
                    filtro === 'todos' && papeis.gerePessoas ? (daIgreja ? 'Cadastre os membros da igreja.' : 'Comece cadastrando quem toca e canta no Louvor.') : null)
                // Quem só vê contatos ganha o mural de rostos (anuário); quem
                // administra fica com a lista, que tem os selos e as ações
                : papeis.gerePessoas
                    ? h('ul', { class: 'lista-linhas' }, ativas.map(linha))
                    : h('ul', { class: 'mural' }, ativas.map((p, i) => cartaoMural(p, i, dados, ctx))),
            inativas.length > 0 && h('details', { class: 'grupo-recolhido' },
                h('summary', null, `Desativadas (${inativas.length})`),
                h('ul', { class: 'lista-linhas' }, inativas.map(linha)),
            ),
        ].filter(Boolean));
    };
    desenharLista();

    // Filtro por ministério (só na igreja toda, e só se houver mais de um)
    const ativos = dados.ministerios.filter((m) => m.ativo);
    const filtros = daIgreja && ativos.length > 0 && h('div', { class: 'filtro-fichas', role: 'group', 'aria-label': 'Filtrar por ministério' },
        [['todos', 'Todos'], ...ativos.map((m) => [m.id, m.nome]), ['sem', 'Sem área']].map(([id, nome]) => {
            const b = h('button', { type: 'button', class: 'ficha', 'aria-pressed': String(id === filtro) }, nome);
            b.addEventListener('click', () => {
                filtro = id;
                b.parentElement.querySelectorAll('.ficha').forEach((f) => f.setAttribute('aria-pressed', String(f === b)));
                desenharLista();
            });
            return b;
        }));

    return h('div', { class: 'secao' }, novo, filtros, lista);
}

function cartaoMural(pessoa, i, dados, ctx) {
    const sou = pessoa.id === dados.minhaPessoa;
    const b = h('button', { type: 'button', class: `mural-pessoa${sou ? ' sou' : ''}` },
        avatar(pessoa, 'pessoa-avatar mural-rosto'),
        h('span', { class: 'mural-nome' }, pessoa.apelido || pessoa.nome, sou ? h('span', { class: 'sr-only' }, ' (você)') : null),
        pessoa.instrumentos.length ? instrumentosComIcone(pessoa.instrumentos, { classe: 'mural-icones', soIcones: true }) : null,
        h('span', { class: 'mural-instrumentos' }, pessoa.instrumentos.join(', ') || ' '));
    b.addEventListener('click', () => (sou ? folhaMeuPerfil(pessoa, ctx) : folhaContato(pessoa)));
    return h('li', { style: { '--i': Math.min(i, 12) } }, b);
}

function selosDaPessoa(pessoa, dados) {
    const selos = [];
    for (const m of pessoa.membro_ministerio.filter((v) => v.ativo && v.e_lider)) {
        selos.push(selo(m.ministerio_id === dados.ministerioId ? 'Líder de louvor' : `Líder · ${nomeDoMinisterio(dados, m.ministerio_id)}`));
    }
    // A conta só chega para o admin (RLS); para os outros, isto fica em branco
    if (pessoa.conta?.e_administrador) selos.push(selo('Admin', 'admin'));
    for (const c of pessoa.cargo_pessoa ?? []) selos.push(selo(nomeDaPermissao(c.cargo)));
    if (dados.papeis.admin && !pessoa.conta && dados.convites.has(pessoa.id)) selos.push(selo('Convite pelo Gmail', 'rascunho'));
    if (dados.papeis.admin && pessoa.ativa) {
        if (!pessoa.conta && !dados.convites.has(pessoa.id)) selos.push(selo('Sem acesso', 'neutro'));
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
            h('div', { class: 'foto-lugar' }, avatar(pessoa, 'pessoa-avatar avatar-grande')),
            pessoa.apelido && h('p', { class: 'folha-texto' }, pessoa.nome),
            pessoa.titulo && pessoa.titulo !== 'membro' && h('p', { class: 'folha-texto' }, nomeDoTitulo(pessoa.titulo)),
            pessoa.instrumentos.length > 0 && h('p', { class: 'folha-texto' }, pessoa.instrumentos.join(', ')),
            contato
                ? h('p', { class: 'folha-contato' }, contato)
                : h('p', { class: 'folha-texto' }, 'Sem contato cadastrado.'),
            whatsapp && h('div', { class: 'acoes-compartilhar so-whats' },
                botaoWhats({ rotulo: `Chamar ${pessoa.apelido || pessoa.nome} no WhatsApp`, href: whatsapp, classe: 'botao-whats-grande' })),
        ),
    });
}

// Cadastro e edição. pessoa = null para cadastrar uma nova.
// O admin vê tudo (título, ministérios, Gmail de convite); o líder de louvor
// cadastra no Louvor (nome, apelido, contato e instrumentos).
function folhaPessoa(pessoa, dados, ctx) {
    const nova = !pessoa;
    const admin = dados.papeis.admin;
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, nova ? 'Cadastrar' : 'Salvar');
    const instrumentos = seletorInstrumentos({
        sugestoes: sugestoesDeInstrumento(dados),
        marcados: pessoa?.instrumentos ?? [],
        rotulo: 'O que toca ou canta no Louvor',
    });

    // Ministérios: o admin marca; o líder de louvor cadastra direto no Louvor.
    // Na porta do Louvor, a pessoa nova já vem marcada no Louvor.
    const ativosAgora = new Set((pessoa?.membro_ministerio ?? []).filter((m) => m.ativo).map((m) => m.ministerio_id));
    if (nova && ctx.area !== 'pessoas') ativosAgora.add(dados.ministerioId);
    const caixas = new Map();
    const blocoMinisterios = admin && h('fieldset', { class: 'campo opcoes-ministerios' },
        h('legend', null, 'Onde serve'),
        dados.ministerios.filter((m) => m.ativo || ativosAgora.has(m.id)).map((m) => {
            const caixa = h('input', { type: 'checkbox', checked: ativosAgora.has(m.id) });
            caixas.set(m.id, caixa);
            caixa.addEventListener('change', mostrarInstrumentos);
            return h('label', { class: 'opcao' }, caixa, h('span', null, m.nome));
        }),
        h('p', { class: 'campo-dica' }, 'Nenhum marcado: é membro e não serve em área.'));
    const marcados = () => (admin ? [...caixas].filter(([, c]) => c.checked).map(([id]) => id) : [...ativosAgora]);
    function mostrarInstrumentos() { instrumentos.elemento.hidden = !marcados().includes(dados.ministerioId); }

    const titulo = admin && seletorDeTitulo({ id: 'pessoa-titulo', valor: pessoa?.titulo ?? 'membro' });
    const podeConvidar = admin && !pessoa?.conta;
    const gmail = podeConvidar && campo({
        rotulo: 'Gmail para entrar', nome: 'gmail', tipo: 'email', autocomplete: 'off', inputmode: 'email', autocapitalize: 'none', required: false,
        dica: 'Opcional. Quando a pessoa entrar com o Google usando este e-mail, já cai na ficha dela, sem você precisar aprovar.',
        value: pessoa ? (dados.convites.get(pessoa.id) ?? '') : '',
    });

    const form = h('form', { class: 'form', novalidate: true },
        campo({ rotulo: 'Nome completo', nome: 'nome', autocomplete: 'off', autocapitalize: 'words', value: pessoa?.nome ?? '' }),
        campo({ rotulo: 'Como gosta de ser chamada', nome: 'apelido', autocomplete: 'off', required: false,
            dica: 'Opcional. É o nome que aparece no app.', value: pessoa?.apelido ?? '' }),
        titulo && h('div', { class: 'campo' }, h('label', { for: 'pessoa-titulo' }, 'Título na igreja'), titulo),
        campo({ rotulo: 'Contato', nome: 'contato', tipo: 'tel', autocomplete: 'off', required: false,
            dica: 'Opcional. Só quem serve na igreja consegue ver.', value: pessoa?.contato ?? '' }),
        blocoMinisterios,
        instrumentos.elemento,
        gmail,
        aviso.elemento,
        botao,
    );
    mostrarInstrumentos();

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aviso.limpar();
        const louvor = marcados().includes(dados.ministerioId);
        const valores = {
            nome: form.elements.nome.value.trim().replace(/\s+/g, ' '),
            apelido: form.elements.apelido.value.trim() || null,
            contato: form.elements.contato.value.trim() || null,
            instrumentos: louvor ? instrumentos.valores() : (pessoa?.instrumentos ?? []),
        };
        if (admin) valores.titulo = titulo.value;
        if (!valores.nome) return aviso.mostrar('Escreva o nome.');
        const email = gmail ? form.elements.gmail.value.trim().toLowerCase() : null;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return aviso.mostrar('Confira o Gmail.');

        await comCarregando(botao, async () => {
            let id = pessoa?.id;
            if (nova) {
                const { data, error } = await supabase.rpc('cadastrar_pessoa', {
                    p_nome: valores.nome, p_apelido: valores.apelido, p_contato: valores.contato,
                    p_instrumentos: valores.instrumentos, p_ministerios: marcados(), p_titulo: valores.titulo ?? 'membro',
                });
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                id = data;
            } else {
                const { error } = await supabase.from('pessoa').update(valores).eq('id', pessoa.id);
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                if (admin) {
                    const erro = await salvarMinisterios(pessoa, marcados());
                    if (erro) return aviso.mostrar(mensagemDoBanco(erro));
                }
            }
            let resultado = null;
            if (gmail && (email || '') !== (dados.convites.get(id) ?? '')) {
                const { data, error } = await supabase.rpc('definir_email_de_convite', { p_pessoa: id, p_email: email || null });
                if (error) return aviso.mostrar(mensagemDoBanco(error));
                resultado = data;
            }
            folha.fechar();
            avisar(resultado === 'aprovada'
                ? `${valores.apelido || valores.nome} já tinha pedido acesso: está dentro.`
                : resultado === 'esperando'
                    ? `Pronto. Quando ${valores.apelido || valores.nome} entrar com o Google, já cai aqui.`
                    : nova ? `${valores.apelido || valores.nome} cadastrada.` : 'Alterações salvas.');
            await ctx.recarregar();
        });
    });

    const extras = !nova && [
        admin && pessoa.ativa && blocoAcesso(pessoa, dados, ctx, () => folha),
        admin && pessoa.ativa && blocoLideranca(pessoa, dados, ctx),
        pessoa.id !== dados.minhaPessoa && blocoAtivar(pessoa, ctx, () => folha),
    ];

    const folha = abrirFolha({
        titulo: nova ? 'Cadastrar pessoa' : (pessoa.apelido || pessoa.nome),
        conteudo: h('div', { class: 'folha-pilha' },
            !nova && blocoFoto(pessoa, () => ctx.recarregar()),
            form, extras),
    });
}

// Liga e desliga os vínculos com os ministérios (nunca apaga: desliga)
async function salvarMinisterios(pessoa, marcados) {
    const vinculos = new Map(pessoa.membro_ministerio.map((m) => [m.ministerio_id, m]));
    for (const id of marcados) {
        const v = vinculos.get(id);
        if (v?.ativo) continue;
        const { error } = v
            ? await supabase.from('membro_ministerio').update({ ativo: true }).eq('pessoa_id', pessoa.id).eq('ministerio_id', id)
            : await supabase.from('membro_ministerio').insert({ pessoa_id: pessoa.id, ministerio_id: id });
        if (error) return error;
    }
    for (const [id, v] of vinculos) {
        if (!v.ativo || marcados.includes(id)) continue;
        const { error } = await supabase.from('membro_ministerio').update({ ativo: false, e_lider: false })
            .eq('pessoa_id', pessoa.id).eq('ministerio_id', id);
        if (error) return error;
    }
    return null;
}

// Integrante comum na própria linha: foto e contato (o resto é com a liderança)
function folhaMeuPerfil(pessoa, ctx) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar contato');
    const form = h('form', { class: 'form', novalidate: true },
        campo({ rotulo: 'Seu contato', nome: 'contato', tipo: 'tel', autocomplete: 'tel', required: false,
            dica: 'Só quem serve na igreja consegue ver.', value: pessoa.contato ?? '' }),
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        await comCarregando(botao, async () => {
            const { error } = await supabase.rpc('atualizar_meu_contato', { p_contato: form.elements.contato.value });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            avisar('Contato salvo.');
            folha.fechar();
            await ctx.recarregar();
        });
    });
    const folha = abrirFolha({
        titulo: 'Seu perfil',
        conteudo: h('div', { class: 'folha-pilha' },
            blocoFoto(pessoa, () => ctx.recarregar()),
            form,
            h('p', { class: 'folha-texto' }, 'Nome, título e ministérios são definidos pela liderança.'),
        ),
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

    // Permissões no app (D45, D71). O admin dá e tira; fica no rastro de auditoria.
    caixa.append(h('p', { class: 'bloco-subtitulo' }, 'Pode no app'),
        ...PERMISSOES.map(([cargo, nome, descricao]) => {
            const atual = () => pessoa.cargo_pessoa?.find((c) => c.cargo === cargo);
            return interruptor({
                rotulo: nome,
                descricao,
                ligado: !!atual(),
                aoMudar: async (valor) => {
                    const { error } = valor
                        ? await supabase.from('cargo_pessoa').insert({ pessoa_id: pessoa.id, cargo })
                        : await supabase.from('cargo_pessoa').delete().eq('id', atual().id);
                    if (error) { avisar(mensagemDoBanco(error)); return false; }
                    avisar(valor ? `${nome}: ligado.` : `${nome}: desligado.`);
                    ctx.recarregar();
                    return true;
                },
            });
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
            marcarCopiado(copiar); anunciar('Mensagem copiada.');
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
        h('div', { class: 'acoes-compartilhar' },
            botaoWhats({ rotulo: 'Mandar no WhatsApp', href: linkDoWhatsApp(texto), classe: 'botao-whats-grande' }),
            copiar),
        pronto,
    );
}

// ---------------------------------------------------------------------------
// Liderança (só o admin designa líderes, RN-02): um interruptor por
// ministério em que a pessoa serve
// ---------------------------------------------------------------------------
function blocoLideranca(pessoa, dados, ctx) {
    const vinculos = pessoa.membro_ministerio.filter((m) => m.ativo);
    if (!vinculos.length) return null;
    return h('section', { class: 'bloco' },
        h('h3', { class: 'bloco-titulo' }, icone('escudo', 'icone icone-p'), 'Liderança'),
        vinculos.map((vinculo) => {
            const louvor = vinculo.ministerio_id === dados.ministerioId;
            const nome = nomeDoMinisterio(dados, vinculo.ministerio_id);
            return interruptor({
                rotulo: louvor ? 'Líder de louvor' : `Líder do ${nome}`,
                descricao: louvor ? 'Monta e publica as escalas e cuida dos grupos.' : `Aparece como quem lidera o ${nome}.`,
                ligado: vinculo.e_lider,
                aoMudar: async (valor) => {
                    const { error } = await supabase.from('membro_ministerio')
                        .update({ e_lider: valor })
                        .eq('pessoa_id', pessoa.id).eq('ministerio_id', vinculo.ministerio_id);
                    if (error) { avisar(mensagemDoBanco(error)); return false; }
                    avisar(valor ? `Agora lidera o ${nome}.` : `Não lidera mais o ${nome}.`);
                    ctx.recarregar();
                    return true;
                },
            });
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
