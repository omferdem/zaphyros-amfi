-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0014 tamam" yazar.
-- Beklenen: yoklamalı ya da takma adlı cihaz el kaldırır, soru sorar, sıkıldım der; yabancı cihaz yapamaz;
-- öğrenci tabloları okuyamaz; hoca (anahtarsız) ve kumanda (anahtarlı) görür ve yönetir; çekiliş en fazla 3 kez,
-- derse dönünce hepsi sıfırlanır; yabancı hoca ve yanlış anahtar yetkisizdir.

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'hoca14@ornek.edu.tr'),
  ('f2222222-2222-2222-2222-222222222222', 'yabanci14@ornek.com');
insert into public.teachers (eposta) values ('hoca14@ornek.edu.tr'), ('yabanci14@ornek.com') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"f1111111-1111-1111-1111-111111111111","email":"hoca14@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Etkilesim Dersi') returning id) select set_config('t14.ders', id::text, false) from d;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t14.ders')::uuid, '1401', 'Ahmet Can Yılmaz') returning id)
select set_config('t14.ahmet', id::text, false) from s;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t14.ders')::uuid, '1402', 'Ayşe Kaya') returning id)
select set_config('t14.ayse', id::text, false) from s;
with s as (insert into sessions (course_id, yoklama_acik) values (current_setting('t14.ders')::uuid, true) returning id)
select set_config('t14.sid', id::text, false) from s;
select set_config('t14.kumanda', kumanda_anahtari(current_setting('t14.sid')::uuid), false);

-- Yoklamalar ve takma ad doğrudan yazılır (öğrenci akışı başka testlerde denendi)
reset request.jwt.claims;
reset role;
insert into attendance (session_id, student_id, yontem, cihaz_id) values
  (current_setting('t14.sid')::uuid, current_setting('t14.ahmet')::uuid, 'qr', 'cihaz-ahmet-0001'),
  (current_setting('t14.sid')::uuid, current_setting('t14.ayse')::uuid, 'qr', 'cihaz-ayse-00001');
insert into session_players (session_id, cihaz_id, takma_ad) values (current_setting('t14.sid')::uuid, 'cihaz-takma-0001', 'Kral Ali');

-- ---------------------------------------------------------------- ÖĞRENCİ
set role anon;
do $$
declare
  sid uuid := current_setting('t14.sid')::uuid;
  v   jsonb;
