-- =============================================================================
-- Migração 19: "não vou poder ir" (D35) e repertório só de quem é do culto (D36).
-- Dados: fim do 06/07. :escala = culto publicado do G2 (Gabi lidera; Mem toca,
-- Avu na mesa). :escala_g3 = culto publicado do G3. :escala_rascunho = G2 em rascunho.
-- =============================================================================
\set ON_ERROR_STOP 1

reset role;
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g2 from public.grupo where nome = 'G2' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as p_gabi  from public.pessoa where apelido = 'Gabi' \gset
select id as p_mem   from public.pessoa where apelido = 'Mem' \gset
select id as p_avu   from public.pessoa where apelido = 'Avu' \gset
select id as p_lider from public.pessoa where apelido = 'Líder' \gset
select e.id as escala, e.culto_id as culto from public.escala e
join public.escala_grupo eg on eg.escala_id = e.id and eg.grupo_id = :'g2'
join public.escala_item i on i.escala_id = e.id and i.pessoa_id = :'p_mem'
where e.estado = 'publicada' limit 1 \gset
select e.id as escala_g3, e.culto_id as culto_g3 from public.escala e
join public.escala_grupo eg on eg.escala_id = e.id and eg.grupo_id = :'g3'
where e.estado = 'publicada' and not exists (select 1 from public.escala_grupo x where x.escala_id = e.id and x.grupo_id <> :'g3')
order by e.criado_em desc limit 1 \gset
select e.id as escala_rascunho from public.escala e
join public.escala_item i on i.escala_id = e.id and i.pessoa_id = :'p_mem'
where e.estado = 'rascunho' limit 1 \gset
select count(*) as avisos_antes from public.aviso \gset

set role authenticated;

-- D35 --------------------------------------------------------------------------
select teste.entrar('membro@teste');
update public.escala_item set saiu_em = now() where escala_id = :'escala' and pessoa_id = :'p_mem';
select teste.ok((select saiu_em is null from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'D35: o integrante não mexe na escala direto (só pela função)');

select public.marcar_presenca(:'escala', false);
select teste.ok((select saiu_em is not null from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'D35: "não vou poder ir" marca a saída e mantém a pessoa na escala');
select public.marcar_presenca(:'escala', false);
select teste.deve_falhar(format('select public.marcar_presenca(%L, false)', :'escala_rascunho'),
  'D35: em rascunho não dá (a escala ainda não vale)');
select teste.entrar('g3@teste');
select teste.deve_falhar(format('select public.marcar_presenca(%L, false)', :'escala'),
  'D35: só quem está na escala');

reset role;
select teste.ok((select count(*) = :avisos_antes + 1 from public.aviso), 'D35: um aviso só, mesmo marcando duas vezes');
select id as aviso, resumo from public.aviso where tipo = 'presenca_alterada' order by criado_em desc limit 1 \gset
select teste.ok(:'resumo' like 'Mem não vai: %', 'D35: o aviso diz quem não vai e o culto');
select teste.ok((select count(*) = 1 from public.aviso_destinatario where aviso_id = :'aviso' and pessoa_id = :'p_gabi'),
  'D35: o líder do grupo do culto é avisado');
select teste.ok((select count(*) = 1 from public.aviso_destinatario where aviso_id = :'aviso' and pessoa_id = :'p_lider'),
  'D35: o líder de louvor é avisado');
select teste.ok((select count(*) = 0 from public.aviso_destinatario where aviso_id = :'aviso' and pessoa_id in (:'p_mem', :'p_avu')),
  'D35: quem saiu e os outros escalados não recebem');
select teste.ok((select count(*) = 0 from public.escala_alteracao where escala_id = :'escala' and processada_em is null),
  'D35: não gera "escala atualizada" para todo mundo');

set role authenticated;
select teste.entrar('membro@teste');
select public.marcar_presenca(:'escala', true);
select teste.ok((select saiu_em is null from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'D35: dá para voltar atrás');
reset role;
select teste.ok((select resumo like 'Mem vai de novo: %' from public.aviso where tipo = 'presenca_alterada' order by criado_em desc limit 1),
  'D35: e os líderes ficam sabendo');

-- Culto que já começou: joga o culto para uma data antiga (não "hoje": num
-- domingo já existe um culto do mesmo tipo e a data é única por tipo)
update public.culto set data = date '2000-01-02' where id = :'culto';
set role authenticated;
select teste.entrar('membro@teste');
select teste.deve_falhar(format('select public.marcar_presenca(%L, false)', :'escala'), 'D35: depois que o culto começa, não dá mais');

-- D36 --------------------------------------------------------------------------
select teste.entrar('lider@teste');
insert into public.musica (titulo, artista) values ('Música do G3', 'Teste') returning id as musica \gset
insert into public.repertorio_item (culto_id, ministerio_id, musica_id) values (:'culto_g3', :'louvor', :'musica');

select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 0 from public.repertorio_item where culto_id = :'culto_g3'),
  'D36: quem não é do culto não vê o repertório');
select teste.entrar('g3@teste');
select teste.ok((select count(*) = 1 from public.repertorio_item where culto_id = :'culto_g3'),
  'D36: o grupo do culto vê');
select teste.entrar('lider@teste');
select teste.ok((select count(*) = 1 from public.repertorio_item where culto_id = :'culto_g3'), 'D36: o líder de louvor vê');
insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido) values (:'escala_g3', :'p_avu', '{Teclado}');
select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 1 from public.repertorio_item where culto_id = :'culto_g3'),
  'D36: escalado avulso no culto também vê');

-- Links diretos dos streamings: só o servidor grava; mudar a música zera
select teste.entrar('lider@teste');
update public.musica set links_streaming = '{"apple": "https://evil.example"}' where id = :'musica';
reset role;
select teste.ok((select links_streaming is null from public.musica where id = :'musica'), 'links: o app não escreve os links');
update public.musica set links_streaming = '{"apple": "https://music.apple.com/br/x"}' where id = :'musica';
set role authenticated;
select teste.entrar('lider@teste');
update public.musica set titulo = 'Música do G3 (ao vivo)' where id = :'musica';
reset role;
select teste.ok((select links_streaming is null from public.musica where id = :'musica'), 'links: mudar o título zera os links antigos');
\warn 'TESTES DO NÃO VOU E DO REPERTÓRIO PASSARAM'
