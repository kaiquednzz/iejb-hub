-- =============================================================================
-- 11. Montar a escala do mês + fotos de perfil
-- Regras: RN-02, RN-30 a RN-36 | Escala de novembro/2026 enviada por Kaique
--
-- O que a planilha do líder mostrou e o modelo ainda não tinha:
--   - "Mesa": quem opera o som em cada culto. Vira uma pessoa da escala com a
--     função "Mesa" (instrumento_exibido), sem grupo de origem. Assim entra e
--     sai da escala como qualquer um e os avisos (RN-41) funcionam sozinhos.
--   - "CEIA": um rótulo curto no culto (culto.rotulo), que também serve para
--     "Jovens", "Santa Ceia", "Batismo"...
-- =============================================================================

alter table public.culto
  add column rotulo text
  check (rotulo is null or length(trim(rotulo)) between 1 and 30);
comment on column public.culto.rotulo is 'Marca curta do culto, ex.: Ceia. Aparece na escala e na mensagem do WhatsApp.';

alter table public.pessoa
  add column foto text
  check (foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$');
comment on column public.pessoa.foto is 'Caminho no bucket "fotos" (pessoa_id/arquivo). Nome novo a cada troca: o arquivo nunca muda, então pode ficar em cache para sempre.';

-- -----------------------------------------------------------------------------
-- Escala de um culto: acha a do ministério ou cria em rascunho.
-- Invoker: o RLS de escala decide (só o líder de louvor cria).
-- -----------------------------------------------------------------------------
create function privado.escala_do_culto(p_culto uuid, p_ministerio uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_escala uuid;
begin
  select id into v_escala from public.escala
  where culto_id = p_culto and ministerio_id = p_ministerio;
  if v_escala is null then
    insert into public.escala (culto_id, ministerio_id)
    values (p_culto, p_ministerio)
    returning id into v_escala;
  end if;
  return v_escala;
end;
$$;

-- Troca os grupos de um culto (um toque no G2 da semana, ou G2 + G3 num
-- culto especial). Quem veio de um grupo que saiu e não está nos novos sai
-- da escala; quem foi incluído à mão (avulso, mesa) fica. Quem está nos dois
-- não sai e entra de novo: assim, numa escala publicada, o aviso só vai para
-- quem realmente mudou.
create function public.definir_grupos_do_culto(p_culto uuid, p_ministerio uuid, p_grupos uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_escala uuid := privado.escala_do_culto(p_culto, p_ministerio);
  v_grupo  uuid;
begin
  p_grupos := coalesce(p_grupos, '{}');

  delete from public.escala_item i
  where i.escala_id = v_escala
    and i.origem_grupo_id is not null
    and not (i.origem_grupo_id = any (p_grupos))
    and not exists (
      select 1 from public.grupo_membro gm
      where gm.grupo_id = any (p_grupos) and gm.pessoa_id = i.pessoa_id
    );

  -- Quem ficou porque também está num grupo novo passa a "vir" dele
  update public.escala_item i
  set origem_grupo_id = (
    select gm.grupo_id from public.grupo_membro gm
    where gm.grupo_id = any (p_grupos) and gm.pessoa_id = i.pessoa_id
    limit 1)
  where i.escala_id = v_escala
    and i.origem_grupo_id is not null
    and not (i.origem_grupo_id = any (p_grupos));

  delete from public.escala_grupo
  where escala_id = v_escala and not (grupo_id = any (p_grupos));

  foreach v_grupo in array p_grupos loop
    perform public.preencher_escala_com_grupo(v_escala, v_grupo);
  end loop;

  return v_escala;
end;
$$;

-- Define quem fica na mesa de som do culto (p_pessoa nulo = ninguém).
-- Se a pessoa já toca nesse culto, ganha "Mesa" junto com o instrumento.
create function public.definir_mesa(p_culto uuid, p_ministerio uuid, p_pessoa uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_escala uuid := privado.escala_do_culto(p_culto, p_ministerio);
begin
  -- Tira a mesa de quem tinha (e a pessoa inteira, se ela só estava pela mesa)
  delete from public.escala_item
  where escala_id = v_escala and pessoa_id is distinct from p_pessoa
    and origem_grupo_id is null and instrumento_exibido = array['Mesa'];
  update public.escala_item
  set instrumento_exibido = array_remove(instrumento_exibido, 'Mesa')
  where escala_id = v_escala and pessoa_id is distinct from p_pessoa
    and 'Mesa' = any (instrumento_exibido);

  if p_pessoa is not null then
    insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido)
    values (v_escala, p_pessoa, array['Mesa'])
    on conflict (escala_id, pessoa_id) do update
      set instrumento_exibido = public.escala_item.instrumento_exibido || array['Mesa']
      where not ('Mesa' = any (public.escala_item.instrumento_exibido));
  end if;

  return v_escala;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fotos de perfil
-- Quem troca a foto de uma pessoa: ela mesma, o admin e o líder de louvor.
-- -----------------------------------------------------------------------------
create function privado.pode_mudar_foto(p_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_pessoa is not null and (
    p_pessoa = privado.minha_pessoa_id()
    or privado.e_admin()
    or privado.e_lider_de_algum_ministerio()
  );
$$;

-- Para as políticas do Storage: a primeira pasta do caminho é a pessoa.
-- Caminho fora do padrão devolve falso em vez de erro.
create function privado.pode_mudar_foto_no_caminho(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_nome ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
      then privado.pode_mudar_foto(split_part(p_nome, '/', 1)::uuid)
    else false
  end;
$$;

-- Definer porque o integrante comum não edita a tabela pessoa (só a própria foto).
create function public.definir_foto(p_pessoa uuid, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.pode_mudar_foto(p_pessoa) then
    raise exception 'Você não pode trocar a foto dessa pessoa.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_caminho is not null and split_part(p_caminho, '/', 1) <> p_pessoa::text then
    raise exception 'Caminho de foto inválido.';
  end if;
  update public.pessoa set foto = p_caminho where id = p_pessoa;
end;
$$;

-- Bucket e políticas: só existem no Supabase de verdade (os testes locais
-- não têm o esquema storage, por isso o "if").
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    -- Público para leitura (o link tem dois UUIDs, ninguém adivinha), com
    -- limite de 200 KB e só WebP/JPEG: o app comprime antes de mandar, e o
    -- próprio Supabase recusa foto crua de celular se alguém tentar furar.
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', true, 204800, array['image/webp', 'image/jpeg'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    create policy "fotos: contas prontas veem"
    on storage.objects for select to authenticated
    using (bucket_id = 'fotos' and privado.minha_pessoa_id() is not null);

    create policy "fotos: sobe quem pode mudar"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and privado.pode_mudar_foto_no_caminho(name));

    create policy "fotos: apaga quem pode mudar"
    on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and privado.pode_mudar_foto_no_caminho(name));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios (funções novas nascem fechadas desde a migração 09)
-- -----------------------------------------------------------------------------
revoke execute on function
  privado.escala_do_culto(uuid, uuid),
  privado.pode_mudar_foto(uuid),
  privado.pode_mudar_foto_no_caminho(text)
from public, anon;
grant execute on function
  privado.escala_do_culto(uuid, uuid),
  privado.pode_mudar_foto(uuid),
  privado.pode_mudar_foto_no_caminho(text)
to authenticated;
grant execute on function
  public.definir_grupos_do_culto(uuid, uuid, uuid[]),
  public.definir_mesa(uuid, uuid, uuid),
  public.definir_foto(uuid, text)
to authenticated;
