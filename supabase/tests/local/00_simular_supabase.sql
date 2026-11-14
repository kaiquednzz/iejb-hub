-- Simula, num Postgres comum, o mínimo do Supabase que as migrações usam:
-- os papéis (anon, authenticated, service_role), o esquema auth com a tabela
-- users e a função auth.uid(). NÃO vai para o Supabase de verdade.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  phone              text,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'
);

-- No Supabase, quem está logado chega com um JWT e auth.uid() lê o "sub".
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- O Supabase dá privilégios amplos por padrão a TODO objeto novo do esquema
-- public: tabelas (inclusive TRUNCATE) e funções ficam liberadas para anon e
-- authenticated. Imitar isso aqui é o que permite aos testes pegar uma função
-- que esquecemos de fechar.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
