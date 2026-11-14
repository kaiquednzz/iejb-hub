-- =============================================================================
-- Migração 18: eventos do site (D34)
--
-- Os eventos de iejb.com.br deixam de ser escritos à mão no index.html. O
-- administrador cadastra no Hub; um GitHub Action do repositório do site lê
-- os eventos PUBLICADOS por public.eventos_do_site() e reescreve o bloco de
-- eventos do index.html no mesmo formato de antes (HTML estático: o Google lê
-- sem rodar JS e o site continua de pé mesmo se o Hub sair do ar, D3).
--
-- Segurança:
--   * escrever: só administrador (RLS). anon não lê a tabela.
--   * o site lê por uma função que devolve só colunas públicas de eventos
--     publicados e que ainda não passaram. Rascunho nunca sai do Hub.
--   * os checks abaixo limitam tamanho e formato (link só https, imagem só um
--     nome de arquivo do bucket ou uma imagem do próprio site). O gerador do
--     site também escapa todo texto: aqui é a primeira barreira, lá a segunda.
-- =============================================================================

create table public.evento (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null check (char_length(btrim(titulo)) between 3 and 80),
  -- Trecho do título que vai em negrito no site ("Cantata de <strong>Natal</strong>")
  destaque       text check (destaque is null or (char_length(destaque) between 1 and 40 and strpos(titulo, destaque) > 0)),
  categoria      text not null check (char_length(btrim(categoria)) between 2 and 40),
  descricao      text not null check (char_length(btrim(descricao)) between 10 and 300),
  data           date not null,
  data_fim       date check (data_fim is null or data_fim > data),   -- evento de vários dias
  horario        time not null,
  -- Fora da igreja: os dois juntos (o site monta "Nome - Cidade")
  local_nome     text check (local_nome is null or char_length(btrim(local_nome)) between 2 and 60),
  local_cidade   text check (local_cidade is null or char_length(btrim(local_cidade)) between 2 and 40),
  link_inscricao text check (link_inscricao is null or (char_length(link_inscricao) <= 300 and link_inscricao ~ '^https://[^[:space:]<>"''`]+$')),
  -- Nome de arquivo do bucket "eventos" (uuid.webp/jpg) ou imagem do site (images/...webp)
  imagem         text check (imagem is null or imagem ~ '^([0-9a-f-]{36}\.(webp|jpg)|images/[A-Za-z0-9/_-]+\.webp)$'),
  publicado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check ((local_nome is null) = (local_cidade is null))
);

comment on table public.evento is 'Eventos do site iejb.com.br (D34). Só admin escreve; o site lê por eventos_do_site().';

create trigger tocar before update on public.evento
for each row execute function privado.tocar_atualizado_em();

create index evento_data on public.evento (data);

alter table public.evento enable row level security;
revoke all on public.evento from anon;

create policy "evento: admin vê"     on public.evento for select to authenticated using (privado.e_admin());
create policy "evento: admin cria"   on public.evento for insert to authenticated with check (privado.e_admin());
create policy "evento: admin muda"   on public.evento for update to authenticated using (privado.e_admin()) with check (privado.e_admin());
create policy "evento: admin apaga"  on public.evento for delete to authenticated using (privado.e_admin());

-- -----------------------------------------------------------------------------
-- O que o site lê. Inclui o dia de ontem: um culto às 22h termina depois da
-- meia-noite, e o próprio site esconde o evento 3h depois de começar.
-- -----------------------------------------------------------------------------
create function public.eventos_do_site()
returns table (
  titulo text, destaque text, categoria text, descricao text,
  data date, data_fim date, horario time,
  local_nome text, local_cidade text, link_inscricao text, imagem text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.titulo, e.destaque, e.categoria, e.descricao,
         e.data, e.data_fim, e.horario,
         e.local_nome, e.local_cidade, e.link_inscricao, e.imagem
  from public.evento e
  where e.publicado
    and coalesce(e.data_fim, e.data) >= (now() at time zone 'America/Sao_Paulo')::date - 1
  order by e.data, e.horario, e.titulo;
$$;

revoke execute on function public.eventos_do_site() from public;
grant execute on function public.eventos_do_site() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Imagens dos eventos: público para leitura (vai para o Google pelo JSON-LD),
-- até 400 KB e só WebP/JPEG (o app reduz para 1200 px antes de mandar).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('eventos', 'eventos', true, 409600, array['image/webp', 'image/jpeg'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    create policy "eventos: admin sobe"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'eventos' and privado.e_admin());

    create policy "eventos: admin apaga"
    on storage.objects for delete to authenticated
    using (bucket_id = 'eventos' and privado.e_admin());
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Os eventos que já estavam escritos à mão no site (14/11/2026). Entram
-- publicados: o primeiro sincronismo tem que deixar o site igual a antes.
-- -----------------------------------------------------------------------------
insert into public.evento (titulo, destaque, categoria, descricao, data, horario, imagem, publicado) values
  ('Ordenação pastoral e Ceia', 'e Ceia', 'Culto especial',
   'Culto de ordenação pastoral do presbítero Rodrigo, com a Ceia do Senhor. Venha celebrar esse momento com a igreja.',
   '2026-12-06', '18:00', null, true),
  ('Cantata de Natal', 'Natal', 'Culto especial',
   'Uma noite de louvor com a nossa Cantata de Natal. Traga a família e os amigos!',
   '2026-12-20', '18:00', 'images/pag-galeria/cantata-25/cantata25-03.webp', true),
  ('Culto da Virada', 'Virada', 'Fim de ano',
   'Vamos encerrar o ano e começar o próximo juntos, em adoração e gratidão.',
   '2026-12-31', '22:00', null, true);
