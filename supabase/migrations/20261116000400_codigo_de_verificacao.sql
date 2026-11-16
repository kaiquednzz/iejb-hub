-- Verificação em duas etapas (D57): o dinheiro da igreja pede senha E código.
--
-- Por quê: até aqui, quem descobrisse a senha de alguém da tesouraria ou do
-- pastor via e mexia no caixa inteiro. Agora o banco só libera o financeiro
-- numa sessão confirmada com o código de 6 dígitos do app autenticador
-- (TOTP, o "aal2" do Supabase Auth). A senha sozinha deixa de bastar.
--
-- Onde vale:
--   1. Ver e mexer no financeiro (ve_financeiro / edita_financeiro). Tudo do
--      financeiro já passa por essas duas funções: RLS das tabelas, o resumo
--      e as funções de contagem.
--   2. Dar ou tirar cargo e tornar alguém admin. Sem isso o MFA teria um
--      atalho: quem roubasse a senha de um admin se daria o cargo de
--      tesouraria e cadastraria o PRÓPRIO celular como segundo fator.
--
-- Onde NÃO vale (de propósito): escala, repertório, avisos e a conferência
-- da contagem (o conferente só vê o valor que ele mesmo contou). Pedir código
-- pra todo mundo afastaria quem só quer ver a escala.
--
-- Se alguém perder o celular: o admin do Supabase apaga o fator no painel
-- (Authentication > Users > a pessoa > MFA) e ela cadastra de novo. Não tem
-- botão no app pra isso, também de propósito: seria um caminho a mais pra
-- quem tivesse a senha de um admin.

create function privado.confirmou_codigo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
comment on function privado.confirmou_codigo() is
  'Verdadeiro quando a sessão foi confirmada com o código do app autenticador (aal2).';
revoke execute on function privado.confirmou_codigo() from public, anon;
grant execute on function privado.confirmou_codigo() to authenticated;

create or replace function privado.ve_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (privado.tem_cargo('tesouraria') or privado.tem_cargo('pastor'))
     and privado.confirmou_codigo();
$$;

create or replace function privado.edita_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$
  select privado.tem_cargo('tesouraria') and privado.confirmou_codigo();
$$;

-- Cargos: só admin, e com código
drop policy "cargo: admin dá"  on public.cargo_pessoa;
drop policy "cargo: admin tira" on public.cargo_pessoa;
create policy "cargo: admin dá" on public.cargo_pessoa
for insert to authenticated with check (privado.e_admin() and privado.confirmou_codigo());
create policy "cargo: admin tira" on public.cargo_pessoa
for delete to authenticated using (privado.e_admin() and privado.confirmou_codigo());

create or replace function public.definir_administrador(p_conta uuid, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.exigir_admin();
  if not privado.confirmou_codigo() then
    raise exception 'Confirme com o código do app autenticador para mudar administradores.'
      using errcode = 'insufficient_privilege';
  end if;

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
