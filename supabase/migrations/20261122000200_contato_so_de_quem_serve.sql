-- =============================================================================
-- Migração: contato só para quem serve (D68)
-- =============================================================================
-- Até aqui todo integrante via o telefone de todos (Q22): fazia sentido quando
-- só o Louvor usava o Hub. Com a igreja toda entrando para ver o mural, "todo
-- integrante" passa a incluir qualquer membro, e o telefone do pessoal do
-- Louvor ficaria aberto para a igreja inteira.
--
-- Regra nova: nome, apelido, foto e instrumentos continuam visíveis para toda
-- conta aprovada (o mural e a escala precisam). O CONTATO só para quem serve
-- (ministério ativo ou algum cargo) e para o administrador.
--
-- Como: a coluna sai do SELECT do papel "authenticated" (privilégio por
-- coluna; o RLS filtra linhas, não colunas) e os contatos passam a vir de
-- public.contatos_da_equipe(), que confere quem pergunta.
-- =============================================================================

create function privado.serve_na_igreja()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.minha_pessoa_id() is not null and (
    privado.e_admin()
    or exists (select 1 from public.membro_ministerio m where m.pessoa_id = privado.minha_pessoa_id() and m.ativo)
    or exists (select 1 from public.cargo_pessoa c where c.pessoa_id = privado.minha_pessoa_id())
  );
$$;
revoke execute on function privado.serve_na_igreja() from public, anon;
grant execute on function privado.serve_na_igreja() to authenticated;

revoke select on public.pessoa from authenticated;
grant select (id, nome, apelido, instrumentos, ativa, criado_em, atualizado_em, foto) on public.pessoa to authenticated;
comment on column public.pessoa.contato is 'Só quem serve (ministério ou cargo) e o admin veem, por public.contatos_da_equipe() (D68; antes Q22).';

create function public.contatos_da_equipe()
returns table (pessoa_id uuid, contato text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.contato
  from public.pessoa p
  where privado.serve_na_igreja() and p.contato is not null;
$$;
revoke execute on function public.contatos_da_equipe() from public, anon;
grant execute on function public.contatos_da_equipe() to authenticated;
