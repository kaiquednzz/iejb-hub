-- =============================================================================
-- Cenário completo do piloto Louvor, do primeiro administrador aos avisos.
-- Cada "teste.ok" ou "teste.deve_falhar" é uma regra conferida.
-- Rode com: ./rodar.sh
-- =============================================================================
\set ON_ERROR_STOP 1

-- -----------------------------------------------------------------------------
-- 1. Cadastros pelo app (no Supabase de verdade, isso é o signUp)
-- -----------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('kaique@teste',   '{"nome": "Kaique"}'),
  ('lider@teste',    '{"nome": "Líder de Louvor"}'),
  ('g2@teste',       '{"nome": "Gabi"}'),
  ('g3@teste',       '{"nome": "Gui"}'),
  ('membro@teste',   '{"nome": "Membro"}'),
  ('avulso@teste',   '{"nome": "Avulso"}'),
  ('temp@teste',     '{"nome": "Temp"}'),
  ('pendente@teste', '{"nome": "Pendente"}'),
  ('estranho@teste', '{}');

select teste.ok((select count(*) = 9 from public.conta where estado = 'pendente'),
  'RN-10: todo cadastro nasce como conta pendente');
select teste.ok((select nome_informado = 'Gabi' from public.conta where login = 'g2@teste'),
  'o nome digitado no cadastro fica guardado para o admin reconhecer');

-- Primeiro administrador, pelo painel do Supabase (RN-03).
select public.inicializar_primeiro_admin('kaique@teste', 'Kaique');
select teste.deve_falhar($$select public.inicializar_primeiro_admin('lider@teste', 'X')$$,
  'RN-03: o atalho do primeiro admin só funciona uma vez');

set role authenticated;

-- -----------------------------------------------------------------------------
-- 2. Conta pendente não enxerga nada (a trava central)
-- -----------------------------------------------------------------------------
select teste.entrar('pendente@teste');
select teste.ok((select count(*) = 0 from public.pessoa),     'pendente não vê pessoas');
select teste.ok((select count(*) = 0 from public.ministerio), 'pendente não vê ministérios');
select teste.ok((select count(*) = 0 from public.grupo),      'pendente não vê grupos');
select teste.ok((select count(*) = 0 from public.culto),      'pendente não vê cultos');
select teste.ok((select count(*) = 1 from public.conta),      'pendente vê só a própria conta');
select teste.deve_falhar($$insert into public.pessoa (nome) values ('Invasor')$$,
  'pendente não cadastra pessoa');
select teste.deve_falhar(
  format('select public.aprovar_conta(%L, gen_random_uuid())', (select id from public.conta)),
  'pendente não aprova a si mesmo');

-- -----------------------------------------------------------------------------
-- 3. Administrador monta o cadastro
-- -----------------------------------------------------------------------------
select teste.entrar('kaique@teste');
select teste.ok((select count(*) = 9 from public.conta), 'admin vê todas as contas');

insert into public.pessoa (nome, apelido, contato, instrumentos) values
  ('Líder de Louvor', 'Líder', '11 90000-0001', '{voz}'),
  ('Gabriela',        'Gabi',  '11 90000-0002', '{violão}'),
  ('Guilherme',       'Gui',   '11 90000-0003', '{teclado}'),
  ('Membro',          'Mem',   '11 90000-0004', '{bateria,violão,voz}'),
  ('Avulso',          'Avu',   null,            '{baixo}'),
  ('Temporário',      'Tem',   null,            '{voz}');

select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g1 from public.grupo where nome = 'G1' \gset
select id as g2 from public.grupo where nome = 'G2' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as p_kaique from public.pessoa where nome = 'Kaique' \gset
select id as p_lider  from public.pessoa where apelido = 'Líder' \gset
select id as p_gabi   from public.pessoa where apelido = 'Gabi' \gset
select id as p_gui    from public.pessoa where apelido = 'Gui' \gset
select id as p_mem    from public.pessoa where apelido = 'Mem' \gset
select id as p_avu    from public.pessoa where apelido = 'Avu' \gset
select id as p_tem    from public.pessoa where apelido = 'Tem' \gset
select id as c_kaique   from public.conta where login = 'kaique@teste' \gset
select id as c_lider    from public.conta where login = 'lider@teste' \gset
select id as c_g2       from public.conta where login = 'g2@teste' \gset
select id as c_g3       from public.conta where login = 'g3@teste' \gset
select id as c_mem      from public.conta where login = 'membro@teste' \gset
select id as c_avu      from public.conta where login = 'avulso@teste' \gset
select id as c_tem      from public.conta where login = 'temp@teste' \gset
select id as c_estranho from public.conta where login = 'estranho@teste' \gset

