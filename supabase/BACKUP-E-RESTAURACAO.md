# Backup e restauração

O plano gratuito do Supabase **não tem backup**. Por isso existe o agendamento `.github/workflows/backup-semanal.yml` (D21 / DT-06).

## O que é guardado

| | |
|---|---|
| Quando | Todo domingo às 3h23 (Brasília), e quando alguém clicar em "Run workflow" |
| O quê | Os **dados** do esquema `public` (pessoas, grupos, cultos, escalas, repertório, avisos, aparelhos de push) e as contas de login (`auth.users`, `auth.identities`). A **estrutura** não vai no backup: ela está nas migrações deste repositório. |
| Onde | Em "artifacts" do GitHub Actions do repositório, por **90 dias** (cerca de 12 backups) |
| Proteção | Criptografado com AES-256 e a senha `BACKUP_SENHA`. Mesmo que o repositório fique público (D15), o arquivo não abre sem a senha. |
| Fora do backup | As fotos de perfil (Storage). Se perder, cada um põe a foto de novo. |

## Configurar (uma vez)

1. **Senha do banco.** Se não souber: Supabase → Project Settings → Database → *Reset database password*. Trocar a senha não afeta o app (ele usa as chaves da API, não essa senha).
2. **Endereço do banco.** Supabase → botão **Connect** (no topo) → aba *Connection String* → **Session pooler**. Copie o endereço (`postgresql://postgres.hqalztygktkabwybmdyl:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`) e troque `[YOUR-PASSWORD]` pela senha.
   Por que *Session pooler* e não *Direct*: a conexão direta do Supabase é só IPv6, e as máquinas do GitHub Actions não têm IPv6.
3. **Senha do backup.** Invente uma senha forte e **guarde no seu gerenciador de senhas**. Sem ela, nenhum backup abre, nem por você.
4. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = o endereço do passo 2
   - `BACKUP_SENHA` = a senha do passo 3
5. Actions → **Backup semanal do banco** → **Run workflow**. Tem que ficar verde e aparecer um arquivo em *Artifacts* no fim da página da execução.

## Restaurar

Testado em 14/11/2026 num Postgres local com os dados do cenário de testes: todas as 20 tabelas voltaram com as mesmas contagens, e o login simulado continuou vendo só o que o RLS permite.

1. Baixe o arquivo do backup (Actions → a execução → *Artifacts*) e descompacte o `.zip` do GitHub.
2. Abra com a senha:
   ```bash
   gpg -d iejb-hub-AAAA-MM-DD.sql.gz.gpg | gunzip > dados.sql
   ```
3. Banco novo com a estrutura: crie um projeto Supabase e aplique as migrações de `supabase/migrations/` em ordem (SQL Editor ou `supabase db push`).
4. Carregue os dados com gatilhos e chaves estrangeiras desligados durante a carga (o backup tem referências circulares, como `grupo` ↔ `grupo_membro`):
   ```bash
   { echo "set session_replication_role = replica;";
     echo "truncate public.ministerio, public.tipo_culto, auth.users cascade;";
     cat dados.sql; } | psql "ENDEREÇO-DO-BANCO-NOVO"
   ```
   O `truncate` tira os dados iniciais que a migração 08 cria (Louvor, G1 a G3, tipos de culto), que também estão no backup.
5. Aponte o app para o projeto novo (`app/.env`) e faça o deploy. As chaves do push (`chave_push`) vêm no backup, então os aparelhos já inscritos continuam recebendo.

> **Ponto não testado** [Chute]: no Supabase de verdade, o papel `postgres` pode não ter permissão para escrever no esquema `auth`. Se o passo 4 falhar só nas contas, restaure o resto (tire as linhas de `auth.users`/`auth.identities` do arquivo) e recrie os logins pela tela Equipe → "Criar acesso". As pessoas, escalas e repertórios voltam do mesmo jeito.
