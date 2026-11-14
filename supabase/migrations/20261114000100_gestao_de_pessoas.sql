-- =============================================================================
-- 10. Gestão de pessoas e pedidos de acesso pelo app
-- Regras: RN-10, RN-13, RN-14 | Tela "Equipe" do app
--
-- Três funções "security invoker": rodam com o poder de quem chamou, então o
-- RLS das tabelas continua decidindo quem pode o quê. Elas só existem para
-- juntar vários passos numa transação só (ou tudo dá certo, ou nada muda):
-- cadastrar a pessoa sem vínculo com o Louvor, ou aprovar um pedido e deixar
-- uma pessoa órfã no meio do caminho, seria pior do que um erro.
-- =============================================================================

-- Cadastra uma pessoa (com ou sem conta) e já a liga ao ministério.
-- Sem esse vínculo ela não poderia entrar em nenhum grupo.
create function public.cadastrar_pessoa(
  p_nome         text,
  p_apelido      text,
  p_contato      text,
  p_instrumentos text[],
  p_ministerio   uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pessoa uuid;
begin
  insert into public.pessoa (nome, apelido, contato, instrumentos)
  values (
    trim(p_nome),
    nullif(trim(p_apelido), ''),
    nullif(trim(p_contato), ''),
    coalesce(p_instrumentos, '{}')
  )
  returning id into v_pessoa;

  insert into public.membro_ministerio (pessoa_id, ministerio_id)
  values (v_pessoa, p_ministerio);

  return v_pessoa;
end;
$$;

-- Aprova um pedido de acesso (RN-10). Se p_pessoa vier vazio, cria a pessoa
-- com p_nome. Em qualquer caso garante o vínculo ativo com o ministério.
-- A checagem de administrador fica com public.aprovar_conta (security definer).
create function public.aprovar_pedido(
  p_conta      uuid,
  p_pessoa     uuid,
  p_nome       text,
  p_ministerio uuid
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

  insert into public.membro_ministerio (pessoa_id, ministerio_id)
  values (v_pessoa, p_ministerio)
  on conflict (pessoa_id, ministerio_id) do update set ativo = true;

  perform public.aprovar_conta(p_conta, v_pessoa, false);
  return v_pessoa;
end;
$$;

-- Desativa ou reativa uma pessoa (RN-13). Nunca apaga: escalas antigas
-- continuam mostrando quem tocou. O vínculo com os ministérios acompanha.
-- Pessoa desativada perde o acesso ao Hub na hora (minha_pessoa_id exige
-- pessoa ativa), por isso as duas travas abaixo.
create function public.definir_pessoa_ativa(p_pessoa uuid, p_ativa boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not p_ativa then
    if p_pessoa = privado.minha_pessoa_id() then
      raise exception 'Você não pode desativar a si mesmo.';
    end if;
    if privado.e_admin_ativo(p_pessoa) and not privado.existe_outro_admin(p_pessoa) then
      raise exception 'Não é possível desativar o último administrador.';
    end if;
  end if;

  update public.pessoa set ativa = p_ativa where id = p_pessoa;
  if not found then
    raise exception 'Pessoa não encontrada ou sem permissão.';
  end if;

  update public.membro_ministerio set ativo = p_ativa where pessoa_id = p_pessoa;
end;
$$;

-- Auxiliares das travas acima. Definer porque a tabela conta só é visível
-- para administradores e o líder de louvor também desativa pessoas.
create function privado.e_admin_ativo(p_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conta c
    where c.pessoa_id = p_pessoa and c.estado = 'ativa' and c.e_administrador
  );
$$;

create function privado.existe_outro_admin(p_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conta c
    join public.pessoa p on p.id = c.pessoa_id
    where c.pessoa_id <> p_pessoa
      and c.estado = 'ativa' and c.e_administrador and p.ativa
  );
$$;

-- A migração 09 fez as funções novas nascerem fechadas: abrir só o que o app usa.
revoke execute on function privado.e_admin_ativo(uuid), privado.existe_outro_admin(uuid) from public, anon;
grant execute on function privado.e_admin_ativo(uuid), privado.existe_outro_admin(uuid) to authenticated;
grant execute on function
  public.cadastrar_pessoa(text, text, text, text[], uuid),
  public.aprovar_pedido(uuid, uuid, text, uuid),
  public.definir_pessoa_ativa(uuid, boolean)
to authenticated;
