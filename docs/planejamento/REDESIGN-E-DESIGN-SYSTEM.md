# IEJB Hub: Redesign e Design System

Status: **v1 implementada** em 17/11/2026; **v2 (identidade) implementada** em 20/11/2026, ver seção 13. As cinco decisões da proposta foram aprovadas pelo Kaique ("permito tudo"). Ver seção 9 (decisões), 11 (o que foi feito) e 12 (o que ficou para depois).
Decisão registrada como **D66** em `VISAO-GERAL-IEJB-HUB.md`.
Direção: Editorial + Institucional moderno + Minimalismo.
Restrições: não remove funcionalidades, não muda regras de negócio nem permissões, preserva a identidade da IEJB (vermelho institucional, creme, Playfair Display).

---

## 1. Diagnóstico do código (antes do redesign)

### Estrutura
- App em Vite + JS puro (`app/src`), ~11,4 mil linhas. Telas em `telas/`, estilos em 12 arquivos CSS em `estilo/` (~4 mil linhas).
- Tokens em `estilo/tokens.css`, copiados do site: cores da marca, vidro, 3 sombras, 3 raios, curvas de movimento.
- Navegação:
  - **Celular:** cápsula de vidro flutuante no topo (logo, selo "Admin", botão Sair). Abas embaixo **só dentro do Louvor** (Escala, Montar, Repertórios, Equipe). As outras áreas (Eventos, Financeiro, Pessoas) só se abriam pelo Início.
  - **Computador (>= 1024 px):** barra lateral com todos os módulos, conta e Sair.
- Início: data, saudação, cartão vermelho "Seu próximo compromisso", contagem a conferir, avisos do admin, faixa horizontal "Vem aí", grade de módulos (inclui "Em breve"), rodapé.

### O que os números mostravam (medido no CSS)
| Item | Antes | Problema |
|---|---|---|
| Tamanhos de fonte | **26** valores diferentes (10 a 44 px, mais 3 `clamp`) | Não existia escala. Cada tela inventava a sua. |
| Raios de borda | **23** valores diferentes | Os tokens tinham 3, mas quase ninguém usava. |
| Sombras | 83 declarações, 25 com valor cru | Sombra em quase tudo. Nada se destacava porque tudo flutuava. |
| Cores soltas (hex/rgba fora dos tokens) | **123** | Mudar um tom exigia caçar arquivo por arquivo. |
| Espaçamentos | 30+ valores (1, 3, 5, 7, 9, 15, 22, 26 px...) | Sem grade. Ritmo vertical irregular. |
| `backdrop-filter` | 18 usos | Vidro custa GPU e só faz sentido onde há conteúdo passando por trás. |

### Problemas de UX na tela inicial
1. **Sair no lugar mais nobre.** O canto superior direito, o ponto mais tocado, tinha uma ação destrutiva e rara.
2. **Selo "Admin" no cabeçalho.** Informava algo que o usuário já sabia e não levava a lugar nenhum.
3. **Data repetida no cartão de compromisso.** O bloco "DOM 22 NOV" e o título "Domingo, 22 de nov. · 18h" diziam a mesma coisa; o nome do culto ficava pequeno.
4. **"Vem aí" cortava conteúdo.** A faixa horizontal mostrava "Cult..." cortado. Rolagem lateral escondida é pouco descobrível para os mais velhos.
5. **Sem navegação global no celular.** Do Início não dava para ir direto à Escala.
6. **"Em breve" ocupava tanto espaço quanto o que funciona.**
7. **Cabeçalho flutuante grande** (~120 px de altura).
8. **Hierarquia tipográfica achatada.**
9. **Zoom desligado** (`user-scalable=no`): risco de acessibilidade para o público idoso (WCAG 1.4.4).

### O que já estava bom e ficou
- Esqueletos de carregamento, cópia offline da escala, regiões `aria-live`, anel de foco, link "pular para o conteúdo", `prefers-reduced-motion`, modo leve.
- Folhas (`<dialog>`), toque nos ícones, comemoração, animação dos blocos que expandem.
- Paleta da marca e Playfair Display.

---

## 2. Princípios de design

