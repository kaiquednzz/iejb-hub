# IEJB Hub

Aplicativo interno da **IEJB - Igreja Evangélica do Jardim Brasil** (Araçariguama - SP). Junta num lugar só o que antes ficava espalhado em planilha, PDF e grupo de WhatsApp: a escala do Louvor, os repertórios, os eventos do site e o caixa da igreja.

Está no ar em [`app.iejb.com.br`](https://app.iejb.com.br) (acesso só para integrantes aprovados) e é usado pela igreja.

![O Hub no celular: Início, Escala e Financeiro](docs/imagens/celular.png)

![O Hub no computador, com a barra lateral](docs/imagens/computador.png)

<sub>Capturas com dados de teste.</sub>

---

## O que ele faz

| Área | O que tem |
|---|---|
| **Início** | O próximo compromisso da pessoa, contagem do caixa esperando a conferência dela, pedidos de acesso (admin), os eventos que vêm aí e os módulos que ela pode abrir. |
| **Louvor: Escala** | As semanas em blocos (domingo, terça, sábado de jovens). Tocar no dia abre quem toca, os instrumentos e o repertório. "Não vou poder ir" avisa os líderes na hora. Funciona sem internet com a última escala vista. |
| **Louvor: Montar** | O líder monta o mês como fazia na planilha: um toque escolhe o grupo da semana, a escala se preenche sozinha e é publicada com aviso a quem foi afetado. Gera o resumo do mês em texto para o WhatsApp. |
| **Louvor: Repertórios** | Músicas por culto, com tom e ordem, botões para ouvir no Spotify, Apple Music e YouTube e a fila do culto no YouTube. Histórico pesquisável ("tocada 3 vezes, última em..."). |
| **Louvor: Equipe** | Aprovar acessos, cadastrar pessoas, montar os grupos, dar funções (Tesouraria, Pastor, Comunicação) e redefinir senha, tudo sem e-mail. |
| **Eventos do site** | A comunicação cadastra os eventos no Hub; o site [iejb.com.br](https://iejb.com.br) se atualiza sozinho a cada 15 min e o evento some depois que passa. |
| **Financeiro** | Entradas, saídas e transferências entre Caixa e PagBank, saldo por conta, resumo do mês e planilha para baixar. A contagem do culto passa por **dupla conferência**: quem contou escolhe quem confere, e só o valor conferido entra no caixa. Nada se apaga: erro é cancelado com motivo e fica no histórico. Dízimo só por total, **sem o nome de quem deu**. |
| **Avisos** | Notificação push no celular quando a escala ou o repertório muda, com mensagem pronta para o WhatsApp como reserva. |

Instala como app (PWA) no celular e funciona no navegador do computador, com layout próprio para tela larga.

## Como é feito

| Camada | Escolha |
|---|---|
| Front-end | Vite + JavaScript puro em módulos, sem framework. A única dependência do app é o `@supabase/supabase-js`. |
| Banco e login | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions), servidor em São Paulo |
| Segurança | Toda permissão é regra do banco (RLS e funções `security definer`), não só da tela. Ser admin, por exemplo, **não** dá acesso ao caixa. |
| Hospedagem | Cloudflare Workers; cada push na `main` publica sozinho |
| Custo | Planos gratuitos de tudo |

```
app/                 o PWA (telas em src/telas, estilos em src/estilo)
supabase/migrations  o banco inteiro, em migrações numeradas
supabase/functions   admin-acesso, enviar-push, links-da-musica
supabase/tests/local testes do banco num Postgres local
docs/planejamento    visão, regras de negócio, modelo de dados, decisões
```

## Fluxo de desenvolvimento

Cada mudança segue o mesmo caminho:

1. **Levantamento.** Antes do código, as regras vêm de como a igreja funciona hoje (quem monta a escala, como os grupos revezam, quem pode ver o caixa) e viram as [regras de negócio](docs/planejamento/REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md) e o [modelo de dados](docs/planejamento/MODELO-DE-DADOS-E-PERMISSOES-PILOTO-LOUVOR.md).
2. **Decisão registrada.** Toda escolha que muda o produto vira uma linha numerada na [visão geral](docs/planejamento/VISAO-GERAL-IEJB-HUB.md), com o motivo; as técnicas ficam no [registro de decisões técnicas](docs/planejamento/REGISTRO-DE-DECISOES-TECNICAS.md). Decisão desfeita fica riscada, com o porquê.
3. **Banco primeiro.** Tabelas, regras de acesso e gatilhos entram como migração e rodam antes num Postgres local que simula logins diferentes (membro, líder, tesouraria, pastor), conferindo o que cada um vê e o que é barrado: 227 verificações em `supabase/tests/local`.
4. **Tela.** Mudanças pequenas e incrementais sobre o que já existe.
5. **Conferência.** Cada tela é aberta num navegador automatizado com dados simulados, de 320 a 1440 px, procurando conteúdo vazando, alvo de toque pequeno e erro no console; acessibilidade pelo axe-core; teste final em iPhone e Android reais.
6. **Revisão antes de produção.** Migração no banco de produção só é aplicada depois de revisada.
7. **Publicação.** Commit em português (`feat:`, `fix:`, `style:`) na `main`; o Cloudflare publica em cerca de 2 minutos.

## Rodar localmente

```bash
cd app
# o .env precisa de VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (chave pública)
npm install
npm run dev
```

Testes do banco (precisa de um PostgreSQL 16+ local):

```bash
cd supabase/tests/local
./rodar.sh
```

## Documentação

- [Visão geral e decisões](docs/planejamento/VISAO-GERAL-IEJB-HUB.md)
- [Regras de negócio do Louvor](docs/planejamento/REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md)
- [Modelo de dados e permissões](docs/planejamento/MODELO-DE-DADOS-E-PERMISSOES-PILOTO-LOUVOR.md)
- [Decisões técnicas](docs/planejamento/REGISTRO-DE-DECISOES-TECNICAS.md)
- [Banco de dados](supabase/README.md) · [Backup e restauração](supabase/BACKUP-E-RESTAURACAO.md)
- [Front-end](app/README.md)

## Privacidade

O que o Hub guarda, quem vê e como pedir para apagar está na própria tela de [privacidade](https://app.iejb.com.br/#/privacidade) (abre sem login).

---

Desenvolvido por Kaique, com o [Claude Code](https://claude.com/claude-code) como ferramenta de desenvolvimento. Repositório privado; os dados pertencem à IEJB.