select public.aprovar_conta(:'c_lider', :'p_lider');
select public.aprovar_conta(:'c_g2',    :'p_gabi');
select public.aprovar_conta(:'c_g3',    :'p_gui');
select public.aprovar_conta(:'c_mem',   :'p_mem');
select public.aprovar_conta(:'c_avu',   :'p_avu');
select public.aprovar_conta(:'c_tem',   :'p_tem', true);  -- criada com senha temporária
select public.recusar_conta(:'c_estranho');

select teste.deve_falhar(format('select public.aprovar_conta(%L, %L)', :'c_estranho', :'p_gabi'),
  'uma pessoa não pode ter duas contas');

insert into public.membro_ministerio (pessoa_id, ministerio_id, e_lider) values
  (:'p_kaique', :'louvor', false),
  (:'p_lider',  :'louvor', true),   -- só admin designa o líder de louvor
  (:'p_gabi',   :'louvor', false),
  (:'p_gui',    :'louvor', false),
  (:'p_mem',    :'louvor', false),
  (:'p_avu',    :'louvor', false),
  (:'p_tem',    :'louvor', false);

select teste.ok((select count(*) >= 5 from public.registro_auditoria),
  'ações do admin ficam no registro de auditoria');

-- -----------------------------------------------------------------------------
-- 4. Senha temporária: não acessa nada até trocar (RN-10, RN-65)
-- -----------------------------------------------------------------------------
select teste.entrar('temp@teste');
select teste.ok((select count(*) = 0 from public.pessoa), 'com senha temporária não vê nada');
reset role;
update auth.users set encrypted_password = 'nova' where email = 'temp@teste';  -- a pessoa trocou a senha
set role authenticated;
select teste.ok((select count(*) > 0 from public.pessoa), 'depois de trocar a senha, acessa normalmente');

-- -----------------------------------------------------------------------------
-- 5. Integrante: vê, mas não muda o que não é dele
-- -----------------------------------------------------------------------------
select teste.entrar('membro@teste');
select teste.ok((select count(*) = 1 from public.conta), 'integrante vê só a própria conta');
select teste.ok((select contato = '11 90000-0002' from public.pessoa where apelido = 'Gabi'),
  'Q22: integrante vê o contato dos outros');
select teste.ok((select count(*) = 0 from public.registro_auditoria), 'integrante não vê a auditoria');
update public.pessoa set nome = 'Hackeado' where apelido = 'Gabi';
select teste.ok((select nome = 'Gabriela' from public.pessoa where apelido = 'Gabi'),
  'integrante não edita outra pessoa');
select public.atualizar_meu_contato('11 98888-7777');
select teste.ok((select contato = '11 98888-7777' from public.pessoa where apelido = 'Mem'),
  'integrante edita o próprio contato');
select teste.deve_falhar(format('select public.aprovar_conta(%L, %L)', :'c_estranho', :'p_avu'),
  'integrante não aprova contas');
select teste.deve_falhar($$insert into public.musica (titulo) values ('Qualquer')$$,
  'integrante não cadastra música');

-- -----------------------------------------------------------------------------
-- 6. Líder de louvor organiza os grupos
-- -----------------------------------------------------------------------------
select teste.entrar('lider@teste');
select teste.deve_falhar(
  format('update public.membro_ministerio set e_lider = true where pessoa_id = %L', :'p_gabi'),
  'só admin designa outro líder de louvor');

insert into public.grupo_membro (grupo_id, pessoa_id, instrumentos) values
  (:'g2', :'p_gabi', '{violão}'),
  (:'g2', :'p_mem',  '{bateria}'),        -- Q19: no G2 ele toca bateria
  (:'g3', :'p_gui',  '{teclado}'),
  (:'g3', :'p_mem',  '{violão,voz}');     -- ... e no G3, violão e voz
update public.grupo set lider_pessoa_id = :'p_gabi' where id = :'g2';
update public.grupo set lider_pessoa_id = :'p_gui'  where id = :'g3';

select teste.deve_falhar(format('update public.grupo set lider_pessoa_id = %L where id = %L', :'p_avu', :'g1'),
  'RN-12: o líder precisa ser membro do grupo');

-- -----------------------------------------------------------------------------
-- 7. Líder de grupo mexe só no próprio grupo (RN-16)
-- -----------------------------------------------------------------------------
select teste.entrar('g2@teste');
insert into public.grupo_membro (grupo_id, pessoa_id, instrumentos) values (:'g2', :'p_avu', '{baixo}');
select teste.ok((select count(*) = 3 from public.grupo_membro where grupo_id = :'g2'),
  'líder do G2 inclui gente no G2');
