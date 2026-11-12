-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0016 tamam" yazar.
-- Beklenen: hoca soru açıkken cevabını verir (geçersiz şık, kapalı soru, perdede olmayan soru reddedilir);
-- skor yalnızca sonucu açılmış ya da geçilmiş sorularda sayılır; hoca doğruysa hoca, sınıfın yarısı doğruysa
-- sınıf puan alır; yabancı hoca ve yanlış anahtar yetkisizdir.

insert into auth.users (id, email) values
  ('f5555555-5555-5555-5555-555555555555', 'hoca16@ornek.edu.tr'),
  ('f6666666-6666-6666-6666-666666666666', 'yabanci16@ornek.com');
insert into public.teachers (eposta) values ('hoca16@ornek.edu.tr'), ('yabanci16@ornek.com') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"f5555555-5555-5555-5555-555555555555","email":"hoca16@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Yaris Dersi') returning id, subject_id)
select set_config('t16.ders', id::text, false), set_config('t16.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t16.icerik')::uuid, 'Yaris') returning id)
select set_config('t16.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t16.icerik')::uuid, 'Soru 1?', 'Dogru1', array['Yanlis1', 'Yanlis1b']) returning id)
select set_config('t16.soru1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t16.icerik')::uuid, 'Soru 2?', 'Dogru2', array['Yanlis2']) returning id)
select set_config('t16.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t16.akis')::uuid, 1, 'soru', current_setting('t16.soru1')::uuid) returning id)
select set_config('t16.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t16.akis')::uuid, 2, 'soru', current_setting('t16.soru2')::uuid) returning id)
select set_config('t16.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t16.ders')::uuid, current_setting('t16.akis')::uuid) returning id)
select set_config('t16.sid', id::text, false) from s;
select set_config('t16.kumanda', kumanda_anahtari(current_setting('t16.sid')::uuid), false);

-- 1. soru perdeye gelir (soru açılır)
update sessions set aktif_adim = current_setting('t16.adim1')::uuid where id = current_setting('t16.sid')::uuid;

reset request.jwt.claims;
reset role;
set role anon;
do $$
declare
  sid uuid := current_setting('t16.sid')::uuid;
  k   text := current_setting('t16.kumanda');
  a1  uuid := current_setting('t16.adim1')::uuid;
  a2  uuid := current_setting('t16.adim2')::uuid;
  v   jsonb;
begin
  assert hoca_yaris_ayarla(sid, 'yanlis', true) ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla ayar';
  assert hoca_yaris_ayarla(sid, k, true) ->> 'durum' = 'tamam', 'HATA: yaris acilamadi';

  assert hoca_cevapla(sid, 'yanlis', a1, 'Dogru1') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla cevap';
  assert hoca_cevapla(sid, k, a2, 'Dogru2') ->> 'hata' = 'adim_aktif_degil', 'HATA: perdede olmayan soruya cevap';
  assert hoca_cevapla(sid, k, a1, 'Uydurma') ->> 'hata' = 'secim_gecersiz', 'HATA: gecersiz sik';
  assert hoca_cevapla(sid, k, a1, 'Yanlis1') ->> 'durum' = 'tamam', 'HATA: hoca cevap veremedi';
  assert hoca_cevapla(sid, k, a1, 'Dogru1') ->> 'durum' = 'tamam', 'HATA: hoca cevabini degistiremedi';

  -- Soru açıkken skor sayılmaz ve cevap sızmaz
  v := hoca_yaris_goster(sid, k);
  assert (v ->> 'acik')::boolean and (v ->> 'soru')::int = 0 and (v ->> 'hoca')::int = 0, 'HATA: acik soru skora girdi: ' || v::text;
  assert (v ->> 'cevapladi')::boolean, 'HATA: cevapladi gorunmuyor';
  assert v -> 'son' = 'null'::jsonb, 'HATA: sonuc acilmadan son bilgi sizdi: ' || v::text;
end $$;

-- Sınıf cevapları (4 kişi: 3 doğru -> yüzde 75) ve sonucun açılması
reset role;
insert into session_players (session_id, cihaz_id, takma_ad) values
  (current_setting('t16.sid')::uuid, 'cihaz-yaris-0001', 'A'), (current_setting('t16.sid')::uuid, 'cihaz-yaris-0002', 'B'),
  (current_setting('t16.sid')::uuid, 'cihaz-yaris-0003', 'C'), (current_setting('t16.sid')::uuid, 'cihaz-yaris-0004', 'D');
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
select current_setting('t16.sid')::uuid, current_setting('t16.adim1')::uuid, current_setting('t16.soru1')::uuid, c, 0, d, case when d then 800 else 0 end, 1000
from (values ('cihaz-yaris-0001', true), ('cihaz-yaris-0002', true), ('cihaz-yaris-0003', true), ('cihaz-yaris-0004', false)) as x(c, d);
update sessions set soru_durum = 'sonuc' where id = current_setting('t16.sid')::uuid;

