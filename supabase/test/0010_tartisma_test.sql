-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0010 tamam" yazar.
-- Beklenen: beyin fırtınasında kişi başı 3 fikir; oylamada kişi başı tek oy (değiştirilebilir), sayılar
-- sonuç açılana kadar gizli; kapalıyken katkı alınmaz; öğrenci tabloyu okuyamaz; yabancı hoca göremez.

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'hoca10@ornek.edu.tr'),
  ('a2222222-2222-2222-2222-222222222222', 'yabanci10@ornek.com');
insert into public.teachers (eposta) values ('hoca10@ornek.edu.tr'), ('yabanci10@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","email":"hoca10@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Tartışma Dersi') returning id, subject_id)
select set_config('t10.ders', id::text, false), set_config('t10.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t10.icerik')::uuid, 'Tartışma') returning id)
select set_config('t10.akis', id::text, false) from l;

with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values
  (current_setting('t10.akis')::uuid, 1, 'fikir', '{"soru":"Kötülük problemi sizce nedir?"}') returning id)
select set_config('t10.fikir', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values
  (current_setting('t10.akis')::uuid, 2, 'oylama', '{"soru":"Tanrı kötülüğü neden engellemez?"}') returning id)
select set_config('t10.oy', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values
  (current_setting('t10.akis')::uuid, 3, 'video', '{"url":"https://www.youtube.com/watch?v=ornek123","baslik":"Giriş"}') returning id)
select set_config('t10.video', id::text, false) from a;

do $$
begin
  begin
    insert into lesson_steps (lesson_id, tur, ayar) values (current_setting('t10.akis')::uuid, 'fikir', '{}');
    raise exception 'HATA: sorusuz fikir adimi eklendi';
  exception when check_violation then null;
  end;
  begin
    insert into lesson_steps (lesson_id, tur, ayar) values (current_setting('t10.akis')::uuid, 'video', '{"url":"http://guvensiz.example/x"}');
    raise exception 'HATA: https olmayan video adresi kabul edildi';
  exception when check_violation then null;
  end;
  begin
    insert into lesson_steps (lesson_id, tur, ayar) values (current_setting('t10.akis')::uuid, 'video', '{"url":"javascript:alert(1)"}');
    raise exception 'HATA: javascript adresi kabul edildi';
  exception when check_violation then null;
  end;
end $$;

with s as (insert into sessions (course_id, lesson_id, aktif_adim, yoklama_acik)
           values (current_setting('t10.ders')::uuid, current_setting('t10.akis')::uuid, current_setting('t10.fikir')::uuid, false) returning id)
select set_config('t10.sid', id::text, false) from s;
select set_config('t10.kumanda', kumanda_anahtari(current_setting('t10.sid')::uuid), false);

do $$
begin
  assert (select soru_durum from sessions where id = current_setting('t10.sid')::uuid) = 'acik', 'HATA: fikir adiminda katki acilmadi';
end $$;

-- ---------------------------------------------------------------- ANON (öğrenciler)
reset request.jwt.claims;
set role anon;
do $$
declare
  v   jsonb;
  sid uuid := current_setting('t10.sid')::uuid;