delete from public.grupo_membro where grupo_id = :'g2' and pessoa_id = :'p_avu';
select teste.deve_falhar(format('insert into public.grupo_membro (grupo_id, pessoa_id) values (%L, %L)', :'g3', :'p_avu'),
  'líder do G2 não mexe no G3');
select teste.deve_falhar(format('delete from public.grupo_membro where grupo_id = %L and pessoa_id = %L', :'g2', :'p_gabi'),
  'o líder não sai do próprio grupo sem antes trocar o líder');

-- -----------------------------------------------------------------------------
-- 8. Cultos e montagem da escala em rascunho
-- -----------------------------------------------------------------------------
select teste.entrar('lider@teste');
select teste.ok((select public.gerar_cultos(current_date + 14) >= 4), 'RN-21: gera os cultos recorrentes');
select teste.ok((select public.gerar_cultos(current_date + 14) = 0), 'gerar de novo não duplica');

select id as culto_oracao  from public.culto where nome = 'Culto de Oração'  order by data limit 1 \gset
select id as culto_familia from public.culto where nome = 'Culto da Família' order by data limit 1 \gset
select id as culto_ebd     from public.culto where nome = 'EBD'              order by data limit 1 \gset

select teste.deve_falhar(format('insert into public.escala (culto_id, ministerio_id) values (%L, %L)', :'culto_ebd', :'louvor'),
  'RN-20: EBD não tem louvor, então não recebe escala');

insert into public.escala (culto_id, ministerio_id) values (:'culto_oracao', :'louvor');
select id as escala from public.escala where culto_id = :'culto_oracao' \gset

select teste.ok((select public.preencher_escala_com_grupo(:'escala', :'g2') = 2),
  'RN-31: escolher o G2 coloca os membros do G2 na escala');
select teste.ok((select public.preencher_escala_com_grupo(:'escala', :'g2') = 0),
  'RN-33: a mesma pessoa não entra duas vezes');
select teste.ok((select instrumento_exibido = '{bateria}' from public.escala_item where pessoa_id = :'p_mem'),
  'RN-17/Q19: o instrumento vem do padrão do grupo usado');

select teste.entrar('membro@teste');
select teste.ok((select count(*) = 0 from public.escala),      'RN-34: integrante não vê rascunho');
select teste.ok((select count(*) = 0 from public.escala_item), 'RN-34: nem as pessoas do rascunho');
select teste.entrar('kaique@teste');
select teste.ok((select count(*) = 0 from public.escala),      'admin também não vê rascunho (RN-02)');
select teste.deve_falhar(format('insert into public.escala_item (escala_id, pessoa_id) values (%L, %L)', :'escala', :'p_avu'),
  'RN-02: admin não edita escala');
select teste.entrar('g2@teste');
select teste.deve_falhar(format('insert into public.repertorio_item (culto_id, ministerio_id, musica_id) select %L, %L, gen_random_uuid()', :'culto_oracao', :'louvor'),
  'Q21: líder de grupo só edita o repertório depois da publicação');

-- -----------------------------------------------------------------------------
-- 9. Publicação e avisos (RN-40, RN-41, RN-45)
-- -----------------------------------------------------------------------------
select teste.entrar('lider@teste');
update public.escala set estado = 'publicada' where id = :'escala';
select teste.ok((select publicada_em is not null and alterada_por = :'p_lider' from public.escala where id = :'escala'),
  'RN-35: guarda quando publicou e quem alterou por último');

select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 2 from public.escala_item), 'RN-36: todo integrante vê a escala publicada');

reset role;
select teste.ok((select public.processar_avisos_pendentes(interval '0') = 1), 'publicação gera um aviso');
set role authenticated;

select teste.entrar('membro@teste');
select teste.ok((select count(*) = 1 from public.aviso_destinatario), 'escalado recebe o aviso');
select teste.ok((select resumo like 'Escala publicada: Culto de Oração%' from public.aviso),
  'o aviso descreve o culto');
select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 0 from public.aviso_destinatario), 'RN-41: quem não está escalado não recebe');

-- Troca: entra o Avulso, sai o Membro, muda o instrumento da Gabi.
select teste.entrar('lider@teste');
insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido) values (:'escala', :'p_avu', '{baixo}');
delete from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem';
update public.escala_item set instrumento_exibido = '{voz}' where escala_id = :'escala' and pessoa_id = :'p_gabi';

select teste.deve_falhar(format('update public.escala set estado = %L where id = %L', 'rascunho', :'escala'),
  'publicada não volta a rascunho');
