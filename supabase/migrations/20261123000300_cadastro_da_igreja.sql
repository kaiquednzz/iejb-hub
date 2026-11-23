-- =============================================================================
-- Migração: cadastro da igreja toda (D71)
-- =============================================================================
-- Até aqui o cadastro era do Louvor: cadastrar pessoa já punha no Louvor, o
-- primeiro acesso só oferecia Louvor e três cargos, e "pastor" era ao mesmo
-- tempo título e permissão (via o caixa, recebia oração, publicava no mural).
-- Separamos três coisas que estavam misturadas:
--
--   1. QUEM a pessoa é na igreja: pessoa.titulo (membro, diácono, pastora...).
--      Só o administrador muda. Pastor e pastora recebem oração e publicam no
--      mural (é pastoral, vem com o título).
--   2. ONDE serve: ministérios de verdade, criados pelo administrador (Kids,
--      Recepção...), cada um com seus líderes. Por enquanto, fora o Louvor, é
--      só a lista de quem serve e quem lidera. Instrumento é coisa do Louvor.
--   3. O QUE pode no app: tesouraria (cuida do caixa), ve_financeiro (só lê
--      o caixa, para o pastor que o administrador escolher) e comunicação. O
--      título de pastor NÃO dá mais acesso ao caixa (decisão do Kaique).
--
-- E um jeito novo de entrar: o administrador cadastra a pessoa com o Gmail
-- dela. Quando ela entrar com o Google usando esse e-mail, a conta já nasce
-- ativa e ligada à ficha certa: sem fila de aprovação e sem cadastro
-- duplicado. Só vale para login do Google (o Google confirma que o e-mail é
-- dela; no cadastro com senha qualquer um digitaria o e-mail de outra pessoa).
-- =============================================================================

-- 1. Título ---------------------------------------------------------------------
alter table public.pessoa add column titulo text not null default 'membro'
  check (titulo in ('membro', 'diacono', 'diaconisa', 'presbitero', 'evangelista',
                    'missionario', 'missionaria', 'pastor', 'pastora'));
comment on column public.pessoa.titulo is 'Título na igreja (D71). Só o administrador muda. Pastor/pastora recebem oração e publicam no mural.';
grant select (titulo) on public.pessoa to authenticated;

create function privado.e_pastor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pessoa
                 where id = privado.minha_pessoa_id() and titulo in ('pastor', 'pastora'));
$$;
revoke execute on function privado.e_pastor() from public, anon;
grant execute on function privado.e_pastor() to authenticated;

-- Líder de ministério cadastra e edita pessoas (a política de pessoa já
-- deixa), mas título e e-mail de convite são do administrador.
create function privado.so_admin_muda_titulo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sem login (migração, agendador, chave de serviço) passa; pelo app, só o admin
  if auth.uid() is null or privado.e_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.titulo <> 'membro' or new.email_convite is not null) then
    raise exception 'Só o administrador define o título e o e-mail de convite.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.titulo is distinct from old.titulo or new.email_convite is distinct from old.email_convite) then
    raise exception 'Só o administrador define o título e o e-mail de convite.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function privado.so_admin_muda_titulo() from public, anon, authenticated;

