-- Primeiro acesso (D62): a pessoa diz como quer ser chamada, se tem algum
-- cargo na igreja e, se quiser, põe uma foto ANTES de esperar a aprovação. O admin reconhece quem é pelo rosto
-- e pelo nome, e na aprovação a foto já vai para o cadastro da pessoa.
--
-- A conta pendente ainda não tem "pessoa" (quem liga é o admin). Por isso a
-- foto fica numa pasta da própria conta: fotos/contas/<id da conta>/<arquivo>.

alter table public.conta
  add column foto_informada text check (foto_informada ~ '^contas/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'),
  add column apresentou_em timestamptz,
  add column cargos_pedidos text[] not null default '{}'
    check (cargos_pedidos <@ array['tesouraria', 'pastor', 'comunicacao']::text[]),
  add column louvor_pedido boolean not null default false,
  add column instrumentos_pedidos text[] not null default '{}' check (cardinality(instrumentos_pedidos) <= 8);
comment on column public.conta.louvor_pedido is 'A pessoa disse que é do Louvor no primeiro acesso (D62), com os instrumentos em instrumentos_pedidos. Só vale se o admin aprovar.';
comment on column public.conta.cargos_pedidos is 'Cargos que a pessoa disse ter na igreja no primeiro acesso (D62). Só valem se o admin aprovar.';
comment on column public.conta.foto_informada is 'Foto que a pessoa pôs antes de ser aprovada (D62). Na aprovação vira a foto da pessoa, se ela não tiver uma.';
comment on column public.conta.apresentou_em is 'Quando a pessoa confirmou nome e foto no primeiro acesso (D62). Vazio: a tela de "Quase lá" aparece.';

-- A foto da pessoa pode vir da pasta da conta (foto do primeiro acesso)
do $$
declare v text;
begin
  for v in select conname from pg_constraint
           where conrelid = 'public.pessoa'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%foto%'
  loop
    execute format('alter table public.pessoa drop constraint %I', v);
  end loop;
end $$;
alter table public.pessoa add constraint pessoa_foto_caminho check (
  foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$' or foto ~ '^contas/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$');

-- Upload: além de pessoa_id/arquivo, a própria conta pode subir em contas/<eu>/
create or replace function privado.pode_mudar_foto_no_caminho(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_nome ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
      then privado.pode_mudar_foto(split_part(p_nome, '/', 1)::uuid)
    when p_nome ~ '^contas/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
      then split_part(p_nome, '/', 2)::uuid = auth.uid()
    else false
  end;
$$;

-- A pessoa pendente confirma como quer ser chamada (e a foto, se pôs)
create function public.apresentar_me(p_nome text, p_foto text default null, p_cargos text[] default '{}',
  p_louvor boolean default false, p_instrumentos text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(length(trim(p_nome)), 0) not between 2 and 60 then
    raise exception 'Escreva seu nome.' using errcode = 'check_violation';
  end if;
  if p_foto is not null and split_part(p_foto, '/', 2) <> auth.uid()::text then
    raise exception 'Foto inválida.' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(p_cargos, '{}') <@ array['tesouraria', 'pastor', 'comunicacao']::text[] then
    raise exception 'Cargo inválido.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_instrumentos, '{}')) i where length(trim(i)) not between 1 and 30) then
    raise exception 'Instrumento inválido.' using errcode = 'check_violation';
  end if;
  update public.conta
  set nome_informado = trim(p_nome), foto_informada = p_foto, apresentou_em = now(), cargos_pedidos = coalesce(p_cargos, '{}'),
      louvor_pedido = coalesce(p_louvor, false),
      instrumentos_pedidos = case when p_louvor then array(select distinct trim(i) from unnest(coalesce(p_instrumentos, '{}')) i) else '{}' end
  where id = auth.uid() and estado = 'pendente';
  if not found then
    raise exception 'Só dá para fazer isso enquanto o pedido espera aprovação.' using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function public.apresentar_me(text, text, text[], boolean, text[]) from public, anon;
grant execute on function public.apresentar_me(text, text, text[], boolean, text[]) to authenticated;

-- Aprovar: a foto que a pessoa pôs vira a foto do cadastro (se ainda não tem)
create or replace function public.aprovar_conta(
  p_conta uuid,
  p_pessoa uuid,
  p_senha_temporaria boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_foto text;
begin
  perform privado.exigir_admin();

  if not exists (select 1 from public.pessoa where id = p_pessoa and ativa) then
    raise exception 'Pessoa não encontrada ou desativada.';
  end if;
  if exists (select 1 from public.conta where pessoa_id = p_pessoa and id <> p_conta) then
    raise exception 'Essa pessoa já tem outra conta.';
  end if;

  update public.conta
  set estado = 'ativa',
      pessoa_id = p_pessoa,
      senha_temporaria = p_senha_temporaria,
      decidido_por = auth.uid(),
      decidido_em = now()
  where id = p_conta and estado in ('pendente', 'recusada', 'desativada')
  returning foto_informada into v_foto;

  if not found then
    raise exception 'Conta não encontrada ou já ativa.';
  end if;

  if v_foto is not null then
    update public.pessoa set foto = v_foto where id = p_pessoa and foto is null;
  end if;

  perform privado.auditar('aprovar_conta',
    jsonb_build_object('conta', p_conta, 'pessoa', p_pessoa, 'senha_temporaria', p_senha_temporaria));
end;
$$;
revoke execute on function public.aprovar_conta(uuid, uuid, boolean) from public, anon;
grant execute on function public.aprovar_conta(uuid, uuid, boolean) to authenticated;

-- Aprovar pedido: o admin escolhe o que vale do que a pessoa pediu.
-- Antes, toda conta aprovada virava do Louvor; agora só se marcar Louvor.
-- Cargos passam pela tabela cargo_pessoa (RLS): só admin dá.
drop function public.aprovar_pedido(uuid, uuid, text, uuid);
create function public.aprovar_pedido(
  p_conta        uuid,
  p_pessoa       uuid,
  p_nome         text,
  p_ministerio   uuid,
  p_louvor       boolean default true,
  p_instrumentos text[] default '{}',
  p_cargos       text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pessoa uuid := p_pessoa;
begin
  if not privado.e_admin() then
    raise exception 'Apenas administradores podem fazer isso.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_pessoa is null then
    if length(trim(coalesce(p_nome, ''))) = 0 then
      raise exception 'Informe o nome da pessoa.';
    end if;
    insert into public.pessoa (nome) values (trim(p_nome)) returning id into v_pessoa;
  end if;

  if p_louvor then
    insert into public.membro_ministerio (pessoa_id, ministerio_id)
    values (v_pessoa, p_ministerio)
    on conflict (pessoa_id, ministerio_id) do update set ativo = true;
    if cardinality(coalesce(p_instrumentos, '{}')) > 0 then
      update public.pessoa
      set instrumentos = array(select distinct x from unnest(instrumentos || p_instrumentos) x)
      where id = v_pessoa;
    end if;
  end if;

  insert into public.cargo_pessoa (pessoa_id, cargo)
  select v_pessoa, c from unnest(coalesce(p_cargos, '{}')) c
  on conflict do nothing;

  perform public.aprovar_conta(p_conta, v_pessoa, false);
  return v_pessoa;
end;
$$;
revoke execute on function public.aprovar_pedido(uuid, uuid, text, uuid, boolean, text[], text[]) from public, anon;
grant execute on function public.aprovar_pedido(uuid, uuid, text, uuid, boolean, text[], text[]) to authenticated;