1. **Uma coisa importante por tela.** Cada tela tem um único destaque (no Início: o próximo compromisso). O resto é lista calma.
2. **Editorial nos títulos, utilitário no resto.** Playfair só para títulos de tela e de destaque. Interface, rótulos, números e botões na fonte do sistema.
3. **Superfícies planas, bordas finas.** Separação por borda de 1 px e espaço, não por sombra. Sombra só no que realmente flutua: folha, toast.
4. **Vermelho é sinal, não fundo.** Ações principais, estado ativo e o único destaque da tela. Seleção (ex.: dia escolhido da semana) usa contorno vermelho, não bloco cheio.
5. **Legível antes de bonito.** Alvos de toque >= 44 px, contraste AA calculado (não estimado).
6. **Movimento com propósito.** Animação confirma uma ação ou mostra de onde algo veio. Nada fica em loop.

Referências de padrão (sem copiar identidade): Linear (listas calmas, estados vazios curtos), Vercel Geist (escala enxuta, bordas no lugar de sombras), Stripe (cartão de resumo com um título forte), Atlassian (tokens semânticos de status, padrões de vazio/erro).

---

## 3. Design System: tokens (`app/src/estilo/tokens.css`)

Três camadas:
1. **Primitivas** (`--vermelho-700`, `--creme-100`...): valores crus. Só usadas dentro de tokens.css.
2. **Semânticas** (`--cor-texto-2`, `--cor-perigo-sutil`...): o papel. Código novo usa só estas.
3. **Apelidos antigos** (`--principal`, `--sombra-1`, `--vidro-borda`...): apontam para os novos, para o código antigo continuar funcionando. Foi remapeando esses apelidos que o app inteiro ficou plano de uma vez (ex.: `--sombra-1` virou "sem sombra", `--vidro-borda` virou a borda creme). Não use em código novo.

### 3.1 Cores

**Primitivas**
| Token | Valor | Observação |
|---|---|---|
| `--vermelho-900` | `#500403` | era `--principal-escuro` |
| `--vermelho-800` | `#6E0908` | hover/pressionado |
| `--vermelho-700` | `#8F0D0B` | vermelho institucional (`--principal`) |
| `--vermelho-500` | `#BF262B` | era `--principal-brighter`; perigo e foco |
| `--vermelho-100` | `#F6E4E2` | fundo sutil da marca |
| `--vermelho-50` | `#FBF1EF` | hover de linha, perigo sutil |
| `--creme-50` | `#FDFAF5` | fundo do app |
| `--creme-100` | `#F6F0E8` | superfície rebaixada |
| `--creme-200` | `#EBE2D6` | borda |
| `--creme-300` | `#DCD0C2` | borda forte (tracejados) |
| `--creme-500` | `#9C8E80` | borda de campo (3,2:1 sobre branco) |
| `--tinta-900` | `#1F1513` | texto principal (preto quente) |
| `--tinta-700` | `#3A0A09` | vinho dos títulos |
| `--tinta-600` | `#5C5150` | texto secundário |
| `--tinta-400` | `#746967` | texto terciário (5,1:1 sobre o fundo) |
| `--verde-700` / `--verde-100` | `#1F7A4D` / `#E3F2EA` | sucesso |
| `--ambar-700` / `--ambar-100` | `#8A5200` / `#F8EBD6` | atenção |
| `--azul-700` / `--azul-100` | `#1D5A8C` / `#E3EEF8` | info |