-- 2. Convite pelo Gmail ----------------------------------------------------------
-- Coluna SEM select para o app: e-mail não fica à vista dos membros. O
-- administrador lê pela função convites_por_email().
alter table public.pessoa add column email_convite text unique
  check (email_convite = lower(btrim(email_convite)) and email_convite ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
comment on column public.pessoa.email_convite is 'Gmail com que a pessoa vai entrar (D71). Ao entrar com o Google com este e-mail, a conta nasce ativa e ligada a esta pessoa.';

create trigger pessoa_so_admin_muda_titulo
before insert or update on public.pessoa
for each row execute function privado.so_admin_muda_titulo();

-- Liga a conta que acabou de nascer à pessoa convidada (só login do Google)
create function privado.ligar_conta_convidada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_google boolean;
begin
  select coalesce(u.raw_app_meta_data ->> 'provider' = 'google', false)
         or coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false)
  into v_google
  from auth.users u where u.id = new.id;
  if not coalesce(v_google, false) then return new; end if;

  select p.id into v_pessoa
  from public.pessoa p
  where p.email_convite = lower(new.login) and p.ativa
    and not exists (select 1 from public.conta c where c.pessoa_id = p.id);
  if v_pessoa is null then return new; end if;

  update public.conta
  set estado = 'ativa', pessoa_id = v_pessoa, decidido_em = now(), apresentou_em = now()
  where id = new.id;
  perform privado.auditar('conta_por_convite', jsonb_build_object('conta', new.id, 'pessoa', v_pessoa));
  return new;
end;
$$;
revoke execute on function privado.ligar_conta_convidada() from public, anon, authenticated;

create trigger conta_ligar_convidada
after insert on public.conta
for each row execute function privado.ligar_conta_convidada();

-- O administrador põe (ou tira) o Gmail de uma pessoa. Se essa pessoa já
-- tinha pedido acesso com o Google usando esse e-mail, aprova na hora.
create function public.definir_email_de_convite(p_pessoa uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
  v_conta uuid;
begin
  perform privado.exigir_admin();
  if exists (select 1 from public.conta where pessoa_id = p_pessoa) then
    raise exception 'Essa pessoa já tem conta no Hub.' using errcode = '22023';
  end if;
  begin
    update public.pessoa set email_convite = v_email where id = p_pessoa;
  exception
    when unique_violation then raise exception 'Esse e-mail já está no convite de outra pessoa.' using errcode = '22023';
    when check_violation then raise exception 'Esse e-mail não parece certo.' using errcode = '22023';
  end;
  if v_email is null then return 'sem_convite'; end if;

  select c.id into v_conta
  from public.conta c join auth.users u on u.id = c.id
  where lower(c.login) = v_email and c.estado = 'pendente' and c.pessoa_id is null
    and (coalesce(u.raw_app_meta_data ->> 'provider' = 'google', false) or coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false));
  if v_conta is not null then
    perform public.aprovar_conta(v_conta, p_pessoa, false);
    return 'aprovada';
  end if;
  return 'esperando';
end;
$$;
revoke execute on function public.definir_email_de_convite(uuid, text) from public, anon;
grant execute on function public.definir_email_de_convite(uuid, text) to authenticated;

