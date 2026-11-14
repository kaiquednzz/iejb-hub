# IEJB Hub: Regras de Negócio do Piloto Louvor

| Campo | Valor |
|---|---|
| **Escopo** | MVP do IEJB Hub, restrito ao ministério de Louvor |
| **Etapa** | 2. Definição de requisitos e regras de negócio |
| **Versão** | 0.2 (rascunho para revisão) |
| **Última atualização** | 13/11/2026 |
| **Documento base** | [Visão geral do IEJB Hub](VISAO-GERAL-IEJB-HUB.md), seção 13 |

> Este documento descreve **o que** o piloto deve fazer e **quais regras** valem. Ele não define banco de dados, telas nem tecnologia; isso fica para a etapa 3.

---

## Como ler este documento

Cada regra indica de onde veio:

| Origem | Significado |
|---|---|
| 🗣️ **Levantamento** | Vem das respostas sobre como o Louvor funciona hoje (visão geral, seções 13.7 a 13.11). |
| ✅ **Decisão** | Decisão já registrada por Kaique na visão geral. |
| 💡 **Proposta** | Sugestão para fechar uma lacuna. Precisa ser aceita ou ajustada por Kaique. |
| ❓ **Em aberto** | Ainda não há resposta. Listado na [seção 10](#10-questões-em-aberto). |

As regras são numeradas (`RN-xx`) para poderem ser citadas no código, nos testes e em conversas futuras.

---

## 1. Escopo do piloto

### Dentro do escopo

- Cadastro das pessoas do Louvor e dos grupos (G1, G2, G3).
- Cadastro dos cultos que têm louvor.
- Montagem e publicação da escala de cada culto.
- Cadastro de músicas e montagem do repertório de cada culto.
- Aviso às pessoas quando a escala muda (push e mensagem para WhatsApp).
- Acesso com conta, instalação obrigatória no celular.

### Fora do escopo

| Item | Motivo |
|---|---|
| Substituições registradas no Hub | ✅ Decisão D16: continuam combinadas pessoalmente. |
| Outros ministérios e a comunidade | ✅ Decisões D13 e D14: entram depois do piloto. |
| Cifras hospedadas no Hub | 💡 Proposta: no piloto, só um link externo opcional (ver RN-52). |
| Disponibilidade dos músicos e confirmação de presença | 💡 Proposta: ficam para depois. Não apareceram como dor no levantamento. |
| Financeiro, Kids, pregações, acervo | ✅ Decisão D11. |

---

## 2. Glossário e entidades

| Termo | Definição |
|---|---|
| **Pessoa** | Alguém que faz parte do Louvor. 💡 Existe independentemente de ter conta, para que no futuro a comunidade inteira caiba no mesmo cadastro (decisão D14). |
| **Conta** | Acesso de uma pessoa ao Hub. Uma pessoa tem no máximo uma conta. |
| **Ministério** | No piloto existe só um: **Louvor**. 💡 Já é uma entidade própria para que outros ministérios entrem depois sem refazer a base. |
| **Grupo** | Subdivisão do Louvor: **G1, G2 e G3**. |
| **Membro do grupo** | Ligação entre uma pessoa e um grupo. Uma pessoa pode estar em vários grupos. |
| **Tipo de culto** | Culto recorrente da semana (ex.: Culto da Família, Culto de Oração). |
| **Culto** | Uma ocorrência com data e horário (ex.: Culto de Oração de 18/11). Pode ser recorrente ou especial. |
| **Escala** | A lista de **pessoas** escaladas para tocar em um culto. |
| **Música** | Uma canção cadastrada uma vez e reutilizada em vários cultos. |
| **Repertório** | As músicas de um culto, cada uma com o **tom** daquele culto. |
| **Aviso** | Comunicação disparada quando o líder de louvor altera uma escala publicada. |

---

## 3. Papéis e permissões

### 3.1. Papéis

| Papel | Quem é | Origem |
|---|---|---|
| **Administrador** | Quem cuida do sistema (cadastro de contas e configurações). Inicialmente **Kaique**, que pode designar outros administradores. | ✅ Decisão (Q1) |
| **Líder de louvor** | Líder geral do ministério. Monta a escala. | 🗣️ Levantamento |
| **Líder de grupo** | Líder de G1, G2 ou G3. Escolhe o repertório. | 🗣️ Levantamento |
| **Integrante** | Pessoa do Louvor com conta. | 🗣️ Levantamento |

Uma pessoa pode acumular papéis (ex.: líder de grupo também é integrante).

### 3.2. Matriz de permissões

Legenda: ✔️ pode · ✖️ não pode · ❓ a confirmar

| Ação | Admin | Líder de louvor | Líder de grupo | Integrante |
|---|---|---|---|---|
| Criar contas e convidar pessoas | ✔️ | ✖️ | ✖️ | ✖️ |
| Designar outros administradores | ✔️ | ✖️ | ✖️ | ✖️ |
| Cadastrar e editar pessoas do Louvor | ✔️ | ✔️ | ✖️ | ✖️ |
| Editar os próprios dados de contato | ✔️ | ✔️ | ✔️ | ✔️ |
| Criar e editar grupos e seus membros | ✔️ | ✔️ | ❓ | ✖️ |
| Criar cultos especiais | ✔️ | ✔️ | ✖️ | ✖️ |
| Montar, editar e publicar escalas | ✖️ (RN-02) | ✔️ | ✖️ | ✖️ |
| Solicitar alteração em uma escala | ✖️ | ✖️ | ✔️ (ver RN-37) | ✖️ |
| Aprovar ou reprovar solicitações | ✖️ | ✔️ | ✖️ | ✖️ |
| Cadastrar músicas | ✔️ | ✔️ | ✔️ | ✖️ |
| Montar o repertório de um culto | ✔️ | ✔️ | ✔️ (ver RN-50) | ✖️ |
| Ver escalas e repertórios | ✔️ | ✔️ | ✔️ | ✔️ (ver RN-36) |

**RN-01** ✅ Toda permissão é verificada **no banco de dados e no backend**, não só na interface (decisão D4). Esconder um botão não é considerado controle de acesso.

**RN-02** ✅ Só o **líder de louvor** edita a escala. O líder de grupo **solicita alterações**, que o líder de louvor aprova ou reprova (Q2, ver RN-37 a RN-39).

**RN-03** ✅ O primeiro administrador é **Kaique**, que pode designar outros administradores (Q1). Para quem também for líder de louvor, basta acumular os dois papéis.

---

## 4. Pessoas, contas e grupos

**RN-10** 💡 Uma pessoa pode estar cadastrada sem ter conta. A conta é criada por **convite de um administrador**, enviado por e-mail; a pessoa define a própria senha ao aceitar (ver RN-64).

**RN-11** 🗣️ Uma pessoa pode ser membro de **mais de um grupo** (caso do G2 e G3).

**RN-12** 💡 Um grupo tem **um líder**, que precisa ser membro desse grupo. ❓ Confirmar se algum grupo tem mais de um líder (Q4).

**RN-13** 💡 Pessoas que saem do Louvor são **desativadas**, não apagadas. Assim as escalas e os repertórios antigos continuam mostrando quem tocou.

**RN-14** 💡 Dados mínimos da pessoa: nome, como é chamada no Louvor (apelido) e meio de contato da conta. Nenhum dado além do necessário para o piloto funcionar.

**RN-15** ❓ Se o piloto vai registrar o **instrumento ou função** de cada pessoa (bateria, violão, voz etc.). Não apareceu no levantamento, mas a visão geral prevê (Q5).

---

## 5. Cultos

**RN-20** 🗣️ Só cultos **com louvor** entram no piloto. Hoje: **Culto da Família** (domingo, 18h) e **Culto de Oração** (terça, 19h30). A **EBD não tem louvor**.

**RN-21** 💡 Os cultos recorrentes são gerados a partir dos tipos de culto (dia da semana + horário), para o líder não precisar criar cada um à mão.

**RN-22** 🗣️ Existem **cultos especiais**, criados avulsos pelo líder de louvor, com data, horário e nome próprios.

**RN-23** 💡 Um culto pode ser **cancelado**. A escala e o repertório ficam guardados, mas o culto some da agenda das pessoas, e os escalados recebem aviso (ver RN-41).

---

## 6. Escala

### 6.1. Regras

**RN-30** 🗣️ A escala é **montada pelo líder de louvor**, culto a culto. **Não existe rodízio automático**: ele decide qual grupo toca em cada culto.

**RN-31** 🗣️ A escala é uma lista de **pessoas**, e o grupo é só um **atalho de preenchimento**. Escolher "G2" coloca os membros do G2 na escala; depois o líder pode tirar ou adicionar pessoas.

**RN-32** 🗣️ Em **cultos especiais**, o líder pode **mesclar grupos**: escolher mais de um grupo e/ou pessoas avulsas.

**RN-33** 💡 A mesma pessoa aparece **no máximo uma vez** na escala de um culto, mesmo que esteja em dois grupos escolhidos.

**RN-34** 💡 A escala tem dois estados:

| Estado | Quem vê | Gera aviso? |
|---|---|---|
| **Rascunho** | Só quem pode editar a escala | Não |
| **Publicada** | Todos os integrantes | Sim, ao publicar e a cada alteração |

Isso permite ao líder montar o mês inteiro com calma e só avisar quando estiver pronto.

**RN-35** 💡 Toda escala publicada guarda **quem fez a última alteração e quando**. É o mínimo para alguém conferir se está vendo a versão atual.

**RN-36** 💡 Cada integrante tem uma visão **"minhas escalas"**, mostrando só os cultos em que está escalado. Essa é a principal diferença em relação ao PDF atual (visão geral, seção 13.3). ❓ Confirmar se o integrante também pode ver a escala completa de todos os cultos (Q6).

**RN-37** ✅ O **líder de grupo não edita a escala**. Ele envia uma **solicitação de alteração** para um culto específico (Q2).

**RN-38** ✅ O **líder de louvor aprova ou reprova** cada solicitação (Q2).

**RN-39** 💡 Formato da solicitação no piloto: **texto livre** ligado ao culto (ex.: "trocar Fulano por Ciclano no domingo"). Ao aprovar, o próprio líder de louvor faz a alteração na escala, e o aviso normal é disparado (RN-40). A solicitação guarda o estado (**pendente**, **aprovada** ou **reprovada**) e, se reprovada, um motivo opcional.

**Motivo da proposta:** uma solicitação "estruturada", em que o líder de grupo monta a escala nova e a aprovação aplica sozinha, é bem mais complexa de construir. Com cerca de 13 pessoas e poucas solicitações por mês, o texto livre resolve no piloto e pode evoluir depois.

### 6.2. Fluxo: montar e publicar a escala

1. O líder de louvor abre um culto com louvor.
2. Escolhe um ou mais grupos; o Hub preenche a lista com os membros.
3. Ajusta a lista, tirando ou adicionando pessoas, se precisar.
4. Salva como **rascunho** ou **publica**.
5. Ao publicar, o Hub dispara o aviso (seção 7).

### 6.3. Fluxo: solicitação de alteração

1. O líder de grupo abre um culto com escala publicada e envia uma solicitação.
2. O líder de louvor recebe um aviso (RN-46).
3. O líder de louvor aprova ou reprova.
4. Se aprovar, ele altera a escala e o aviso normal vai para as pessoas afetadas.
5. O líder de grupo recebe a resposta (RN-47).

---

## 7. Avisos de mudança

**RN-40** ✅ Quando o **líder de louvor** publica ou altera uma escala publicada, as pessoas são avisadas (levantamento, seção 13.10).

**RN-41** 💡 Recebem o aviso as **pessoas afetadas**: quem entrou, quem saiu e quem continua escalado naquele culto. ❓ Confirmar se deve ir para todo o Louvor (Q7).

**RN-42** ✅ Canal principal: **notificação push** (decisão D18).

**RN-43** ✅ Canal de reserva: o Hub gera uma **mensagem pronta** com o resumo da mudança e o link para o Hub, que o líder envia no grupo do WhatsApp (decisão D18).

Exemplo de mensagem:

```
Escala atualizada: Culto de Oração, terça 18/11, 19h30
Tocam: G2 + Fulano
Veja no Hub: app.iejb.com.br/...
```

**RN-44** 🗣️ Mudanças feitas pelos **líderes de grupo não geram aviso** para o líder de louvor.

**RN-45** 💡 Várias alterações seguidas na mesma escala, feitas em poucos minutos, geram **um único aviso**, para não lotar o celular das pessoas.

**RN-46** 💡 O líder de louvor recebe uma notificação quando chega uma **nova solicitação de alteração**.

**RN-47** 💡 O líder de grupo recebe uma notificação quando sua solicitação é **aprovada ou reprovada**.

---

## 8. Repertório

**RN-50** 🗣️ O repertório de um culto é escolhido pelo **líder do grupo escalado**. ❓ Em cultos com grupos mesclados, quem escolhe (Q8).

**RN-51** 🗣️ O **tom pertence ao repertório do culto**, não à música. A mesma música pode ter tons diferentes em cultos diferentes.

**RN-52** 💡 A música é cadastrada **uma vez** (nome, artista ou versão de referência, link opcional para cifra ou vídeo) e reaproveitada nos repertórios.

**RN-53** 💡 O repertório tem **ordem** (qual música vem primeiro). ❓ Confirmar se a ordem importa (Q9).

**RN-54** 💡 O repertório fica visível para as pessoas escaladas naquele culto assim que o líder do grupo salvar. ❓ Se alterar o repertório também deve gerar aviso (Q10). Pelo levantamento, hoje ele é enviado no WhatsApp e não há regra de aviso.

---

## 9. Acesso e instalação

**RN-60** ✅ No **celular**, o Hub só é usado **instalado como PWA**. Aberto pelo navegador, mostra uma tela com o passo a passo de instalação para iPhone e Android (decisão D17).

**RN-61** ✅ No **computador**, funciona no navegador, sem exigir instalação (decisão D17).

**RN-62** 💡 Depois da instalação, o Hub pede permissão de notificação **com uma explicação antes** ("para te avisar quando a escala mudar"), em vez de mostrar o pedido do sistema logo de cara.

**RN-63** 💡 Uma pessoa pode receber notificações em **mais de um aparelho** (ex.: celular e computador).

**RN-64** ✅ Login com **e-mail e senha** (Q3, escolhido a partir da recomendação abaixo).

**RN-65** 💡 A pessoa pode **redefinir a senha** por e-mail.

**Por que e-mail e senha, e não as alternativas:**

| Opção | Problema no Hub |
|---|---|
| Nome de usuário + senha | Sem e-mail, não há como recuperar a senha esquecida, e o Supabase Auth (backend proposto) trabalha com e-mail ou telefone. |
| Link mágico por e-mail | No iPhone, o link abre no Safari, que **não compartilha a sessão** com o app instalado na tela de início. A pessoa faria login no lugar errado. |
| Conta Google | Nem todo integrante usa Google, e o redirecionamento de login dentro de um PWA instalado é menos previsível. Pode ser adicionado depois. |

---

## 10. Questões em aberto

| # | Questão | Afeta |
|---|---|---|
| Q4 | Algum grupo tem mais de um líder? | RN-12 |
| Q5 | O piloto registra o instrumento ou função de cada pessoa? | RN-15 |
| Q6 | O integrante vê a escala completa de todos os cultos ou só a dele? | RN-36 |
| Q7 | O aviso de mudança vai só para as pessoas afetadas ou para todo o Louvor? | RN-41 |
| Q8 | Em culto com grupos mesclados, quem escolhe o repertório? | RN-50 |
| Q9 | A ordem das músicas no repertório importa? | RN-53 |
| Q10 | Mudança no repertório deve gerar aviso? | RN-54 |
| Q11 | Quando a pessoa sabe de uma troca (substituição), o líder ajusta a escala no Hub? | Visão geral, seção 13.6 |

### Respondidas

| # | Questão | Resposta | Regras |
|---|---|---|---|
| Q1 | Quem é o administrador? | Kaique, que pode designar outros. | RN-03, RN-10 |
| Q2 | Líder de grupo pode editar a escala? | Não. Ele solicita a alteração e o líder de louvor aprova ou reprova. | RN-02, RN-37 a RN-39 |
| Q3 | Como as pessoas fazem login? | E-mail e senha. | RN-64, RN-65 |

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 13/11/2026 | Rascunho inicial das regras de negócio do piloto Louvor. |
| 0.2 | 13/11/2026 | Q1 a Q3 respondidas: Kaique como administrador, solicitação de alteração com aprovação do líder de louvor, login com e-mail e senha. |
