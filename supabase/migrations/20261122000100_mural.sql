-- =============================================================================
-- Migração: Mural da igreja (D68)
-- =============================================================================
-- O Início deixa de ser só "a sua escala" e ganha o que a igreja toda quer ver:
-- avisos, fotos do culto e uma palavra. Quem publica: administrador, pastor e
-- Comunicação. Quem vê: toda conta aprovada (com ou sem ministério).
--
--   * Sem comentários (de propósito): só Amém e coração. Ninguém precisa moderar.
--   * Fotos num bucket PRIVADO: rosto de criança e de irmão não fica com link
--     aberto na internet. O app pede um link assinado que vence em uma hora.
--   * Fixar até uma data: o aviso da cantata fica no topo até o dia dela.
--   * Notificar é opcional e começa desligado no app: push demais vira ruído.
-- =============================================================================

-- Quem publica ---------------------------------------------------------------
create function privado.publica_no_mural()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.e_admin() or privado.tem_cargo('comunicacao') or privado.tem_cargo('pastor');
$$;
revoke execute on function privado.publica_no_mural() from public, anon;
grant execute on function privado.publica_no_mural() to authenticated;

-- Hoje no relógio de Brasília (o "fixado até" é uma data da igreja, não do UTC)
create function privado.hoje_em_brasilia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke execute on function privado.hoje_em_brasilia() from public, anon;
grant execute on function privado.hoje_em_brasilia() to authenticated;

-- Publicações ----------------------------------------------------------------
create table public.mural_publicacao (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('aviso', 'fotos', 'palavra')),
  titulo      text check (titulo is null or char_length(titulo) between 1 and 80),
  texto       text check (texto is null or char_length(texto) between 1 and 1000),
  referencia  text check (referencia is null or char_length(referencia) between 1 and 60),
  -- Nomes de arquivo no bucket "mural" (uuid.webp). Até 10 por publicação.
  fotos       text[] not null default '{}' check (cardinality(fotos) <= 10),
  fixado_ate  date,
  criado_por  uuid not null references public.pessoa (id) on delete restrict,
  criado_em   timestamptz not null default now(),
  -- Cada tipo tem o seu mínimo: aviso com título, fotos com foto, palavra com texto
  constraint mural_tem_o_minimo check (
    (tipo = 'aviso'   and titulo is not null) or
    (tipo = 'fotos'   and cardinality(fotos) between 1 and 10) or
    (tipo = 'palavra' and texto is not null)
  ),
  constraint mural_foto_so_em_fotos check (tipo = 'fotos' or cardinality(fotos) = 0)
);
comment on table public.mural_publicacao is 'Mural da igreja no Início (D68). Publica: admin, pastor, Comunicação. Vê: toda conta aprovada.';
comment on column public.mural_publicacao.fixado_ate is 'Fica no topo do mural até este dia (inclusive), no relógio de Brasília.';
create index mural_publicacao_recentes on public.mural_publicacao (criado_em desc);

alter table public.mural_publicacao enable row level security;
revoke all on public.mural_publicacao from anon, authenticated;
grant select, delete on public.mural_publicacao to authenticated;
-- Depois de publicado, só muda o texto e o "fixado até". Tipo, fotos e autor ficam.
grant update (titulo, texto, referencia, fixado_ate) on public.mural_publicacao to authenticated;
grant all on public.mural_publicacao to service_role;

create policy "mural: membros veem"
on public.mural_publicacao for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "mural: quem publica edita"
on public.mural_publicacao for update to authenticated
using (privado.publica_no_mural())
with check (privado.publica_no_mural());

create policy "mural: quem publica apaga"
on public.mural_publicacao for delete to authenticated
using (privado.publica_no_mural());

-- Reações --------------------------------------------------------------------
create table public.mural_reacao (
  publicacao_id uuid not null references public.mural_publicacao (id) on delete cascade,
  pessoa_id     uuid not null default privado.minha_pessoa_id() references public.pessoa (id) on delete cascade,
  tipo          text not null check (tipo in ('amem', 'coracao')),
  criado_em     timestamptz not null default now(),
  primary key (publicacao_id, pessoa_id, tipo)
);
comment on table public.mural_reacao is 'Amém e coração do mural. Cada pessoa dá no máximo um de cada por publicação.';

