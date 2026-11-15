-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0039 tamam" yazar.
-- Beklenen: takim_soru_ozeti perdedeki turun her sorusu için takımların doğru ve yanlış sayısını verir (açılmamış soru 0);
-- hocayla yarışta hoca cevap vermediği soru kaybedilir, sınıf puanı için doğru oranı en az %60 gerekir.

insert into auth.users (id, email) values ('c3939393-3939-3939-3939-393939393901', 'hoca39@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca39@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3939393-3939-3939-3939-393939393901","email":"hoca39@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Takim Ozet Dersi') returning id, subject_id)
select set_config('t39.ders', id::text, false), set_config('t39.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t39.icerik')::uuid, '⚡ T', -1) returning id)
select set_config('t39.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t39.icerik')::uuid, 'S?', 'A', array['B']) returning id)
select set_config('t39.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t39.ders')::uuid, current_setting('t39.akis')::uuid) returning id)
select set_config('t39.sid', id::text, false) from s;
select set_config('t39.k', kumanda_anahtari(current_setting('t39.sid')::uuid), false);
with t as (insert into oyun_turlari (session_id, lesson_id) values (current_setting('t39.sid')::uuid, current_setting('t39.akis')::uuid) returning id)
select set_config('t39.tur', id::text, false) from t;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values (current_setting('t39.akis')::uuid, 1, 'soru', current_setting('t39.soru')::uuid, current_setting('t39.tur')::uuid) returning id)
select set_config('t39.a1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values (current_setting('t39.akis')::uuid, 2, 'soru', current_setting('t39.soru')::uuid, current_setting('t39.tur')::uuid) returning id)
select set_config('t39.a2', id::text, false) from a;
reset request.jwt.claims;
reset role;

insert into takim_ayar (session_id, sayi) values (current_setting('t39.sid')::uuid, 2);
insert into takim_uyeleri (session_id, cihaz_id, takim) values
  (current_setting('t39.sid')::uuid, 'cihaz-ozet-0001', 1), (current_setting('t39.sid')::uuid, 'cihaz-ozet-0002', 1),
  (current_setting('t39.sid')::uuid, 'cihaz-ozet-0003', 2), (current_setting('t39.sid')::uuid, 'cihaz-ozet-0004', 2);
-- 1. soru: takım 1 iki doğru; takım 2 bir doğru bir yanlış
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
select current_setting('t39.sid')::uuid, current_setting('t39.a1')::uuid, current_setting('t39.soru')::uuid, c, 0, d, case when d then 800 else 0 end, 100
from (values ('cihaz-ozet-0001', true), ('cihaz-ozet-0002', true), ('cihaz-ozet-0003', true), ('cihaz-ozet-0004', false)) v(c, d);
update sessions set aktif_tur = current_setting('t39.tur')::uuid, aktif_adim = current_setting('t39.a2')::uuid where id = current_setting('t39.sid')::uuid;

do $$
declare
  v jsonb;
begin
  v := takim_soru_ozeti(current_setting('t39.sid')::uuid, current_setting('t39.k'));
  assert (v ->> 'sayi')::int = 2 and jsonb_array_length(v -> 'sorular') = 2, 'HATA: ozet yapisi: ' || v::text;
  assert (v -> 'sorular' -> 0 ->> 'acildi')::boolean and not (v -> 'sorular' -> 1 ->> 'acildi')::boolean, 'HATA: acildi: ' || v::text;
  assert (v -> 'takimlar' -> 0 -> 'sorular' -> 0 ->> 'dogru')::int = 2, 'HATA: takim 1 dogru: ' || v::text;
  assert (v -> 'takimlar' -> 1 -> 'sorular' -> 0 ->> 'dogru')::int = 1 and (v -> 'takimlar' -> 1 -> 'sorular' -> 0 ->> 'yanlis')::int = 1, 'HATA: takim 2: ' || v::text;
  assert (v -> 'takimlar' -> 0 -> 'sorular' -> 1 ->> 'dogru')::int = 0, 'HATA: acilmamis soru sayildi';
  assert (v -> 'takimlar' -> 0 ->> 'uye')::int = 2, 'HATA: uye sayisi';
  assert takim_soru_ozeti(current_setting('t39.sid')::uuid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yetkisiz';
end $$;

-- Hocayla yarış: 1. soruda sınıf oranı %75 (3/4), hoca cevap vermedi: hoca 0, sınıf 1, soru 1
do $$
declare
  v jsonb;
begin
  v := hoca_yaris_goster(current_setting('t39.sid')::uuid, current_setting('t39.k'));
  assert (v ->> 'soru')::int = 1 and (v ->> 'hoca')::int = 0 and (v ->> 'sinif')::int = 1, 'HATA: hoca cevapsiz: ' || v::text;
end $$;
-- Sınıf oranı %50'ye düşerse sınıf puan almaz
update responses set dogru = false, puan = 0 where session_id = current_setting('t39.sid')::uuid and cihaz_id = 'cihaz-ozet-0003';
do $$
declare
  v jsonb;
begin
  v := hoca_yaris_goster(current_setting('t39.sid')::uuid, current_setting('t39.k'));
  assert (v ->> 'sinif')::int = 0, 'HATA: yuzde 50 sinif puani aldi: ' || v::text;
end $$;

select '0039 tamam' as sonuc;
