# IEJB Hub: Visão Geral do Projeto

| Campo | Valor |
|---|---|
| **Nome** | IEJB Hub |
| **Instituição** | IEJB, Igreja Evangélica do Jardim Brasil |
| **Responsável pelo projeto e desenvolvimento** | Kaique |
| **Status** | Em desenvolvimento (etapa 4): banco, login, escala, PWA gestão de pessoas e acessos, montagem da escala, repertório com botões de streaming, fotos de perfil, avisos por push e ajuste da escala pelo líder de grupo prontos (todas as regras do piloto têm tela); app publicado em `app.iejb.com.br`. Sem aprovação institucional definitiva. |
| **Versão deste documento** | 2.0 (líder de grupo com autonomia) |
| **Última atualização** | 13/11/2026 |

> Este documento registra a visão atual do IEJB Hub para que ela possa evoluir depois.
> Ele **não** é uma especificação técnica, **não** representa aprovação da liderança e **não** autoriza o início da implementação.

---

## Como ler este documento

Cada ponto relevante está marcado com o seu grau de maturidade:

| Marcador | Significado |
|---|---|
| ✅ **Definido** | Premissa ou diretriz já estabelecida por Kaique para o projeto. Ainda depende da aprovação institucional da IEJB. |
| 💡 **Proposto** | Ideia ou caminho considerado, mas que pode mudar. |
| ❓ **Em aberto** | Ponto explicitamente indefinido, que precisa de conversa ou decisão futura. |

