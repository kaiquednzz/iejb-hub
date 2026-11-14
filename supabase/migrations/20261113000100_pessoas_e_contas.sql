-- =============================================================================
-- 01. Pessoas, contas e ministérios
-- Modelo de dados v0.3, seção 3.1 | Regras: RN-01, RN-03, RN-10, RN-13, RN-14, RN-65
--
-- Ideia central: PESSOA (quem faz parte) é separada de CONTA (acesso ao Hub).
-- A conta nasce "pendente" e não enxerga nada até um administrador aprovar.
-- =============================================================================

-- Esquema privado: funções auxiliares usadas pelas políticas e pelos gatilhos.
-- Fica fora da API (o Supabase só expõe o esquema "public"), então ninguém
-- consegue chamar essas funções direto pelo app.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Função genérica: mantém "atualizado_em" sempre certo.
-- -----------------------------------------------------------------------------
create function privado.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- "Sistema" = quem não é um usuário logado pelo app: o próprio Postgres
-- (migrações, painel do Supabase), a chave de serviço (funções de servidor)
-- ou uma função "security definer" que já fez as próprias checagens.
create function privado.e_sistema()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('authenticated', 'anon');
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.ministerio (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique check (length(trim(nome)) > 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.ministerio is 'Ministérios da igreja. No piloto existe só o Louvor (D13, D14).';

create table public.pessoa (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  apelido       text,
  contato       text,
  instrumentos  text[] not null default '{}',
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table  public.pessoa is 'Quem faz parte da igreja, com ou sem conta (RN-10). Nunca é apagada, só desativada (RN-13).';
comment on column public.pessoa.contato is 'Visível para todos os integrantes (Q22).';
comment on column public.pessoa.instrumentos is 'O que a pessoa toca ou canta em geral. Só sugestão; o que vale na escala é o padrão de cada grupo (RN-17).';

create table public.conta (
  id               uuid primary key references auth.users (id) on delete cascade,
  login            text not null,
  nome_informado   text,
  pessoa_id        uuid unique references public.pessoa (id) on delete restrict,
  estado           text not null default 'pendente'
                   check (estado in ('pendente', 'ativa', 'recusada', 'desativada')),
  e_administrador  boolean not null default false,
  senha_temporaria boolean not null default false,
  decidido_por     uuid references public.conta (id),
  decidido_em      timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint conta_ativa_tem_pessoa check (estado <> 'ativa' or pessoa_id is not null),
  constraint admin_precisa_estar_ativa check (not e_administrador or estado = 'ativa')
);
comment on table  public.conta is 'Acesso ao Hub. O id é o mesmo do usuário do Supabase Auth. A senha nunca fica aqui.';
comment on column public.conta.nome_informado is 'Nome que a pessoa digitou ao pedir acesso. Ajuda o administrador a reconhecê-la.';
comment on column public.conta.senha_temporaria is 'Verdadeiro enquanto a pessoa não trocou a senha definida pelo administrador (RN-10, RN-65).';

create table public.membro_ministerio (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoa (id) on delete restrict,
  ministerio_id uuid not null references public.ministerio (id) on delete restrict,
  e_lider       boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (pessoa_id, ministerio_id)
);
comment on column public.membro_ministerio.e_lider is 'Marca o líder de louvor (RN-02). Só um administrador pode mudar.';

create table public.registro_auditoria (
  id            uuid primary key default gen_random_uuid(),
  ator_conta_id uuid references public.conta (id) on delete set null,
  acao          text not null,
  alvo          jsonb not null default '{}',
  feito_em      timestamptz not null default now()
);
comment on table public.registro_auditoria is 'Rastro de ações administrativas sensíveis. Só acréscimo, visível só para administradores.';

create index membro_ministerio_ministerio_idx on public.membro_ministerio (ministerio_id);

create trigger tocar before update on public.ministerio        for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.pessoa            for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.conta             for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.membro_ministerio for each row execute function privado.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Quem sou eu? Funções que as políticas usam para descobrir o papel de quem
-- está logado (modelo, seção 5.1).
--
-- São "security definer": rodam com o poder do dono (postgres) e por isso
-- conseguem ler a tabela "conta" sem cair nas próprias políticas dela
-- (evita recursão infinita). O "search_path = ''" impede que alguém engane
-- a função criando uma tabela com o mesmo nome em outro esquema.
-- -----------------------------------------------------------------------------

-- A pessoa dona da conta logada, SE a conta está pronta para uso.
-- Conta pendente, recusada, desativada, com senha temporária ou de pessoa
-- desativada devolve NULL, e quase toda política exige que não seja NULL.
-- Essa é a trava central do sistema (modelo, seção 5.3, casos 6 e 7).
create function privado.minha_pessoa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.pessoa_id
  from public.conta c
  join public.pessoa p on p.id = c.pessoa_id
  where c.id = auth.uid()
    and c.estado = 'ativa'
    and not c.senha_temporaria
    and p.ativa;
$$;

create function privado.e_admin()
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
    where c.id = auth.uid()
      and c.estado = 'ativa'
      and not c.senha_temporaria
      and c.e_administrador
      and p.ativa
  );
$$;

create function privado.e_integrante(p_ministerio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membro_ministerio m
    where m.pessoa_id = privado.minha_pessoa_id()
      and m.ministerio_id = p_ministerio
      and m.ativo
  );
$$;

create function privado.e_lider_louvor(p_ministerio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membro_ministerio m
    where m.pessoa_id = privado.minha_pessoa_id()
      and m.ministerio_id = p_ministerio
      and m.ativo
      and m.e_lider
  );
$$;

-- Líder de qualquer ministério (para o que é compartilhado: pessoas e cultos).
create function privado.e_lider_de_algum_ministerio()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membro_ministerio m
    where m.pessoa_id = privado.minha_pessoa_id()
      and m.ativo
      and m.e_lider
  );
$$;

-- -----------------------------------------------------------------------------
-- Integração com o Supabase Auth
-- -----------------------------------------------------------------------------

-- Todo usuário novo do Auth (cadastro pelo app ou criado pelo administrador)
-- ganha uma conta PENDENTE. Ela só passa a valer quando um administrador
-- aprova e liga a uma pessoa (RN-10).
create function privado.criar_conta_para_novo_usuario()
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
    nullif(trim(new.raw_user_meta_data ->> 'nome'), '')
  );
  return new;
