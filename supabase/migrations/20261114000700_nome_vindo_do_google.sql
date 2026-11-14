-- =============================================================================
-- 16. Nome de quem entra com Google
-- O cadastro por e-mail manda o nome em raw_user_meta_data.nome. O Google manda
-- em full_name/name. Sem isto, o pedido de acesso chegaria ao admin sem nome.
-- =============================================================================
create or replace function privado.criar_conta_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conta (id, login, nome_informado)
  values (
    new.id,
    coalesce(new.email, new.phone, new.id::text),
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'nome',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )), '')
  );
  return new;
end;
$$;

revoke execute on function privado.criar_conta_para_novo_usuario() from public, anon, authenticated;
