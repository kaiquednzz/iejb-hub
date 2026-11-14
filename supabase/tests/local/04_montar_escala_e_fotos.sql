-- =============================================================================
-- Migração 11: grupos por culto, mesa de som e fotos.
-- Roda depois do 03 ("lider@teste" é admin e líder de louvor).
-- G2 = Gabi (violão) + Mem (bateria); G3 = Gui (teclado) + Mem (violão, voz).
-- =============================================================================
\set ON_ERROR_STOP 1

reset role;
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g2 from public.grupo where nome = 'G2' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as p_gabi from public.pessoa where apelido = 'Gabi' \gset
select id as p_gui  from public.pessoa where apelido = 'Gui' \gset
select id as p_mem  from public.pessoa where apelido = 'Mem' \gset
select id as p_avu  from public.pessoa where apelido = 'Avu' \gset
-- Um culto ainda sem escala
select c.id as culto from public.culto c
where c.tem_louvor and not exists (select 1 from public.escala e where e.culto_id = c.id)
order by c.data limit 1 \gset
set role authenticated;

select teste.entrar('membro@teste');
select teste.deve_falhar(format('select public.definir_grupos_do_culto(%L, %L, array[%L]::uuid[])', :'culto', :'louvor', :'g2'),
  'RN-02: integrante não monta escala');

select teste.entrar('lider@teste');
select public.definir_grupos_do_culto(:'culto', :'louvor', array[:'g2']::uuid[]) as escala \gset
select teste.ok((select estado = 'rascunho' from public.escala where id = :'escala'), 'escolher o grupo cria a escala em rascunho');
select teste.ok((select count(*) = 2 from public.escala_item where escala_id = :'escala'), 'o G2 inteiro entra');
select teste.ok((select instrumento_exibido = '{bateria}' from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'RN-17: entra com o instrumento do G2');

update public.escala set estado = 'publicada' where id = :'escala';
select count(*) as antes from public.escala_alteracao where escala_id = :'escala' \gset

-- Troca G2 por G3 depois de publicada
select public.definir_grupos_do_culto(:'culto', :'louvor', array[:'g3']::uuid[]);
select teste.ok((select array_agg(pessoa_id order by pessoa_id) = (select array_agg(x order by x) from unnest(array[:'p_gui', :'p_mem']::uuid[]) x)
                 from public.escala_item where escala_id = :'escala'), 'trocar o grupo troca as pessoas');
select teste.ok((select count(*) = 1 from public.escala_alteracao where escala_id = :'escala' and tipo = 'saiu' and pessoa_id = :'p_gabi'),
  'quem saiu é avisado');
select teste.ok((select count(*) = 1 from public.escala_alteracao where escala_id = :'escala' and tipo = 'entrou' and pessoa_id = :'p_gui'),
  'quem entrou é avisado');
select teste.ok((select count(*) = 0 from public.escala_alteracao where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'quem está nos dois grupos não sai e entra de novo (nada de aviso à toa)');
select teste.ok((select count(*) = 1 from public.escala_grupo where escala_id = :'escala' and grupo_id = :'g3'),
  'o grupo usado agora é o G3');

-- Grupos mesclados (culto especial)
select public.definir_grupos_do_culto(:'culto', :'louvor', array[:'g2', :'g3']::uuid[]);
select teste.ok((select count(*) = 3 from public.escala_item where escala_id = :'escala'), 'G2 + G3 juntos, sem duplicar quem está nos dois');

-- Mesa de som
select public.definir_mesa(:'culto', :'louvor', :'p_avu');
select teste.ok((select instrumento_exibido = '{Mesa}' and origem_grupo_id is null from public.escala_item
                 where escala_id = :'escala' and pessoa_id = :'p_avu'), 'mesa entra como avulsa com a função Mesa');
select public.definir_mesa(:'culto', :'louvor', :'p_mem');
select teste.ok((select count(*) = 0 from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_avu'),
  'trocar a mesa tira quem só estava pela mesa');
select teste.ok((select 'Mesa' = any (instrumento_exibido) and cardinality(instrumento_exibido) > 1 from public.escala_item
                 where escala_id = :'escala' and pessoa_id = :'p_mem'), 'quem já toca ganha a mesa junto');
select public.definir_mesa(:'culto', :'louvor', null);
select teste.ok((select not ('Mesa' = any (instrumento_exibido)) from public.escala_item
                 where escala_id = :'escala' and pessoa_id = :'p_mem'), 'sem mesa: tira só a função, a pessoa continua tocando');
-- A mesa não some quando troca o grupo
select public.definir_mesa(:'culto', :'louvor', :'p_avu');
select public.definir_grupos_do_culto(:'culto', :'louvor', array[:'g2']::uuid[]);
select teste.ok((select count(*) = 1 from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_avu'),
  'trocar o grupo não tira a mesa');

-- Rótulo do culto
update public.culto set rotulo = 'Ceia' where id = :'culto';
select teste.deve_falhar(format($$update public.culto set rotulo = '   ' where id = %L$$, :'culto'), 'rótulo vazio não vale');

-- Fotos
select teste.entrar('membro@teste');
select public.definir_foto(:'p_mem', :'p_mem' || '/11111111-1111-1111-1111-111111111111.webp');
select teste.ok((select foto is not null from public.pessoa where id = :'p_mem'), 'integrante troca a própria foto');
select teste.deve_falhar(format('select public.definir_foto(%L, %L)', :'p_gabi', :'p_gabi' || '/11111111-1111-1111-1111-111111111111.webp'),
  'integrante não troca a foto dos outros');
select teste.deve_falhar(format('select public.definir_foto(%L, %L)', :'p_mem', :'p_gabi' || '/11111111-1111-1111-1111-111111111111.webp'),
  'a foto precisa ficar na pasta da própria pessoa');
select teste.ok((select privado.pode_mudar_foto_no_caminho('../../etc/passwd') = false), 'caminho estranho não passa (sem erro)');
select teste.entrar('lider@teste');
select public.definir_foto(:'p_gabi', null);
select teste.ok(true, 'líder de louvor pode tirar a foto de alguém');
reset role;

\warn 'TESTES DE MONTAR ESCALA E FOTOS PASSARAM'