delete from public.escala where id = :'escala';
select teste.ok((select count(*) = 1 from public.escala where id = :'escala'), 'escala publicada não pode ser apagada');

reset role;
select teste.ok((select public.processar_avisos_pendentes(interval '0') = 1),
  'RN-45: três mudanças seguidas viram um único aviso');
select teste.ok((
  select array_agg(d.pessoa_id order by d.pessoa_id)
       = (select array_agg(x order by x) from unnest(array[:'p_gabi', :'p_avu', :'p_mem']::uuid[]) x)
  from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
  where a.resumo like 'Escala atualizada%'),
  'Q14: avisa quem entrou, quem saiu e quem continua');
select teste.ok((select resumo like '%Entrou: Avu%Saiu: Mem%' from public.aviso where resumo like 'Escala atualizada%'),
  'o resumo diz quem entrou e quem saiu');
select teste.ok((select public.processar_avisos_pendentes(interval '0') = 0), 'nada pendente, nada a avisar');
set role authenticated;

select teste.entrar('membro@teste');
select teste.ok((select public.marcar_aviso_lido() = 2), 'integrante marca os próprios avisos como lidos');
select teste.deve_falhar(format('insert into public.escala_item (escala_id, pessoa_id) values (%L, %L)', :'escala', :'p_mem'),
  'integrante não se coloca na escala');

-- -----------------------------------------------------------------------------
-- 10. Repertório (RN-50 a RN-56)
-- -----------------------------------------------------------------------------
select teste.entrar('g2@teste');
insert into public.musica (titulo, artista) values ('Música A', 'Banda'), ('Música B', 'Banda'), ('Música C', 'Banda');
select teste.deve_falhar($$insert into public.musica (titulo, artista) values ('música a', 'BANDA')$$,
  'a mesma música não é cadastrada duas vezes');

insert into public.repertorio_item (culto_id, ministerio_id, musica_id, tom)
select :'culto_oracao', :'louvor', id, 'G' from public.musica order by titulo;
select teste.ok((select array_agg(posicao order by posicao) = '{1,2,3}' from public.repertorio_item),
  'RN-53: músicas entram em ordem, no fim da lista');

select r.id as item_c from public.repertorio_item r join public.musica m on m.id = r.musica_id where m.titulo = 'Música C' \gset
select public.mover_musica_no_repertorio(:'item_c', 1);
select teste.ok((
  select array_agg(m.titulo order by r.posicao) = '{Música C,Música A,Música B}'
  from public.repertorio_item r join public.musica m on m.id = r.musica_id),
  'reordenar leva a música para a posição certa');

delete from public.repertorio_item r using public.musica m where m.id = r.musica_id and m.titulo = 'Música A';
select teste.ok((select array_agg(posicao order by posicao) = '{1,2}' from public.repertorio_item),
  'tirar uma música fecha o buraco na ordem');
select teste.deve_falhar($$delete from public.musica where titulo = 'Música C'$$,
  'música usada num repertório não pode ser apagada');

select teste.entrar('g3@teste');
select teste.deve_falhar(format('insert into public.repertorio_item (culto_id, ministerio_id, musica_id) select %L, %L, id from public.musica limit 1', :'culto_oracao', :'louvor'),
  'RN-56: líder do G3 não edita repertório de culto do G2');

reset role;
select teste.ok((select public.processar_avisos_pendentes(interval '0') = 1), 'RN-55: mudança no repertório gera aviso');
select teste.ok((select count(*) = 2 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'repertorio_alterado'),
  'aviso de repertório vai só para quem está escalado');
set role authenticated;

-- -----------------------------------------------------------------------------
-- 11. Solicitação de alteração (RN-37 a RN-39, Q20)
-- -----------------------------------------------------------------------------
select teste.entrar('g3@teste');
select teste.deve_falhar(format('insert into public.solicitacao_alteracao (escala_id, texto) values (%L, %L)', :'escala', 'trocar'),
  'Q20: líder do G3 não pede alteração em culto do G2');

select teste.entrar('g2@teste');
insert into public.solicitacao_alteracao (escala_id, texto) values (:'escala', 'Trocar Avu por Mem na terça');
select id as solicitacao from public.solicitacao_alteracao \gset
select teste.deve_falhar(format('select public.decidir_solicitacao(%L, true)', :'solicitacao'),
  'líder de grupo não aprova a própria solicitação');

select teste.entrar('lider@teste');
select teste.ok((select count(*) = 1 from public.aviso where tipo = 'solicitacao_nova'),
  'RN-46: líder de louvor é avisado na hora');
