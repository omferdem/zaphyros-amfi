-- 0019: Akışta "oyun" adımı
--
-- Hocanın haftalık akışına "bugünün oyunu" kartı koymasını sağlar. Adım perdede oyunun adını, nasıl oynandığını ve bir
-- "Oyunu başlat" düğmesini gösterir; düğme ilgili modu açar (takım yarışması, halat çekme, hocayla yarış, bilgi merdiveni).
-- * lesson_steps.tur'a 'oyun' eklenir.
-- * ayar.oyun: 'takim' | 'halat' | 'hoca' | 'merdiven' (zorunlu); ayar.baslik ve ayar.aciklama isteğe bağlıdır (en fazla 300 harf).
-- Öğrenci telefonunda bu adım "hocanın ekranını izle" olarak görünür (başka bir değişiklik gerekmez).

alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps drop constraint lesson_steps_etkinlik_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru', 'fikir', 'oylama', 'video', 'oyun')),
  add constraint lesson_steps_etkinlik_check check (
    case
      when tur in ('fikir', 'oylama') then length(btrim(coalesce(ayar ->> 'soru', ''))) between 1 and 300
      when tur = 'video' then coalesce(ayar ->> 'url', '') ~ '^https://[^\s]{4,255}$'
      when tur = 'oyun' then coalesce(ayar ->> 'oyun', '') in ('takim', 'halat', 'hoca', 'merdiven')
        and length(coalesce(ayar ->> 'baslik', '')) <= 120
        and length(coalesce(ayar ->> 'aciklama', '')) <= 300
      else true
    end
  );