alter table public.mural_reacao enable row level security;
revoke all on public.mural_reacao from anon, authenticated;
grant select, insert, delete on public.mural_reacao to authenticated;
grant all on public.mural_reacao to service_role;

create policy "reação: membros veem"
on public.mural_reacao for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "reação: cada um a sua"
on public.mural_reacao for insert to authenticated
with check (pessoa_id = privado.minha_pessoa_id());

create policy "reação: cada um tira a sua"
on public.mural_reacao for delete to authenticated
using (pessoa_id = privado.minha_pessoa_id());

-- Aviso no celular -----------------------------------------------------------
alter table public.aviso drop constraint aviso_tipo_check;
alter table public.aviso add constraint aviso_tipo_check check (tipo in (
  'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
  'solicitacao_nova', 'solicitacao_decidida', 'presenca_alterada',
  'contagem_para_conferir', 'contagem_decidida', 'contagem_sem_conferencia',
  'mural_publicacao'));

-- Publicar (uma porta só: valida, grava e, se pedido, avisa a igreja) --------
create function public.publicar_no_mural(
  p_tipo       text,
  p_titulo     text default null,
  p_texto      text default null,
  p_referencia text default null,
  p_fotos      text[] default '{}',
  p_fixado_ate date default null,
  p_avisar     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := privado.minha_pessoa_id();
  v_id     uuid;
  v_titulo text := nullif(btrim(p_titulo), '');
  v_texto  text := nullif(btrim(p_texto), '');
  v_ref    text := nullif(btrim(p_referencia), '');
  v_fotos  text[] := coalesce(p_fotos, '{}');
  v_resumo text;
  v_todos  uuid[];
begin
  if v_eu is null or not privado.publica_no_mural() then
    raise exception 'Só o pastor, a Comunicação e o administrador publicam no mural.' using errcode = '42501';
  end if;

  -- O app manda só o nome do arquivo que ele mesmo subiu: nada de caminho de
  -- outro bucket nem "../"
  if exists (select 1 from unnest(v_fotos) f where f !~ '^[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'Foto inválida.' using errcode = '22023';
  end if;
  if p_fixado_ate is not null and p_fixado_ate < privado.hoje_em_brasilia() then
    raise exception 'A data de fixar já passou.' using errcode = '22023';
  end if;

  insert into public.mural_publicacao (tipo, titulo, texto, referencia, fotos, fixado_ate, criado_por)
  values (p_tipo, v_titulo, v_texto, v_ref, v_fotos, p_fixado_ate, v_eu)
  returning id into v_id;

  if p_avisar then
    v_resumo := coalesce(v_titulo, left(v_texto, 120),
                         case p_tipo when 'fotos' then 'Fotos novas no mural' else 'Novidade no mural' end);
    select array_agg(c.pessoa_id) into v_todos
    from public.conta c
    where c.estado = 'ativa' and c.pessoa_id is not null and c.pessoa_id <> v_eu;
    perform privado.criar_aviso('mural_publicacao', null, null, v_resumo, v_todos);
  end if;

  return v_id;
end;
$$;
revoke execute on function public.publicar_no_mural(text, text, text, text, text[], date, boolean) from public, anon;
grant execute on function public.publicar_no_mural(text, text, text, text, text[], date, boolean) to authenticated;

-- Bucket privado das fotos ---------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- PRIVADO (D68): ao contrário das fotos de perfil, aqui tem foto de culto,
    -- de criança, de família. Só conta aprovada gera link (assinado, 1 hora).
    -- 500 KB e só WebP/JPEG: o app reduz para 1600 px antes de mandar.
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('mural', 'mural', false, 512000, array['image/webp', 'image/jpeg'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    create policy "mural: membros veem as fotos"
    on storage.objects for select to authenticated
    using (bucket_id = 'mural' and privado.minha_pessoa_id() is not null);

    create policy "mural: quem publica sobe"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'mural' and privado.publica_no_mural());

    create policy "mural: quem publica apaga"
    on storage.objects for delete to authenticated
    using (bucket_id = 'mural' and privado.publica_no_mural());
  end if;
end;
$$;
