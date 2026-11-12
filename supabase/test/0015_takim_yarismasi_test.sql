-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0015 tamam" yazar.
-- Beklenen: hoca takım modunu açar; öğrenci takım seçer (yabancı cihaz seçemez, sayı dışı takım olmaz);
-- cevap verdikten sonra takım değiştirilemez; takım puanı üye başına ortalamayla sıralanır;
-- sayı azalınca dışarıda kalan üyeler silinir; yabancı hoca ve yanlış anahtar yetkisizdir.

insert into auth.users (id, email) values
  ('f3333333-3333-3333-3333-333333333333', 'hoca15@ornek.edu.tr'),
  ('f4444444-4444-4444-4444-444444444444', 'yabanci15@ornek.com');
insert into public.teachers (eposta) values ('hoca15@ornek.edu.tr'), ('yabanci15@ornek.com') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"f3333333-3333-3333-3333-333333333333","email":"hoca15@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Takim Dersi') returning id, subject_id)
select set_config('t15.ders', id::text, false), set_config('t15.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t15.icerik')::uuid, 'Takim') returning id)
select set_config('t15.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t15.icerik')::uuid, 'Soru 1?', 'A', array['B']) returning id)
select set_config('t15.soru1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t15.icerik')::uuid, 'Soru 2?', 'A', array['B']) returning id)
select set_config('t15.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t15.akis')::uuid, 1, 'soru', current_setting('t15.soru1')::uuid) returning id)
select set_config('t15.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t15.akis')::uuid, 2, 'soru', current_setting('t15.soru2')::uuid) returning id)
select set_config('t15.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t15.ders')::uuid, current_setting('t15.akis')::uuid) returning id)
select set_config('t15.sid', id::text, false) from s;
select set_config('t15.kumanda', kumanda_anahtari(current_setting('t15.sid')::uuid), false);

reset request.jwt.claims;
reset role;
-- Dört takma adlı oyuncu: iki ve iki
insert into session_players (session_id, cihaz_id, takma_ad) values
  (current_setting('t15.sid')::uuid, 'cihaz-takim-0001', 'Birinci'),
  (current_setting('t15.sid')::uuid, 'cihaz-takim-0002', 'Ikinci'),
  (current_setting('t15.sid')::uuid, 'cihaz-takim-0003', 'Ucuncu'),
  (current_setting('t15.sid')::uuid, 'cihaz-takim-0004', 'Dorduncu');

set role anon;
do $$
declare
  sid uuid := current_setting('t15.sid')::uuid;
  k   text := current_setting('t15.kumanda');
begin
  -- Takım modu kapalıyken seçilemez
  assert takim_sec(sid, 'cihaz-takim-0001', 1) ->> 'hata' = 'takim_modu_kapali', 'HATA: kapali modda takim secildi';
  assert (takim_durumum(sid, 'cihaz-takim-0001') ->> 'sayi')::int = 0, 'HATA: sayi';

  -- Yanlış anahtar ayarlayamaz
  assert takim_ayarla(sid, 'yanlis', 3) ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla ayar';
  assert takim_ayarla(sid, k, 7) ->> 'hata' = 'sayi_gecersiz', 'HATA: 7 takim kabul edildi';
  assert takim_ayarla(sid, k, 1) ->> 'hata' = 'sayi_gecersiz', 'HATA: 1 takim kabul edildi';
  assert takim_ayarla(sid, k, 3) ->> 'durum' = 'tamam', 'HATA: takim modu acilamadi';
  assert (takim_durumum(sid, 'cihaz-takim-0001') ->> 'sayi')::int = 3, 'HATA: sayi 3 degil';

  -- Seçim kuralları
  assert takim_sec(sid, 'cihaz-yabanci-001', 1) ->> 'hata' = 'katilmadin', 'HATA: yabanci cihaz takim secti';
  assert takim_sec(sid, 'cihaz-takim-0001', 4) ->> 'hata' = 'takim_gecersiz', 'HATA: sayi disi takim';
  assert takim_sec(sid, 'cihaz-takim-0001', 1) ->> 'durum' = 'tamam';
  assert takim_sec(sid, 'cihaz-takim-0002', 1) ->> 'durum' = 'tamam';
  assert takim_sec(sid, 'cihaz-takim-0003', 2) ->> 'durum' = 'tamam';
  assert takim_sec(sid, 'cihaz-takim-0004', 3) ->> 'durum' = 'tamam';
  assert (takim_durumum(sid, 'cihaz-takim-0003') ->> 'takim')::int = 2, 'HATA: secilen takim gorunmuyor';
  -- Cevap vermeden takım değiştirilebilir
  assert takim_sec(sid, 'cihaz-takim-0004', 2) ->> 'durum' = 'tamam', 'HATA: takim degistirilemedi';
  assert takim_sec(sid, 'cihaz-takim-0004', 3) ->> 'durum' = 'tamam';

  -- Öğrenci tabloları okuyamaz
  begin
    perform 1 from takim_uyeleri;
    raise exception 'HATA: anon takim_uyeleri okudu';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Cevaplar doğrudan yazılır (cevap_ver akışı 0005 testinde denendi)
