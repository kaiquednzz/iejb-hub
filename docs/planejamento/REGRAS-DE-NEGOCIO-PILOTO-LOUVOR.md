# IEJB Hub: Regras de Negócio do Piloto Louvor

| Campo | Valor |
|---|---|
| **Escopo** | MVP do IEJB Hub, restrito ao ministério de Louvor |
| **Etapa** | 2. Definição de requisitos e regras de negócio |
| **Versão** | 0.8 (rascunho para revisão) |
| **Última atualização** | 14/11/2026 |
| **Documento base** | [Visão geral do IEJB Hub](VISAO-GERAL-IEJB-HUB.md), seção 13 |

> Este documento descreve **o que** o piloto deve fazer e **quais regras** valem. Ele não define banco de dados, telas nem tecnologia; isso fica para a etapa 3.

---

## Como ler este documento

Cada regra indica de onde veio:

| Origem | Significado |
|---|---|
| 🗣️ **Levantamento** | Vem das respostas sobre como o Louvor funciona hoje (visão geral, seções 13.7 a 13.13). |
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
| Fluxo próprio de substituição (pedido, aceite do substituto) | ✅ Decisão D16: a troca continua combinada pessoalmente; o líder de louvor só atualiza a escala (RN-70). |
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
| **Solicitação de acesso** | Pedido feito pela própria pessoa, com seu nome e senha, que o administrador aprova ou recusa (RN-10). |
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
| Criar contas | ✔️ | ✖️ | ✖️ | ✖️ |
| Designar outros administradores | ✔️ | ✖️ | ✖️ | ✖️ |
| Cadastrar e editar pessoas do Louvor | ✔️ | ✔️ | ✖️ | ✖️ |
| Editar os próprios dados de contato | ✔️ | ✔️ | ✔️ | ✔️ |
| Criar e editar grupos | ✔️ | ✔️ | ✖️ | ✖️ |
| Adicionar e tirar membros de um grupo | ✔️ | ✔️ | ✔️ só do próprio grupo (RN-16) | ✖️ |
| Aprovar solicitações de acesso | ✔️ | ✖️ | ✖️ | ✖️ |
| Criar cultos especiais | ✔️ | ✔️ | ✖️ | ✖️ |
| Montar, editar e publicar escalas | ✖️ (RN-02) | ✔️ | ✖️ | ✖️ |
| Ajustar pessoas e instrumentos de um culto publicado | ✖️ | ✔️ | ✔️ só nos cultos do próprio grupo (RN-37) | ✖️ |
| Mesa de som, grupo do culto, cancelar | ✖️ | ✔️ | ✖️ (RN-38) | ✖️ |
| Cadastrar músicas | ✔️ | ✔️ | ✔️ | ✖️ |
| Montar o repertório de um culto | ✔️ | ✔️ | ✔️ (ver RN-50) | ✖️ |
| Ver escalas e repertórios | ✔️ | ✔️ | ✔️ | ✔️ (ver RN-36) |

**RN-01** ✅ Toda permissão é verificada **no banco de dados e no backend**, não só na interface (decisão D4). Esconder um botão não é considerado controle de acesso.

**RN-02** ✅ O **líder de louvor** monta e publica a escala. ✅ *(mudou em 14/11/2026, Q23)* O **líder de grupo** ajusta sozinho as pessoas e os instrumentos nos cultos publicados do próprio grupo, e o líder de louvor é avisado (ver RN-37 a RN-39).

**RN-03** ✅ O primeiro administrador é **Kaique**, que pode designar outros administradores (Q1). Para quem também for líder de louvor, basta acumular os dois papéis.

---

## 4. Pessoas, contas e grupos

**RN-10** ✅ O Hub **não envia e-mail** (Q12). Uma pessoa pode estar cadastrada sem ter conta, e a conta nasce por um de dois caminhos:

1. **Criada pelo administrador**, com senha temporária que a pessoa troca no primeiro login.
2. **Solicitada pela própria pessoa**, com o nome e a senha que ela escolher, e **aprovada pelo administrador**.

💡 Detalhes propostos: uma conta pendente não vê nada até ser aprovada (vale a RN-01, no banco). Ao aprovar, o administrador liga a solicitação a uma pessoa do Louvor. Fica para a etapa 3 como isso se encaixa no Supabase Auth, que exige a confirmação de e-mail desligada.

**RN-11** 🗣️ Uma pessoa pode ser membro de **mais de um grupo** (caso do G2 e G3).

**RN-12** ✅ Cada grupo tem **um único líder**, que precisa ser membro desse grupo (Q4).

**RN-13** 💡 Pessoas que saem do Louvor são **desativadas**, não apagadas. Assim as escalas e os repertórios antigos continuam mostrando quem tocou.