end;
$$;

create trigger criar_conta
after insert on auth.users
for each row execute function privado.criar_conta_para_novo_usuario();

-- Quando a senha muda, a senha temporária deixa de valer.
-- Se foi o administrador que redefiniu, a função de servidor chama
-- public.marcar_senha_temporaria logo em seguida e a marca volta.
create function privado.limpar_senha_temporaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.conta set senha_temporaria = false where id = new.id;
  end if;
  return new;
end;
$$;

create trigger limpar_senha_temporaria
after update of encrypted_password on auth.users
for each row execute function privado.limpar_senha_temporaria();

-- -----------------------------------------------------------------------------
-- Integridade que depende de quem está agindo
-- -----------------------------------------------------------------------------

-- Nunca deixar o sistema sem administrador (modelo, seção 4).
create function privado.proteger_ultimo_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.e_administrador and old.estado = 'ativa'
     and (not new.e_administrador or new.estado <> 'ativa')
     and not exists (
       select 1 from public.conta c
       where c.id <> old.id and c.e_administrador and c.estado = 'ativa'
     )
  then
    raise exception 'Não é possível remover o último administrador.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger proteger_ultimo_admin
before update on public.conta
for each row execute function privado.proteger_ultimo_admin();

-- Só administrador designa (ou tira) o líder de louvor.
create function privado.so_admin_muda_lider()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.e_lider)
     or (tg_op = 'UPDATE' and new.e_lider is distinct from old.e_lider)
  then
    if not (privado.e_sistema() or privado.e_admin()) then
      raise exception 'Só um administrador pode definir o líder de louvor.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger so_admin_muda_lider
before insert or update on public.membro_ministerio
for each row execute function privado.so_admin_muda_lider();

-- -----------------------------------------------------------------------------
-- Segurança por linha (RLS)
-- Com RLS ligada e sem política, a tabela fica fechada para todo mundo.
-- Cada política abaixo abre só o que a matriz do modelo (seção 5.2) permite.
-- -----------------------------------------------------------------------------
alter table public.ministerio         enable row level security;
alter table public.pessoa             enable row level security;
alter table public.conta              enable row level security;
alter table public.membro_ministerio  enable row level security;
alter table public.registro_auditoria enable row level security;

-- ministerio: qualquer conta pronta vê; ninguém mexe pelo app.
create policy "ministerio: contas prontas veem"
on public.ministerio for select to authenticated
using (privado.minha_pessoa_id() is not null);

-- pessoa: todo integrante vê nome, apelido e contato de todos (Q22).
-- Administrador e líder de louvor cadastram e editam. Ninguém apaga (RN-13).
-- Para editar só o próprio contato existe public.atualizar_meu_contato().
create policy "pessoa: contas prontas veem"
on public.pessoa for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "pessoa: admin e líder cadastram"
on public.pessoa for insert to authenticated
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

create policy "pessoa: admin e líder editam"
on public.pessoa for update to authenticated
using (privado.e_admin() or privado.e_lider_de_algum_ministerio())
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

-- conta: cada um vê a própria (inclusive pendente, para a tela saber o que
-- mostrar). Administrador vê todas. Mudanças só pelas funções da seção abaixo.
create policy "conta: vejo a minha"
on public.conta for select to authenticated
using (id = auth.uid());

create policy "conta: admin vê todas"
on public.conta for select to authenticated
using (privado.e_admin());

-- membro_ministerio
create policy "membro_ministerio: integrantes do ministério veem"
on public.membro_ministerio for select to authenticated
using (privado.e_integrante(ministerio_id) or privado.e_admin());

