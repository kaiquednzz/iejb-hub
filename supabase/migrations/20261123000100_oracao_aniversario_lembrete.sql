-- =============================================================================
-- Migração: pedidos de oração, aniversários, lembrete de ensaio e aviso de
-- pedido de acesso (D69)
-- =============================================================================
-- Tudo aqui é para a igreja toda abrir o Hub fora do domingo:
--
--   * Pedido de oração: a pessoa escolhe para qual pastor (ou quais) vai. Só
--     eles leem. Pode ir sem nome. O pastor toca "Orei por você" e a pessoa é
--     avisada. Some sozinho em 30 dias: é coisa íntima, não fica guardada.
--   * Aniversário (opcional, só dia e mês: ninguém precisa dizer a idade). Um
--     dia antes, a igreja toda recebe "Amanhã é aniversário de Fulano!". Dois
--     no mesmo dia viram uma notificação só.
--   * Lembrete de ensaio: 3 dias antes do culto, às 19h, para quem toca.
--   * Pedido de acesso: o administrador recebe aviso quando alguém termina o
--     primeiro acesso (com o QR de convite, isso vai acontecer mais).
-- =============================================================================

-- Tipos novos de aviso ---------------------------------------------------------
alter table public.aviso drop constraint aviso_tipo_check;
alter table public.aviso add constraint aviso_tipo_check check (tipo in (
  'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
  'solicitacao_nova', 'solicitacao_decidida', 'presenca_alterada',
  'contagem_para_conferir', 'contagem_decidida', 'contagem_sem_conferencia',
  'mural_publicacao',
  'oracao_pedido', 'oracao_orada', 'aniversario', 'lembrete_ensaio', 'acesso_pedido'));

-- Quem está com a conta ativa (destinatários de aviso para a igreja toda)
create function privado.pessoas_com_conta_ativa()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.pessoa_id), '{}')
  from public.conta c
  join public.pessoa p on p.id = c.pessoa_id and p.ativa
  where c.estado = 'ativa';
$$;
revoke execute on function privado.pessoas_com_conta_ativa() from public, anon, authenticated;

-- "Dona Cida" se tem apelido; senão o primeiro nome
create function privado.nome_de_chamar(p_pessoa uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(apelido), ''), split_part(btrim(nome), ' ', 1)) from public.pessoa where id = p_pessoa;
$$;
revoke execute on function privado.nome_de_chamar(uuid) from public, anon, authenticated;

-- =============================================================================
-- Pedidos de oração
-- =============================================================================
create table public.pedido_oracao (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references public.pessoa (id) on delete cascade,
  texto      text not null check (char_length(btrim(texto)) between 3 and 1000),
  anonimo    boolean not null default false,
  criado_em  timestamptz not null default now(),
  orado_em   timestamptz,
  orado_por  uuid references public.pessoa (id) on delete set null
);
comment on table public.pedido_oracao is 'Pedidos de oração (D69). Só o autor e os pastores escolhidos leem (pastores pela função pedidos_de_oracao_para_mim, que esconde o autor dos anônimos). Apagados em 30 dias.';
create index pedido_oracao_autor on public.pedido_oracao (autor_id, criado_em desc);

create table public.pedido_oracao_destino (
  pedido_id uuid not null references public.pedido_oracao (id) on delete cascade,
  pastor_id uuid not null references public.pessoa (id) on delete cascade,
  primary key (pedido_id, pastor_id)
);
create index pedido_oracao_destino_pastor on public.pedido_oracao_destino (pastor_id);

alter table public.pedido_oracao enable row level security;
alter table public.pedido_oracao_destino enable row level security;
revoke all on public.pedido_oracao, public.pedido_oracao_destino from anon, authenticated;
grant select, delete on public.pedido_oracao to authenticated;
grant select on public.pedido_oracao_destino to authenticated;
grant all on public.pedido_oracao, public.pedido_oracao_destino to service_role;

-- O autor vê e apaga os próprios. Ninguém mais lê a tabela direto: nem o
-- administrador (ser admin não dá acesso à vida de oração de ninguém).
create policy "oração: o autor vê os seus"
on public.pedido_oracao for select to authenticated
using (autor_id = privado.minha_pessoa_id());

create policy "oração: o autor apaga os seus"
on public.pedido_oracao for delete to authenticated
using (autor_id = privado.minha_pessoa_id());

create policy "oração: o autor vê para quem mandou"
on public.pedido_oracao_destino for select to authenticated
using (exists (select 1 from public.pedido_oracao p where p.id = pedido_id and p.autor_id = privado.minha_pessoa_id()));