select public.decidir_solicitacao(:'solicitacao', false, 'Avu já confirmou');
select teste.deve_falhar(format('select public.decidir_solicitacao(%L, true)', :'solicitacao'),
  'solicitação decidida não se decide de novo');

select teste.entrar('g2@teste');
select teste.ok((select resumo like '%reprovada%Motivo: Avu já confirmou' from public.aviso where tipo = 'solicitacao_decidida'),
  'RN-47: autor recebe a resposta com o motivo');

-- -----------------------------------------------------------------------------
-- 12. Culto só com avulsos (Q13) e cancelamento (RN-23)
-- -----------------------------------------------------------------------------
select teste.entrar('lider@teste');
insert into public.escala (culto_id, ministerio_id, estado) values (:'culto_familia', :'louvor', 'publicada');
select id as escala_familia from public.escala where culto_id = :'culto_familia' \gset
insert into public.escala_item (escala_id, pessoa_id) values (:'escala_familia', :'p_avu');

select teste.entrar('g2@teste');
select teste.deve_falhar(format('insert into public.repertorio_item (culto_id, ministerio_id, musica_id) select %L, %L, id from public.musica limit 1', :'culto_familia', :'louvor'),
  'Q13: culto sem grupo, só líder de louvor e admin editam o repertório');

select teste.entrar('kaique@teste');
insert into public.repertorio_item (culto_id, ministerio_id, musica_id)
select :'culto_familia', :'louvor', id from public.musica where titulo = 'Música B';
select teste.ok((select count(*) = 1 from public.repertorio_item where culto_id = :'culto_familia'),
  'admin edita repertório de qualquer culto');

reset role;
select public.processar_avisos_pendentes(interval '0');
set role authenticated;

select teste.entrar('lider@teste');
update public.culto set estado = 'cancelado' where id = :'culto_familia';
reset role;
select public.processar_avisos_pendentes(interval '0');
select teste.ok((select count(*) = 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'culto_cancelado' and d.pessoa_id = :'p_avu'),
  'RN-23: escalados são avisados do cancelamento');
set role authenticated;

-- -----------------------------------------------------------------------------
-- 13. Aparelhos de push (RN-63)
-- -----------------------------------------------------------------------------
select teste.entrar('membro@teste');
insert into public.dispositivo_push (endpoint, chave_p256dh, chave_auth)
values ('https://push.exemplo/membro', 'chave', 'auth');
select teste.deve_falhar(format('insert into public.dispositivo_push (conta_id, endpoint, chave_p256dh, chave_auth) values (%L, %L, %L, %L)',
  :'c_g2', 'https://push.exemplo/falso', 'x', 'y'),
  'ninguém registra aparelho em nome de outra conta');
select teste.entrar('g2@teste');
select teste.ok((select count(*) = 0 from public.dispositivo_push), 'cada um vê só os próprios aparelhos');

-- -----------------------------------------------------------------------------
-- 14. Administradores (RN-03)
-- -----------------------------------------------------------------------------
select teste.entrar('kaique@teste');
select teste.deve_falhar(format('select public.definir_administrador(%L, false)', :'c_kaique'),
  'o último administrador não pode deixar de ser admin');
select public.definir_administrador(:'c_lider', true);
select public.definir_administrador(:'c_kaique', false);
select teste.ok((select count(*) = 1 from public.conta), 'quem deixou de ser admin perde a visão das contas');

select teste.entrar('lider@teste');
select public.desativar_conta(:'c_tem');
select teste.entrar('temp@teste');
select teste.ok((select count(*) = 0 from public.pessoa), 'conta desativada não vê mais nada');

-- -----------------------------------------------------------------------------
-- 15. Quem não está logado (anon)
-- -----------------------------------------------------------------------------
reset role;
set role anon;
select teste.deve_falhar($$select * from public.pessoa$$, 'deslogado não lê pessoas');
select teste.deve_falhar($$select * from public.escala$$, 'deslogado não lê escalas');
select teste.deve_falhar($$select public.processar_avisos_pendentes()$$, 'deslogado não dispara avisos');
reset role;
set role authenticated;
select teste.entrar('membro@teste');
select teste.deve_falhar($$select public.processar_avisos_pendentes()$$, 'usuário logado também não dispara avisos');
select teste.deve_falhar($$select public.inicializar_primeiro_admin('membro@teste', 'Eu')$$,
  'usuário logado não usa o atalho do primeiro admin');
select teste.deve_falhar($$truncate public.pessoa$$, 'usuário logado não esvazia tabelas (TRUNCATE ignora o RLS)');
reset role;

\warn 'TODOS OS TESTES PASSARAM'
