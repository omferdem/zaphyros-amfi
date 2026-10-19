-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0005 tamam" yazar.

insert into auth.users (id, email) values
  ('51111111-1111-1111-1111-111111111111', 'hoca5@ornek.edu.tr'),
  ('52222222-2222-2222-2222-222222222222', 'yabanci5@ornek.com');
insert into public.teachers (eposta) values ('hoca5@ornek.edu.tr'), ('yabanci5@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"51111111-1111-1111-1111-111111111111","email":"hoca5@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Yarışma Dersi') returning id, subject_id)
select set_config('t5.ders', id::text, false), set_config('t5.icerik', subject_id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t5.ders')::uuid, '5001', 'Zeynep Ak');

with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn)
           values (current_setting('t5.icerik')::uuid, 'Ontolojik kanıtı kim ortaya koydu?', 'Anselmus', array['Hume', 'Paley', 'Kant'], 20) returning id)
select set_config('t5.s1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar)
           values (current_setting('t5.icerik')::uuid, 'Saat benzetmesi kimin?', 'Paley', array['Anselmus']) returning id)
select set_config('t5.s2', id::text, false) from q;

do $$
begin
  begin
    insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t5.icerik')::uuid, 'X?', 'A', array['A']);
    raise exception 'HATA: dogru cevap yanlislar arasinda kabul edildi';
  exception when check_violation then null;
  end;
end $$;

with l as (insert into lessons (subject_id, ad) values (current_setting('t5.icerik')::uuid, 'Yarışma') returning id)
select set_config('t5.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t5.akis')::uuid, 1, 'soru', current_setting('t5.s1')::uuid) returning id)
select set_config('t5.a1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t5.akis')::uuid, 2, 'soru', current_setting('t5.s2')::uuid) returning id)
select set_config('t5.a2', id::text, false) from a;

do $$
begin
  begin
    insert into lesson_steps (lesson_id, tur) values (current_setting('t5.akis')::uuid, 'soru');
    raise exception 'HATA: sorusuz soru adimi eklendi';
  exception when check_violation then null;
  end;
end $$;

with s as (insert into sessions (course_id, lesson_id, aktif_adim, yoklama_acik)
           values (current_setting('t5.ders')::uuid, current_setting('t5.akis')::uuid, current_setting('t5.a1')::uuid, true) returning id)
select set_config('t5.sid', id::text, false) from s;
select set_config('t5.kumanda', kumanda_anahtari(current_setting('t5.sid')::uuid), false);
select set_config('t5.kod', ders_kodu(current_setting('t5.sid')::uuid) ->> 'kod', false);

do $$
begin
  assert (select soru_durum from sessions where id = current_setting('t5.sid')::uuid) = 'acik', 'HATA: soru adimiyla baslayan oturumda soru acilmadi';
end $$;

-- ---------------------------------------------------------------- ANON (öğrenciler)
reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
  v_dogru int;
  v_yanlis int;
