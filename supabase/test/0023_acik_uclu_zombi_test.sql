-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0023 tamam" yazar.
-- Beklenen: açık uçlu kipte tek ve uzun cevap kabul edilir, kelime bulutunda uzun cevap reddedilir; zombi_goster açılmış
-- sorular için oyuncu sonuçlarını (1/0/-1) verir, çözülmekte olan sorunun sonucunu sızdırmaz, yetkisizi reddeder.

insert into auth.users (id, email) values ('c2323232-2323-2323-2323-232323232301', 'hoca23@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca23@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2323232-2323-2323-2323-232323232301","email":"hoca23@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Zombi Dersi') returning id, subject_id)
select set_config('t23.ders', id::text, false), set_config('t23.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t23.icerik')::uuid, 'Zombi') returning id)
select set_config('t23.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t23.icerik')::uuid, 'Soru 1?', 'A', array['B']) returning id)
select set_config('t23.soru1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t23.icerik')::uuid, 'Soru 2?', 'A', array['B']) returning id)
select set_config('t23.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t23.akis')::uuid, 1, 'fikir', '{"soru":"Açık uçlu?","mod":"acik"}') returning id)
select set_config('t23.acik', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t23.akis')::uuid, 2, 'fikir', '{"soru":"Bulut?"}') returning id)
select set_config('t23.bulut', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t23.akis')::uuid, 3, 'soru', current_setting('t23.soru1')::uuid) returning id)
select set_config('t23.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t23.akis')::uuid, 4, 'soru', current_setting('t23.soru2')::uuid) returning id)
select set_config('t23.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t23.ders')::uuid, current_setting('t23.akis')::uuid) returning id)
select set_config('t23.sid', id::text, false) from s;
update sessions set aktif_adim = current_setting('t23.acik')::uuid where id = current_setting('t23.sid')::uuid;

-- ------------------------------------------------------------ açık uçlu cevap
reset request.jwt.claims;
reset role;
set role anon;
do $$
declare
  sid uuid := current_setting('t23.sid')::uuid;
  uzun text := repeat('a', 250);
  v jsonb;
begin
  v := katki_gonder(sid, 'cihaz-zombi-0001', uzun);
  assert v ->> 'durum' = 'tamam', 'HATA: acik uclu uzun cevap kabul edilmedi: ' || v::text;
  assert katki_gonder(sid, 'cihaz-zombi-0001', 'ikinci cevap') ->> 'hata' = 'sinir', 'HATA: acik uclu ikinci cevap';
  assert katki_gonder(sid, 'cihaz-zombi-0002', repeat('b', 301)) ->> 'hata' = 'metin_uzun', 'HATA: 301 harf';
end $$;

-- bulut kipinde uzun cevap reddedilir
reset role;
update sessions set aktif_adim = current_setting('t23.bulut')::uuid where id = current_setting('t23.sid')::uuid;
set role anon;
do $$
begin
  assert katki_gonder(current_setting('t23.sid')::uuid, 'cihaz-zombi-0001', repeat('c', 41)) ->> 'hata' = 'metin_uzun', 'HATA: bulutta 41 harf kabul edildi';
  assert katki_gonder(current_setting('t23.sid')::uuid, 'cihaz-zombi-0001', 'kelime') ->> 'durum' = 'tamam', 'HATA: bulut kelimesi';
end $$;

-- ------------------------------------------------------------ zombi_goster
reset role;
update sessions set aktif_adim = current_setting('t23.adim1')::uuid where id = current_setting('t23.sid')::uuid;
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t23.sid')::uuid, current_setting('t23.adim1')::uuid, current_setting('t23.soru1')::uuid, 'cihaz-zombi-0001', 0, true, 800, 1000),
  (current_setting('t23.sid')::uuid, current_setting('t23.adim1')::uuid, current_setting('t23.soru1')::uuid, 'cihaz-zombi-0002', 1, false, 0, 1000);

set role authenticated;
set request.jwt.claims = '{"sub":"c2323232-2323-2323-2323-232323232301","email":"hoca23@ornek.edu.tr"}';
do $$
declare v jsonb;
begin
  v := zombi_goster(current_setting('t23.sid')::uuid);
  assert jsonb_array_length(v -> 'sorular') = 2, 'HATA: soru sayisi: ' || v::text;
  assert jsonb_array_length(v -> 'oyuncular') = 2, 'HATA: oyuncu sayisi: ' || v::text;
  -- Çözülmekte olan soru açılmadığı için sonuç null gelir (sızmaz)
  assert (v -> 'oyuncular' -> 0 -> 'sonuc' -> 0) = 'null'::jsonb, 'HATA: cozulen sorunun sonucu sizdi: ' || v::text;
end $$;

reset role;
update sessions set soru_durum = 'sonuc' where id = current_setting('t23.sid')::uuid;
set role authenticated;
set request.jwt.claims = '{"sub":"c2323232-2323-2323-2323-232323232301","email":"hoca23@ornek.edu.tr"}';
do $$
declare v jsonb;
begin
  v := zombi_goster(current_setting('t23.sid')::uuid);
  assert (v -> 'oyuncular' -> 0 -> 'sonuc' ->> 0)::int = 1 and (v -> 'oyuncular' -> 1 -> 'sonuc' ->> 0)::int = 0, 'HATA: sonuclar: ' || v::text;
  assert (v -> 'sorular' -> 0 ->> 'acildi')::boolean and not (v -> 'sorular' -> 1 ->> 'acildi')::boolean, 'HATA: acildi: ' || v::text;
end $$;

-- yetkisiz
reset request.jwt.claims;
reset role;
set role anon;
do $$
begin
  assert zombi_goster(current_setting('t23.sid')::uuid) ->> 'hata' = 'yetki_yok', 'HATA: anahtarsiz anon gordu';
  assert zombi_goster(current_setting('t23.sid')::uuid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtar';
end $$;

reset role;
select '0023 tamam' as sonuc;
