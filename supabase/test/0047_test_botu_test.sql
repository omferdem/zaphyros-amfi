-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0047 tamam" yazar.
-- Beklenen: test_dogru_index yalnızca "TEST-BOT" derslerinde ve açık soruda doğru şıkkı verir; gerçek derste hata döner.

insert into auth.users (id, email) values ('c4777777-4444-4444-4444-444444444401', 'hoca47@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca47@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4777777-4444-4444-4444-444444444401","email":"hoca47@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('TEST-BOT') returning id, subject_id) select set_config('t47.bot', id::text, false), set_config('t47.icerik', subject_id::text, false) from d;
with d as (insert into courses (ad) values ('Gercek Ders') returning id, subject_id) select set_config('t47.gercek', id::text, false), set_config('t47.icerik2', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t47.icerik')::uuid, 'A', 1) returning id) select set_config('t47.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t47.icerik')::uuid, 'S?', 'A', array['B', 'C'], 30) returning id) select set_config('t47.soru', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t47.akis')::uuid, 1, 'soru', current_setting('t47.soru')::uuid) returning id) select set_config('t47.a1', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id, aktif_adim) values (current_setting('t47.bot')::uuid, current_setting('t47.akis')::uuid, current_setting('t47.a1')::uuid) returning id) select set_config('t47.sbot', id::text, false) from s;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t47.icerik2')::uuid, 'B', 1) returning id) select set_config('t47.akis2', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t47.icerik2')::uuid, 'S2?', 'A', array['B', 'C'], 30) returning id) select set_config('t47.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t47.akis2')::uuid, 1, 'soru', current_setting('t47.soru2')::uuid) returning id) select set_config('t47.b1', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id, aktif_adim) values (current_setting('t47.gercek')::uuid, current_setting('t47.akis2')::uuid, current_setting('t47.b1')::uuid) returning id) select set_config('t47.sgercek', id::text, false) from s;
reset request.jwt.claims;
reset role;

update sessions set soru_durum = 'acik', soru_basladi = now() where id in (current_setting('t47.sbot')::uuid, current_setting('t47.sgercek')::uuid);

set role anon;
do $$
declare v jsonb;
begin
  v := test_dogru_index(current_setting('t47.sbot')::uuid);
  assert (v ->> 'dogru_index') is not null and (v ->> 'dogru_index')::int between 0 and 2, 'HATA: test dersinde dogru sik donmedi: ' || v::text;
  v := test_dogru_index(current_setting('t47.sgercek')::uuid);
  assert v ->> 'hata' = 'test_dersi_degil', 'HATA: gercek ders sizdirdi: ' || v::text;
end $$;
reset role;

update sessions set soru_durum = 'sonuc' where id = current_setting('t47.sbot')::uuid;
do $$
begin
  assert test_dogru_index(current_setting('t47.sbot')::uuid) ->> 'hata' = 'soru_acik_degil', 'HATA: kapali soruda sik verdi';
end $$;

select '0047 tamam' as sonuc;