-- Os pastores que dá para escolher (conta ativa e cargo de pastor)
create function public.pastores_da_igreja()
returns table (id uuid, nome text, apelido text, foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.apelido, p.foto
  from public.pessoa p
  join public.cargo_pessoa c on c.pessoa_id = p.id and c.cargo = 'pastor'
  join public.conta ct on ct.pessoa_id = p.id and ct.estado = 'ativa'
  where p.ativa and privado.minha_pessoa_id() is not null
  order by p.nome;
$$;
revoke execute on function public.pastores_da_igreja() from public, anon;
grant execute on function public.pastores_da_igreja() to authenticated;

create function public.pedir_oracao(p_texto text, p_pastores uuid[], p_anonimo boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu      uuid := privado.minha_pessoa_id();
  v_id      uuid;
  v_validos uuid[];
begin
  if v_eu is null then
    raise exception 'Só quem tem conta aprovada pede oração pelo app.' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct p.id), '{}') into v_validos
  from public.pastores_da_igreja() p
  where p.id = any (coalesce(p_pastores, '{}'));
  if cardinality(v_validos) = 0 or cardinality(v_validos) <> cardinality(array(select distinct unnest(p_pastores))) then
    raise exception 'Escolha para qual pastor vai o pedido.' using errcode = '22023';
  end if;
  -- Freio contra toque repetido (ou abuso): 5 pedidos por dia
  if (select count(*) from public.pedido_oracao where autor_id = v_eu and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Você já mandou 5 pedidos hoje. Amanhã dá para mandar de novo.' using errcode = 'P0001';
  end if;

  insert into public.pedido_oracao (autor_id, texto, anonimo)
  values (v_eu, btrim(p_texto), coalesce(p_anonimo, false))
  returning id into v_id;
  insert into public.pedido_oracao_destino (pedido_id, pastor_id) select v_id, unnest(v_validos);

  -- O texto NÃO vai na notificação: ela aparece na tela bloqueada
  perform privado.criar_aviso('oracao_pedido', null, null,
    case when coalesce(p_anonimo, false) then 'Chegou um pedido de oração (sem nome).'
         else 'Chegou um pedido de oração de ' || privado.nome_de_chamar(v_eu) || '.' end,
    array_remove(v_validos, v_eu));
  return v_id;
end;
$$;
revoke execute on function public.pedir_oracao(text, uuid[], boolean) from public, anon;
grant execute on function public.pedir_oracao(text, uuid[], boolean) to authenticated;

-- A caixa do pastor: só os pedidos mandados para ele; sem nome nos anônimos
create function public.pedidos_de_oracao_para_mim()
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
  where privado.tem_cargo('pastor')
  order by o.orado_em is not null, o.criado_em desc;
$$;
revoke execute on function public.pedidos_de_oracao_para_mim() from public, anon;
grant execute on function public.pedidos_de_oracao_para_mim() to authenticated;

create function public.marcar_orei(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    uuid := privado.minha_pessoa_id();
  v_autor uuid;
begin
  if v_eu is null or not privado.tem_cargo('pastor')
     or not exists (select 1 from public.pedido_oracao_destino where pedido_id = p_pedido and pastor_id = v_eu) then
    raise exception 'Esse pedido não foi mandado para você.' using errcode = '42501';
  end if;
  update public.pedido_oracao set orado_em = now(), orado_por = v_eu
  where id = p_pedido and orado_em is null
  returning autor_id into v_autor;
  if v_autor is null then return; end if; -- outro pastor já marcou
  perform privado.criar_aviso('oracao_orada', null, null,
    privado.nome_de_chamar(v_eu) || ' orou pelo seu pedido.', array[v_autor]);
end;
$$;
revoke execute on function public.marcar_orei(uuid) from public, anon;
grant execute on function public.marcar_orei(uuid) to authenticated;

create function privado.apagar_pedidos_antigos()
returns integer
language sql
security definer
set search_path = ''
as $$
  with apagados as (
    delete from public.pedido_oracao where criado_em < now() - interval '30 days' returning 1
  )
  select count(*)::integer from apagados;
$$;
revoke execute on function privado.apagar_pedidos_antigos() from public, anon, authenticated;

-- =============================================================================
-- Aniversários
-- =============================================================================
alter table public.pessoa
  add column aniversario_dia smallint check (aniversario_dia between 1 and 31),
  add column aniversario_mes smallint check (aniversario_mes between 1 and 12),
  add constraint pessoa_aniversario_completo check ((aniversario_dia is null) = (aniversario_mes is null)),
  add constraint pessoa_aniversario_existe check (
    aniversario_dia is null or aniversario_dia <= case aniversario_mes when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end);
comment on column public.pessoa.aniversario_dia is 'Dia do aniversário, opcional e sem o ano (D69). A igreja toda vê e é avisada na véspera.';
-- Visível para toda conta aprovada, como o nome (o contato continua fora)
grant select (aniversario_dia, aniversario_mes) on public.pessoa to authenticated;

create function public.definir_meu_aniversario(p_dia integer, p_mes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_eu uuid := privado.minha_pessoa_id();
begin
  if v_eu is null then
    raise exception 'Conta não aprovada.' using errcode = '42501';
  end if;
  update public.pessoa set aniversario_dia = p_dia, aniversario_mes = p_mes where id = v_eu;
exception
  when check_violation then
    raise exception 'Essa data não existe.' using errcode = '22023';
end;
$$;
revoke execute on function public.definir_meu_aniversario(integer, integer) from public, anon;
grant execute on function public.definir_meu_aniversario(integer, integer) to authenticated;

-- Dias já avisados (o agendador pode rodar duas vezes; o aviso não)
create table privado.aniversario_avisado (dia date primary key);

-- Roda todo dia às 9h. Quem faz 29/02 é lembrado no dia 28 nos anos comuns.
create function privado.avisar_aniversarios(p_hoje date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje    date := coalesce(p_hoje, privado.hoje_em_brasilia());
  v_amanha  date := v_hoje + 1;
  v_nomes   text[];
  v_pessoas uuid[];
  v_lista   text;
  v_todos   uuid[];
begin
  -- Uma vez por dia, mesmo que o agendador rode de novo
  insert into privado.aniversario_avisado (dia) values (v_amanha) on conflict do nothing;
  if not found then return 0; end if;

  select array_agg(privado.nome_de_chamar(p.id) order by p.nome), array_agg(p.id)
  into v_nomes, v_pessoas
  from public.pessoa p
  join public.conta c on c.pessoa_id = p.id and c.estado = 'ativa'
  where p.ativa and (
    (p.aniversario_mes = extract(month from v_amanha) and p.aniversario_dia = extract(day from v_amanha))
    or (p.aniversario_mes = 2 and p.aniversario_dia = 29 and v_amanha = make_date(extract(year from v_amanha)::int, 3, 1)
        and extract(day from (make_date(extract(year from v_amanha)::int, 3, 1) - 1)) = 28)
  );
  if v_nomes is null then return 0; end if;

  v_lista := case cardinality(v_nomes)
    when 1 then v_nomes[1]
    else array_to_string(v_nomes[1:cardinality(v_nomes) - 1], ', ') || ' e ' || v_nomes[cardinality(v_nomes)]
  end;
  -- O aniversariante não recebe o próprio aviso
  select array(select unnest(privado.pessoas_com_conta_ativa()) except select unnest(v_pessoas)) into v_todos;
  perform privado.criar_aviso('aniversario', null, null, 'Amanhã é aniversário de ' || v_lista || '! 🎉', v_todos);
  return cardinality(v_nomes);
end;
$$;
revoke execute on function privado.avisar_aniversarios(date) from public, anon, authenticated;

-- =============================================================================
-- Lembrete de ensaio: 3 dias antes, às 19h, para quem toca
-- =============================================================================
create function privado.lembrar_ensaio(p_hoje date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia   date := coalesce(p_hoje, privado.hoje_em_brasilia()) + 3;
  v_semana text[] := array['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  r       record;
  v_n     integer := 0;
  v_musicas integer;
begin
  for r in
    select e.id as escala_id, c.id as culto_id, c.nome, c.data
    from public.escala e
    join public.culto c on c.id = e.culto_id
    where e.estado = 'publicada' and c.estado = 'ativo' and c.tem_louvor and c.data = v_dia
      and not exists (select 1 from public.aviso a where a.tipo = 'lembrete_ensaio' and a.escala_id = e.id)
  loop
    select count(*) into v_musicas from public.repertorio_item ri where ri.culto_id = r.culto_id;
    perform privado.criar_aviso('lembrete_ensaio', r.escala_id, null,
      v_semana[extract(dow from r.data)::int + 1] || ' tem ' || r.nome || '. Bora ensaiar'
        || case when v_musicas > 0 then ': ' || v_musicas || case when v_musicas = 1 then ' música' else ' músicas' end || ' no repertório.' else '!' end,
      array(select ei.pessoa_id from public.escala_item ei where ei.escala_id = r.escala_id and ei.saiu_em is null));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function privado.lembrar_ensaio(date) from public, anon, authenticated;

-- =============================================================================
-- Pedido de acesso: avisa os administradores
-- =============================================================================
create function privado.avisar_pedido_de_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_admins uuid[];
begin
  select coalesce(array_agg(c.pessoa_id), '{}') into v_admins
  from public.conta c where c.e_administrador and c.estado = 'ativa' and c.pessoa_id is not null;
  if cardinality(v_admins) > 0 then
    perform privado.criar_aviso('acesso_pedido', null, null,
      coalesce(new.nome_informado, 'Alguém') || ' pediu acesso ao Hub.', v_admins);
  end if;
  return new;
end;
$$;
revoke execute on function privado.avisar_pedido_de_acesso() from public, anon, authenticated;

create trigger conta_avisa_pedido_de_acesso
after update of apresentou_em on public.conta
for each row
when (old.apresentou_em is null and new.apresentou_em is not null and new.estado = 'pendente')
execute function privado.avisar_pedido_de_acesso();

-- =============================================================================
-- Agendamento (só no Supabase de verdade; horários em UTC = Brasília + 3)
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('avisar-aniversarios', '0 12 * * *', 'select privado.avisar_aniversarios()');
    perform cron.schedule('lembrar-ensaio', '0 22 * * *', 'select privado.lembrar_ensaio()');
    perform cron.schedule('apagar-pedidos-de-oracao', '30 6 * * *', 'select privado.apagar_pedidos_antigos()');
  end if;
end;
$$;
