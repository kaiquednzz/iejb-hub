# IEJB Hub: Visão Geral do Projeto

| Campo | Valor |
|---|---|
| **Nome** | IEJB Hub |
| **Instituição** | IEJB, Igreja Evangélica do Jardim Brasil |
| **Responsável pelo projeto e desenvolvimento** | Kaique |
| **Status** | Em planejamento. Sem aprovação institucional definitiva e sem início de desenvolvimento. |
| **Versão deste documento** | 0.4 (primeiras respostas sobre o Louvor) |
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
- Possibilidade de instalação como PWA.
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
| `app.iejb.com.br` | IEJB Hub | 💡 Proposto |

### Repositório

✅ **Definido:** repositório independente e privado, `iejb-hub`.

### Stack inicialmente considerada

| Camada | Opção considerada | Status |
|---|---|---|
| Front-end | HTML, CSS e JavaScript são possibilidades. React também está sendo considerado. | ❓ **Em aberto** |
| Backend | Supabase | 💡 Proposto |
| Banco de dados | PostgreSQL | 💡 Proposto |
| Autenticação | Supabase Auth | 💡 Proposto |
| Segurança | Políticas RLS (Row Level Security) | 💡 Proposto |
| Hospedagem | Cloudflare Pages | 💡 Proposto |
| Versionamento | GitHub | 💡 Proposto |
| Domínio | Subdomínio `app.iejb.com.br` | 💡 Proposto |

> ⚠️ Nenhuma tecnologia de front-end deve ser tratada como decisão definitiva.

### Custos de infraestrutura

💡 **Proposto:** utilizar os planos gratuitos dos serviços, sem assumir custos adicionais de infraestrutura durante o planejamento e o desenvolvimento, respeitando os limites e condições de cada serviço.

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
| D16 | Substituições ficam fora do MVP: continuam sendo combinadas pessoalmente, sem registro no Hub. |

### 💡 Proposto

| # | Item |
|---|---|
| P1 | Endereço `app.iejb.com.br` para o Hub. |
| P3 | Supabase (PostgreSQL, Supabase Auth, RLS) como backend. |
| P4 | Hospedagem no Cloudflare Pages e versionamento no GitHub. |
| P5 | Uso dos planos gratuitos dos serviços. |
| P6 | Instalação como PWA. |
| P7 | Implantação gratuita, 2 meses de teste e mensalidade a definir. |

### ❓ Em aberto

| # | Item |
|---|---|
| A1 | Tecnologia do front-end. |
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
| A12 | Regras do Louvor listadas na seção 13.4. |

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
| Tamanho | Quantidade de integrantes ainda não levantada. |

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

✅ **Definido:** **substituições** não serão tratadas no MVP. Elas continuam sendo combinadas pessoalmente entre os integrantes, como hoje.

**Motivo:** manter o piloto simples.

**Consequência conhecida:** quando houver uma troca, a escala no Hub vai mostrar quem foi escalado originalmente, não quem vai tocar de fato.

❓ **Em aberto:** se o líder de louvor vai ajustar a escala no Hub quando souber de uma troca, ou se a escala fica como a original.

### 13.7. Respostas do levantamento

> **Fonte:** respostas de Kaique em 13/11/2026, como integrante do Louvor. **Ainda precisam ser confirmadas com o líder de louvor.**

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Revezamento dos grupos | Geralmente **um grupo por culto**. |
| 2 | Integrante em mais de um grupo | **Sim.** O G2 e o G3 têm integrantes em comum. |
| 3 | Cultos com louvor escalado | **Todos.** |
| 4 | Poder dos líderes de grupo | Podem mudar praticamente tudo, mas **toda mudança é avisada** ao líder de louvor. |
| 5 | Repertório | Os líderes de grupo escolhem e enviam no **grupo do WhatsApp**. Resposta sobre o tom mudar por culto ficou ambígua. |
| 6 | Quantidade de integrantes | Não sabe. |
| 7 | Líder de louvor usaria o Hub? | Não respondida. Só o próprio líder pode responder. |

**Cultos semanais publicados no site institucional** (referência, em 13/11/2026):

| Dia | Horário | Nome |
|---|---|---|
| Domingo | 09:00 | EBD |
| Domingo | 18:00 | Culto da Família |
| Terça | 19:30 | Culto de Oração |

### 13.8. O que as respostas já indicam para o modelo

💡 **Proposto** (a validar nas regras de negócio):

- Uma pessoa pode pertencer a **vários grupos**, então a relação pessoa x grupo é de muitos para muitos.
- A escala é montada principalmente **por grupo** ("o G2 toca neste culto"), mas a palavra "geralmente" indica exceções, então pode ser preciso ajustar pessoas individualmente.
- Existem **dois níveis de liderança** no Louvor: o líder de louvor e os líderes de grupo, que podem editar e cujas mudanças precisam chegar ao líder de louvor.
- O **repertório pertence ao culto e é definido pelo líder do grupo** escalado.

### 13.9. Novas perguntas

1. A EBD também tem louvor escalado, ou "todos" se refere aos cultos?
2. O grupo é fixo por culto (ex.: G1 sempre no domingo à noite) ou roda entre os cultos?
3. Em que situações sai do "um grupo por culto" (dois grupos juntos, grupo misto, eventos especiais)?
4. Hoje, como os líderes de grupo avisam o líder de louvor das mudanças?
5. O tom das músicas muda de um culto para outro?

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| 0.1 | 13/11/2026 | Registro inicial da visão do IEJB Hub. |
| 0.2 | 13/11/2026 | Piloto Louvor como MVP, acesso inicial restrito ao Louvor, repositório privado e levantamento do processo atual. |
| 0.3 | 13/11/2026 | Substituições fora do MVP; repositório `iejb-hub` criado. |
| 0.4 | 13/11/2026 | Primeiras respostas do levantamento do Louvor, implicações para o modelo e novas perguntas. |