begin
  begin
    perform 1 from questions;
    raise exception 'HATA: anon soru tablosunu okudu';
  exception when insufficient_privilege then null;
  end;

  v := ders_durumu(current_setting('t5.sid')::uuid);
  assert v -> 'adim' ->> 'tur' = 'soru' and v -> 'adim' ->> 'soru' like 'Ontolojik%', 'HATA: soru gorunmuyor: ' || v::text;
  assert jsonb_array_length(v -> 'adim' -> 'secenekler') = 4, 'HATA: sik sayisi';
  assert (v -> 'adim' ->> 'kalan_ms')::int between 1 and 20000, 'HATA: kalan sure: ' || v::text;
  assert v -> 'adim' -> 'dogru_index' = 'null'::jsonb, 'HATA: dogru cevap erken acildi';

  -- Şıkların içinde doğrunun yeri (öğrenci bunu bilmez; test için hesaplıyoruz)
  select i - 1 into v_dogru from jsonb_array_elements_text(v -> 'adim' -> 'secenekler') with ordinality e(x, i) where x = 'Anselmus';
  v_yanlis := (v_dogru + 1) % 4;

  -- Kimliği olmayan cevap veremez
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001', v_dogru) ->> 'hata' = 'kimlik_yok', 'HATA: kimliksiz cevap';

  assert takma_ad_al(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001', '  Kara Kartal ') ->> 'ad' = 'Kara Kartal', 'HATA: takma ad';
  assert takma_ad_al(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002', 'kara kartal') ->> 'hata' = 'ad_kullaniliyor', 'HATA: ayni ad iki kez';
  assert takma_ad_al(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002', 'Mavi') ->> 'durum' = 'tamam', 'HATA: ikinci takma ad';
  assert takma_ad_al(current_setting('t5.sid')::uuid, 'cihaz-oyun-0003', 'A') ->> 'hata' = 'ad_kisa', 'HATA: kisa ad';

  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001', v_dogru) ->> 'durum' = 'tamam', 'HATA: dogru cevap verilemedi';
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001', v_yanlis) ->> 'hata' = 'zaten_cevapladin', 'HATA: ikinci cevap';
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002', v_yanlis) ->> 'durum' = 'tamam', 'HATA: yanlis cevap verilemedi';
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002', 9) ->> 'hata' in ('secim_gecersiz', 'zaten_cevapladin'), 'HATA: gecersiz secim';

  -- Yoklamaya giren öğrenci adıyla yarışır
  v := kodla_katil(current_setting('t5.kod'), 'cihaz-oyun-0003');
  v := check_in(current_setting('t5.sid')::uuid, v ->> 'bilet', 'cihaz-oyun-0003', '5001');
  assert v ->> 'durum' = 'tamam', 'HATA: yoklama: ' || v::text;
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0003', v_dogru) ->> 'durum' = 'tamam', 'HATA: yoklamali ogrenci cevap veremedi';

  v := benim_sonucum(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001');
  assert (v ->> 'cevapladi')::boolean and v -> 'dogru' = 'null'::jsonb, 'HATA: sonuc erken: ' || v::text;

  -- Kumanda sonucu açıklar
  v := kumanda_komut(current_setting('t5.sid')::uuid, current_setting('t5.kumanda'), 'sonuc_goster');
  v := ders_durumu(current_setting('t5.sid')::uuid);
  assert (v -> 'adim' ->> 'dogru_index')::int = v_dogru, 'HATA: dogru index: ' || v::text;
  assert (v -> 'adim' -> 'dagilim' ->> v_dogru)::int = 2 and (v -> 'adim' -> 'dagilim' ->> v_yanlis)::int = 1, 'HATA: dagilim: ' || v::text;
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002', v_dogru) ->> 'hata' = 'sure_bitti', 'HATA: sonuctan sonra cevap';

  v := benim_sonucum(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001');
  assert (v ->> 'dogru')::boolean and (v ->> 'puan')::int between 500 and 1000, 'HATA: puan: ' || v::text;
  assert (v ->> 'oyuncu')::int = 3 and (v ->> 'sira')::int between 1 and 2, 'HATA: sira: ' || v::text;
  v := benim_sonucum(current_setting('t5.sid')::uuid, 'cihaz-oyun-0002');
  assert not (v ->> 'dogru')::boolean and (v ->> 'puan')::int = 0 and (v ->> 'sira')::int = 3, 'HATA: yanlis puan: ' || v::text;

  -- Sonraki soru: cevap alma yeniden başlar
  v := kumanda_komut(current_setting('t5.sid')::uuid, current_setting('t5.kumanda'), 'git', current_setting('t5.a2')::uuid);
  v := ders_durumu(current_setting('t5.sid')::uuid);
  assert v -> 'adim' ->> 'soru_durum' = 'acik' and jsonb_array_length(v -> 'adim' -> 'secenekler') = 2, 'HATA: ikinci soru: ' || v::text;
  v := benim_sonucum(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001');
  assert not (v ->> 'cevapladi')::boolean and (v ->> 'toplam')::int >= 500, 'HATA: yeni soruda eski cevap: ' || v::text;
end $$;

-- Süre dolunca cevap alınmaz (soru 25 saniye önce açılmış gibi)
reset role;
update sessions set soru_basladi = now() - interval '25 seconds' where id = current_setting('t5.sid')::uuid;
set role anon;
do $$
begin
  assert cevap_ver(current_setting('t5.sid')::uuid, 'cihaz-oyun-0001', 0) ->> 'hata' = 'sure_bitti', 'HATA: sure dolduktan sonra cevap';
end $$;

-- ---------------------------------------------------------------- HOCA: puan tablosu
set role authenticated;
set request.jwt.claims = '{"sub":"51111111-1111-1111-1111-111111111111","email":"hoca5@ornek.edu.tr"}';
do $$
declare
  v jsonb := puan_tablosu(current_setting('t5.sid')::uuid, 10);
begin
  assert jsonb_array_length(v) = 3, 'HATA: puan tablosu: ' || v::text;
  assert v -> 2 ->> 'ad' = 'Mavi' and (v -> 2 ->> 'puan')::int = 0, 'HATA: son sira: ' || v::text;
  assert exists (select 1 from jsonb_array_elements(v) e where e ->> 'ad' = 'Zeynep A.'), 'HATA: yoklamali ad: ' || v::text;
  assert (select count(*) from responses where session_id = current_setting('t5.sid')::uuid) = 3, 'HATA: hoca cevaplari goremiyor';
end $$;

-- ---------------------------------------------------------------- YABANCI
set request.jwt.claims = '{"sub":"52222222-2222-2222-2222-222222222222","email":"yabanci5@ornek.com"}';
do $$
begin
  assert (select count(*) from questions) = 0, 'HATA: yabanci soru goruyor';
  assert (select count(*) from responses) = 0, 'HATA: yabanci cevap goruyor';
  begin
    perform puan_tablosu(current_setting('t5.sid')::uuid, 10);
    raise exception 'HATA: yabanci puan tablosunu aldi';
  exception when no_data_found then null;
  end;
end $$;

reset role;
reset request.jwt.claims;
select '0005 tamam' as sonuc;