create function public.convites_por_email()
returns table (pessoa_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, email_convite from public.pessoa
  where email_convite is not null and privado.e_admin()
    and not exists (select 1 from public.conta c where c.pessoa_id = pessoa.id);
$$;
revoke execute on function public.convites_por_email() from public, anon;
grant execute on function public.convites_por_email() to authenticated;

-- 3. Permissões no app ----------------------------------------------------------
-- Quem tinha o cargo "pastor" vira título pastor + "vê o caixa" (para ninguém
-- perder acesso no dia da troca; o administrador tira se não for o caso).
update public.pessoa p set titulo = 'pastor'
where p.titulo = 'membro' and exists (select 1 from public.cargo_pessoa c where c.pessoa_id = p.id and c.cargo = 'pastor');
alter table public.cargo_pessoa drop constraint cargo_pessoa_cargo_check;
insert into public.cargo_pessoa (pessoa_id, cargo)
select pessoa_id, 've_financeiro' from public.cargo_pessoa where cargo = 'pastor'
on conflict do nothing;
delete from public.cargo_pessoa where cargo = 'pastor';
alter table public.cargo_pessoa add constraint cargo_pessoa_cargo_check
  check (cargo in ('tesouraria', 'comunicacao', 've_financeiro'));
comment on column public.cargo_pessoa.cargo is 'Permissão no app (D71): tesouraria (cuida do caixa), ve_financeiro (só lê o caixa), comunicacao (publica no mural e cuida dos eventos).';

create or replace function privado.ve_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.tem_cargo('tesouraria') or privado.tem_cargo('ve_financeiro'); $$;

create or replace function privado.publica_no_mural()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.e_admin() or privado.tem_cargo('comunicacao') or privado.e_pastor(); $$;

-- Oração: pastor é quem tem o título (e conta ativa)
create or replace function public.pastores_da_igreja()
returns table (id uuid, nome text, apelido text, foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.apelido, p.foto
  from public.pessoa p
  join public.conta ct on ct.pessoa_id = p.id and ct.estado = 'ativa'
  where p.ativa and p.titulo in ('pastor', 'pastora') and privado.minha_pessoa_id() is not null
  order by p.nome;
$$;

create or replace function public.pedidos_de_oracao_para_mim()
returns table (id uuid, texto text, anonimo boolean, autor_nome text, autor_apelido text, autor_foto text,
               criado_em timestamptz, orado_em timestamptz, orado_por_nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.texto, o.anonimo,
         case when o.anonimo then null else a.nome end,
         case when o.anonimo then null else a.apelido end,
         case when o.anonimo then null else a.foto end,
         o.criado_em, o.orado_em, privado.nome_de_chamar(o.orado_por)
  from public.pedido_oracao o
  join public.pedido_oracao_destino d on d.pedido_id = o.id and d.pastor_id = privado.minha_pessoa_id()
  join public.pessoa a on a.id = o.autor_id
  where privado.e_pastor()
  order by o.orado_em is not null, o.criado_em desc;
$$;

create or replace function public.marcar_orei(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    uuid := privado.minha_pessoa_id();
  v_autor uuid;
begin
  if v_eu is null or not privado.e_pastor()
     or not exists (select 1 from public.pedido_oracao_destino where pedido_id = p_pedido and pastor_id = v_eu) then
    raise exception 'Esse pedido não foi mandado para você.' using errcode = '42501';
  end if;
  update public.pedido_oracao set orado_em = now(), orado_por = v_eu
  where id = p_pedido and orado_em is null
  returning autor_id into v_autor;
  if v_autor is null then return; end if;
  perform privado.criar_aviso('oracao_orada', null, null,
    privado.nome_de_chamar(v_eu) || ' orou pelo seu pedido.', array[v_autor]);
end;
$$;

-- Contagem sem conferência: avisa quem acompanha o caixa (antes: os pastores)
create or replace function public.contar_sozinha(p_data date, p_culto uuid, p_conta uuid, p_dizimos bigint, p_ofertas bigint, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_quem_ve uuid[];
begin
  v_id := privado.nova_contagem('sozinha', p_data, p_culto, p_conta, p_dizimos, p_ofertas, p_observacao);
  perform privado.lancar_contagem(v_id);
  select array_agg(cp.pessoa_id) into v_quem_ve
  from public.cargo_pessoa cp where cp.cargo = 've_financeiro' and cp.pessoa_id <> privado.minha_pessoa_id();
  perform privado.criar_aviso('contagem_sem_conferencia', null, null,
    format('%s contou sozinha a contagem de %s (R$ %s), sem outra pessoa conferindo.',
      (select coalesce(apelido, nome) from public.pessoa where id = privado.minha_pessoa_id()),
      to_char(p_data, 'DD/MM'),
      replace(to_char((coalesce(p_dizimos, 0) + coalesce(p_ofertas, 0)) / 100.0, 'FM999G999G990D00'), ',', '.')),
    v_quem_ve);
end;
$$;

-- 4. Ministérios -----------------------------------------------------------------
alter table public.ministerio add column ativo boolean not null default true;
comment on table public.ministerio is 'Ministérios da igreja (D71). O administrador cria. Fora o Louvor, por enquanto é só quem serve e quem lidera.';

grant insert (nome), update (nome, ativo) on public.ministerio to authenticated;
create policy "ministerio: admin cria"
on public.ministerio for insert to authenticated with check (privado.e_admin());
create policy "ministerio: admin edita"
on public.ministerio for update to authenticated using (privado.e_admin()) with check (privado.e_admin());

-- O Louvor tem telas próprias que o acham pelo nome: não muda de nome nem sai
create function privado.louvor_fica()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.nome = 'Louvor' and (new.nome <> 'Louvor' or not new.ativo) then
    raise exception 'O Louvor não muda de nome nem sai (ele tem a escala).' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger ministerio_louvor_fica
before update on public.ministerio
for each row execute function privado.louvor_fica();

-- Quem serve onde é informação da igreja: toda conta aprovada vê
drop policy "membro_ministerio: integrantes do ministério veem" on public.membro_ministerio;
create policy "membro_ministerio: contas prontas veem"
on public.membro_ministerio for select to authenticated
using (privado.minha_pessoa_id() is not null);

-- 5. Primeiro acesso: os ministérios que existem e o título -------------------------
alter table public.conta
  add column titulo_pedido text check (titulo_pedido is null or titulo_pedido in
    ('membro', 'diacono', 'diaconisa', 'presbitero', 'evangelista', 'missionario', 'missionaria', 'pastor', 'pastora')),
  add column ministerios_pedidos uuid[] not null default '{}';
update public.conta set titulo_pedido = 'pastor', cargos_pedidos = array_remove(cargos_pedidos, 'pastor')
where 'pastor' = any (cargos_pedidos);
alter table public.conta drop constraint conta_cargos_pedidos_check;
alter table public.conta add constraint conta_cargos_pedidos_check
  check (cargos_pedidos <@ array['tesouraria', 'comunicacao', 've_financeiro']::text[]);

drop function public.apresentar_me(text, text, text[], boolean, text[]);
create function public.apresentar_me(
  p_nome         text,
  p_foto         text default null,
  p_titulo       text default 'membro',
  p_ministerios  uuid[] default '{}',
  p_instrumentos text[] default '{}',
  p_cargos       text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_louvor uuid := (select id from public.ministerio where nome = 'Louvor');
  v_ministerios uuid[] := array(select distinct m from unnest(coalesce(p_ministerios, '{}')) m
                                where m in (select id from public.ministerio where ativo));
begin
  if coalesce(length(trim(p_nome)), 0) not between 2 and 60 then
    raise exception 'Escreva seu nome.' using errcode = 'check_violation';
  end if;
  if p_foto is not null and split_part(p_foto, '/', 2) <> auth.uid()::text then
    raise exception 'Foto inválida.' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(p_cargos, '{}') <@ array['tesouraria', 'comunicacao']::text[] then
    raise exception 'Função inválida.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(coalesce(p_instrumentos, '{}')) i where length(trim(i)) not between 1 and 30) then
    raise exception 'Instrumento inválido.' using errcode = 'check_violation';
  end if;
  update public.conta
  set nome_informado = trim(p_nome), foto_informada = p_foto, apresentou_em = now(),
      titulo_pedido = coalesce(p_titulo, 'membro'),
      ministerios_pedidos = v_ministerios,
      cargos_pedidos = coalesce(p_cargos, '{}'),
      louvor_pedido = v_louvor = any (v_ministerios),
      instrumentos_pedidos = case when v_louvor = any (v_ministerios)
        then array(select distinct trim(i) from unnest(coalesce(p_instrumentos, '{}')) i) else '{}' end
  where id = auth.uid() and estado = 'pendente';
  if not found then
    raise exception 'Só dá para fazer isso enquanto o pedido espera aprovação.' using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function public.apresentar_me(text, text, text, uuid[], text[], text[]) from public, anon;
grant execute on function public.apresentar_me(text, text, text, uuid[], text[], text[]) to authenticated;

-- Os ministérios para escolher no primeiro acesso (a conta ainda é pendente,
-- então não lê a tabela)
create function public.ministerios_para_escolher()
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, nome from public.ministerio
  where ativo and exists (select 1 from public.conta where id = auth.uid())
  order by nome = 'Louvor' desc, nome;
$$;
revoke execute on function public.ministerios_para_escolher() from public, anon;
grant execute on function public.ministerios_para_escolher() to authenticated;

-- 6. Aprovar e cadastrar: qualquer ministério, título, permissões -----------------
drop function public.aprovar_pedido(uuid, uuid, text, uuid, boolean, text[], text[]);
create function public.aprovar_pedido(
  p_conta        uuid,
  p_pessoa       uuid,
  p_nome         text,
  p_titulo       text default 'membro',
  p_ministerios  uuid[] default '{}',
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
  v_louvor uuid := (select id from public.ministerio where nome = 'Louvor');
begin
  if not privado.e_admin() then
    raise exception 'Apenas administradores podem fazer isso.' using errcode = 'insufficient_privilege';
  end if;

  if v_pessoa is null then
    if length(trim(coalesce(p_nome, ''))) = 0 then
      raise exception 'Informe o nome da pessoa.';
    end if;
    insert into public.pessoa (nome, titulo) values (trim(p_nome), coalesce(p_titulo, 'membro')) returning id into v_pessoa;
  elsif p_titulo is not null then
    update public.pessoa set titulo = p_titulo where id = v_pessoa;
  end if;

  insert into public.membro_ministerio (pessoa_id, ministerio_id)
  select v_pessoa, m from unnest(coalesce(p_ministerios, '{}')) m
  on conflict (pessoa_id, ministerio_id) do update set ativo = true;

  if v_louvor = any (coalesce(p_ministerios, '{}')) and cardinality(coalesce(p_instrumentos, '{}')) > 0 then
    update public.pessoa
    set instrumentos = array(select distinct x from unnest(instrumentos || p_instrumentos) x)
    where id = v_pessoa;
  end if;

  insert into public.cargo_pessoa (pessoa_id, cargo)
  select v_pessoa, c from unnest(coalesce(p_cargos, '{}')) c
  on conflict do nothing;

  perform public.aprovar_conta(p_conta, v_pessoa, false);
  return v_pessoa;
end;
$$;
revoke execute on function public.aprovar_pedido(uuid, uuid, text, text, uuid[], text[], text[]) from public, anon;
grant execute on function public.aprovar_pedido(uuid, uuid, text, text, uuid[], text[], text[]) to authenticated;

drop function public.cadastrar_pessoa(text, text, text, text[], uuid);
create function public.cadastrar_pessoa(
  p_nome         text,
  p_apelido      text default null,
  p_contato      text default null,
  p_instrumentos text[] default '{}',
  p_ministerios  uuid[] default '{}',
  p_titulo       text default 'membro'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pessoa uuid;
begin
  -- Líder só cadastra no ministério que lidera; o admin, em qualquer um ou
  -- em nenhum (membro que não serve em área nenhuma). O RLS confere.
  if not privado.e_admin() and cardinality(coalesce(p_ministerios, '{}')) = 0 then
    raise exception 'Escolha o ministério da pessoa.' using errcode = '22023';
  end if;
  insert into public.pessoa (nome, apelido, contato, instrumentos, titulo)
  values (trim(p_nome), nullif(trim(p_apelido), ''), nullif(trim(p_contato), ''),
          coalesce(p_instrumentos, '{}'), coalesce(p_titulo, 'membro'))
  returning id into v_pessoa;

  insert into public.membro_ministerio (pessoa_id, ministerio_id)
  select v_pessoa, m from unnest(coalesce(p_ministerios, '{}')) m;
  return v_pessoa;
end;
$$;
revoke execute on function public.cadastrar_pessoa(text, text, text, text[], uuid[], text) from public, anon;
grant execute on function public.cadastrar_pessoa(text, text, text, text[], uuid[], text) to authenticated;
