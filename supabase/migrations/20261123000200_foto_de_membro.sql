-- =============================================================================
-- Migração: membro posta foto do último culto (D70)
-- =============================================================================
-- Qualquer conta aprovada pode postar UMA foto (com legenda curta) de cada
-- culto, nas 48 horas depois que ele começa. Aparece na hora no mural.
--
-- Travas para não virar bagunça nem pesar:
--   * 1 foto por post e 1 post por pessoa por culto;
--   * só nas 48h depois do culto (é "foto do último culto", não um feed);
--   * some sozinha em 90 dias, menos as que a Comunicação marcar "guardar"
--     (a limpeza é a função limpar-mural, que apaga o arquivo e o post);
--   * o autor edita a legenda e apaga a dele; pastor, Comunicação e admin
--     apagam qualquer uma (moderação depois, decisão do Kaique).
-- =============================================================================

alter table public.mural_publicacao
  add column de_membro boolean not null default false,
  add column culto_id  uuid references public.culto (id) on delete set null,
  add column guardar   boolean not null default false;
comment on column public.mural_publicacao.de_membro is 'Foto postada por um membro (D70): uma por pessoa por culto, some em 90 dias se guardar = false.';
comment on column public.mural_publicacao.guardar is 'Marcada por quem publica: a foto de membro não é apagada aos 90 dias.';

create unique index mural_uma_foto_por_culto on public.mural_publicacao (criado_por, culto_id) where de_membro;

-- Quem publica marca "guardar"; o autor de uma foto de membro edita a legenda
grant update (guardar) on public.mural_publicacao to authenticated;

drop policy "mural: quem publica edita" on public.mural_publicacao;
create policy "mural: quem publica ou o autor da foto edita"
on public.mural_publicacao for update to authenticated
using (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()))
with check (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()));

drop policy "mural: quem publica apaga" on public.mural_publicacao;
create policy "mural: quem publica ou o autor da foto apaga"
on public.mural_publicacao for delete to authenticated
using (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()));

-- O autor só mexe na legenda: fixar, guardar e título são de quem publica
create function privado.mural_autor_so_muda_legenda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.publica_no_mural() and (
       new.fixado_ate is distinct from old.fixado_ate
    or new.guardar is distinct from old.guardar
    or new.titulo is distinct from old.titulo
    or new.referencia is distinct from old.referencia) then
    raise exception 'Você pode mudar só a legenda da sua foto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function privado.mural_autor_so_muda_legenda() from public, anon, authenticated;
create trigger mural_autor_so_muda_legenda
before update on public.mural_publicacao
for each row execute function privado.mural_autor_so_muda_legenda();

-- O culto que está aceitando fotos agora (começou há menos de 48h)
create function public.culto_para_foto()
returns table (id uuid, nome text, data date, horario time, ja_postei boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.data, c.horario,
         exists (select 1 from public.mural_publicacao m
                 where m.de_membro and m.culto_id = c.id and m.criado_por = privado.minha_pessoa_id())
  from public.culto c
  where privado.minha_pessoa_id() is not null
    and c.estado = 'ativo'
    and ((c.data + c.horario) at time zone 'America/Sao_Paulo') between now() - interval '48 hours' and now()
  order by c.data desc, c.horario desc
  limit 1;
$$;
revoke execute on function public.culto_para_foto() from public, anon;
grant execute on function public.culto_para_foto() to authenticated;

create function public.postar_foto_do_culto(p_culto uuid, p_foto text, p_legenda text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu      uuid := privado.minha_pessoa_id();
  v_legenda text := nullif(btrim(p_legenda), '');
  v_id      uuid;
begin
  if v_eu is null then
    raise exception 'Só quem tem conta aprovada posta foto.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.culto_para_foto() c where c.id = p_culto) then
    raise exception 'As fotos desse culto já fecharam (dá até 48 horas depois dele).' using errcode = '22023';
  end if;
  -- A foto fica na pasta da própria pessoa: membros/<pessoa>/<uuid>.webp
  if p_foto !~ ('^membros/' || v_eu::text || '/[0-9a-f-]{36}\.(webp|jpg)$') then
    raise exception 'Foto inválida.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_legenda, '')) > 140 then
    raise exception 'A legenda vai até 140 letras.' using errcode = '22023';
  end if;
  if exists (select 1 from public.mural_publicacao where de_membro and culto_id = p_culto and criado_por = v_eu) then
    raise exception 'Você já postou uma foto desse culto. Apague a outra para trocar.' using errcode = 'P0001';
  end if;

  insert into public.mural_publicacao (tipo, texto, fotos, criado_por, de_membro, culto_id)
  values ('fotos', v_legenda, array[p_foto], v_eu, true, p_culto)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.postar_foto_do_culto(uuid, text, text) from public, anon;
grant execute on function public.postar_foto_do_culto(uuid, text, text) to authenticated;

-- A porta de quem publica continua aceitando só nomes simples (uuid.webp);
-- a de membro, só a pasta da pessoa. O check do nome de arquivo fica em cada
-- função. Fotos de membro vencidas (para a limpeza):
create function public.fotos_de_membro_vencidas()
returns table (id uuid, fotos text[])
language sql
stable
security definer
set search_path = ''
as $$
  select id, fotos from public.mural_publicacao
  where de_membro and not guardar and criado_em < now() - interval '90 days';
$$;
revoke execute on function public.fotos_de_membro_vencidas() from public, anon, authenticated;
grant execute on function public.fotos_de_membro_vencidas() to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- Membro sobe e apaga só na própria pasta (membros/<pessoa>/...)
    create policy "mural: membro sobe a foto dele"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'mural' and (storage.foldername(name))[1] = 'membros'
                and (storage.foldername(name))[2] = privado.minha_pessoa_id()::text);
    create policy "mural: membro apaga a foto dele"
    on storage.objects for delete to authenticated
    using (bucket_id = 'mural' and (storage.foldername(name))[1] = 'membros'
           and (storage.foldername(name))[2] = privado.minha_pessoa_id()::text);
  end if;
end;
$$;

-- Limpeza diária às 4h (função limpar-mural, com a chave de serviço)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('limpar-mural', '0 7 * * *', $cron$
      select net.http_post(
        url := 'https://hqalztygktkabwybmdyl.supabase.co/functions/v1/limpar-mural',
        body := '{}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 30000)
    $cron$);
  end if;
end;
$$;