set role anon;
do $$
declare
  sid uuid := current_setting('t16.sid')::uuid;
  k   text := current_setting('t16.kumanda');
  v   jsonb;
begin
  assert hoca_cevapla(sid, k, current_setting('t16.adim1')::uuid, 'Yanlis1') ->> 'hata' = 'kapali', 'HATA: sonuctan sonra cevap degisti';
  v := hoca_yaris_goster(sid, k);
  assert (v ->> 'soru')::int = 1 and (v ->> 'hoca')::int = 1 and (v ->> 'sinif')::int = 1, 'HATA: 1. soru skoru: ' || v::text;
  assert (v -> 'son' ->> 'hoca_dogru')::boolean and (v -> 'son' ->> 'sinif_orani')::int = 75, 'HATA: son bilgi: ' || v::text;
end $$;

-- 2. soruya geçilir: hoca yanlış bilir, sınıf da yarıdan azı doğru bilir
reset role;
update sessions set aktif_adim = current_setting('t16.adim2')::uuid where id = current_setting('t16.sid')::uuid;
set role anon;
do $$
declare
  sid uuid := current_setting('t16.sid')::uuid;
  k   text := current_setting('t16.kumanda');
  v   jsonb;
begin
  -- Önceki sorunun cevabı artık geçilmiş sayılır ve skorda kalır
  assert (hoca_yaris_goster(sid, k) ->> 'soru')::int = 1, 'HATA: gecilen soru skordan dustu';
  assert not (hoca_yaris_goster(sid, k) ->> 'cevapladi')::boolean, 'HATA: yeni soruda cevapladi gorunuyor';
  assert hoca_cevapla(sid, k, current_setting('t16.adim2')::uuid, 'Yanlis2') ->> 'durum' = 'tamam';
end $$;
reset role;
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
select current_setting('t16.sid')::uuid, current_setting('t16.adim2')::uuid, current_setting('t16.soru2')::uuid, c, 0, d, 0, 1000
from (values ('cihaz-yaris-0001', false), ('cihaz-yaris-0002', false), ('cihaz-yaris-0003', true)) as x(c, d);
update sessions set soru_durum = 'sonuc' where id = current_setting('t16.sid')::uuid;

set role anon;
do $$
declare
  sid uuid := current_setting('t16.sid')::uuid;
  k   text := current_setting('t16.kumanda');
  v   jsonb;
begin
  v := hoca_yaris_goster(sid, k);
  -- Soru 1: hoca doğru, sınıf %75; soru 2: hoca yanlış, sınıf %33 -> hoca 1, sınıf 1
  assert (v ->> 'soru')::int = 2 and (v ->> 'hoca')::int = 1 and (v ->> 'sinif')::int = 1, 'HATA: toplam skor: ' || v::text;
  assert not (v -> 'son' ->> 'hoca_dogru')::boolean and (v -> 'son' ->> 'sinif_orani')::int = 33, 'HATA: 2. soru son: ' || v::text;
  -- Tablolar öğrenciden kapalı
  begin
    perform 1 from hoca_cevaplari;
    raise exception 'HATA: anon hoca_cevaplari okudu';
  exception when insufficient_privilege then null;
  end;
  assert hoca_yaris_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: anahtarsiz anon goruldu';
end $$;

-- Hoca (anahtarsız) ve yabancı hoca
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"f5555555-5555-5555-5555-555555555555","email":"hoca16@ornek.edu.tr"}';
do $$
declare sid uuid := current_setting('t16.sid')::uuid;
begin
  assert (hoca_yaris_goster(sid) ->> 'soru')::int = 2, 'HATA: hoca skoru goremedi';
  assert (select count(*) from hoca_cevaplari where session_id = sid) = 2, 'HATA: hoca kendi cevaplarini goremedi';
  assert hoca_yaris_ayarla(sid, null, false) ->> 'durum' = 'tamam', 'HATA: hoca yarisi kapatamadi';
  assert not (hoca_yaris_goster(sid) ->> 'acik')::boolean, 'HATA: yaris kapanmadi';
end $$;
set request.jwt.claims = '{"sub":"f6666666-6666-6666-6666-666666666666","email":"yabanci16@ornek.com"}';
do $$
declare sid uuid := current_setting('t16.sid')::uuid;
begin
  assert hoca_yaris_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca gordu';
  assert (select count(*) from hoca_cevaplari) = 0, 'HATA: yabanci hoca cevaplari okudu';
end $$;

reset request.jwt.claims;
reset role;
select '0016 tamam' as sonuc;
