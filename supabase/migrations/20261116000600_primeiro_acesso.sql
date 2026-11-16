-- Primeiro acesso (D62): a pessoa diz como quer ser chamada e, se quiser, põe
-- uma foto ANTES de esperar a aprovação. O admin reconhece quem é pelo rosto
-- e pelo nome, e na aprovação a foto já vai para o cadastro da pessoa.
--
-- A conta pendente ainda não tem "pessoa" (quem liga é o admin). Por isso a
-- foto fica numa pasta da própria conta: fotos/contas/<id da conta>/<arquivo>.

alter table public.conta
  add column foto_informada text check (foto_informada ~ '^contas/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'),
  add column apresentou_em timestamptz;
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
create function public.apresentar_me(p_nome text, p_foto text default null)
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
  update public.conta
  set nome_informado = trim(p_nome), foto_informada = p_foto, apresentou_em = now()
  where id = auth.uid() and estado = 'pendente';
  if not found then
    raise exception 'Só dá para fazer isso enquanto o pedido espera aprovação.' using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function public.apresentar_me(text, text) from public, anon;
grant execute on function public.apresentar_me(text, text) to authenticated;

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