**Semânticas**
| Token | Uso |
|---|---|
| `--cor-fundo` | fundo do app |
| `--cor-superficie` | cartões e linhas (#FFFFFF) |
| `--cor-superficie-rebaixada` | campos de busca, segmentos, bloco de data |
| `--cor-borda` / `--cor-borda-forte` | bordas de 1 px / tracejados de estado vazio |
| `--cor-borda-campo` | contorno de inputs (WCAG 1.4.11) |
| `--cor-texto` / `--cor-texto-2` / `--cor-texto-3` | hierarquia de texto |
| `--cor-titulo` | títulos em Playfair |
| `--cor-marca` / `--cor-marca-hover` / `--cor-marca-viva` | ação principal, item ativo |
| `--cor-marca-sutil` / `--cor-marca-sutil-2` | fundo de botão secundário, ícone de linha / hover de linha |
| `--cor-sobre-marca` | texto sobre vermelho |
| `--cor-sucesso`, `--cor-atencao`, `--cor-perigo`, `--cor-info` (+ `-sutil`) | status |
| `--cor-foco` | anel de foco |

### 3.1.1 Tema escuro (D74, 25/11/2026)

O seletor de aparência fica em **Você**: Seguir sistema, Claro ou Escuro. Sem uma escolha salva, o padrão é Claro; seguir o sistema só acontece quando a pessoa seleciona essa opção. A preferência fica no aparelho. O tema escuro usa superfícies neutras (`#18191A`, `#242526`, `#303133`) e texto claro; cinza claro marca links, seleção e foco, enquanto botões principais usam grafite médio. O vinho deixa de ser a cor geral de interação no escuro, reduzindo a competição com o conteúdo. Controles nativos recebem `color-scheme: dark`, e o foco visível continua destacado. A tela de entrada e a abertura HTML também leem a preferência antes da primeira pintura. A tela nativa inicial do PWA ainda usa a cor estática `#FDFAF5` definida no manifesto; ela não acompanha a escolha local nesta versão.

Os tokens semânticos são a fonte da paleta (`tokens.css`). Componentes antigos com cores fixas são revisados por área para evitar cartões claros soltos, status apagados ou texto de baixo contraste. QR codes e conteúdos cuja leitura exige branco/preto mantêm fundo branco.

### 3.2 Tipografia (atalhos `font:`)
| Token | Valor | Uso |
|---|---|---|
| `--texto-display` | Playfair 700 32/1.18 | título de tela, saudação |
| `--texto-titulo-1` | Playfair 700 24/1.25 | título do destaque, nome no Você |
| `--texto-titulo-2` | Sistema 600 20/1.3 | títulos de cartão |
| `--texto-corpo-g` | Sistema 400 17/1.4 | linhas de lista |
| `--texto-corpo` | Sistema 400 15/1.45 | texto padrão |
| `--texto-apoio` | Sistema 400 13/1.4 | metadados |
| `--texto-rotulo` | Sistema 600 12/1.3, maiúsculas, `--rotulo-espaco` 0,06em | rótulo de seção ("VEM AÍ") |

### 3.3 Espaçamento, raios, elevação, ícones, movimento
- **Espaço (grade de 4 px):** `--esp-1` 4 · `--esp-2` 8 · `--esp-3` 12 · `--esp-4` 16 · `--esp-5` 20 · `--esp-6` 24 · `--esp-8` 32 · `--esp-10` 40 · `--esp-12` 48 · `--esp-16` 64.
- **Raios:** `--raio-1` 8 (chips) · `--raio-2` 12 (botões, campos, segmentos) · `--raio-3` 20 (cartões, grupos de lista, folhas) · `--raio-pilula`.
- **Elevação:** cartões sem sombra (só borda). `--elev-1` (sombra mínima) no cartão de destaque e na pílula dos segmentos; `--elev-2` em folha e toast.
- **Ícones:** traço 1,75; `--icone-p` 16, `--icone-m` 20 (padrão), `--icone-g` 24 (abas).
- **Movimento:** `--ease-ios`, `--mola` (só toque/confirmação), `--dur-rapida` 120 ms, `--dur-media` 240 ms, `--dur-lenta` 420 ms.

---

## 4. Componentes (`app/src/estilo/sistema.css`, carregado por último)

| Componente | Classe(s) | Observação |
|---|---|---|
| Botão | `.botao-principal`, `.botao-secundario`, `.botao-perigo`, `.botao-texto`, `.botao-texto-perigo` | raio 12, sem sombra; secundário = fundo vermelho clarinho + texto vermelho |
| Botão de ícone | `.botao-icone` | 44x44, pílula, fundo rebaixado |
| Grupo de lista | `ul.grupo-lista` | cartão branco, borda creme, divisórias de 1 px |
| Item de lista | `.item-lista` (+ `.item-icone`, `.item-textos`, `.item-nome`, `.item-apoio`, `.item-seta`, `.item-contador`) | linha inteira clicável, >= 60 px. JS: `linhaLista()` em `telas/voce.js`. **Não confundir com `.linha` da Equipe** (classe antiga, outra coisa) |
| Rótulo de seção | `.rotulo-secao` (+ `.rotulo-secao-linha`, `.rotulo-secao-acao`) | maiúsculas pequenas; ação opcional à direita |
| Cartão de destaque | `.inicio-compromisso` (+ `.compromisso-*`) | um por tela; usado no Início e na Escala |
| Bloco de data | `.bloco-data` (JS: `blocoData()` em `inicio-eventos.js`) | dia em Playfair + mês |
| Atenção | `.atencao` | linha com ponto âmbar ("2 pessoas pedindo acesso") |
| Segmentos | `.segmentos` (botões ou links) | pílula branca deslizante; `seletorEscala()` usa links |
| Estado vazio | `.estado` (novo) e `.estado-vazio` (antigo, restilizado) | branco, borda tracejada, ícone em círculo neutro |
| Selo | `.selo`, `.selo-rascunho`, `.selo-cancelado` | raio 6, cores semânticas |
| Cabeçalho | `.cabecalho` | barra presa no topo, marca ou "‹ Voltar", avatar à direita |
| Barra de abas | `.barra-abas` | presa embaixo, largura toda, 5 abas |

---

## 5. Navegação da v1 (substituída na v2: ver 13.1)

> As abas abaixo eram as do Louvor. Desde 20/11 as abas são Início, Agenda, Ministérios e Você, e o Louvor tem a própria casa.

### 5.1 Barra de abas global (celular e tablet)
`barraAbas()` em `telas/moldura.js`, colocada por `main.js` em toda tela de quem já entrou (as telas não chamam mais).

| Aba | Rota | Também acende em |
|---|---|---|
| Início | `#/inicio` | `#/eventos`, `#/financeiro`, `#/pessoas` (abrem pelo Início) |
| Escala | `#/escala` | `#/montar` |
| Repertórios | `#/repertorios` | |
| Equipe | `#/equipe` | |
| Você | `#/voce` | `#/privacidade`, `#/termos` |

- Iguais para todos: a barra não muda de forma conforme o papel.
- **Montar escala**: seletor "Ver escala | Montar" no topo da Escala e do Montar, **só para o líder** (`eLiderDeLouvor`, RN-02). A rota `#/montar` continua protegida em `main.js` como antes.
- Admin: número de pedidos de acesso na aba Você, no avatar do cabeçalho e na linha Pessoas.

### 5.2 Tela Você (`telas/voce.js`, rota `#/voce`)
Avatar, nome, papel principal (`papelPrincipal()`: Administrador, Pastor, Líder de louvor, Tesouraria, Comunicação ou Membro), login, **Suas áreas** (mesmas checagens de antes: `e_administrador`, `cuidaDosEventos`, `veFinanceiro`), Privacidade, Termos e **Sair da conta** no fim.

### 5.3 Cabeçalho
Barra simples de 56 px presa no topo (vidro leve; sólida no modo leve). Marca à esquerda (ou "‹ Início"/"‹ Você" nas áreas que não são aba), avatar à direita levando ao Você. Saíram o Sair e o selo "Admin".

### 5.4 Computador (>= 1024 px)
Barra lateral mantida, agora plana (branca com borda). A conta no rodapé virou link para o Você (o Sair mora lá). Cabeçalho e abas continuam escondidos. Início em uma coluna de 760 px.

### 5.5 Tablet
Abas embaixo com os ícones centralizados (máx. 560 px); conteúdo em 720 px.

---

## 6. Tela inicial da v1 (ampliada na v2: ver 13.3)

1. Cabeçalho: marca + avatar.
2. Data + "Boa noite, Kaique" (sem exclamação).
3. **Atenção** (só se houver): contagem para conferir; pedidos de acesso (admin).
4. **Próximo compromisso** (vermelho): rótulo + "em 5 dias"/"semana que vem" (some em hoje/amanhã, que já aparecem na data), nome do culto em Playfair, "Domingo, 22 de nov. · 18h", chips dos instrumentos, "Ver escala e repertório". Vazio: cartão branco tracejado.
5. **Vem aí**: lista vertical com até 3 eventos; "Ver todos (N)" expande na própria tela (até 8). Tocar abre a mesma folha de antes.
6. **Suas áreas**: grupo de lista só com o que a pessoa pode abrir.
7. "Em breve no Hub: Pregações e Kids", numa linha.

---

## 7. Acessibilidade (verificada)

- **Contraste calculado** (WCAG AA) para todos os pares novos. Dois falharam no primeiro cálculo e foram corrigidos: `--tinta-400` (4,47 → 5,09:1) e a borda dos campos (1,52 → 3,18:1, token `--cor-borda-campo`, aplicado a todos os inputs).
- **Zoom de pinça religado** (viewport sem `maximum-scale`/`user-scalable=no`). O zoom acidental ao tocar em campos continua evitado pelos campos com 16 px ou mais.
- Um `h1` por tela (a tela Você tem `h1` escondido para leitor de tela); `aria-current="page"` na aba e no seletor; contadores com texto escondido; botão "Ver todos" com `aria-expanded`/`aria-controls`.
- Alvos de toque >= 44 px em abas, avatar, "Ver todos" e linhas.
- Sem vazamento horizontal em 320 px e 820 px em nenhuma tela (testado).

---

## 8. Estados

| Estado | Padrão |
|---|---|
| Carregando | Esqueleto com o formato real (o do compromisso agora é neutro, não rosado). |
| Vazio | Cartão branco tracejado, ícone em círculo neutro, 1 frase, ação opcional (`.estado` / `.estado-vazio`). |
| Sem rede | Cópia offline da escala, como antes. |
| Erro de ação | Toast, como antes. |

---

## 9. Decisões (aprovadas em 17/11/2026)

1. **Montar** como seletor dentro da aba Escala (não 6ª aba).
2. **"Em breve"** numa linha discreta.
3. **Vem aí** em lista vertical de até 3, com "Ver todos".
4. **Zoom religado.**
5. **Cartão de destaque vermelho cheio.**

---

## 10. Etapas (todas feitas em 17/11/2026)

| Etapa | Commit | O que mudou |
|---|---|---|
| 0. Tokens | `53ee3e5` | Três camadas de tokens; zoom religado. Sem mudança visual. |
| 1. Componentes | `0c207ce` | Apelidos antigos remapeados: app inteiro plano, borda creme, raios 12/16/20; botões, campos, selos e ícones novos. |
| 2. Navegação | `e229578` | Abas globais, tela Você, cabeçalho novo, seletor Ver escala/Montar, lateral plana. |
| 3. Início | `73c0c06` | Seção 6. |
| 4 a 6 | último commit do dia | Destaque da Escala no mesmo padrão; dia escolhido da semana com contorno; estados vazios; contraste corrigido; testes de largura e da folha. |

---

## 11. Diferenças em relação à proposta

- **Botão secundário** ficou com fundo vermelho clarinho (não borda + texto escuro): para quem tem mais idade, fundo deixa mais claro que aquilo é um botão.
- **Cabeçalho** não encolhe ao rolar: é uma barra fixa simples; o título grande fica no conteúdo. Menos JS, mesmo resultado prático.
- **Você** não mostra "seus instrumentos" nem "instalar/notificações": exigiria consulta nova (instrumentos) ou duplicaria o cartão de avisos que já está na Escala.
- **Conta na barra lateral** virou link para o Você, em vez de um menu com Sair.

## 12. O que ficou para depois

- **Tamanhos de fonte das telas internas:** as telas novas usam a escala de 7 passos, mas as regras antigas de Montar, Equipe, Financeiro e folhas ainda têm os tamanhos avulsos (continuam 26 valores no CSS antigo). Migrar tela a tela quando cada uma for mexida.
- **CSS morto:** regras antigas do Início (`.evento-bloco`, `.eventos-faixa`, `.modulo*`, `.compromisso-data`, `.inicio-pedidos`) e da cápsula não são mais usadas. Remover numa limpeza.
- **Texto que acompanha o tamanho de letra do iPhone** (Dynamic Type, `-apple-system-body`): não feito; precisa de teste no aparelho.
- **Esqueleto que vira erro depois de 8 s:** não feito.
- **Financeiro** foi revisado só no layout (o simulador de testes não tem dados do caixa); conferir no app de verdade.

---

## 13. Redesign v2: identidade (20/11/2026, D67)

Motivo: a v1 deixou o app organizado, mas neutro ("só mais um app"). A v2 dá personalidade com propósito, seguindo uma regra: **ousadia na apresentação, convenção nos controles** (voltar, ação principal e confirmação ficam sempre no mesmo lugar, por causa do público mais velho).

### 13.1 Arquitetura: abas da pessoa, casa por ministério
- Abas: **Início · Agenda · Ministérios · Você** (antes eram as abas do Louvor, o que não deixava o Hub crescer).
- **Agenda** (`telas/agenda.js`): cultos em que a pessoa toca + eventos da igreja, por mês.
- **Ministérios** (`telas/ministerios.js`): capa do Louvor, "em breve" (Kids, Pregações) e Administração (Pessoas, Eventos, Financeiro, mesmas regras de antes).
- **Casa do Louvor** (`navLouvor` em `moldura.js`): "Ministério de *Louvor*" + abas de texto com traço (Escala, Montar só para o líder, Repertórios, Equipe). O `h1` de cada tela é "Louvor" (o leitor de tela ouve também a parte).

### 13.2 Linguagem visual
- **Boletim de culto:** todo `.rotulo-secao` dentro do `main` ganha numeração romana (I., II.) e filete fino; meses e títulos de destaque em Playfair itálica.
- **Playfair itálica de verdade** (600/700, `estilo/fontes/`, via pacote @fontsource, licença OFL).
- **A chama** (`util/chama.js`): acende no avatar de quem toca nos próximos 7 dias, aparece no dia de culto, no puxar para atualizar, no cartaz da formação e nas boas-vindas. Tremula só com transform; parada no modo leve e com movimento reduzido.

### 13.3 O ritmo da semana (Início)
Semana normal → cartão vermelho. **Véspera** e **dia de culto** → capa com contagem (relógio de Brasília), ordem do louvor numerada com tons, rostos de quem toca junto, Ver a escala / Ouvir tudo / Mandar no WhatsApp. **Depois do culto** (2h30 após o início) → "Obrigado por tocar hoje" + o que foi tocado. `theme-color` vermelho no dia de culto (vale no Android; no iPhone instalado a barra de status segue o fundo da página).

### 13.8 Início para toda a igreja (D73, 25/11/2026)
O destaque do Início passa a mostrar o próximo culto ativo para todas as contas aprovadas, e não somente o próximo culto em que a pessoa serve. Quem está numa escala publicada no próximo culto continua vendo seus instrumentos; na véspera e no dia, mantém a capa personalizada com repertório e equipe. Sem participação na escala daquele culto, o cartão mostra data e horário e abre a Agenda. A Agenda lista os cultos ativos da igreja e marca a participação pessoal quando houver. Se não houver culto futuro cadastrado, o destaque não aparece. O restante da ordem permanece: pendências que pedem atenção, próximo culto, Mural e eventos do site. Os cultos futuros continuam dependendo da geração autorizada pelo fluxo Escala/Montar.

O mural busca as 30 publicações recentes e, em uma consulta complementar, todos os posts com `fixado_ate` válido. Une por ID e ordena os fixados primeiro; assim, um aviso antigo não sai da lista por ficar fora do limite de recentes.

### 13.9 Aparência escura (D74, 25/11/2026)

Revisão visual da correção: a paleta escura também remapeia as cores primitivas legadas (creme, vermelho e rosa), que eram lidas diretamente por telas antigas. Isso evita cartões claros e blocos vinho no meio do tema escuro. Foram revisadas as famílias de tela de início/mural, agenda e escala, ministérios, equipe, repertórios, montagem, eventos, financeiro, oração, perfil, acesso e documentos, além dos componentes comuns de formulário, navegação e seleção. Estados hover usam superfície neutra; foco e seleção usam azul com contraste visível. QR codes, fotos, imagens de marca e folhas de impressão mantêm seus requisitos próprios.

Achados e correções desta revisão:

- A camada fixa atrás da navegação inferior ainda tinha fundo creme translúcido e ficava clara no tema escuro. Agora usa a superfície de vidro escura e a borda do tema.
- O aviso para ativar notificações na Escala tinha fundo branco quase opaco e borda vinho. Agora usa cartão grafite, borda neutra e título azul legível.
- Os tokens legados de creme/vermelho/rosa foram remapeados no escuro, alcançando componentes de telas antigas sem precisar criar exceções claras em cada arquivo.
- Foram percorridas as rotas principais e de acesso em larguras móvel e desktop, com conta fictícia e respostas de consulta vazias. Isso permitiu revisar hierarquia, superfície, texto, seleção, navegação e vazios sem acessar nem alterar dados reais. Telas cujo conteúdo depende de registros existentes foram avaliadas no estado vazio; seus estados cheios e fluxos de gravação ainda dependem de conferência com dados de demonstração.

Direção visual: priorizar hierarquia, leitura e familiaridade de feed como Instagram/Facebook, sem reproduzir seus elementos de marca. O vinho continua no tema claro e nos ativos institucionais; no escuro, não colore cartões, superfícies ou ações gerais. O destaque escuro usa cinzas neutros, sem introduzir azul como cor de marca.

### 13.10 Símbolo compacto do Hub (D75, 25/11/2026)

Nas marcas compactas que aparecem ao lado do nome ou de um rótulo — cabeçalho móvel, barra lateral, entrada, carregamento e carteirinha — usar somente o fogo. O PNG `public/simbolo-fogo-iejb.png` é recortado do ativo oficial e passa pelo mesmo filtro de cor do logo atual. A abertura animada e o ícone instalado do PWA mantêm o brasão completo, pois aparecem sem o nome escrito ao lado. O novo símbolo é incluído nos ativos estáticos do service worker.
Preferência local em **Você**, com três opções: Seguir sistema, Claro e Escuro. Sem escolha salva, inicia em Claro, sem depender do sistema operacional. O escuro usa grafite e cinza claro em ações/seleção, sem vinho como cor geral nem azul como cor de marca. A tela de entrada e a abertura recebem a escolha antes da primeira pintura. Não altera dados, permissões nem configuração do Supabase.

### 13.4 Acabamento
Transição do cartão do compromisso para a Escala (View Transitions, `view-transition-name: compromisso`); "gota" que desliza entre as abas; traço que desliza na casa do Louvor; título compacto no cabeçalho ao rolar (`util/rolagem.js`); puxar para atualizar com a chama (só no app instalado).

### 13.5 Por módulo
| Onde | O quê |
|---|---|
| Escala | Formação como cartaz de banda (rostos grandes, você com anel e chama) |
| Montar | Barra "mês completo" (montados x publicados); **imagem da escala do mês** em layout de boletim, 1080×1350, pelo compartilhamento do celular (`util/imagem-escala.js`) |
| Repertórios | Capas de encarte; "As mais tocadas" (com 3+ cultos no histórico); **mandar no WhatsApp** (músicas, tons, links e "ouvir tudo", `util/compartilhar.js`) também na Escala e no dia de culto |
| Editor de repertório | "tocada há N semanas" (âmbar se < 4 semanas) / "nunca tocada" |
| Equipe | Mural de rostos para quem só vê contatos; lista com selos para quem administra |
| Financeiro | **Contar pelas notas** (`telas/financeiro/cedulas.js`, opcional, só preenche o campo); **Prestação de contas (PDF)** pela impressão do sistema (`relatorio.js`) |
| Eventos | Detalhe como capa de revista (imagem + data, ou capa tipográfica) |
| Você | **Carteirinha digital** com reflexo em faixa lisa (sem degradê) que segue o dedo ou a inclinação (pede permissão no iPhone) |
| Primeiro acesso | "Que bom que você chegou", perguntas em tom de conversa, chama no título |

### 13.6 Verificação
Sem vazamento horizontal em 320, 820 e 1366 px em 11 telas; contraste AA calculado (cédulas escurecidas para o branco passar de 4,5:1); um `h1` por tela; aba e parte do Louvor certas com `aria-current`; folha encosta no rodapé; cédulas somam certo (teste: 3×100 + 50 + 0,50 = 350,50); prestação de contas confere com os lançamentos de teste.

### 13.7 Fica para depois
Modo palco (descartado: sem cifra não ajuda); retrospectiva "Seu ano no louvor" (dezembro de 2027, os dados foram zerados em 16/11); arrastar grupos no Montar (o toque já resolve e é melhor para quem tem a mão menos firme); backup (próximo item).
