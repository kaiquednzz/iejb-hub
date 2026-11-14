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
src/main.js           decide a tela: tem sessão? qual o estado da conta?
src/supabase.js       o cliente único do Supabase
src/sessao.js         lê a conta logada, nome curto, tradução de erros
src/telas/            uma função por tela; cada uma devolve um elemento pronto
src/util/dom.js       h() monta HTML sem innerHTML (proteção contra XSS) + ícones
src/util/datas.js     datas sempre no fuso de Brasília
src/estilo/           tokens (do site) → base → componentes → telas
```

## Fluxo das telas

```
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

## Testado como

Chrome headless com as respostas do Supabase simuladas (sessão falsa no
localStorage e rotas interceptadas), cobrindo: login com senha errada, pedir
acesso, conta pendente, senha temporária, escala cheia (publicada, rascunho,
sem escala, cancelado, repertório aberto), escala vazia e desktop.

## Antes de pôr no ar

1. **Cloudflare Pages**: conectar o repo, *Root directory* `app`, *Build
   command* `npm run build`, *Output* `dist`. Domínio `app.iejb.com.br`.
2. **Supabase → Authentication → URL Configuration**: Site URL
   `https://app.iejb.com.br`.
3. **Desligar "Confirm email"** (Authentication → Sign In / Providers → Email)
   antes de alguém usar o *Pedir acesso*. Ligado, o Supabase manda e-mail de
   confirmação (contra a D19) e a pessoa não consegue entrar até clicar nele.

## Ainda não tem

- Service worker / instalação obrigatória como PWA no celular (vem com o push).
- Telas do líder (montar escala, repertório) e do admin (aprovar contas).
- Edge Function para o admin criar conta com senha temporária e redefinir senha.