reset role;
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t15.sid')::uuid, current_setting('t15.adim1')::uuid, current_setting('t15.soru1')::uuid, 'cihaz-takim-0001', 0, true, 900, 1000),
  (current_setting('t15.sid')::uuid, current_setting('t15.adim1')::uuid, current_setting('t15.soru1')::uuid, 'cihaz-takim-0002', 1, false, 0, 1000),
  (current_setting('t15.sid')::uuid, current_setting('t15.adim1')::uuid, current_setting('t15.soru1')::uuid, 'cihaz-takim-0003', 0, true, 800, 1000),
  (current_setting('t15.sid')::uuid, current_setting('t15.adim1')::uuid, current_setting('t15.soru1')::uuid, 'cihaz-takim-0004', 0, true, 700, 1000);

set role anon;
do $$
declare
  sid uuid := current_setting('t15.sid')::uuid;
  k   text := current_setting('t15.kumanda');
  v   jsonb;
begin
  -- Cevap verdikten sonra takım kilitlenir (aynı takıma tekrar seçmek zararsız)
  assert takim_sec(sid, 'cihaz-takim-0004', 1) ->> 'hata' = 'kilitli', 'HATA: cevaptan sonra takim degisti';
  assert takim_sec(sid, 'cihaz-takim-0004', 3) ->> 'durum' = 'tamam', 'HATA: ayni takima secim reddedildi';

  v := takim_goster(sid, k);
  assert (v ->> 'sayi')::int = 3 and jsonb_array_length(v -> 'takimlar') = 3, 'HATA: takim listesi: ' || v::text;
  -- Takım 1: 900 puan, 2 üye -> ort 450; Takım 2: 800, 1 üye -> ort 800; Takım 3: 700, 1 üye -> ort 700
  assert (v -> 'takimlar' -> 0 ->> 'takim')::int = 2 and (v -> 'takimlar' -> 0 ->> 'ortalama')::int = 800, 'HATA: 1. takim: ' || v::text;
  assert (v -> 'takimlar' -> 1 ->> 'takim')::int = 3, 'HATA: 2. takim: ' || v::text;
  assert (v -> 'takimlar' -> 2 ->> 'takim')::int = 1 and (v -> 'takimlar' -> 2 ->> 'puan')::int = 900 and (v -> 'takimlar' -> 2 ->> 'uye')::int = 2, 'HATA: 3. takim: ' || v::text;
  assert (v -> 'takimlar' -> 0 ->> 'sira')::int = 1 and (v -> 'takimlar' -> 2 ->> 'sira')::int = 3, 'HATA: sira numaralari';
  assert takim_goster(sid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla goruldu';
  assert takim_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: anahtarsiz anon goruldu';

  -- Sayı 2'ye inince 3. takımın üyesi silinir
  assert takim_ayarla(sid, k, 2) ->> 'durum' = 'tamam';
  v := takim_goster(sid, k);
  assert jsonb_array_length(v -> 'takimlar') = 2, 'HATA: takim sayisi 2 degil';
  assert (takim_durumum(sid, 'cihaz-takim-0004') ->> 'takim') is null, 'HATA: disarida kalan uye silinmedi';

  -- Kapatınca herkes çıkar
  assert takim_ayarla(sid, k, 0) ->> 'durum' = 'tamam';
  assert jsonb_array_length(takim_goster(sid, k) -> 'takimlar') = 0, 'HATA: kapaninca liste bos degil';
end $$;

-- Hoca (anahtarsız) ve yabancı hoca
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"f3333333-3333-3333-3333-333333333333","email":"hoca15@ornek.edu.tr"}';
do $$
declare sid uuid := current_setting('t15.sid')::uuid;
begin
  assert takim_ayarla(sid, null, 2) ->> 'durum' = 'tamam', 'HATA: hoca anahtarsiz ayarlayamadi';
  assert (takim_goster(sid) ->> 'sayi')::int = 2, 'HATA: hoca goremedi';
  assert (select count(*) from takim_ayar where session_id = sid) = 1, 'HATA: hoca takim_ayar goremedi';
end $$;
set request.jwt.claims = '{"sub":"f4444444-4444-4444-4444-444444444444","email":"yabanci15@ornek.com"}';
do $$
declare sid uuid := current_setting('t15.sid')::uuid;
begin
  assert takim_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca gordu';
  assert takim_ayarla(sid, null, 0) ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca ayarladi';
  assert (select count(*) from takim_ayar) = 0, 'HATA: yabanci hoca tabloyu okudu';
end $$;

reset request.jwt.claims;
reset role;
select '0015 tamam' as sonuc;
