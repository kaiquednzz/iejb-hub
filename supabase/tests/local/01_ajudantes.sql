-- Funções de apoio para os testes. NÃO vão para o Supabase de verdade.
create schema teste;
grant usage on schema teste to authenticated, anon;

-- Falha o teste se a condição for falsa.
create function teste.ok(p_condicao boolean, p_descricao text)
returns void language plpgsql as $$
begin
  if p_condicao is not true then
    raise exception 'FALHOU: %', p_descricao;
  end if;
  raise notice 'ok: %', p_descricao;
end;
$$;

-- Falha o teste se o comando NÃO der erro.
create function teste.deve_falhar(p_sql text, p_descricao text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok: % (bloqueado: %)', p_descricao, sqlerrm;
    return;
  end;
  raise exception 'FALHOU: % (o comando deveria ter sido bloqueado)', p_descricao;
end;
$$;

-- Finge que o usuário com esse e-mail está logado (o que o JWT faz no Supabase).
create function teste.entrar(p_email text)
returns void language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then raise exception 'Usuário de teste % não existe', p_email; end if;
  -- aal2: como quem confirmou com o código do app autenticador (D57).
  -- Os cenários antigos são de antes do código existir e assumem acesso cheio.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated', 'aal', 'aal2')::text, false);
end;
$$;

-- O mesmo, mas a pessoa só digitou a senha (sem o código)
create function teste.entrar_so_com_senha(p_email text)
returns void language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then raise exception 'Usuário de teste % não existe', p_email; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated', 'aal', 'aal1')::text, false);
end;
$$;

grant execute on all functions in schema teste to authenticated, anon;