**RN-14** 💡 Dados mínimos da pessoa: nome, como é chamada no Louvor (apelido) e meio de contato da conta. Nenhum dado além do necessário para o piloto funcionar. ✅ O contato é **visível para todos os integrantes** (Q22).

**RN-15** ✅ O Hub registra o **instrumento ou função** de cada pessoa (bateria, violão, voz etc.) e **mostra na escala** (Q5). Uma pessoa pode ter **mais de um** instrumento, e na escala aparece **o que o líder do grupo definir** (Q16).

**RN-16** ✅ O líder de grupo **adiciona e tira membros do próprio grupo**, além do líder de louvor e do administrador (Q15 e Q18).

**RN-17** ✅ O instrumento mostrado na escala é definido **por vínculo pessoa + grupo**: quem tem o instrumento "violão" no G2 aparece assim quando o G2 é usado. Pessoa avulsa, sem grupo, tem o instrumento definido pelo líder de louvor (Q18). A mesma pessoa pode ter instrumentos diferentes em grupos diferentes. ✅ Em um culto específico o instrumento pode ser diferente do padrão do grupo, e o líder de louvor ajusta na escala (Q19). Exemplo: quem toca bateria no G2 e violão com voz no G3 pode inverter num culto.

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

**RN-36** ✅ Todo integrante vê a **escala completa de todos os cultos** (Q6). 💡 Além disso, o Hub destaca **"minhas escalas"**, só com os cultos em que a pessoa está escalada. Essa é a principal diferença em relação ao PDF atual (visão geral, seção 13.3).

**RN-37** ✅ *(mudou em 14/11/2026, Q23)* O **líder de grupo ajusta a escala com autonomia**, sem pedir aprovação, nos cultos **publicados** em que o grupo dele foi escalado (Q20): **tira e inclui pessoas** e **muda o instrumento** de alguém naquele culto.

**RN-38** ✅ *(Q23)* Continuam só com o **líder de louvor**: a **mesa de som**, o **grupo** escalado no culto, **cancelar** o culto, mexer em **rascunho** e **publicar**. Ou seja: a montagem do mês é dele; o ajuste fino do culto, do líder de grupo.

**RN-39** ✅ *(Q23)* O **líder de louvor é avisado** de cada ajuste feito por um líder de grupo, com o nome de quem mudou (ex.: "Escala atualizada por Mari: Culto da Família, 22/11. Entrou: Bia. Saiu: Lucas."). As pessoas afetadas recebem o aviso normal (RN-40).

> **Histórico:** até a versão 0.6 o líder de grupo **solicitava** a alteração em texto livre e o líder de louvor aprovava ou reprovava (Q2). Essa versão chegou a ser construída e foi trocada pela autonomia na Q23, porque o pedido deixaria a troca parada esperando aprovação. As solicitações antigas ficam guardadas no banco.

### 6.2. Fluxo: montar e publicar a escala

1. O líder de louvor abre um culto com louvor.
2. Escolhe um ou mais grupos; o Hub preenche a lista com os membros.
3. Ajusta a lista, tirando ou adicionando pessoas, se precisar.
4. Salva como **rascunho** ou **publica**.
5. Ao publicar, o Hub dispara o aviso (seção 7).

### 6.3. Fluxo: ajuste pelo líder de grupo

1. O líder de grupo abre um culto publicado do grupo dele e toca em "Mudar quem toca".
2. Troca pessoas ou instrumentos.
3. Depois de alguns minutos sem novas mudanças (RN-45), os afetados e o líder de louvor recebem o aviso (RN-39, RN-40).

### 6.4. Troca combinada entre integrantes

**RN-70** ✅ Quando duas pessoas combinam uma troca pessoalmente, o **líder de louvor atualiza a escala no Hub** (Q11). Não existe fluxo próprio de substituição no piloto (decisão D16). A atualização gera o aviso normal (RN-40), então quem entrou e quem saiu são avisados pelo próprio Hub.

**RN-71** 💡 Risco conhecido: se a troca não chegar ao líder de louvor, a escala mostra quem não vai tocar. Hoje o aviso ao líder é um **recado informal, sem regra** (Q17), e o Hub não muda isso no piloto. Desde a Q23 o líder de grupo ajusta a escala sozinho (RN-37), o que diminui esse risco nos cultos do grupo dele. Permitir que qualquer integrante avise o líder pelo Hub fica como melhoria depois do piloto.

---

## 7. Avisos de mudança

**RN-40** ✅ Quando o **líder de louvor** publica ou altera uma escala publicada, as pessoas são avisadas (levantamento, seção 13.10).