begin
  begin
    perform 1 from contributions;
    raise exception 'HATA: anon katki tablosunu okudu';
  exception when insufficient_privilege then null;
  end;

  v := ders_durumu(sid);
  assert v -> 'adim' ->> 'tur' = 'fikir' and v -> 'adim' ->> 'soru' like 'Kötülük%', 'HATA: fikir sorusu gorunmuyor: ' || v::text;

  -- Beyin fırtınası: kişi başı 3 fikir, aynı fikir iki kez olmaz, çok kısa ve çok uzun reddedilir
  assert katki_gonder(sid, 'cihaz-fikir-0001', 'Özgür irade') ->> 'durum' = 'tamam', 'HATA: ilk fikir';
  assert katki_gonder(sid, 'cihaz-fikir-0001', ' özgür   İRADE ') ->> 'hata' = 'ayni', 'HATA: ayni fikir iki kez';
  assert katki_gonder(sid, 'cihaz-fikir-0001', 'x') ->> 'hata' = 'metin_kisa', 'HATA: kisa fikir';
  assert katki_gonder(sid, 'cihaz-fikir-0001', repeat('a', 41)) ->> 'hata' = 'metin_uzun', 'HATA: uzun fikir';
  assert katki_gonder(sid, 'cihaz-fikir-0001', 'Sınav') ->> 'durum' = 'tamam', 'HATA: ikinci fikir';
  assert (katki_gonder(sid, 'cihaz-fikir-0001', 'Ceza') ->> 'kalan')::int = 0, 'HATA: ucuncu fikir';
  assert katki_gonder(sid, 'cihaz-fikir-0001', 'Dördüncü') ->> 'hata' = 'sinir', 'HATA: 3 fikir siniri';
  assert katki_gonder(sid, 'cihaz-fikir-0002', 'özgür irade') ->> 'durum' = 'tamam', 'HATA: baska ogrencinin ayni fikri';
  assert katki_gonder(sid, 'kisa', 'Fikir') ->> 'hata' = 'cihaz_gecersiz', 'HATA: gecersiz cihaz';
  assert katki_gonder(sid, 'cihaz-fikir-0001', 'Fikir', 1) ->> 'hata' = 'sinir', 'HATA: fikirde taraf yoksayilmali';

  v := ders_durumu(sid) -> 'adim';
  assert (v ->> 'cevap_sayisi')::int = 2, 'HATA: kisi sayisi: ' || v::text;
  -- "özgür irade" iki kişiden geldi: tek kelime, sayısı 2
  assert jsonb_array_length(v -> 'fikirler') = 3, 'HATA: fikir sayisi: ' || v::text;
  assert (v -> 'fikirler' -> 0 ->> 'n')::int = 2, 'HATA: ayni fikir birlesmedi: ' || v::text;
end $$;

-- Hoca: kumanda sonucu açar; kapalıyken katkı alınmaz
do $$
declare
  v   jsonb;
  sid uuid := current_setting('t10.sid')::uuid;
begin
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'sonuc_goster');
  assert katki_gonder(sid, 'cihaz-fikir-0003', 'Geç kalan') ->> 'hata' = 'kapali', 'HATA: kapaliyken katki alindi';
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'yeniden_ac');
  assert katki_gonder(sid, 'cihaz-fikir-0003', 'Geç kalan') ->> 'durum' = 'tamam', 'HATA: yeniden acilinca katki alinmadi';

  -- Uygunsuz fikir kumandadan gizlenir ve bulutta görünmez
  v := kumanda_gizle(sid, current_setting('t10.kumanda'), 'GEÇ KALAN');
  v := ders_durumu(sid) -> 'adim';
  assert not exists (select 1 from jsonb_array_elements(v -> 'fikirler') e where e ->> 'm' = 'Geç kalan'), 'HATA: gizlenen fikir gorunuyor: ' || v::text;
  assert kumanda_gizle(sid, 'yanlis-anahtar', 'Sınav') ->> 'hata' = 'anahtar_gecersiz', 'HATA: yanlis anahtarla gizleme';
end $$;

-- Oylama: perdeye geçince oylar açılır; kişi başı tek oy, değiştirilebilir; sayılar sonuca kadar gizli
do $$
declare
  v   jsonb;
  sid uuid := current_setting('t10.sid')::uuid;
