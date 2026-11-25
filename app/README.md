# IEJB Hub: front-end

Vite + JavaScript puro (módulos ES), sem framework (D22). Fala direto com o
Supabase pelo `@supabase/supabase-js`; quem protege os dados é a RLS do banco.

## Rodar

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (é isso que vai pro Cloudflare)
npm run preview   # serve o dist/ para conferir o build
```

O `.env` já tem a URL do projeto e a chave **publishable** (pública por design,
por isso está no git). Nunca coloque a chave secret/service_role no front.

## Como está organizado

```
index.html            casca: só carrega fontes, manifest e src/main.js
public/               logo e ícones (copiados do site iejb.com.br)
public/sw.js          service worker (cache do app para abrir offline)
src/main.js           decide a tela: precisa instalar? tem sessão? qual o estado da conta?
src/pwa.js            registra o SW, detecta aparelho/instalação, botão Instalar do Android
src/offline.js        cópia local da conta e da última escala (apagada ao sair)
src/supabase.js       o cliente único do Supabase
src/sessao.js         lê a conta logada, nome curto, tradução de erros
src/telas/            uma função por tela; cada uma devolve um elemento pronto
src/telas/inicio.js   próximo culto para todos; detalhes pessoais quando a pessoa está escalada
src/telas/equipe/     tela Equipe: pedidos de acesso, pessoas e grupos (uma seção por arquivo)
src/telas/montar/     tela Montar escala (líder de louvor): mês, semanas, culto, mesa, WhatsApp
src/util/foto.js      fotos de perfil: comprime no aparelho, sobe, mostra (avatar)
src/util/escala.js    regra da "Mesa" (função de som) usada em mais de uma tela
src/util/google.js    entrar com Google (D33): só aparece se estiver ligado no Supabase
src/util/push.js      ativar avisos, inscrever o aparelho, remover ao sair
src/util/musica.js    links de busca nas plataformas, ID do YouTube, fila "Tocar no YouTube" (D26)
src/telas/repertorio.js  bloco do repertório na escala, "Ouvir" e o editor
src/telas/ajustar-escala.js  "Mudar quem toca" do líder de grupo (D32)
src/util/folha.js     folha que sobe de baixo (<dialog>), confirmação e aviso rápido (toast)
src/util/erros.js     traduz erros do banco e da função admin-acesso
src/util/dom.js       h() monta HTML sem innerHTML (proteção contra XSS) + ícones
src/util/datas.js     datas sempre no fuso de Brasília
src/estilo/           tokens (do site) → base → componentes → telas
```

## Fluxo das telas

```
celular não instalado ► Instalar (antes de tudo, até do login)
sem sessão ─────────► Entrar  ⇄  Pedir acesso (#/pedir-acesso)
com sessão
  conta pendente ───► Aguardando ("Conferir de novo")
  recusada/desativ. ► Aguardando (explica e oferece Sair)
  senha temporária ─► Trocar senha (obrigatório)
  ativa ────────────► Escala (#/escala) ⇄ Montar (#/montar, só líder de louvor) ⇄ Equipe (#/equipe)
```

A tela é só conveniência. Se alguém forçar a tela da escala mexendo no JS, o
banco devolve vazio para uma conta pendente. A trava de verdade é a RLS.

## Ideias que valem estudar aqui

- **`h()` em vez de `innerHTML`**: todo dado do banco entra como texto, nunca
  como HTML. Um nome tipo `<img onerror=...>` aparece escrito, não executa.
- **Uma consulta só para a escala**: `culto → escala → escala_item → pessoa` e
  `culto → repertorio_item → musica`, usando as chaves estrangeiras (embed do
  PostgREST). Sem N+1 requisições.
- **`onAuthStateChange` + `setTimeout`**: dentro do callback não se chama o
  Supabase com `await` (o supabase-js segura o cadeado da sessão e travaria).
- **Rodadas em `decidirTela`**: se duas decisões rodarem ao mesmo tempo, só a
  mais nova desenha a tela.
- **Movimento**: View Transitions entre telas, cascata de entrada nos cartões,
  `<details>` com altura animada (`interpolate-size` + `::details-content`).
  Tudo que fica em loop anima só `translate`/`rotate`/`opacity` (GPU), e
  `prefers-reduced-motion` desliga quase tudo.

## PWA

- **Obrigatório no celular, livre no computador.** No `npm run dev` a trava
  fica desligada (pela rede local não há HTTPS, então nem dá para instalar).
- **Instalar vem antes do login**: no iPhone o app da tela de início não vê a
  sessão do Safari. Quem entrasse pelo Safari abriria o ícone deslogado.
- **Três caminhos na tela de instalação**: iPhone (passos do Compartilhar, não
  existe botão de instalar no iOS), Android (botão de verdade quando o
  navegador oferece o `beforeinstallprompt`; senão, passos pelo menu ⋮) e link
  aberto dentro do WhatsApp/Instagram (manda abrir no navegador).
- **Service worker** (`public/sw.js`): página rede-primeiro, `/assets/*`
  cache-primeiro (têm hash no nome), Supabase nunca passa pelo cache. Na
  instalação ele já guarda a página e os arquivos dela, então o app abre offline
  desde a primeira visita. A cada abertura com internet, apaga os arquivos de
  builds antigos.
- **Offline**: a última escala carregada fica no aparelho e aparece com a faixa
  "Sem conexão. Mostrando a escala de…". Só leitura; apagada ao sair da conta.

Dois tropeços que valem a lição:

1. **`Vary: Origin`**: o servidor manda esse cabeçalho e o Vite marca o script
   com `crossorigin`. A cópia guardada na instalação não tinha `Origin`, a
   pedida pela página tinha, e para o cache isso são pedidos diferentes. O app
   não abria offline. Resolvido com `match(pedido, { ignoreVary: true })`, que é
   seguro só porque arquivo com hash no nome nunca muda de conteúdo.
2. **Novas tentativas do supabase-js**: em erro de rede ele tenta de novo
   esperando 1s, 2s e 4s. Sem internet, isso atrasava a cópia offline em 7
   segundos. Agora as consultas usam `.retry(navigator.onLine)`: continua
   tentando de novo no 4G instável, mas desiste na hora quando o aparelho
   já sabe que está sem rede.

## Aparência

Em **Você → Aparência**, a pessoa escolhe Seguir sistema, Claro ou Escuro. Sem escolha salva, o padrão é Claro; o sistema é seguido apenas quando selecionado. A preferência fica no armazenamento local (chave `iejb-aparencia`) e não é enviada ao Supabase. No escuro, a paleta é neutra: cinza claro marca ações e foco, e os botões principais usam grafite médio, sem vinho como cor geral nem azul como cor de marca. Os tokens e a aplicação do tema ficam em `src/estilo/tokens.css` e `src/util/tema.js`. A tela nativa inicial do PWA ainda usa a cor estática do manifesto (`#FDFAF5`).

## Testado como

Chrome headless com as respostas do Supabase simuladas (sessão falsa no
localStorage e rotas interceptadas), cobrindo: login com senha errada, pedir
acesso, conta pendente, senha temporária, escala cheia (publicada, rascunho,
sem escala, cancelado, repertório aberto), escala vazia e desktop.

PWA: iPhone no Safari (passos), Android sem e com `beforeinstallprompt`
(botão → "Instalado!"), link aberto no WhatsApp, iPhone já instalado (vai pro
login), e desktop logado que perde a internet: o app abre pelo service worker e
mostra a escala guardada com a faixa de sem conexão.

## Testes do front (D69)

`npm test` builda o app, sobe a prévia na porta 4174 e roda os testes de `testes/` num Chrome com o tamanho de um iPhone. O Supabase é **simulado** (`testes/simulador.js`): cada teste diz quem está logado e o que o banco responde, e confere o que o app mandou (qual função, com quais argumentos). Qualquer erro de JavaScript na tela reprova o teste.

Eles não substituem os testes do banco (`supabase/tests/local`): lá se prova que a permissão vale; aqui, que a tela chama a coisa certa e não quebra.

Primeira vez: `npx playwright install chromium` (ou `CHROME=/caminho/do/chrome npm test` para usar um Chrome já instalado).

## Publicação (feita em 14/11/2026)

1. **Cloudflare Workers** (conta IEJB), conectado ao repo: *Path* `app`, *Build
   command* `npm run build`, *Deploy command*
   `npx wrangler deploy --assets=./dist --name iejb-hub --compatibility-date=2026-11-01`,
   variável `NODE_VERSION=22`. Domínio `app.iejb.com.br` em
   Settings → Domains & Routes. Cada push na `main` publica sozinho.
2. **Supabase → Authentication → URL Configuration**: Site URL
   `https://app.iejb.com.br`.
3. **Desligar "Confirm email"** (Authentication → Sign In / Providers → Email)
   antes de alguém usar o *Pedir acesso*. Ligado, o Supabase manda e-mail de
   confirmação (contra a D19) e a pessoa não consegue entrar até clicar nele.

## Tela Montar escala

Feita a partir da planilha que o líder manda hoje (PDF no WhatsApp com Data, Grupo e Mesa por culto):

- **O mês são as semanas que começam no mês** (como a planilha: a terça 01/12 está na escala de novembro).
- **Grupo da semana:** um toque em G1/G2/G3 no cabeçalho da semana escala domingo e terça juntos. Cada culto pode ser trocado sozinho, e culto especial pode juntar grupos.
- **Mesa:** quem opera o som em cada culto. No banco é uma pessoa da escala com a função "Mesa", então entra no aviso de mudança como qualquer um. Quem tem "Mesa" nos instrumentos aparece primeiro.
- **Ceia:** rótulo do culto, destacado na escala e na mensagem.
- **Culto especial:** Jovens no sábado, vigília etc.
- **Publicar** solta tudo o que está em rascunho de uma vez. Depois disso, cada mudança avisa só quem foi afetado.
- **WhatsApp:** gera o resumo do mês em texto (substitui o PDF), com o link do app.
- Os cultos fixos do mês são gerados sozinhos ao abrir (gerar_cultos é idempotente).

## Repertório (D26)

Dentro de cada culto da aba Escala:

- **Ouvir:** cada música abre uma folha com Spotify, YouTube Music, Apple Music e YouTube, cada um na **busca** por título + artista (sem login, sem chave de API, sem limite). Se a música tem link cadastrado, o vídeo vem primeiro.
- **Tocar no YouTube:** monta uma fila com os vídeos na ordem do repertório (`youtube.com/watch_videos?video_ids=`) e mostra "N de M" com link. Endereço não oficial (risco aceito na D26).
- **Montar/Editar repertório:** aparece para o líder de um grupo escalado (depois da escala publicada), o líder de louvor e o admin, a mesma regra que o banco confere em `pode_editar_repertorio`. Busca no catálogo enquanto digita, cadastra música nova (com atalho "Procurar no YouTube" para pegar o link), tom por culto com um toque, sobe/desce na ordem. Mudança depois de publicada gera aviso de "repertório alterado".

## Líder de grupo ajusta a escala (D32)

- Num culto **publicado** em que o grupo dele está escalado, o líder de grupo (que não é líder de louvor) vê "Mudar quem toca" no cartão do culto: tira e inclui pessoas e muda o instrumento delas **naquele culto**.
- Mesa de som, grupo do culto, cancelar e publicar continuam com o líder de louvor. Quem garante é o banco (políticas de `escala_item` + gatilho `mesa_so_lider_de_louvor`).
- Os afetados e o **líder de louvor** recebem o aviso ("Escala atualizada por Mari: ...").
- **Reserva do push (RN-43):** na folha de um culto publicado (aba Montar), "Mandar esta escala no WhatsApp" gera a mensagem pronta da mudança.
- O pedido de alteração (versão anterior da regra) saiu do app; o histórico fica no banco.

## Avisos no celular (push)

Cartão "Receba avisos da escala" na aba Escala enquanto a permissão não foi pedida (no iPhone o pedido precisa sair de um toque, e só funciona com o app instalado, iOS 16.4+). Ao abrir o app com permissão dada, a inscrição é conferida e registrada na conta logada (`registrar_aparelho`). Ao sair da conta, o aparelho é removido antes do logout. O service worker mostra a notificação (`push`) e abre o app no toque (`notificationclick`). Avisos da mesma escala se substituem (tag).

## Fotos de perfil

Comprimidas no aparelho (quadrado de 320 px, WebP ou JPEG, ~25 KB) antes de subir. O bucket `fotos` recusa mais de 200 KB e só aceita WebP/JPEG. Cada troca gera um nome novo, então o arquivo pode ficar em cache por um ano (só baixa uma vez). Troca a foto: a própria pessoa (Equipe → sua linha), o admin e o líder de louvor.

## Tela Equipe

Todo integrante entra: vê as pessoas (com o contato, Q22) e os grupos. O que cada um pode mexer:

| | Admin | Líder de louvor | Líder de grupo | Integrante |
|---|---|---|---|---|
| Pedidos de acesso (aprovar, recusar) | ✓ | | | |
| Cadastrar, editar, desativar pessoa | ✓ | ✓ | | |
| Acesso ao Hub (criar, redefinir senha, desligar, tornar admin) | ✓ | | | |
| Marcar líder de louvor | ✓ | | | |
| Membros e instrumentos dos grupos | ✓ | ✓ | só o próprio grupo | |
| Escolher o líder do grupo | ✓ | ✓ | | |

Os botões aparecem conforme o papel, mas quem garante a tabela é o banco (RLS e as funções). Criar acesso e redefinir senha passam pela função de servidor `admin-acesso` (ver `supabase/functions/`), porque precisam da chave de serviço, que nunca vai para o app.

## Ainda não tem

- Central de notificações dentro do app (os avisos já ficam guardados em aviso_destinatario).
- Cifras e letras (fora do piloto por enquanto).
