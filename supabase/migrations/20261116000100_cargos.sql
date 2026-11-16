-- =============================================================================
-- 24. Cargos: Tesouraria, Pastor e Comunicação (D45)
--
-- Até aqui os papéis eram marcadores soltos (admin na conta, líder no vínculo
-- com o Louvor). Com o financeiro e os eventos, a igreja precisa de cargos que
-- não pertencem a um ministério:
--   - tesouraria:  lança e edita o financeiro;
--   - pastor:      vê o financeiro, sem editar;
--   - comunicacao: cuida dos eventos do site, junto com o admin.
-- A lista é fechada de propósito (check): cargo novo entra por migração, com a
-- regra dele escrita junto. Só o admin dá e tira cargo, e fica no rastro.
-- O admin NÃO vê o financeiro por ser admin (decisão de 15/11/2026): se der o
-- cargo a si mesmo, isso aparece no registro de auditoria.
-- =============================================================================

create table public.cargo_pessoa (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references public.pessoa (id) on delete cascade,
  cargo      text not null check (cargo in ('tesouraria', 'pastor', 'comunicacao')),
  criado_em  timestamptz not null default now(),
  unique (pessoa_id, cargo)
);
comment on table public.cargo_pessoa is
  'Cargos fora dos ministérios (D45). tesouraria edita o financeiro, pastor só lê, comunicacao cuida dos eventos.';
create index cargo_pessoa_cargo_idx on public.cargo_pessoa (cargo);

alter table public.cargo_pessoa enable row level security;

-- Saber quem é tesoureiro ou da comunicação não é segredo (a tela de Equipe
-- mostra); o que é restrito são os dados que o cargo abre.
create policy "cargo: integrantes veem" on public.cargo_pessoa
for select to authenticated using (privado.minha_pessoa_id() is not null);
create policy "cargo: admin dá" on public.cargo_pessoa
for insert to authenticated with check (privado.e_admin());
create policy "cargo: admin tira" on public.cargo_pessoa
for delete to authenticated using (privado.e_admin());
revoke all on public.cargo_pessoa from anon;
revoke update on public.cargo_pessoa from authenticated;
grant select, insert, delete on public.cargo_pessoa to authenticated;
grant all on public.cargo_pessoa to service_role;

-- Tem o cargo? (a pessoa da conta logada, se a conta está pronta)
create function privado.tem_cargo(p_cargo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cargo_pessoa
    where pessoa_id = privado.minha_pessoa_id() and cargo = p_cargo
  );
$$;
revoke execute on function privado.tem_cargo(text) from public, anon;
grant execute on function privado.tem_cargo(text) to authenticated;

-- Rastro: quem deu ou tirou qual cargo de quem
create function privado.auditar_cargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform privado.auditar('cargo_dado', jsonb_build_object('pessoa_id', new.pessoa_id, 'cargo', new.cargo));
    return new;
  end if;
  perform privado.auditar('cargo_tirado', jsonb_build_object('pessoa_id', old.pessoa_id, 'cargo', old.cargo));
  return old;
end;
$$;
revoke execute on function privado.auditar_cargo() from public, anon;

create trigger auditar after insert or delete on public.cargo_pessoa
for each row execute function privado.auditar_cargo();

-- -----------------------------------------------------------------------------
-- Eventos do site: admin OU comunicação
-- -----------------------------------------------------------------------------
create function privado.cuida_dos_eventos()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.e_admin() or privado.tem_cargo('comunicacao');
$$;
revoke execute on function privado.cuida_dos_eventos() from public, anon;
grant execute on function privado.cuida_dos_eventos() to authenticated;

drop policy "evento: admin vê"    on public.evento;
drop policy "evento: admin cria"  on public.evento;
drop policy "evento: admin muda"  on public.evento;
drop policy "evento: admin apaga" on public.evento;
create policy "evento: comunicação vê"    on public.evento for select to authenticated using (privado.cuida_dos_eventos());
create policy "evento: comunicação cria"  on public.evento for insert to authenticated with check (privado.cuida_dos_eventos());
create policy "evento: comunicação muda"  on public.evento for update to authenticated using (privado.cuida_dos_eventos()) with check (privado.cuida_dos_eventos());
create policy "evento: comunicação apaga" on public.evento for delete to authenticated using (privado.cuida_dos_eventos());

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists "eventos: admin sobe"  on storage.objects;
    drop policy if exists "eventos: admin apaga" on storage.objects;
    create policy "eventos: comunicação sobe"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'eventos' and privado.cuida_dos_eventos());
    create policy "eventos: comunicação apaga"
    on storage.objects for delete to authenticated
    using (bucket_id = 'eventos' and privado.cuida_dos_eventos());
  end if;
end;
$$;