begin
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'git', current_setting('t10.oy')::uuid);
  v := ders_durumu(sid) -> 'adim';
  assert v ->> 'tur' = 'oylama' and v ->> 'soru_durum' = 'acik', 'HATA: oylama acilmadi: ' || v::text;
  assert v -> 'sayilar' = 'null'::jsonb or not (v ? 'sayilar'), 'HATA: sayilar erken gorundu: ' || v::text;
  assert v -> 'etiketler' ->> 0 = 'Katılıyorum', 'HATA: varsayilan etiket: ' || v::text;

  assert katki_gonder(sid, 'cihaz-oy-000001', '', null) ->> 'hata' = 'taraf_gecersiz', 'HATA: tarafsiz oy';
  assert katki_gonder(sid, 'cihaz-oy-000001', '', 2) ->> 'hata' = 'taraf_gecersiz', 'HATA: gecersiz taraf';
  assert katki_gonder(sid, 'cihaz-oy-000001', 'İyiliği göstermek için', 0) ->> 'durum' = 'tamam', 'HATA: ilk oy';
  assert katki_gonder(sid, 'cihaz-oy-000002', 'Özgürlük önemli', 1) ->> 'durum' = 'tamam', 'HATA: ikinci oy';
  assert katki_gonder(sid, 'cihaz-oy-000003', '', 1) ->> 'durum' = 'tamam', 'HATA: gerekcesiz oy';
  assert katki_gonder(sid, 'cihaz-oy-000001', repeat('a', 201), 0) ->> 'hata' = 'metin_uzun', 'HATA: uzun gerekce';
  -- Fikir değiştirme: tek oy kalır
  assert katki_gonder(sid, 'cihaz-oy-000003', 'Fikrim değişti', 0) ->> 'durum' = 'tamam', 'HATA: oy degistirilemedi';

  v := ders_durumu(sid) -> 'adim';
  assert (v ->> 'cevap_sayisi')::int = 3, 'HATA: oy sayisi: ' || v::text;
  assert not (v ? 'sayilar') or v -> 'sayilar' = 'null'::jsonb, 'HATA: sayilar sonuctan once acik: ' || v::text;

  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'sonuc_goster');
  v := ders_durumu(sid) -> 'adim';
  assert v -> 'sayilar' = '[2, 1]'::jsonb, 'HATA: sayilar: ' || v::text;
  assert jsonb_array_length(v -> 'gerekceler') = 3, 'HATA: gerekce sayisi: ' || v::text;
  assert katki_gonder(sid, 'cihaz-oy-000002', 'Geç', 0) ->> 'hata' = 'kapali', 'HATA: sonuctan sonra oy degisti';
  -- Yeniden açılırsa fikir değiştirilebilir
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'yeniden_ac');
  assert katki_gonder(sid, 'cihaz-oy-000002', 'Özgürlük önemli', 0) ->> 'durum' = 'tamam', 'HATA: yeniden acilinca oy degismedi';
  assert (ders_durumu(sid) -> 'adim' ->> 'cevap_sayisi')::int = 3, 'HATA: oy cogaldi';

  -- Video: adres ve başlık gelir, katkı yoktur
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'git', current_setting('t10.video')::uuid);
  v := ders_durumu(sid) -> 'adim';
  assert v ->> 'tur' = 'video' and v ->> 'video' like 'https://www.youtube.com/%' and v ->> 'soru' = 'Giriş', 'HATA: video: ' || v::text;
  assert katki_gonder(sid, 'cihaz-oy-000001', 'Fikir', 0) ->> 'hata' = 'etkinlik_yok', 'HATA: videoda katki alindi';
end $$;

-- Kumanda hocaya her zaman sayıları ve gerekçeleri gösterir
do $$
declare
  v   jsonb;
  sid uuid := current_setting('t10.sid')::uuid;
begin
  v := kumanda_komut(sid, current_setting('t10.kumanda'), 'git', current_setting('t10.oy')::uuid);
  v := kumanda_durumu(sid, current_setting('t10.kumanda'));
  assert v -> 'adim' -> 'sayilar' = '[3, 0]'::jsonb or v -> 'adim' -> 'sayilar' = '[2, 1]'::jsonb, 'HATA: kumanda sayilari: ' || v::text;
  assert exists (select 1 from jsonb_array_elements(v -> 'adimlar') e where e ->> 'tur' = 'video' and e ->> 'ozet' = 'Giriş'), 'HATA: kumanda adim ozeti: ' || v::text;
end $$;

-- ---------------------------------------------------------------- HOCA: görür, yabancı göremez
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"a1111111-1111-1111-1111-111111111111","email":"hoca10@ornek.edu.tr"}';
do $$
begin
  assert (select count(*) from contributions where session_id = current_setting('t10.sid')::uuid) >= 6, 'HATA: hoca katkilari goremiyor';
  assert exists (select 1 from contributions where session_id = current_setting('t10.sid')::uuid and gizli), 'HATA: gizli isaret yok';
  begin
    update contributions set metin = 'degistirildi' where session_id = current_setting('t10.sid')::uuid;
    raise exception 'HATA: hoca katki metnini degistirebildi';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222","email":"yabanci10@ornek.com"}';
do $$
begin
  assert (select count(*) from contributions) = 0, 'HATA: yabanci katki goruyor';
end $$;

reset role;
reset request.jwt.claims;
select '0010 tamam' as sonuc;
