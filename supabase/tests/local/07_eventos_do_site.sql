-- =============================================================================
-- Migração 18 (D34): eventos do site. Só admin (lider@teste, que virou admin no cenário 02) escreve; o site
-- (anon) lê só os publicados que ainda não passaram, e nunca a tabela.
-- =============================================================================
\set ON_ERROR_STOP 1

reset role;
set role authenticated;

select teste.entrar('lider@teste');
insert into public.evento (titulo, destaque, categoria, descricao, data, horario, publicado)
values ('Culto de Jovens', 'Jovens', 'Jovens', 'Louvor, palavra e comunhão para a juventude.', current_date + 10, '19:30', false)
returning id as rascunho \gset
select teste.ok((select count(*) = 1 from public.evento where id = :'rascunho'), 'D34: admin cria evento');
insert into public.evento (titulo, categoria, descricao, data, horario, publicado)
values ('Evento antigo', 'Teste', 'Esse já aconteceu faz tempo.', current_date - 5, '19:30', true);

select teste.deve_falhar($$insert into public.evento (titulo, destaque, categoria, descricao, data, horario) values ('Cantata', 'Natal', 'X1', 'Descrição longa o bastante.', current_date, '18:00')$$,
  'D34: destaque precisa estar dentro do título');
select teste.deve_falhar($$insert into public.evento (titulo, categoria, descricao, data, horario, link_inscricao) values ('Retiro', 'X1', 'Descrição longa o bastante.', current_date, '18:00', 'javascript:alert(1)')$$,
  'D34: link de inscrição só https');
select teste.deve_falhar($$insert into public.evento (titulo, categoria, descricao, data, horario, link_inscricao) values ('Retiro', 'X1', 'Descrição longa o bastante.', current_date, '18:00', 'https://x.com/"><script>')$$,
  'D34: link de inscrição sem aspas nem <');
select teste.deve_falhar($$insert into public.evento (titulo, categoria, descricao, data, horario, imagem) values ('Retiro', 'X1', 'Descrição longa o bastante.', current_date, '18:00', '../../etc/passwd')$$,
  'D34: imagem só nome do bucket ou images/ do site');
select teste.deve_falhar($$insert into public.evento (titulo, categoria, descricao, data, horario, local_nome) values ('Retiro', 'X1', 'Descrição longa o bastante.', current_date, '18:00', 'Chácara')$$,
  'D34: local fora da igreja precisa de nome e cidade');

-- Quem não é admin
select teste.entrar('g2@teste');
select teste.ok((select count(*) = 0 from public.evento), 'D34: líder de grupo não vê os eventos do Hub (rascunhos)');
select teste.deve_falhar($$insert into public.evento (titulo, categoria, descricao, data, horario) values ('Invasão', 'X1', 'Descrição longa o bastante.', current_date, '18:00')$$,
  'D34: quem não é admin não cria evento');
update public.evento set publicado = true where id = :'rascunho';
reset role;
select teste.ok((select not publicado from public.evento where id = :'rascunho'), 'D34: quem não é admin não publica');

-- O site (sem login)
select count(*) as esperados from public.evento where publicado and coalesce(data_fim, data) >= current_date - 1 \gset
set role anon;
select teste.deve_falhar('select * from public.evento', 'D34: o site não lê a tabela direto');
select teste.ok((select count(*) = :esperados from public.eventos_do_site()), 'D34: o site recebe os publicados que não passaram');
select teste.ok(not exists (select 1 from public.eventos_do_site() where titulo in ('Culto de Jovens', 'Evento antigo')),
  'D34: rascunho e evento passado não saem do Hub');
reset role;