begin
  -- Yabancı cihaz düğmeleri kullanamaz
  assert sinif_gonder(sid, 'cihaz-yabanci-001', 'el') ->> 'hata' = 'katilmadin', 'HATA: yabanci cihaz el kaldirdi';
  assert sinif_gonder(sid, 'x', 'el') ->> 'hata' = 'cihaz_gecersiz', 'HATA: gecersiz cihaz kabul edildi';
  assert sinif_gonder(sid, 'cihaz-ahmet-0001', 'uc') ->> 'hata' = 'tur_gecersiz', 'HATA: gecersiz tur';

  -- El kaldırma: tekrar basmak yinelemez, indirilebilir
  assert sinif_gonder(sid, 'cihaz-ahmet-0001', 'el') ->> 'durum' = 'tamam', 'HATA: el kaldirilamadi';
  assert sinif_gonder(sid, 'cihaz-ahmet-0001', 'el') ->> 'durum' = 'tamam', 'HATA: ikinci el hata verdi';
  assert (sinif_durumum(sid, 'cihaz-ahmet-0001') ->> 'el')::boolean, 'HATA: el durumu gorunmuyor';
  assert sinif_gonder(sid, 'cihaz-ahmet-0001', 'el_indir') ->> 'durum' = 'tamam', 'HATA: el indirilemedi';
  assert not (sinif_durumum(sid, 'cihaz-ahmet-0001') ->> 'el')::boolean, 'HATA: el inmedi';

  -- Soru: kısa ve uzun metin reddedilir, üç bekleyen sınırı
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', 'a') ->> 'hata' = 'metin_kisa', 'HATA: kisa soru kabul edildi';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', repeat('a', 281)) ->> 'hata' = 'metin_uzun', 'HATA: uzun soru kabul edildi';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', 'Kötülük problemi nedir?') ->> 'durum' = 'tamam', 'HATA: soru gonderilemedi';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', 'İkinci soru burada') ->> 'durum' = 'tamam';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', 'Üçüncü soru burada') ->> 'durum' = 'tamam';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'soru', 'Dördüncü soru burada') ->> 'hata' = 'sinir', 'HATA: soru siniri yok';
  assert jsonb_array_length(sinif_durumum(sid, 'cihaz-ayse-00001') -> 'sorular') = 3, 'HATA: ogrenci sorulari gorunmuyor';

  -- Sıkıldım: üç kişi (yoklamalı ikisi + takma adlı)
  assert sinif_gonder(sid, 'cihaz-ahmet-0001', 'sikildim') ->> 'durum' = 'tamam';
  assert sinif_gonder(sid, 'cihaz-ayse-00001', 'sikildim') ->> 'durum' = 'tamam';
  assert sinif_gonder(sid, 'cihaz-takma-0001', 'sikildim') ->> 'durum' = 'tamam';
  assert sinif_gonder(sid, 'cihaz-takma-0001', 'sikildim') ->> 'durum' = 'tamam', 'HATA: ikinci sikildim hata verdi';

  -- Öğrenci tabloları okuyamaz
  begin
    perform 1 from sinif_olaylari;
    raise exception 'HATA: anon sinif_olaylari okudu';
  exception when insufficient_privilege then null;
  end;
  -- Hoca RPC'si yanlış anahtarla çalışmaz
  assert sinif_goster(sid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla goruldu';
  assert sinif_komut(sid, 'yanlis', 'derse_don') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla komut';
  assert sinif_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: anahtarsiz anon goruldu';
end $$;

-- ---------------------------------------------------------------- KUMANDA (anahtarlı)
do $$
declare
  sid uuid := current_setting('t14.sid')::uuid;
  k   text := current_setting('t14.kumanda');
  v   jsonb;
  adlar text[];
begin
  v := sinif_goster(sid, k);
  assert jsonb_array_length(v -> 'olaylar') = 6, 'HATA: olay sayisi: ' || v::text;  -- 3 soru + 3 sikildim
  assert (v ->> 'katilan')::int = 3, 'HATA: katilan: ' || v::text;
  -- Kısa ad: "Ahmet Can Yılmaz" -> "Ahmet Y."
  assert exists (select 1 from jsonb_array_elements(v -> 'olaylar') o where o ->> 'ad' = 'Ahmet Y.'), 'HATA: kisa ad: ' || v::text;
  assert exists (select 1 from jsonb_array_elements(v -> 'olaylar') o where o ->> 'ad' = 'Kral A.'), 'HATA: takma ad kisaltmasi: ' || v::text;

  -- Soruyu cevaplandı say
  perform sinif_komut(sid, k, 'soru_tamam', (select (o ->> 'id')::uuid from jsonb_array_elements(v -> 'olaylar') o where o ->> 'tur' = 'soru' limit 1));
  assert jsonb_array_length(sinif_goster(sid, k) -> 'olaylar') = 5, 'HATA: soru tamamlanmadi';

  -- Çekiliş: 1. ve 2. çekiliş farklı kişi seçer; 3. çekilişte kalan kişi biter
  v := sinif_komut(sid, k, 'cekilis');
  assert v ->> 'durum' = 'tamam' and v ->> 'secilen' is not null, 'HATA: 1. cekilis: ' || v::text;
  adlar := array[v ->> 'secilen'];
  assert (sinif_goster(sid, k) ->> 'mola')::boolean, 'HATA: mola acilmadi';
  v := sinif_komut(sid, k, 'cekilis');
  assert v ->> 'durum' = 'tamam' and not (v ->> 'secilen') = any (adlar), 'HATA: 2. cekilis ayni kisiyi secti: ' || v::text;
  adlar := adlar || (v ->> 'secilen');
  v := sinif_komut(sid, k, 'cekilis');
  assert v ->> 'durum' = 'tamam' and not (v ->> 'secilen') = any (adlar), 'HATA: 3. cekilis: ' || v::text;
  assert (sinif_goster(sid, k) ->> 'cekilis')::int = 3, 'HATA: cekilis sayaci';
  -- 4. çekiliş: sınır
  assert sinif_komut(sid, k, 'cekilis') ->> 'hata' = 'sinir', 'HATA: 4. cekilis yapildi';

  -- Derse dönünce her şey sıfırlanır
  perform sinif_komut(sid, k, 'derse_don');
  v := sinif_goster(sid, k);
  assert not (v ->> 'mola')::boolean and (v ->> 'cekilis')::int = 0, 'HATA: derse donus: ' || v::text;
  assert not exists (select 1 from jsonb_array_elements(v -> 'olaylar') o where o ->> 'tur' = 'sikildim'), 'HATA: sikildim sifirlanmadi';
  assert sinif_komut(sid, k, 'cekilis') ->> 'hata' = 'kimse_yok', 'HATA: bos havuzdan cekildi';
  assert sinif_komut(sid, k, 'bilinmeyen') ->> 'hata' = 'komut_gecersiz';
end $$;

-- ---------------------------------------------------------------- HOCA (anahtarsız, giriş yapmış)
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"f1111111-1111-1111-1111-111111111111","email":"hoca14@ornek.edu.tr"}';
do $$
declare
  sid uuid := current_setting('t14.sid')::uuid;
begin
  assert (sinif_goster(sid) ->> 'katilan')::int = 3, 'HATA: hoca anahtarsiz goremedi';
  assert (select count(*) from sinif_olaylari where session_id = sid) = 7, 'HATA: hoca tabloyu goremedi';
  assert sinif_komut(sid, null, 'mola_ac') ->> 'durum' = 'tamam', 'HATA: hoca mola acamadi';
  assert (sinif_goster(sid) ->> 'mola')::boolean, 'HATA: mola gorunmuyor';
  assert sinif_komut(sid, null, 'derse_don') ->> 'durum' = 'tamam';
end $$;

-- Yabancı hoca göremez ve yönetemez
set request.jwt.claims = '{"sub":"f2222222-2222-2222-2222-222222222222","email":"yabanci14@ornek.com"}';
do $$
declare
  sid uuid := current_setting('t14.sid')::uuid;
begin
  assert sinif_goster(sid) ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca gordu';
  assert sinif_komut(sid, null, 'eller_indir') ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca komut verdi';
  assert (select count(*) from sinif_olaylari) = 0, 'HATA: yabanci hoca tabloyu okudu';
end $$;

reset request.jwt.claims;
reset role;
select '0014 tamam' as sonuc;
