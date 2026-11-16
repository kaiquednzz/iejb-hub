-- Tira o código do app autenticador (revoga D57, decisão do Kaique em 16/11).
--
-- Motivo: quem usa o financeiro é gente de mais idade; um app de senha a mais,
-- e o problema de celular trocado ou perdido, iam virar dor de cabeça toda
-- semana. O financeiro volta a pedir só a senha. O que continua protegendo:
-- só tesouraria e pastor veem (admin não), tudo fica no histórico, e a senha
-- vazada é recusada no cadastro (D54).

create or replace function privado.ve_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.tem_cargo('tesouraria') or privado.tem_cargo('pastor'); $$;

create or replace function privado.edita_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.tem_cargo('tesouraria'); $$;

drop policy "cargo: admin dá"  on public.cargo_pessoa;
drop policy "cargo: admin tira" on public.cargo_pessoa;
create policy "cargo: admin dá" on public.cargo_pessoa
for insert to authenticated with check (privado.e_admin());
create policy "cargo: admin tira" on public.cargo_pessoa
for delete to authenticated using (privado.e_admin());

create or replace function public.definir_administrador(p_conta uuid, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.exigir_admin();

  update public.conta set e_administrador = p_valor
  where id = p_conta and estado = 'ativa';

  if not found then
    raise exception 'Só contas ativas podem ser administradoras.';
  end if;

  perform privado.auditar('definir_administrador',
    jsonb_build_object('conta', p_conta, 'valor', p_valor));
end;
$$;
revoke execute on function public.definir_administrador(uuid, boolean) from public, anon;
grant execute on function public.definir_administrador(uuid, boolean) to authenticated;

drop function privado.confirmou_codigo();
