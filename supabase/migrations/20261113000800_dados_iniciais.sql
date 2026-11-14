-- =============================================================================
-- 08. Dados iniciais reais da IEJB
-- Pessoas NÃO entram aqui: são cadastradas pelo app, pelo administrador.
-- =============================================================================

insert into public.ministerio (nome) values ('Louvor');

insert into public.grupo (ministerio_id, nome)
select m.id, g.nome
from public.ministerio m
cross join (values ('G1'), ('G2'), ('G3')) as g (nome)
where m.nome = 'Louvor';

-- Cultos da semana publicados no site (visão geral, 13.7). EBD sem louvor (RN-20).
insert into public.tipo_culto (nome, dia_semana, horario, tem_louvor) values
  ('EBD',              0, '09:00', false),
  ('Culto da Família', 0, '18:00', true),
  ('Culto de Oração',  2, '19:30', true);
