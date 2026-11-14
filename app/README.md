# IEJB Hub: front-end

Vite + JavaScript puro (módulos ES), sem framework (D22). Fala direto com o
Supabase pelo `@supabase/supabase-js`; quem protege os dados é a RLS do banco.

## Rodar

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/ (é isso que vai pro Cloudflare Pages)
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
  ativa ────────────► Escala
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

## Testado como

Chrome headless com as respostas do Supabase simuladas (sessão falsa no
localStorage e rotas interceptadas), cobrindo: login com senha errada, pedir
acesso, conta pendente, senha temporária, escala cheia (publicada, rascunho,
sem escala, cancelado, repertório aberto), escala vazia e desktop.

PWA: iPhone no Safari (passos), Android sem e com `beforeinstallprompt`
(botão → "Instalado!"), link aberto no WhatsApp, iPhone já instalado (vai pro
login), e desktop logado que perde a internet: o app abre pelo service worker e
mostra a escala guardada com a faixa de sem conexão.

## Antes de pôr no ar

1. **Cloudflare Pages**: conectar o repo, *Root directory* `app`, *Build
   command* `npm run build`, *Output* `dist`. Domínio `app.iejb.com.br`.
2. **Supabase → Authentication → URL Configuration**: Site URL
   `https://app.iejb.com.br`.
3. **Desligar "Confirm email"** (Authentication → Sign In / Providers → Email)
   antes de alguém usar o *Pedir acesso*. Ligado, o Supabase manda e-mail de
   confirmação (contra a D19) e a pessoa não consegue entrar até clicar nele.

## Ainda não tem

- Push (as notificações): precisa de chaves VAPID e da função de servidor que envia.
- Telas do líder (montar escala, repertório) e do admin (aprovar contas).
- Edge Function para o admin criar conta com senha temporária e redefinir senha.
