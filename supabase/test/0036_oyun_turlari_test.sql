-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0036 tamam" yazar.
-- Beklenen: aynı akışta iki ayrı oyun turu birbirinin cevaplarını görmez (takım, zombi, merdiven, hocayla yarış);
-- tursuz eski kayıtlar aktif_tur boşken aynen sayılır; tur silinince adımları da gider.

insert into auth.users (id, email) values ('c3636363-3636-3636-3636-363636363601', 'hoca36@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca36@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3636363-3636-3636-3636-363636363601","email":"hoca36@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Tur Dersi') returning id, subject_id)
select set_config('t36.ders', id::text, false), set_config('t36.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t36.icerik')::uuid, '⚡ Paket', -1) returning id)
select set_config('t36.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t36.icerik')::uuid, 'Soru 1?', 'A', array['B']) returning id)
select set_config('t36.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t36.ders')::uuid, current_setting('t36.akis')::uuid) returning id)
select set_config('t36.sid', id::text, false) from s;
select set_config('t36.k', kumanda_anahtari(current_setting('t36.sid')::uuid), false);
-- iki tur, her birinin tek adımı
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t36.sid')::uuid, current_setting('t36.akis')::uuid, 'Paket', 'takim') returning id)
select set_config('t36.tur1', id::text, false) from t;
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t36.sid')::uuid, current_setting('t36.akis')::uuid, 'Paket', 'takim') returning id)
select set_config('t36.tur2', id::text, false) from t;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values (current_setting('t36.akis')::uuid, 1, 'soru', current_setting('t36.soru')::uuid, current_setting('t36.tur1')::uuid) returning id)
select set_config('t36.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values (current_setting('t36.akis')::uuid, 1, 'soru', current_setting('t36.soru')::uuid, current_setting('t36.tur2')::uuid) returning id)
select set_config('t36.adim2', id::text, false) from a;
reset request.jwt.claims;
reset role;

insert into takim_ayar (session_id, sayi) values (current_setting('t36.sid')::uuid, 2);
insert into takim_uyeleri (session_id, cihaz_id, takim) values
  (current_setting('t36.sid')::uuid, 'cihaz-tur-0001', 1),
  (current_setting('t36.sid')::uuid, 'cihaz-tur-0002', 2);
-- Tur 1'de takım 1 cevap verdi
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t36.sid')::uuid, current_setting('t36.adim1')::uuid, current_setting('t36.soru')::uuid, 'cihaz-tur-0001', 0, true, 800, 1000);

-- Aktif tur 1: takım 1 puanı var
update sessions set aktif_tur = current_setting('t36.tur1')::uuid, aktif_adim = current_setting('t36.adim1')::uuid, soru_durum = 'sonuc'
  where id = current_setting('t36.sid')::uuid;
do $$
declare v jsonb;
begin
  v := takim_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert (select (t ->> 'puan')::int from jsonb_array_elements(v -> 'takimlar') t where (t ->> 'takim')::int = 1) = 800, 'HATA: tur 1 puani: ' || v::text;
  v := merdiven_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert jsonb_array_length(v -> 'sorular') = 1 and (v -> 'sorular' -> 0 ->> 'cevap')::int = 1, 'HATA: tur 1 merdiven: ' || v::text;
  v := zombi_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert jsonb_array_length(v -> 'oyuncular') = 1, 'HATA: tur 1 oyuncu: ' || v::text;
end $$;

-- Aktif tur 2: tur 1'in cevapları görünmez
update sessions set aktif_tur = current_setting('t36.tur2')::uuid, aktif_adim = current_setting('t36.adim2')::uuid, soru_durum = 'acik'
  where id = current_setting('t36.sid')::uuid;
do $$
declare v jsonb;
begin
  v := takim_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert (select sum((t ->> 'puan')::int) from jsonb_array_elements(v -> 'takimlar') t) = 0, 'HATA: tur 2 puan sizdi: ' || v::text;
  v := merdiven_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert jsonb_array_length(v -> 'sorular') = 1 and (v -> 'sorular' -> 0 ->> 'cevap')::int = 0, 'HATA: tur 2 merdiven: ' || v::text;
  v := zombi_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert jsonb_array_length(v -> 'oyuncular') = 0, 'HATA: tur 2 oyuncu sizdi: ' || v::text;
  v := hoca_yaris_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert (v ->> 'soru')::int = 0, 'HATA: tur 2 hocayla yaris: ' || v::text;
end $$;

-- Tur silinince adımı ve cevapları da gider
delete from oyun_turlari where id = current_setting('t36.tur1')::uuid;
do $$
begin
  assert not exists (select 1 from lesson_steps where id = current_setting('t36.adim1')::uuid), 'HATA: tur adimi kalmis';
  assert not exists (select 1 from responses where session_id = current_setting('t36.sid')::uuid), 'HATA: tur cevabi kalmis';
end $$;

-- Eski tursuz kayıtlar aktif_tur boşken aynen çalışır
update sessions set aktif_tur = null, aktif_adim = null where id = current_setting('t36.sid')::uuid;
insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t36.akis')::uuid, 5, 'soru', current_setting('t36.soru')::uuid);
do $$
declare v jsonb;
begin
  v := merdiven_goster(current_setting('t36.sid')::uuid, current_setting('t36.k'));
  assert jsonb_array_length(v -> 'sorular') = 1, 'HATA: tursuz adim: ' || v::text;
end $$;

select '0036 tamam' as sonuc;