create policy "membro_ministerio: admin e líder incluem"
on public.membro_ministerio for insert to authenticated
with check (privado.e_admin() or privado.e_lider_louvor(ministerio_id));

create policy "membro_ministerio: admin e líder editam"
on public.membro_ministerio for update to authenticated
using (privado.e_admin() or privado.e_lider_louvor(ministerio_id))
with check (privado.e_admin() or privado.e_lider_louvor(ministerio_id));

-- registro_auditoria: só administrador lê; só o sistema escreve.
create policy "auditoria: admin vê"
on public.registro_auditoria for select to authenticated
using (privado.e_admin());

-- -----------------------------------------------------------------------------
-- Funções do app (RPC). Rodam com poder de dono, então cada uma confere
-- sozinha se quem chamou pode fazer aquilo.
-- -----------------------------------------------------------------------------

create function privado.auditar(p_acao text, p_alvo jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.registro_auditoria (ator_conta_id, acao, alvo)
  values ((select id from public.conta where id = auth.uid()), p_acao, p_alvo);
$$;

create function privado.exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Apenas administradores podem fazer isso.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Aprova uma conta pendente e liga a uma pessoa (RN-10).
-- p_senha_temporaria = true quando foi o administrador que criou a conta
-- com uma senha provisória (a pessoa vai precisar trocar no primeiro login).
create function public.aprovar_conta(
  p_conta uuid,
  p_pessoa uuid,
  p_senha_temporaria boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  where id = p_conta and estado in ('pendente', 'recusada', 'desativada');

  if not found then
    raise exception 'Conta não encontrada ou já ativa.';
  end if;

  perform privado.auditar('aprovar_conta',
    jsonb_build_object('conta', p_conta, 'pessoa', p_pessoa, 'senha_temporaria', p_senha_temporaria));
end;
$$;

create function public.recusar_conta(p_conta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.exigir_admin();

  update public.conta
  set estado = 'recusada', decidido_por = auth.uid(), decidido_em = now()
  where id = p_conta and estado = 'pendente';

  if not found then
    raise exception 'Só contas pendentes podem ser recusadas.';
  end if;

  perform privado.auditar('recusar_conta', jsonb_build_object('conta', p_conta));
end;
$$;

create function public.desativar_conta(p_conta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.exigir_admin();

  update public.conta
  set estado = 'desativada', e_administrador = false,
      decidido_por = auth.uid(), decidido_em = now()
  where id = p_conta and estado = 'ativa';

  if not found then
    raise exception 'Só contas ativas podem ser desativadas.';
  end if;

  perform privado.auditar('desativar_conta', jsonb_build_object('conta', p_conta));
end;
$$;

create function public.definir_administrador(p_conta uuid, p_valor boolean)
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

-- Chamada pela função de servidor logo depois de o administrador redefinir
-- a senha de alguém (RN-65): obriga a pessoa a trocar no próximo login.
create function public.marcar_senha_temporaria(p_conta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.exigir_admin();

  update public.conta set senha_temporaria = true
  where id = p_conta and estado = 'ativa';

  if not found then
    raise exception 'Conta não encontrada ou não está ativa.';
  end if;

  perform privado.auditar('redefinir_senha', jsonb_build_object('conta', p_conta));
end;
$$;

-- O integrante edita só o próprio contato (matriz: "editar o próprio contato").
create function public.atualizar_meu_contato(p_contato text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid := privado.minha_pessoa_id();
begin
  if v_pessoa is null then
    raise exception 'Conta sem acesso.' using errcode = 'insufficient_privilege';
  end if;
  update public.pessoa set contato = nullif(trim(p_contato), '') where id = v_pessoa;
end;
$$;

-- Primeiro administrador (RN-03). Só roda pelo painel do Supabase (SQL Editor)
-- e só enquanto não existe nenhum administrador.
-- Uso: crie sua conta pelo app (fica pendente) e rode
--   select public.inicializar_primeiro_admin('seu@email.com', 'Seu Nome');
create function public.inicializar_primeiro_admin(p_login text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta  uuid;
  v_pessoa uuid;
begin
  if exists (select 1 from public.conta where e_administrador) then
    raise exception 'Já existe um administrador.';
  end if;

  select id into v_conta from public.conta where lower(login) = lower(p_login);
  if v_conta is null then
    raise exception 'Nenhuma conta com esse login. Cadastre-se pelo app primeiro.';
  end if;

  insert into public.pessoa (nome) values (p_nome) returning id into v_pessoa;

  update public.conta
  set estado = 'ativa', pessoa_id = v_pessoa, e_administrador = true,
      decidido_em = now()
  where id = v_conta;

  insert into public.registro_auditoria (ator_conta_id, acao, alvo)
  values (v_conta, 'inicializar_primeiro_admin', jsonb_build_object('conta', v_conta));

  return v_pessoa;
end;
$$;