**RN-41** ✅ O aviso vai **só para as pessoas afetadas**, não para o Louvor inteiro (Q7). ✅ "Afetado" é quem **entrou, saiu ou continua escalado** naquele culto (Q14).

**RN-42** ✅ Canal principal: **notificação push** (decisão D18).

**RN-43** ✅ Canal de reserva: o Hub gera uma **mensagem pronta** com o resumo da mudança e o link para o Hub, que o líder envia no grupo do WhatsApp (decisão D18).

Exemplo de mensagem:

```
Escala atualizada: Culto de Oração, terça 18/11, 19h30
Tocam: G2 + Fulano
Veja no Hub: app.iejb.com.br/...
```

**RN-44** ✅ *(mudou em 14/11/2026, Q23)* Mudanças feitas pelos **líderes de grupo avisam o líder de louvor** (antes: não avisavam). Mudanças no **repertório** continuam avisando só quem está escalado.

**RN-45** 💡 Várias alterações seguidas na mesma escala, feitas em poucos minutos, geram **um único aviso**, para não lotar o celular das pessoas.

**RN-46** ~~O líder de louvor recebe uma notificação quando chega uma nova solicitação de alteração.~~ Sem efeito desde a Q23 (não existe mais solicitação).

**RN-47** ~~O líder de grupo recebe uma notificação quando sua solicitação é aprovada ou reprovada.~~ Sem efeito desde a Q23.

---

## 8. Repertório

**RN-50** ✅ O repertório de um culto é escolhido pelos **líderes dos grupos daquele culto, em conjunto** (Q8). Com um grupo só, é o líder desse grupo; com grupos mesclados, os líderes dos grupos juntos.

**RN-51** 🗣️ O **tom pertence ao repertório do culto**, não à música. A mesma música pode ter tons diferentes em cultos diferentes.

**RN-52** 💡 A música é cadastrada **uma vez** (nome, artista ou versão de referência, link opcional para cifra ou vídeo) e reaproveitada nos repertórios.

**RN-53** ✅ O repertório tem **ordem**, e ela importa (Q9).

**RN-54** 💡 O repertório fica visível para os integrantes assim que um líder salvar.

**RN-55** ✅ Mudança no repertório **gera aviso** (Q10). 💡 O aviso vai para as pessoas escaladas naquele culto, e a regra de agrupar avisos seguidos (RN-45) também vale aqui.

**RN-56** 💡 Como a escala é de pessoas (RN-31), o Hub precisa guardar **quais grupos foram usados** para montar cada culto, só para saber quais líderes podem editar o repertório. Todos esses líderes editam o mesmo repertório; vale a última alteração salva. Líder de louvor e administrador editam o repertório de qualquer culto. ✅ Em culto só com pessoas avulsas, sem grupo, o repertório é editado apenas pelo **líder de louvor e pelo administrador** (Q13). ✅ O líder de grupo edita o repertório **depois que a escala é publicada**, quando quiser (Q21).

---

## 9. Acesso e instalação

**RN-60** ✅ No **celular**, o Hub só é usado **instalado como PWA**. Aberto pelo navegador, mostra uma tela com o passo a passo de instalação para iPhone e Android (decisão D17).

**RN-61** ✅ No **computador**, funciona no navegador, sem exigir instalação (decisão D17).

**RN-62** 💡 Depois da instalação, o Hub pede permissão de notificação **com uma explicação antes** ("para te avisar quando a escala mudar"), em vez de mostrar o pedido do sistema logo de cara.

**RN-63** 💡 Uma pessoa pode receber notificações em **mais de um aparelho** (ex.: celular e computador).

**RN-64** ✅ Login com **e-mail e senha** (Q3, escolhido a partir da recomendação abaixo). 💡 *(14/11/2026, D33)* **Google** em teste como opção a mais, para quem é leigo: só vira oficial se o retorno funcionar no iPhone com o app instalado (o problema descrito na tabela abaixo).

**RN-65** ✅ A **senha esquecida é redefinida pelo administrador** (Q12), que passa uma nova senha temporária. Não há redefinição por e-mail.

**Por que e-mail e senha, e não as alternativas:**

| Opção | Problema no Hub |
|---|---|
| Nome de usuário + senha | O Supabase Auth (backend proposto) trabalha com e-mail ou telefone. |
| Link mágico por e-mail | No iPhone, o link abre no Safari, que **não compartilha a sessão** com o app instalado na tela de início. A pessoa faria login no lugar errado. |
| Conta Google | Nem todo integrante usa Google, e o redirecionamento de login dentro de um PWA instalado é menos previsível. Pode ser adicionado depois. |

---

## 10. Questões em aberto

Nenhuma no momento. O piloto está com as regras fechadas, a confirmar com o líder de louvor.

### Respondidas

