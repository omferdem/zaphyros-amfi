-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0017 tamam" yazar.
-- Beklenen: akıştaki soru adımları sırayla döner; çözülmekte olan soru "acildi" değildir, sonucu açılınca olur;
-- doğru oranı ve cevap sayısı hesaplanır; yanlış anahtar ve yabancı hoca yetkisizdir.

insert into auth.users (id, email) values
  ('f7777777-7777-7777-7777-777777777777', 'hoca17@ornek.edu.tr'),
  ('f8888888-8888-8888-8888-888888888888', 'yabanci17@ornek.com');
insert into public.teachers (eposta) values ('hoca17@ornek.edu.tr'), ('yabanci17@ornek.com') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"f7777777-7777-7777-7777-777777777777","email":"hoca17@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Merdiven Dersi') returning id, subject_id)
select set_config('t17.ders', id::text, false), set_config('t17.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t17.icerik')::uuid, 'Merdiven') returning id)
select set_config('t17.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t17.icerik')::uuid, 'Soru 1?', 'A', array['B']) returning id)
select set_config('t17.soru1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t17.icerik')::uuid, 'Soru 2?', 'A', array['B']) returning id)
select set_config('t17.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t17.akis')::uuid, 1, 'yoklama', '{}') returning id)
select set_config('t17.yok', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t17.akis')::uuid, 2, 'soru', current_setting('t17.soru1')::uuid) returning id)
select set_config('t17.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t17.akis')::uuid, 3, 'soru', current_setting('t17.soru2')::uuid) returning id)
select set_config('t17.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t17.ders')::uuid, current_setting('t17.akis')::uuid) returning id)
select set_config('t17.sid', id::text, false) from s;
select set_config('t17.kumanda', kumanda_anahtari(current_setting('t17.sid')::uuid), false);
update sessions set aktif_adim = current_setting('t17.adim1')::uuid where id = current_setting('t17.sid')::uuid;

reset request.jwt.claims;
reset role;
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t17.sid')::uuid, current_setting('t17.adim1')::uuid, current_setting('t17.soru1')::uuid, 'cihaz-merdiven-01', 0, true, 800, 1000),
  (current_setting('t17.sid')::uuid, current_setting('t17.adim1')::uuid, current_setting('t17.soru1')::uuid, 'cihaz-merdiven-02', 0, true, 700, 1000),
  (current_setting('t17.sid')::uuid, current_setting('t17.adim1')::uuid, current_setting('t17.soru1')::uuid, 'cihaz-merdiven-03', 1, false, 0, 1000);

set role anon;
do $$
declare
  sid uuid := current_setting('t17.sid')::uuid;
  k   text := current_setting('t17.kumanda');
  v   jsonb;
begin
  assert merdiven_goster(sid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla goruldu';
  assert merdiven_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: anahtarsiz anon goruldu';

  v := merdiven_goster(sid, k);
  -- Yoklama adımı sayılmaz; iki soru sırayla gelir
  assert jsonb_array_length(v -> 'sorular') = 2, 'HATA: soru sayisi: ' || v::text;
  assert (v -> 'sorular' -> 0 ->> 'sira')::int = 1 and (v -> 'sorular' -> 1 ->> 'sira')::int = 2, 'HATA: sira: ' || v::text;
  -- Çözülmekte olan soru henüz açılmamıştır
  assert not (v -> 'sorular' -> 0 ->> 'acildi')::boolean, 'HATA: cozulen soru acildi sayildi: ' || v::text;
  assert (v -> 'sorular' -> 0 ->> 'cevap')::int = 3 and (v -> 'sorular' -> 0 ->> 'oran')::int = 67, 'HATA: oran: ' || v::text;
  -- Henüz gelinmemiş soruda cevap yok
  assert (v -> 'sorular' -> 1 ->> 'cevap')::int = 0 and (v -> 'sorular' -> 1 ->> 'oran') is null, 'HATA: gelecek soru: ' || v::text;
end $$;

-- Sonuç açılınca soru "acildi" olur
reset role;
update sessions set soru_durum = 'sonuc' where id = current_setting('t17.sid')::uuid;
set role anon;
do $$
declare v jsonb;
begin
  v := merdiven_goster(current_setting('t17.sid')::uuid, current_setting('t17.kumanda'));
  assert (v -> 'sorular' -> 0 ->> 'acildi')::boolean, 'HATA: sonuc acilinca acildi degil: ' || v::text;
end $$;

-- Hoca (anahtarsız) ve yabancı hoca
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"f7777777-7777-7777-7777-777777777777","email":"hoca17@ornek.edu.tr"}';
do $$
begin
  assert jsonb_array_length(merdiven_goster(current_setting('t17.sid')::uuid) -> 'sorular') = 2, 'HATA: hoca goremedi';
end $$;
set request.jwt.claims = '{"sub":"f8888888-8888-8888-8888-888888888888","email":"yabanci17@ornek.com"}';
do $$
begin
  assert merdiven_goster(current_setting('t17.sid')::uuid) ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca gordu';
end $$;

reset request.jwt.claims;
reset role;
select '0017 tamam' as sonuc;
