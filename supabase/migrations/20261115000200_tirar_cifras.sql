-- =============================================================================
-- Migração 21: tira as cifras (D38 revogada)
--
-- O Cifra Club não tem API e bloqueia leitura por servidor (403 da Akamai,
-- testado em 15/11/2026); colar a cifra pelo celular ficou trabalhoso demais
-- para os líderes. Pela diretriz principal (não criar obrigação), a feature
-- saiu. Nenhuma cifra tinha sido salva. O código está no histórico do git
-- (commit bb2f9d6) se um dia houver uma fonte que funcione.
-- =============================================================================
alter table public.musica
  drop constraint musica_cifra_com_tom,
  drop column cifra,
  drop column cifra_tom;
