# IEJB Hub: Registro de Decisões Técnicas

| Campo | Valor |
|---|---|
| **Escopo** | Escolhas de tecnologia do piloto Louvor |
| **Etapa** | Entre a 3 (modelo de dados) e a 4 (desenvolvimento do MVP) |
| **Versão** | 0.3 (rascunho para revisão) |
| **Última atualização** | 13/11/2026 |
| **Documentos base** | [Visão geral](VISAO-GERAL-IEJB-HUB.md), [Regras de negócio](REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md), [Modelo de dados e permissões](MODELO-DE-DADOS-E-PERMISSOES-PILOTO-LOUVOR.md) |

> Cada ponto traz as opções, o que eu recomendo e por quê, e quem decide é Kaique. Em 13/11/2026 Kaique decidiu o backend (DT-01) e o plano gratuito (DT-06), delegou o front-end (DT-03) e aprovou as demais recomendações (DT-02, DT-04, DT-05). Os itens de "A confirmar na etapa 4" são verificações técnicas que podem ajustar detalhes, não a direção.
>
> Os limites dos serviços vêm de pesquisa feita em **13/11/2026** (fontes no fim). Planos gratuitos mudam: confirme nos sites oficiais antes de depender de um número.

---

## Como ler este documento

| Marcador | Significado |
|---|---|
| ✅ **Decidido** | Kaique escolheu, ou delegou a escolha. |
| 💡 **Recomendação** | Minha sugestão com justificativa. Pode ser trocada. |
| ❓ **Em aberto** | Precisa de resposta de Kaique. Listado na [seção 8](#8-questões-em-aberto). |
| ⚠️ **Risco** | Algo que pode dar errado e precisa de mitigação. |

---

## 1. Resumo

| # | Decisão | Recomendação | Status |
|---|---|---|---|
| DT-01 | Backend e banco | Supabase (PostgreSQL com RLS) | ✅ |
| DT-02 | Contas e login | Supabase Auth, sem e-mail, com cadastro por solicitação | ✅ |
| DT-03 | Front-end | Vite com JavaScript puro em módulos, sem framework na v1 | ✅ (por delegação) |
| DT-04 | Hospedagem e domínio | Cloudflare Pages em `app.iejb.com.br` | ✅ |
| DT-05 | Notificações push | Service worker próprio, VAPID e função de servidor | ✅ |
| DT-06 | Plano gratuito, pausa e backup | Plano gratuito no piloto, com atividade programada e backup próprio | ✅ plano, 💡 mitigações ⚠️ |

---

## 2. DT-01: Backend e banco de dados

**Contexto.** O modelo de dados (etapa 3) depende de permissões aplicadas **no banco** (RN-01, D4) e de um serviço de login. Ele tem 19 tabelas e uma matriz de permissões por papel.

**Opções consideradas**

| Opção | A favor | Contra |
|---|---|---|
| **A. Supabase** (PostgreSQL, Auth, RLS, funções de servidor) | RLS é exatamente o mecanismo que a etapa 3 pressupõe. Login, banco e funções vêm prontos. Plano gratuito. É PostgreSQL comum, então os dados são portáveis (D8). | Pausa por inatividade no plano gratuito (DT-06). Funções de servidor rodam em Deno/TypeScript, linguagem nova. Dependência de um fornecedor. |
| **B. Flask + PostgreSQL** (o que Kaique já estuda) | Reaproveita Python, Flask e PostgreSQL. Controle total. | Você passa a construir e manter login, sessões, envio de push e as regras de permissão por conta própria. Hospedar Flask de graça costuma trazer limitações (desligar por inatividade, banco à parte). Mais código, mais superfície de segurança, para um piloto de 13 pessoas. |

**💡 Recomendação: A (Supabase).** O ponto decisivo é a segurança: com RLS, a regra "integrante não vê rascunho" mora no banco e vale para qualquer cliente. Em Flask, cada rota precisa lembrar de conferir isso. Por outro lado, a opção B ensinaria mais sobre backend, e isso pesa para o seu objetivo de aprender. Se o aprendizado de backend for o foco, vale discutir.

**✅ Decisão de Kaique (13/11/2026): Supabase.** Motivos dele: não quer hospedar o backend por conta própria e quer custo zero.

**Riscos.** Veja DT-06. Além disso, RLS errada falha em silêncio (dados vazios ou vazando). O plano é **testar cada política com cada papel** antes de usar com pessoas reais.

---

## 3. DT-02: Contas e login

**Contexto.** Decisões já tomadas: login com e-mail e senha (RN-64), o Hub **não envia e-mail** (D19), conta criada pelo administrador ou solicitada pela pessoa e aprovada (RN-10), senha redefinida pelo administrador (RN-65).

**Como o Supabase Auth encaixa**

| Necessidade | Como fica |
|---|---|
| Administrador cria conta com senha temporária | Função de servidor chama a API de administrador para criar o usuário já confirmado, o que **não envia e-mail**. |
| Administrador redefine senha | Mesma API, também em função de servidor, nunca no navegador (modelo, seção 5.4). |
| Pessoa solicita acesso com nome e senha | Ver as duas opções abaixo. |
| Conta pendente não acessa nada | Política no banco: sem `conta.estado = ativa`, nenhuma leitura ou escrita (modelo, seção 5.3). |

**Cadastro por solicitação: duas formas**

| Opção | A favor | Contra |
|---|---|---|
| **A. Cadastro aberto do Supabase com confirmação de e-mail desligada** | Simples: a tela pública chama o cadastro padrão, e a conta nasce pendente. | Qualquer pessoa pode criar contas com qualquer e-mail, inclusive um que não é dela. Fontes de comunidade apontam spam e abuso de cota como o risco típico. Aqui o dano é limitado, porque conta pendente não vê nada. |
| **B. Função de servidor pública "solicitar acesso"** | Você controla o que entra, valida e limita a frequência antes de criar a conta. | Mais código e uma função aberta para manter. |

**✅ Decisão (aprovada por Kaique em 13/11/2026): A**, com limite de frequência e, se o serviço oferecer, verificação anti-robô (precisa ser confirmado na etapa 4). Com 13 pessoas, a função B é complexidade difícil de justificar. A confirmação de e-mail desligada **só é aceitável porque a conta pendente não enxerga nada**: essa política é a trava de segurança do sistema inteiro.

⚠️ **Se alguém criar uma conta com o e-mail de outro integrante**, a pessoa verdadeira fica impedida de se cadastrar com ele. Mitigação simples: o administrador confere cada solicitação com a pessoa antes de aprovar (já é o fluxo da RN-10) e remove a indevida.

---

## 4. DT-03: Front-end

**Contexto.** A visão geral deixa a escolha em aberto (A1: "HTML, CSS e JavaScript" ou React). O app terá cerca de 12 telas: login, pedir acesso, minhas escalas, escala de um culto, repertório, músicas, solicitações, avisos, pessoas, grupos, cultos e administração de contas. É uma PWA instalável (RN-60), e o site institucional do mesmo dono é HTML, CSS e JavaScript puros, sem build.

**Opções**

| Opção | A favor | Contra |
|---|---|---|
| **A. HTML, CSS e JS puros**, sem build | Mesmo modelo do site. Nenhuma ferramenta nova. | Com 12 telas e estado de login, você acaba reescrevendo roteamento e atualização de tela à mão. Fica difícil de manter. |
| **B. Vite + JS puro em módulos** | Mantém o JavaScript que você já está aprendendo, mas ganha módulos, variáveis de ambiente e o build que a PWA precisa. Não exige aprender um framework junto com RLS e push. | Ainda é você quem organiza telas e estado. Exige disciplina de estrutura. |
| **C. React (ou outro framework) + Vite** | Componentes, ecossistema grande, muito pedido no mercado e bom para portfólio. | Três coisas difíceis ao mesmo tempo: framework, RLS e push. Risco de o projeto emperrar no aprendizado do framework. |

**💡 Recomendação: B, com confiança baixa.** Pelo seu perfil (HTML e CSS fortes, JavaScript em evolução) e pela sua preferência de não adicionar biblioteca sem motivo concreto. A camada que conversa com o banco fica separada das telas, e isso deixa a migração para React viável depois, se o código ficar pesado. 

**✅ Decisão (Kaique delegou a escolha a Claude, 13/11/2026): B, Vite com JavaScript puro em módulos, sem framework na v1.** Valem os motivos acima. Duas condições para não virar bagunça: (1) tudo que fala com o Supabase fica em uma camada separada das telas; (2) ao terminar a primeira funcionalidade completa (por exemplo, ver a escala), avalia-se se a camada de telas está repetindo código demais. Se estiver, migra-se para um framework **antes** de construir as outras telas, não depois. React continua possível nessa migração.

---

## 5. DT-04: Hospedagem e domínio

**Contexto.** Proposta existente: Cloudflare Pages e subdomínio `app.iejb.com.br` (P1, P4). O repositório do Hub é **privado** (D15).

| Ponto | Situação |
|---|---|
| Cloudflare Pages, plano gratuito | Limites atuais: 500 builds por mês, 1 build por vez, banda e requisições estáticas ilimitadas. Funções do Pages entram na cota de requisições do Workers, o que o app não deve usar. |
| GitHub Pages (usado no site institucional) | 💡 Provável que **não sirva** para repositório privado no plano gratuito do GitHub (confirmar). É um dos motivos para preferir o Cloudflare. |
| Subdomínio | Para `app.iejb.com.br`, basta um registro de DNS apontando para o Cloudflare. ✅ Kaique tem acesso ao DNS e faria a configuração (Q23). 💡 Provavelmente funciona sem migrar o domínio inteiro para o Cloudflare (confirmar na etapa 4). |

**✅ Decisão (aprovada por Kaique em 13/11/2026):** Cloudflare Pages com deploy automático a cada push na `main`. O limite de 500 builds por mês é folgado para um projeto desse tamanho.

**Atualização (14/11/2026):** na hora de publicar, o painel do Cloudflare levou para o fluxo novo de **Workers com arquivos estáticos**, que substitui o Pages para sites novos. Mesmo efeito: deploy a cada push, plano gratuito, sem código de servidor. O projeto ficou na conta do Cloudflare da IEJB, a mesma do domínio, então o DNS de `app.iejb.com.br` foi criado sozinho, sem mexer no Registro.br.

---

## 6. DT-05: Notificações push

**Contexto.** D17 e D18: PWA obrigatória no celular, push como canal principal e mensagem de WhatsApp como reserva.

**O que a pesquisa confirmou**

- No iPhone, push só funciona com iOS 16.4 ou mais novo **e** com o app adicionado à tela de início e aberto por esse ícone. Em aba do Safari, não dá para se inscrever.
- A permissão precisa ser pedida por um toque da pessoa, dentro do app instalado (RN-62 já prevê isso).
- O push declarativo do iOS 18.4 não é aceito pelo Chrome, Edge nem Firefox, então 💡 o service worker próprio continua necessário.
- O WebKit avisa que o push clássico pode falhar por defeitos no service worker ou por limpeza automática de registros, o que reforça o canal de reserva do D18.

**Peças necessárias (o que já estava previsto na visão, seção 13.11)**

| Peça | Observação |
|---|---|
| Service worker | Recebe o push e mostra a notificação. O site institucional já tem um `sw.js`, mas o do Hub é outro projeto. |
| Chaves VAPID | Geradas uma vez e **nunca trocadas**, ou todos os aparelhos precisam se inscrever de novo. |
| Tabela `dispositivo_push` | Já no modelo (seção 3.1). |
| Função de servidor que envia | Calcula os destinatários (modelo, seção 6) e dispara. Roda com credencial privilegiada. |
| Janela de agrupamento (RN-45) | Precisa de algo que rode periodicamente ou com atraso. 💡 Recurso de agendamento do banco, **a confirmar na etapa 4**. |

**✅ Decisão (aprovada por Kaique em 13/11/2026):** service worker próprio, chaves VAPID e função de servidor, com a mensagem de WhatsApp como reserva (D18).

⚠️ **Teste em aparelho real.** O simulador do iOS não suporta web push. Vale reservar um iPhone e um Android reais já no início da etapa 4.

---

## 7. DT-06: Pausa e backup do plano gratuito

Este é o ponto de maior risco operacional do projeto.

**Fatos**

- Projetos Supabase gratuitos são pausados quando ficam cerca de uma semana com pouca atividade no banco, e um e-mail de aviso sai uma semana antes. Projetos pagos não pausam.
- O plano gratuito **não tem backups diários**.
- O plano Pro custa em torno de US$ 25 por mês e remove a pausa e traz backup.

**Por que importa aqui.** O Louvor usa o Hub toda semana, então a pausa tende a não acontecer. Mas uma semana sem culto (férias, recesso de fim de ano) pode zerar a atividade, e uma escala indisponível num domingo seria justamente o oposto da diretriz do projeto: "não criar mais uma obrigação". Além disso, os dados **pertencem à igreja** (D8). Perder tudo por falta de backup seria sério.

**✅ Decisão de Kaique:** plano gratuito. 💡 Para isso ser seguro, os itens 1 e 2 abaixo precisam entrar na etapa 4.

**💡 Mitigações propostas**

1. Ficar no plano gratuito, mas com **atividade programada** que mantenha o projeto ativo (por exemplo, uma tarefa agendada no GitHub fazendo uma consulta simples). Fontes divergem sobre se isso basta, então vale confirmar no painel de quem usa.
2. **Backup próprio**: exportação periódica do banco para um lugar seguro, atendendo também a exportação prometida na D8.
3. Reavaliar o plano Pro quando houver mais ministérios ou assinatura da igreja.

⚠️ **Tensão com o modelo financeiro (P7).** US$ 25 por mês, dependendo do câmbio, tende a consumir a maior parte (ou mais) da mensalidade que vier a ser cobrada, antes de contar o seu tempo. Isso não trava o piloto, mas é uma conta que precisa ser feita antes de fechar o preço com a igreja.

---

## 8. Questões em aberto

Nenhuma.

### Respondidas

| # | Questão | Resposta |
|---|---|---|
| Q23 | Quem controla o DNS de `iejb.com.br`? | Kaique tem acesso e faria a configuração. |
| Q24 | Front-end: JS puro com Vite ou React? | Kaique deixou a escolha com Claude: Vite com JS puro (DT-03). |
| Q25 | Plano gratuito ou Pro? | Gratuito. |
| Q26 | Supabase ou Flask + PostgreSQL? | Supabase, porque não quer hospedar o backend e quer custo zero. |

### A confirmar na etapa 4

| Item | Por quê |
|---|---|
| Verificação anti-robô no cadastro do Supabase | Reforçaria a DT-02. |
| Recurso de agendamento do banco e da função de servidor | Necessário para a janela de avisos (DT-05). |
| GitHub Pages com repositório privado | Confirmaria por que o Cloudflare é necessário. |
| Subdomínio no Cloudflare Pages sem migrar o DNS | Kaique tem acesso ao DNS; falta confirmar o procedimento. |

---

## Fontes

Consultadas em 13/11/2026.

- Supabase, "Project Pausing": https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase, `auth.admin.createUser` (não envia e-mail de confirmação): https://supabase.com/docs/reference/dart/auth-admin-createuser
- Cloudflare Pages, "Limits": https://developers.cloudflare.com/pages/platform/limits
- Apple, "Sending web push notifications in web apps and browsers": https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- MobiLoud, "PWA push notifications" e "Progressive Web Apps on iOS": https://www.mobiloud.com/blog/pwa-push-notifications
- Comunidade (sobre cadastro aberto e confirmação de e-mail): https://www.iloveblogs.blog/fix/fix-supabase-signin-without-email-verification

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 13/11/2026 | Primeiro rascunho: DT-01 a DT-06, riscos do plano gratuito e questões Q23 a Q26. |
| 0.2 | 13/11/2026 | Q23 a Q26 respondidas: Supabase, plano gratuito, front-end com Vite e JS puro (por delegação) e acesso ao DNS. |
| 0.3 | 13/11/2026 | Kaique aprovou DT-02, DT-04 e DT-05. Todas as decisões técnicas do piloto estão fechadas. |