| # | Questão | Resposta | Regras |
|---|---|---|---|
| Q1 | Quem é o administrador? | Kaique, que pode designar outros. | RN-03, RN-10 |
| Q2 | Líder de grupo pode editar a escala? | Não. Ele solicita a alteração e o líder de louvor aprova ou reprova. **Substituída pela Q23.** | RN-02, RN-37 a RN-39 |
| Q3 | Como as pessoas fazem login? | E-mail e senha. O Hub não envia e-mail (Q12). | RN-64, RN-65 |
| Q4 | Algum grupo tem mais de um líder? | Não. | RN-12 |
| Q5 | A escala mostra o instrumento de cada pessoa? | Sim. | RN-15 |
| Q6 | O integrante vê só a própria escala ou todas? | Todas. | RN-36 |
| Q7 | O aviso vai para quem? | Para os afetados. | RN-41 |
| Q8 | Em culto com grupos mesclados, quem escolhe o repertório? | Os líderes dos grupos, em conjunto. | RN-50, RN-56 |
| Q9 | A ordem das músicas importa? | Sim. | RN-53 |
| Q10 | Mudança no repertório avisa? | Sim. | RN-55 |
| Q11 | Em troca combinada, o líder atualiza a escala no Hub? | Sim. | RN-70, RN-71 |
| Q12 | Como a pessoa recebe acesso e recupera a senha sem e-mail? | O administrador cria a conta com senha temporária, ou a pessoa solicita com nome e senha e o administrador aprova. Senha esquecida: o administrador redefine. | RN-10, RN-65 |
| Q13 | Quem edita o repertório de culto só com avulsos? | Líder de louvor e administrador. | RN-56 |
| Q14 | "Afetados" no aviso, quem é? | Quem entrou, saiu ou continua escalado. | RN-41 |
| Q15 | O líder de grupo mexe nos membros do próprio grupo? | "Os dois": líder de grupo (só o próprio grupo) e líder de louvor/admin. | RN-16 |
| Q16 | Uma pessoa pode ter mais de um instrumento? | Sim; na escala aparece o que o líder do grupo definir. | RN-15, RN-17 |
| Q17 | Como o líder de louvor fica sabendo de uma troca? | Aviso simples e informal, sem regra. | RN-71 |
| Q18 | Leitura da Q15 e da Q16 está certa? | Sim: líder de grupo e líder de louvor/admin editam membros; instrumento por vínculo pessoa + grupo. | RN-16, RN-17 |
| Q19 | Quem tem mais de um instrumento aparece com todos, ou varia por culto? | Varia por culto: padrão por grupo, ajustável em cada culto. | RN-17 |
| Q20 | O líder de grupo pede alteração em qual culto? | Só nos cultos do próprio grupo. | RN-37 |
| Q21 | Quando o líder de grupo edita o repertório? | Depois da escala, quando ele quiser. | RN-56 |
| Q22 | Integrantes veem o contato uns dos outros? | Sim. | RN-14 |
| Q23 | (14/11/2026) O líder de grupo deve pedir ao líder de louvor? | Não: ele muda com autonomia **pessoas e instrumentos** nos cultos publicados do grupo dele, e o líder de louvor é apenas avisado. Mesa, grupo do culto, cancelar e publicar continuam com o líder de louvor. | RN-02, RN-37 a RN-39, RN-44 |

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 13/11/2026 | Rascunho inicial das regras de negócio do piloto Louvor. |
| 0.2 | 13/11/2026 | Q1 a Q3 respondidas: Kaique como administrador, solicitação de alteração com aprovação do líder de louvor, login com e-mail e senha. |
| 0.3 | 13/11/2026 | Q4 a Q11 respondidas. Novas questões: Q12 (acesso sem e-mail) e Q13 (repertório em culto sem grupo). |
| 0.4 | 13/11/2026 | Q12 a Q17 respondidas: acesso sem e-mail com aprovação do administrador, líder de grupo edita membros do próprio grupo, instrumento por vínculo, aviso só aos afetados. Nova questão Q18. |
| 0.5 | 13/11/2026 | Q18 confirmada. Sem questões em aberto no piloto. |
| 0.6 | 13/11/2026 | Q19 a Q22 (da etapa 3) incorporadas: instrumento ajustável por culto, solicitação só nos cultos do próprio grupo, repertório após a escala, contato visível. |
| 0.8 | 14/11/2026 | RN-64: login com Google em teste (D33). |
| 0.7 | 14/11/2026 | Q23: o líder de grupo ajusta pessoas e instrumentos sozinho e o líder de louvor é avisado (RN-02, RN-37 a 39, RN-44 mudaram; RN-46 e 47 sem efeito). Mesa de som e ceia como parte da escala (ver visão geral, D29). |
