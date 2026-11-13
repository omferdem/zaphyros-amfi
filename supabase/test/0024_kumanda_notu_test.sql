-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0024 tamam" yazar.
-- Beklenen: kumanda adım listesinde hoca notu görünür (boş not null gelir); sahnenin ders_durumu notu içermez.

insert into auth.users (id, email) values ('c2424242-2424-2424-2424-242424242401', 'hoca24@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca24@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2424242-2424-2424-2424-242424242401","email":"hoca24@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Not Dersi') returning id, subject_id)
select set_config('t24.ders', id::text, false), set_config('t24.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t24.icerik')::uuid, 'Notlu') returning id)
select set_config('t24.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t24.akis')::uuid, 1, 'fikir', '{"soru":"Soru?","not":"Örnek: Farabi yi an"}') returning id)
select set_config('t24.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t24.akis')::uuid, 2, 'fikir', '{"soru":"Notsuz?"}') returning id)
select set_config('t24.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t24.ders')::uuid, current_setting('t24.akis')::uuid) returning id)
select set_config('t24.sid', id::text, false) from s;
select set_config('t24.kumanda', kumanda_anahtari(current_setting('t24.sid')::uuid), false);
update sessions set aktif_adim = current_setting('t24.adim1')::uuid where id = current_setting('t24.sid')::uuid;

reset request.jwt.claims;
reset role;
set role anon;
do $$
declare
  v jsonb;
  sid uuid := current_setting('t24.sid')::uuid;
begin
  v := kumanda_durumu(sid, current_setting('t24.kumanda'));
  assert v -> 'adimlar' -> 0 ->> 'not' like 'Örnek:%', 'HATA: not gelmedi: ' || v::text;
  assert (v -> 'adimlar' -> 1 -> 'not') = 'null'::jsonb, 'HATA: notsuz adimda not var: ' || v::text;
  assert position('Farabi' in ders_durumu(sid)::text) = 0, 'HATA: not ders_durumu icinde sizdi';
  assert kumanda_durumu(sid, 'yanlis') ->> 'hata' = 'anahtar_gecersiz', 'HATA: yanlis anahtar';
end $$;

reset role;
select '0024 tamam' as sonuc;
