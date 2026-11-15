-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0044 tamam" yazar.
-- Beklenen: zombi_goster her oyuncuya hizli (sürenin ilk üçte birinde doğru) ve cevapladi (açık soruda cevap verdi) alanlarını ekler.

insert into auth.users (id, email) values ('c4444444-4444-4444-4444-444444444401', 'hoca44@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca44@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4444444-4444-4444-4444-444444444401","email":"hoca44@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Hizli Dersi') returning id, subject_id) select set_config('t44.ders', id::text, false), set_config('t44.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t44.icerik')::uuid, '⚡ H', -1) returning id) select set_config('t44.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t44.icerik')::uuid, 'S?', 'A', array['B'], 30) returning id) select set_config('t44.soru', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t44.akis')::uuid, 1, 'soru', current_setting('t44.soru')::uuid) returning id) select set_config('t44.a1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t44.akis')::uuid, 2, 'soru', current_setting('t44.soru')::uuid) returning id) select set_config('t44.a2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id, aktif_adim) values (current_setting('t44.ders')::uuid, current_setting('t44.akis')::uuid, current_setting('t44.a1')::uuid) returning id) select set_config('t44.sid', id::text, false) from s;
select set_config('t44.k', kumanda_anahtari(current_setting('t44.sid')::uuid), false);
reset request.jwt.claims;
reset role;

insert into session_players (session_id, cihaz_id, takma_ad) values
  (current_setting('t44.sid')::uuid, 'cihaz-hiz-00001', 'Hizli'), (current_setting('t44.sid')::uuid, 'cihaz-hiz-00002', 'Yavas');
-- 1. soru: Hızlı 5 sn'de doğru (30 sn'nin ilk üçte biri), Yavaş 20 sn'de doğru
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t44.sid')::uuid, current_setting('t44.a1')::uuid, current_setting('t44.soru')::uuid, 'cihaz-hiz-00001', 0, true, 900, 5000),
  (current_setting('t44.sid')::uuid, current_setting('t44.a1')::uuid, current_setting('t44.soru')::uuid, 'cihaz-hiz-00002', 0, true, 700, 20000);
-- Aktif soru 2 açık; yalnızca Hızlı cevap verdi
update sessions set aktif_adim = current_setting('t44.a2')::uuid where id = current_setting('t44.sid')::uuid;
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t44.sid')::uuid, current_setting('t44.a2')::uuid, current_setting('t44.soru')::uuid, 'cihaz-hiz-00001', 1, false, 0, 4000);

do $$
declare v jsonb;
begin
  v := zombi_goster(current_setting('t44.sid')::uuid, current_setting('t44.k'));
  assert jsonb_array_length(v -> 'oyuncular') = 2, 'HATA: oyuncu sayisi: ' || v::text;
  assert (select (o -> 'hizli' ->> 0)::int from jsonb_array_elements(v -> 'oyuncular') o where o ->> 'ad' = 'Hizli') = 1, 'HATA: hizli dogru: ' || v::text;
  assert (select (o -> 'hizli' ->> 0)::int from jsonb_array_elements(v -> 'oyuncular') o where o ->> 'ad' = 'Yavas') = 0, 'HATA: yavas hizli sayildi: ' || v::text;
  assert (select (o ->> 'cevapladi')::boolean from jsonb_array_elements(v -> 'oyuncular') o where o ->> 'ad' = 'Hizli') = true, 'HATA: cevapladi';
  assert (select (o ->> 'cevapladi')::boolean from jsonb_array_elements(v -> 'oyuncular') o where o ->> 'ad' = 'Yavas') = false, 'HATA: cevaplamadi';
  assert (select jsonb_array_length(o -> 'sonuc') from jsonb_array_elements(v -> 'oyuncular') o limit 1) = 2, 'HATA: sonuc uzunlugu';
end $$;

select '0044 tamam' as sonuc;
