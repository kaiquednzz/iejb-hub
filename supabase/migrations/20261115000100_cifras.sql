-- =============================================================================
-- Migração 20: cifras (D38)
--
-- A cifra mora na música, em ChordPro (formato aberto: "[G]Bondade de [D]Deus"),
-- junto com o tom em que ela foi escrita. No culto, o app transpõe do tom da
-- cifra para o tom do repertório (repertorio_item.tom). O líder cola do jeito
-- que copia do Cifra Club; a conversão para ChordPro é feita no app
-- (util/chordpro.js).
--
-- Quem edita: os mesmos que já editam música (admin, líder de louvor, líder
-- de grupo: políticas da migração 05). Quem lê: quem tem conta pronta, como
-- o resto da música. A cifra não diz em que culto a música vai, então a
-- regra do repertório (D36) não precisa valer aqui.
--
-- cifra_tom também serve de sinal "tem cifra" para a tela da escala, que
-- não baixa o texto inteiro de todas as músicas.
-- =============================================================================

alter table public.musica
  add column cifra text check (cifra is null or char_length(cifra) between 1 and 30000),
  add column cifra_tom text check (cifra_tom is null or cifra_tom ~ '^[A-G][#b]?m?$'),
  add constraint musica_cifra_com_tom check ((cifra is null) = (cifra_tom is null));

comment on column public.musica.cifra is 'Cifra em ChordPro (D38). Convertida no app a partir do texto colado.';
comment on column public.musica.cifra_tom is 'Tom em que a cifra está escrita (ex.: G, Em). O app transpõe para o tom do culto.';