Quando uma seção inteira tem o mesmo status, o marcador aparece no título dela. A seção [11. Registro de status](#11-registro-de-status) consolida tudo em uma tabela.

---

## Sumário

1. [Conceito e visão geral](#1-conceito-e-visão-geral)
2. [Os cinco pilares do sistema](#2-os-cinco-pilares-do-sistema)
3. [Módulos funcionais previstos](#3-módulos-funcionais-previstos)
4. [Cargos, responsabilidades e permissões](#4-cargos-responsabilidades-e-permissões)
5. [Experiência do usuário e interface](#5-experiência-do-usuário-e-interface)
6. [Arquitetura e tecnologias consideradas](#6-arquitetura-e-tecnologias-consideradas)
7. [Modelo financeiro inicialmente imaginado](#7-modelo-financeiro-inicialmente-imaginado)
8. [Problemas que o IEJB Hub pretende resolver](#8-problemas-que-o-iejb-hub-pretende-resolver)
9. [Benefícios esperados](#9-benefícios-esperados)
10. [Etapas previstas](#10-etapas-previstas)
11. [Registro de status](#11-registro-de-status)
12. [Diretriz principal do projeto](#12-diretriz-principal-do-projeto)
13. [Escopo do MVP: piloto Louvor](#13-escopo-do-mvp-piloto-louvor)

---

## 1. Conceito e visão geral

O IEJB Hub será uma **central digital da IEJB**, funcionando como um aplicativo web próprio da igreja.

A ideia é reunir em um único ambiente grande parte das informações, atividades, compromissos, registros e ferramentas administrativas da instituição.

O Hub **não** deve ser pensado apenas como um sistema de gestão de escalas, mas como uma plataforma que conecte **a comunidade, os ministérios e a liderança**.

### Objetivo

Facilitar a organização da igreja, centralizar informações, preservar sua memória institucional e proporcionar uma experiência digital organizada e acessível.

### O que as pessoas poderão fazer no Hub

- Consultar informações da igreja.
- Acompanhar datas, eventos e compromissos.
- Consultar suas escalas e responsabilidades.
- Acessar informações dos ministérios.
- Consultar pregações e registros de cultos anteriores.
- Receber comunicados.
- Organizar atividades e responsabilidades.
- Acessar ferramentas administrativas conforme suas permissões.

---

## 2. Os cinco pilares do sistema

### 2.1. Informação e comunicação

Centralização de:

- Programação da igreja.
- Cultos e horários.
- Eventos.
- Comunicados.
- Documentos institucionais.
- Informações importantes.
- Calendário geral.

### 2.2. Organização e participação

Ferramentas para organizar:

- Escalas ministeriais.
- Compromissos.
- Disponibilidade dos integrantes.
- Confirmações de participação.
- Substituições.
- Atividades dos ministérios.
- Calendário compartilhado.

### 2.3. Memória e conhecimento

Um dos diferenciais imaginados para o IEJB Hub é **preservar a memória da igreja**.

Possibilidades:

- Arquivo de pregações.
- Temas e resumos de mensagens.
- Pregadores e datas.
- Estudos bíblicos.
- Registros de ceias.
- Eventos, congressos e conferências.
- Documentos e conteúdos históricos.

**Exemplo de uso:** uma pessoa poderia procurar uma mensagem pregada em uma ceia anterior e consultar seu tema, resumo, pregador e referências bíblicas.

O acervo deverá permitir pesquisas por **data, tema, pregador** e outras informações relevantes.

### 2.4. Gestão e administração

Centralização da estrutura organizacional da igreja:

- Cadastro de pessoas.
- Ministérios e departamentos.
- Cargos e funções.
- Responsáveis por atividades.
- Usuários e permissões.
- Documentos administrativos.
- Configurações gerais.

### 2.5. Gestão financeira

Módulo **restrito** à tesouraria e a pessoas autorizadas:

- Entradas.
- Saídas.
- Dízimos e ofertas, quando aplicável.
- Categorias financeiras.
- Controle de caixa.
- Saldo.
- Relatórios.
- Prestação de contas.
- Histórico de movimentações.

✅ **Definido:** o módulo financeiro deverá ter controles de segurança, rastreabilidade e permissões específicas.

---

## 3. Módulos funcionais previstos

> ❓ **Em aberto:** a lista definitiva de módulos ainda não foi fechada. Os módulos abaixo são os previstos até agora.

### Louvor

- Cadastro de grupos e integrantes.
- Cadastro de instrumentos e funções.
- Organização de equipes.
- Escalas por culto.
- Disponibilidade dos músicos.
- Confirmação de participação.
- Substituição de integrantes.
- Cadastro de músicas.
- Repertórios por culto.
- Tons, cifras, letras e links de referência.
- Histórico de escalas e repertórios.

### Cultos

- Cadastro e programação de cultos.
- Datas e horários.
- Responsáveis.
- Direção.
- Organização das atividades.
- Integração com as escalas dos ministérios.

### Pregações

- Cadastro de pregadores.
- Escalas de pregação.
- Temas.
- Referências bíblicas.
- Resumos das mensagens.
- Histórico e pesquisa no acervo.

### Ministério Kids

- Cadastro de professores e auxiliares.
- Turmas.
- Organização das aulas.
- Escalas.
- Responsáveis.
- Registros necessários para o funcionamento do ministério.

✅ **Definido:** deverá existir atenção especial à **privacidade e à proteção de dados de crianças**.

### Pessoas e ministérios

- Cadastro de integrantes.
- Departamentos e ministérios.
- Cargos.
- Funções.
- Responsáveis.
- Vinculação de pessoas aos ministérios.

### Administração

- Gestão de usuários.
- Configuração de cargos.
- Permissões.
- Comunicados.
- Documentos.
- Configurações do sistema.

### Funcionalidades compartilhadas

- Dashboard personalizado.
- Calendário central.
- Notificações e avisos.
- Confirmações de escalas.
- Histórico de atividades.
- Compartilhamento de informações.
- Pesquisa geral.

### Integração entre módulos

Todos os módulos deverão compartilhar informações quando fizer sentido.

**Exemplo:** um culto poderá reunir sua programação, a equipe de louvor, o repertório, o pregador e a equipe do Kids.

---

## 4. Cargos, responsabilidades e permissões

A gestão de acesso é **um dos pontos mais importantes do projeto**.

### Três conceitos distintos

| Conceito | O que é | Exemplos |
|---|---|---|
| **Cargo** | Posição da pessoa na organização da igreja. | Pastor, tesoureiro, líder de louvor, professor, integrante. |
| **Responsabilidade** | Aquilo pelo qual a pessoa responde. | Organizar escalas, cadastrar repertórios, administrar o Kids. |
| **Permissão** | Aquilo que a pessoa pode executar no sistema. | Visualizar, cadastrar, editar, excluir, administrar. |

### Comportamento esperado

Os administradores deverão conseguir definir **quais pessoas podem acessar cada módulo** e **quais operações podem realizar**.

Exemplos:

- Um músico consulta suas escalas, mas não consegue editar as escalas gerais.
- Um líder de louvor administra seu ministério.
- Um tesoureiro administra movimentações financeiras.
- Um pastor pode consultar informações gerais autorizadas.
- Um administrador gerencia usuários e configurações.

✅ **Definido:** as permissões deverão ser aplicadas **também no backend e no banco de dados**, não apenas na interface.

❓ **Em aberto:** a estrutura definitiva de cargos e permissões.

---

## 5. Experiência do usuário e interface

O IEJB Hub deverá ter **aparência e experiência de um aplicativo real**.

### Características desejadas

- Interface moderna e profissional.
- Design responsivo.
- Excelente experiência mobile.
- Instalação como PWA (obrigatória no celular, ver seção 13.11).
- Navegação organizada por módulos.
- Dashboard personalizado conforme o usuário.
- Menu lateral ou estrutura de navegação equivalente.
- Central de notificações.
- Área pessoal.
- Atalhos para compromissos e atividades.
- Interface simples para pessoas com pouca familiaridade tecnológica.

### Identidade

A proposta **não** é criar uma interface administrativa genérica. A identidade visual deverá transmitir a personalidade da IEJB e manter consistência em todos os módulos.

❓ **Em aberto:** o design final.

### Relação com o WhatsApp

O WhatsApp continuará sendo útil como canal de comunicação. O Hub deverá funcionar como **fonte organizada e confiável** das informações e compromissos, sem necessariamente tentar substituir as conversas.

---

## 6. Arquitetura e tecnologias consideradas

### Relação com o site institucional

✅ **Definido:** o site institucional já existe e deverá **continuar funcionando independentemente** do novo sistema.

| Endereço | Uso | Status |
|---|---|---|
| `iejb.com.br` | Site institucional | Em produção |
| `app.iejb.com.br` | IEJB Hub | ✅ Definido |

### Repositório

✅ **Definido:** repositório independente e privado, `iejb-hub`.

### Stack inicialmente considerada

| Camada | Opção considerada | Status |
|---|---|---|
| Front-end | Vite com JavaScript puro em módulos, sem framework na v1 (escolha delegada por Kaique, ver registro de decisões técnicas). | ✅ **Definido** |
| Backend | Supabase | ✅ **Definido** |
| Banco de dados | PostgreSQL | ✅ **Definido** |
| Autenticação | Supabase Auth | ✅ **Definido** |
| Segurança | Políticas RLS (Row Level Security) | ✅ **Definido** |
| Hospedagem | Cloudflare (Workers com arquivos estáticos) | ✅ **Definido** |
| Versionamento | GitHub | ✅ **Definido** |
| Domínio | Subdomínio `app.iejb.com.br` | ✅ **Definido** |

> As decisões técnicas e seus motivos estão no [registro de decisões técnicas](REGISTRO-DE-DECISOES-TECNICAS.md).

### Custos de infraestrutura

✅ **Definido** (Kaique, 13/11/2026): utilizar os planos gratuitos dos serviços, sem assumir custos adicionais de infraestrutura durante o planejamento e o desenvolvimento, respeitando os limites e condições de cada serviço. O plano gratuito do Supabase pausa o projeto por inatividade e não tem backup; as mitigações estão no registro de decisões técnicas (DT-06).

---

## 7. Modelo financeiro inicialmente imaginado

> 💡 **Proposto, sujeito a conversa e aprovação da liderança da IEJB.**

O sistema será desenvolvido inicialmente para **uso exclusivo da IEJB**.

Existe a possibilidade de estabelecer um modelo de manutenção mensal após a implantação.

### Proposta inicial

| Item | Condição |
|---|---|
| Implantação | Gratuita |
| Período de testes e adaptação | 2 meses gratuitos |
| Mensalidade (após os 2 meses) | A definir com a liderança |

A mensalidade contemplaria: utilização, hospedagem, manutenção, correções, atualizações, backups e suporte básico.

### Propriedade dos dados

✅ **Definido:** os dados **pertencem à igreja** e deverão ter possibilidade de exportação.

---

## 8. Problemas que o IEJB Hub pretende resolver

- Informações espalhadas em conversas, planilhas e documentos.
- Dificuldade de consultar programações e compromissos.
- Falta de centralização das escalas.
- Dificuldade em organizar substituições e confirmações.
- Falta de histórico de atividades.
- Dificuldade em recuperar informações de pregações e eventos antigos.
- Dependência de pessoas específicas para encontrar informações.
- Falta de clareza sobre responsabilidades.
- Dificuldade em controlar permissões e acessos.
- Retrabalho administrativo.
- Falta de centralização de informações financeiras.

---

## 9. Benefícios esperados

- Centralização das informações.
- Melhor organização dos ministérios.
- Facilidade de comunicação.
- Economia de tempo.
- Melhor distribuição de responsabilidades.
- Maior previsibilidade na organização dos cultos.
- Facilidade de consulta às escalas.
- Preservação da memória institucional.
- Maior controle administrativo.
- Melhor acompanhamento financeiro.
- Continuidade das informações mesmo quando os responsáveis mudarem.

---

## 10. Etapas previstas

> ❓ **Em aberto:** o cronograma de desenvolvimento ainda não foi definido. A sequência abaixo é a ordem prevista, sem datas.

1. Planejamento e levantamento das necessidades com a liderança.
2. Definição de requisitos e regras de negócio.
3. Planejamento do banco de dados e das permissões.
4. Desenvolvimento do MVP.
5. Testes com usuários reais da IEJB.
6. Expansão dos módulos.
7. Implantação definitiva.
8. Dois meses de utilização gratuita para validação.
9. Possível início da mensalidade, mediante aprovação.

### Escopo da primeira versão (MVP)

✅ **Definido:** a primeira versão deverá priorizar (detalhado na [seção 13](#13-escopo-do-mvp-piloto-louvor), aplicado apenas ao ministério de Louvor):

- Autenticação.
- Pessoas.
- Ministérios.
- Cultos.
- Escalas.
- Repertórios.

✅ **Definido:** o módulo financeiro e outros módulos mais sensíveis poderão ser desenvolvidos **posteriormente**, com os cuidados necessários.

---

## 11. Registro de status

### ✅ Definido (premissas de Kaique, sujeitas à aprovação institucional)

| # | Item |
|---|---|
| D1 | Nome do projeto: **IEJB Hub**. |
| D2 | O Hub é uma plataforma da comunidade, dos ministérios e da liderança, não apenas um sistema de escalas. |
| D3 | O site institucional continua funcionando de forma independente do Hub. |
| D4 | Permissões aplicadas também no backend e no banco de dados, não só na interface. |
| D5 | Cargo, responsabilidade e permissão são conceitos distintos. |
| D6 | Módulo financeiro com segurança, rastreabilidade e permissões específicas. |
| D7 | Atenção especial à privacidade e à proteção de dados de crianças. |
| D8 | Os dados pertencem à igreja e devem poder ser exportados. |
| D9 | O WhatsApp continua como canal de conversa; o Hub é a fonte organizada das informações. |
| D10 | MVP prioriza autenticação, pessoas, ministérios, cultos, escalas e repertórios. |
| D11 | Financeiro e módulos sensíveis ficam para depois do MVP. |
| D12 | Uso inicial exclusivo da IEJB. |
| D13 | O MVP é um piloto restrito ao ministério de Louvor. |
| D14 | Acesso inicial apenas para integrantes do Louvor; a arquitetura já deve prever a comunidade inteira, liberada por etapas. |
| D15 | Repositório do Hub privado durante o planejamento; pode ficar público depois da aprovação. |
| D16 | Substituições não têm fluxo próprio no MVP: são combinadas pessoalmente e o líder de louvor atualiza a escala no Hub. |
| D17 | No celular, o Hub só é usado instalado como PWA; no computador, funciona no navegador sem exigir instalação. |
| D18 | Avisos de mudança do líder de louvor: notificação push como canal principal e mensagem pronta para o WhatsApp como reserva. |
| D19 | O Hub não envia e-mail. A conta é criada pelo administrador (senha temporária) ou solicitada pela pessoa e aprovada pelo administrador; senha esquecida é redefinida pelo administrador. |
| D20 | Backend e banco: Supabase (PostgreSQL, Supabase Auth, RLS). Motivos: não hospedar o backend por conta própria e custo zero. |
| D21 | Planos gratuitos dos serviços no piloto, com atividade programada e backup próprio para reduzir os riscos do plano gratuito. |
| D22 | Front-end: Vite com JavaScript puro em módulos, sem framework na v1 (escolha delegada por Kaique). |
| D23 | Login com Supabase Auth, sem e-mail: conta criada pelo administrador ou solicitada pela pessoa (cadastro aberto com confirmação de e-mail desligada) e aprovada por ele. A conta pendente não acessa nada. |
| D24 | Hospedagem no Cloudflare (Workers com arquivos estáticos, na conta da IEJB, deploy automático a cada push), código no GitHub, endereço `app.iejb.com.br`. O domínio está na mesma conta do Cloudflare. |
| D25 | Push com service worker próprio, chaves VAPID e função de servidor, com a mensagem de WhatsApp como reserva. |
| D26 | Músicas nas plataformas de streaming sem integração de conta: cada música do repertório tem botões "Ouvir no Spotify / YouTube Music / Apple Music" que abrem a busca da plataforma com título e artista, e o culto tem "Tocar o repertório no YouTube", que monta a fila na ordem do repertório com os links do YouTube das músicas (endereço `youtube.com/watch_videos?video_ids=`). Sem criar playlist nas contas das pessoas e sem campo de playlist do culto. Motivos: a API do Spotify em modo de desenvolvimento aceita só 5 usuários e exige Premium do dono; a da Apple exige conta paga de desenvolvedor. Risco aceito: o endereço do YouTube não é oficial; se parar, os botões por música continuam. Entra na tela de montar repertório. |
| D27 | No celular, a instalação como PWA vem antes do login, porque no iPhone o app da tela de início não enxerga a sessão do Safari. O app guarda no aparelho a última escala vista, para abrir sem internet, e apaga essa cópia ao sair da conta. |
| D28 | Toda a gestão de pessoas e acessos é feita pelo próprio Hub, na tela Equipe: aprovar ou recusar pedidos, cadastrar e desativar pessoas, criar acesso com senha temporária, redefinir senha, desligar acesso, tornar administrador, marcar líder de louvor e montar os grupos. Criar acesso e redefinir senha usam uma função de servidor do Supabase (`admin-acesso`), a única parte que tem a chave de serviço. |
| D29 | Montagem da escala espelha a planilha atual do líder: o mês é formado pelas semanas que começam nele; o grupo é escolhido por semana (vale para domingo e terça) e pode ser trocado culto a culto; cada culto tem a **Mesa** (quem opera o som), registrada como uma pessoa da escala com a função "Mesa"; culto pode ter o rótulo **Ceia**; e o resumo do mês sai em texto para o WhatsApp, no lugar do PDF. Veio da planilha de novembro/2026 (a confirmar com o líder de louvor, A12). |
| D32 | (Q23) O líder de grupo ajusta sozinho pessoas e instrumentos nos cultos publicados do grupo dele; o líder de louvor é avisado de cada ajuste, com o nome de quem mudou. Mesa, grupo do culto, cancelar e publicar seguem com o líder de louvor. O pedido de alteração (RN-37 a 39 antigas) saiu do app. **Inverte a Q2 e a RN-44; precisa ser confirmado com o líder de louvor (A12).** |
| D31 | Push implementado sem ninguém manusear a chave privada: a função de servidor gera as chaves VAPID na primeira vez e as guarda numa tabela que só o servidor lê. Envio a cada minuto pelo agendador do banco, só quando há aviso pendente. Um agendamento diário no GitHub mantém o Supabase acordado (D21). |
| D30 | Fotos de perfil comprimidas no próprio aparelho (~25 KB) e guardadas no Storage do Supabase com limite de 200 KB por arquivo, cache de um ano e nome novo a cada troca. Com cerca de 13 pessoas o uso fica muito abaixo do plano gratuito. |

### 💡 Proposto

| # | Item |
|---|---|
| P7 | Implantação gratuita, 2 meses de teste e mensalidade a definir. |

### ❓ Em aberto

| # | Item |
|---|---|
| A2 | Design final. |
| A3 | Lista definitiva de módulos. |
| A4 | Quais pessoas terão contas. |
| A5 | Quando e com que conteúdo a comunidade inteira passa a ter acesso (a v1 é só Louvor, ver D14). |
| A6 | Estrutura definitiva de cargos e permissões. |
| A7 | Regras específicas de cada ministério. |
| A8 | Funcionalidades prioritárias. |
| A9 | Modelo financeiro e mensalidade. |
| A10 | Aprovação institucional. |
| A11 | Cronograma de desenvolvimento. |
| A12 | Confirmação das regras do piloto Louvor com o líder de louvor (documento de regras de negócio). |

---

## 12. Diretriz principal do projeto

> **O IEJB Hub deve ser uma ferramenta que facilite o trabalho das pessoas que servem na igreja, e não crie mais uma obrigação para elas.**

A prioridade é desenvolver uma solução **útil, acessível, confiável e realmente alinhada à rotina da IEJB**.

---

## 13. Escopo do MVP: piloto Louvor

### 13.1. Decisão

✅ **Definido:** o MVP começa por **um único ministério, o Louvor**, usado de verdade de ponta a ponta antes de expandir.

Os itens de prioridade da seção 10 (autenticação, pessoas, ministérios, cultos, escalas e repertórios) continuam valendo, mas **apenas no recorte do Louvor**. Os outros ministérios e a comunidade entram em etapas seguintes.

✅ **Definido:** na primeira versão, só os integrantes do Louvor têm conta. O modelo de cadastro e de permissões já deve ser pensado para a comunidade inteira, para que a expansão não exija refazer a base.

**Motivo:** abrir para toda a comunidade com conteúdo só do Louvor faria a maioria das pessoas encontrar um app vazio, além de aumentar cadastro, suporte e responsabilidade com dados pessoais antes de qualquer validação.

### 13.2. Como funciona hoje (processo atual)

| Etapa | Como é feito hoje |
|---|---|
| Estrutura | O Louvor tem **3 grupos: G1, G2 e G3**. |
| Montagem da escala | Feita **exclusivamente pelo líder de louvor**, em uma planilha. |
| Divulgação da escala | O líder envia um **PDF da planilha pelo WhatsApp**. |
| Substituição | Quem não pode tocar **combina pessoalmente** com outra pessoa para substituí-la. |
| Repertório | Escolhido pelo **líder de cada grupo**. |
| Cifras | **Não há** cifra compartilhada. |
| Tamanho | Cerca de **13 integrantes**. |

### 13.3. Dores observadas no processo atual

- A escala é um PDF: não dá para cada pessoa ver só os seus compromissos, e qualquer mudança exige gerar e reenviar o arquivo.
- As substituições são combinadas em conversa e não ficam registradas, então a escala oficial pode não refletir quem realmente vai tocar. (Aceito no MVP, ver 13.6.)
- O repertório e as cifras não têm um lugar comum.
- Todo o conhecimento da escala depende do líder de louvor.

### 13.4. Perguntas em aberto sobre o Louvor

Precisam ser respondidas, de preferência com o líder de louvor, antes de definir as regras de negócio. As primeiras respostas estão na [seção 13.7](#137-respostas-do-levantamento).

1. Como os grupos G1, G2 e G3 se revezam (rodízio fixo, por culto, por semana)?
2. Cada integrante pertence a um único grupo ou pode tocar em mais de um?
3. Quais cultos têm louvor escalado?
4. Quem são os líderes de grupo e o que cada um pode editar, em relação ao líder de louvor?
5. Como o repertório é definido e quando chega aos músicos? O tom muda por culto?
6. Quantas pessoas fazem parte do Louvor?
7. O líder de louvor topa usar o Hub no lugar da planilha?

### 13.5. Critério de sucesso do piloto

💡 **Proposto:** o piloto funciona se o líder de louvor conseguir montar e publicar a escala no Hub **com menos esforço do que na planilha atual**, e os integrantes passarem a consultar a escala por lá. Se o Hub der mais trabalho que a planilha, ele contraria a diretriz principal da seção 12.

### 13.6. Fora do escopo do MVP

✅ **Definido:** **substituições** não terão fluxo próprio no MVP (sem pedido nem aceite do substituto no Hub). Elas continuam sendo combinadas pessoalmente entre os integrantes, como hoje.

**Motivo:** manter o piloto simples.

✅ **Definido:** quando o líder de louvor souber de uma troca, ele **atualiza a escala no Hub** (ver 13.12).

**Risco conhecido:** se a troca não chegar ao líder de louvor, a escala mostra quem não vai tocar.

### 13.7. Respostas do levantamento

> **Fonte:** respostas de Kaique em 13/11/2026, como integrante do Louvor. **Ainda precisam ser confirmadas com o líder de louvor.**

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Revezamento dos grupos | Geralmente **um grupo por culto**. |
| 2 | Integrante em mais de um grupo | **Sim.** O G2 e o G3 têm integrantes em comum. |
| 3 | Cultos com louvor escalado | **Todos.** |
| 4 | Poder dos líderes de grupo | Podem mudar praticamente tudo. (A parte sobre avisos foi esclarecida na seção 13.10.) |
| 5 | Repertório | Os líderes de grupo escolhem e enviam no **grupo do WhatsApp**. Resposta sobre o tom mudar por culto ficou ambígua. |
| 6 | Quantidade de integrantes | Cerca de 13 (respondido depois, ver 13.10). |
| 7 | Líder de louvor usaria o Hub? | **Sim** (ver 13.10). |

**Cultos semanais publicados no site institucional** (referência, em 13/11/2026):

| Dia | Horário | Nome |
|---|---|---|
| Domingo | 09:00 | EBD |
| Domingo | 18:00 | Culto da Família |
| Terça | 19:30 | Culto de Oração |

### 13.8. Segunda rodada de respostas

> **Fonte:** Kaique, 13/11/2026. A confirmar com o líder de louvor.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | A EBD tem louvor? | **Não.** Os cultos com louvor são o Culto da Família e o Culto de Oração, além de cultos especiais. |
| 2 | Grupo fixo ou rodízio? | **Flexível:** o líder de louvor decide a cada culto. Não há rodízio automático. |
| 3 | Exceções ao "um grupo por culto" | Em **cultos especiais** os grupos podem se **mesclar**. O líder decide. |
| 4 | Como os líderes de grupo avisam mudanças? | **Não avisam.** |
| 5 | O tom muda por culto? | **Pode mudar.** |

✅ **Esclarecido (ver 13.10):** não havia contradição. "Tudo é avisado" se refere às mudanças do **líder de louvor**, que são comunicadas aos líderes e integrantes. "Não avisam" se refere aos líderes de grupo, que não reportam mudanças ao líder de louvor.

### 13.9. O que as respostas indicam para o modelo

💡 **Proposto** (a validar nas regras de negócio):

- **Pessoa x grupo é muitos para muitos:** uma pessoa pode estar em vários grupos (caso do G2 e G3).
- **A escala é de pessoas, e o grupo é um atalho:** o líder escolhe um grupo para preencher a escala de um culto rapidamente, mas o que fica registrado são as pessoas escaladas. Assim cabem os cultos normais (um grupo), os especiais (grupos mesclados) e ajustes individuais, sem regras separadas para cada caso.
- **Sem rodízio automático:** a escolha do grupo é manual, culto a culto, como o líder já faz hoje.
- **Cultos com louvor:** apenas os cultos marcados como tendo louvor entram na escala (a EBD fica de fora).
- **O tom pertence ao repertório do culto, não à música:** a mesma música pode ter tons diferentes em cultos diferentes.
- **Dois níveis de liderança:** líder de louvor e líderes de grupo.
- **Mudanças do líder de louvor precisam chegar às pessoas afetadas.** Mudanças dos líderes de grupo não precisam ser reportadas para cima.
- **Volume pequeno:** cerca de 13 integrantes, bem dentro dos limites dos planos gratuitos considerados.

### 13.10. Terceira rodada de respostas

> **Fonte:** Kaique, 13/11/2026.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Avisos de mudança | Tudo que o **líder de louvor** muda é avisado aos líderes e integrantes. Os líderes de grupo não reportam mudanças ao líder de louvor. |
| 2 | O líder de louvor usaria o Hub no lugar da planilha? | **Sim.** |
| 3 | Quantidade de integrantes | Cerca de **13 pessoas**. |

### 13.11. PWA e notificações

✅ **Definido:**

- **Celular:** o Hub precisa estar **instalado como PWA**. Se for aberto pelo navegador do celular, mostra uma tela com o passo a passo de instalação (iPhone e Android).
- **Computador:** funciona **no navegador**, sem exigir instalação.
- **Avisos de mudança do líder de louvor:** **notificação push** como canal principal, e o Hub gera uma **mensagem pronta para o WhatsApp** como reserva.

**Motivo da instalação obrigatória no celular:** no iPhone, notificações push só funcionam em web apps adicionados à tela de início. Com cerca de 13 integrantes, a instalação pode ser feita com cada pessoa, por exemplo em um ensaio.

**Motivo da reserva no WhatsApp:** a pessoa pode negar a permissão de notificação, desativá-la no sistema ou trocar de aparelho. Sem um canal de reserva, o aviso não chegaria e ninguém saberia.

**Impacto no escopo do MVP:** o push adiciona uma frente própria ao MVP: tratamento de push no service worker, chaves VAPID, registro das inscrições de cada aparelho e uma função no backend para disparar as notificações.

### 13.12. Quarta rodada de respostas

> **Fonte:** Kaique, 13/11/2026. As regras derivadas estão no [documento de regras de negócio](REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md).

| # | Pergunta | Resposta |
|---|---|---|
| Q4 | Algum grupo tem mais de um líder? | Não. |
| Q5 | A escala mostra o instrumento de cada pessoa? | Sim. |
| Q6 | O integrante vê só a própria escala ou todas? | Todas. |
| Q7 | O aviso de mudança vai para quem? | Para os afetados. |
| Q8 | Em culto com grupos mesclados, quem escolhe o repertório? | Os líderes dos grupos, em conjunto. |
| Q9 | A ordem das músicas importa? | Sim. |
| Q10 | Mudança no repertório avisa? | Sim. |
| Q11 | Em troca combinada, o líder atualiza a escala no Hub? | Sim. |

### 13.13. Quinta rodada de respostas

> **Fonte:** Kaique, 13/11/2026. As regras derivadas estão no [documento de regras de negócio](REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md).

| # | Pergunta | Resposta |
|---|---|---|
| Q12 | Como a pessoa recebe acesso e recupera a senha sem e-mail? | O administrador cria a conta com senha temporária, ou a pessoa solicita com nome e senha e o administrador aprova. |
| Q13 | Quem edita o repertório de culto só com avulsos? | Líder de louvor e administrador. |
| Q14 | Quem são os "afetados" no aviso? | Quem entrou, saiu ou continua escalado. |
| Q15 | O líder de grupo mexe nos membros do próprio grupo? | "Os dois": líder de grupo (só o próprio grupo) e líder de louvor/admin. Leitura confirmada. |
| Q16 | Uma pessoa pode ter mais de um instrumento? | Sim; na escala aparece o que o líder do grupo definir (por vínculo pessoa + grupo). Leitura confirmada. |
| Q17 | Como o líder de louvor fica sabendo de uma troca? | Aviso simples e informal, sem regra. |

### 13.14. Sexta rodada de respostas

> **Fonte:** Kaique, 13/11/2026. Surgiram durante o [modelo de dados](MODELO-DE-DADOS-E-PERMISSOES-PILOTO-LOUVOR.md) (etapa 3).

| # | Pergunta | Resposta |
|---|---|---|
| Q19 | Quem tem mais de um instrumento aparece com todos, ou varia por culto? | Varia por culto: padrão por grupo (ex.: bateria no G2, violão e canto no G3), ajustável em cada culto. |
| Q20 | O líder de grupo pede alteração em qual culto? | Só nos cultos do próprio grupo. |
| Q21 | Quando o líder de grupo edita o repertório? | Depois da escala, quando ele quiser. |
| Q22 | Integrantes veem o contato uns dos outros? | Sim. |

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 13/11/2026 | Registro inicial da visão do IEJB Hub. |
| 0.2 | 13/11/2026 | Piloto Louvor como MVP, acesso inicial restrito ao Louvor, repositório privado e levantamento do processo atual. |
| 0.3 | 13/11/2026 | Substituições fora do MVP; repositório `iejb-hub` criado. |
| 0.4 | 13/11/2026 | Primeiras respostas do levantamento do Louvor, implicações para o modelo e novas perguntas. |
| 0.5 | 13/11/2026 | Segunda rodada: EBD sem louvor, escala flexível, grupos mesclados em cultos especiais, tom por culto e contradição sobre avisos. |
| 0.6 | 13/11/2026 | Terceira rodada: avisos esclarecidos, líder de louvor usaria o Hub, cerca de 13 integrantes. Levantamento inicial do Louvor concluído. |
| 0.7 | 13/11/2026 | PWA obrigatório no celular (não no computador), push como canal principal e WhatsApp como reserva. |
| 0.8 | 13/11/2026 | Quarta rodada: líder de louvor atualiza a escala em trocas, aviso só aos afetados, escala visível a todos e repertório pelos líderes dos grupos. |
| 0.9 | 13/11/2026 | Quinta rodada: acesso sem e-mail com aprovação do administrador (D19), repertório em culto só com avulsos, afetados, membros do grupo e instrumento por vínculo. |
| 1.0 | 13/11/2026 | Q15 e Q16 confirmadas. Regras do piloto Louvor sem questões em aberto, a confirmar com o líder de louvor. |
| 1.1 | 13/11/2026 | Sexta rodada (Q19 a Q22), vinda do modelo de dados da etapa 3. |
| 1.2 | 13/11/2026 | Decisões técnicas: Supabase, planos gratuitos e front-end com Vite e JavaScript puro (D20 a D22). Registro de decisões técnicas criado. |
| 1.3 | 13/11/2026 | Aprovadas as recomendações de login, hospedagem e push (D23 a D25). Stack do piloto fechada. |
| 2.0 | 14/11/2026 | D32: o líder de grupo ajusta a escala com autonomia e o líder de louvor é avisado; o pedido de alteração saiu. |
| 1.9 | 14/11/2026 | Pedido de alteração do líder de grupo e decisão do líder de louvor (RN-37 a 39); mensagem de WhatsApp de uma mudança (RN-43). Todas as regras do piloto Louvor têm tela. |
| 1.8 | 14/11/2026 | Avisos por push (D31) e o "mantenha acordado" diário. |
| 1.7 | 14/11/2026 | Repertório implementado como na D26: ouvir nas plataformas, tocar no YouTube em sequência, editor para líderes de grupo. |
| 1.6 | 14/11/2026 | Tela de montar escala (D29), com mesa de som e ceia vindas da planilha do líder, e fotos de perfil (D30). |
| 1.5 | 14/11/2026 | App publicado em `app.iejb.com.br` (Cloudflare Workers, D24 atualizada). Tela Equipe com gestão completa de pessoas e acessos (D28). |
| 1.4 | 13/11/2026 | Desenvolvimento começou. Músicas nas plataformas de streaming por botões e fila do YouTube, sem playlist (D26). PWA antes do login e escala offline (D27). |
