-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0006 tamam" yazar.
-- Beklenen: öğrenci yalnızca telefon modundaki açık dersin PERDEDEKİ slaytının görselini okur;
-- hoca yalnızca kendi içeriğinin görsellerini yazar; kumanda telefon modunu açıp kapatır.

insert into auth.users (id, email) values
  ('61111111-1111-1111-1111-111111111111', 'hoca6@ornek.edu.tr'),
  ('62222222-2222-2222-2222-222222222222', 'yabanci6@ornek.com');
insert into public.teachers (eposta) values ('hoca6@ornek.edu.tr'), ('yabanci6@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"61111111-1111-1111-1111-111111111111","email":"hoca6@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Telefon Dersi') returning id, subject_id)
select set_config('t6.ders', id::text, false), set_config('t6.icerik', subject_id::text, false) from d;

with p as (insert into presentations (subject_id, ad, sayfa_sayisi, metinler, gorseller_hazir)
           values (current_setting('t6.icerik')::uuid, 'Görselli', 2, '["Bir", "İki"]', true) returning id)
select set_config('t6.sunum', id::text, false) from p;
with p as (insert into presentations (subject_id, ad, sayfa_sayisi, metinler)
           values (current_setting('t6.icerik')::uuid, 'Görselsiz', 1, '["Tek"]') returning id)
select set_config('t6.sunum2', id::text, false) from p;

with l as (insert into lessons (subject_id, ad) values (current_setting('t6.icerik')::uuid, 'Akış') returning id)
select set_config('t6.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur, presentation_id, sayfa_no) values (current_setting('t6.akis')::uuid, 1, 'slayt', current_setting('t6.sunum')::uuid, 1) returning id)
select set_config('t6.a1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, presentation_id, sayfa_no) values (current_setting('t6.akis')::uuid, 2, 'slayt', current_setting('t6.sunum')::uuid, 2) returning id)
select set_config('t6.a2', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, presentation_id, sayfa_no) values (current_setting('t6.akis')::uuid, 3, 'slayt', current_setting('t6.sunum2')::uuid, 1) returning id)
select set_config('t6.a3', id::text, false) from a;

with s as (insert into sessions (course_id, lesson_id, aktif_adim, telefon_modu)
           values (current_setting('t6.ders')::uuid, current_setting('t6.akis')::uuid, current_setting('t6.a1')::uuid, false) returning id)
select set_config('t6.sid', id::text, false) from s;
select set_config('t6.kumanda', kumanda_anahtari(current_setting('t6.sid')::uuid), false);

-- Hoca kendi içeriğine görsel yazar, başkasının içeriğine yazamaz
reset role;
select set_config('t6.yol1', current_setting('t6.icerik') || '/' || current_setting('t6.sunum') || '/1', false);
select set_config('t6.yol2', current_setting('t6.icerik') || '/' || current_setting('t6.sunum') || '/2', false);
select set_config('t6.yol3', current_setting('t6.icerik') || '/' || current_setting('t6.sunum2') || '/1', false);
set role authenticated;
set request.jwt.claims = '{"sub":"61111111-1111-1111-1111-111111111111","email":"hoca6@ornek.edu.tr"}';
insert into storage.objects (bucket_id, name) values
  ('slayt-gorselleri', current_setting('t6.yol1')),
  ('slayt-gorselleri', current_setting('t6.yol2')),
  ('slayt-gorselleri', current_setting('t6.yol3'));
do $$
begin
  assert (select count(*) from storage.objects where bucket_id = 'slayt-gorselleri') = 3, 'HATA: hoca kendi gorsellerini goremiyor';
end $$;

set request.jwt.claims = '{"sub":"62222222-2222-2222-2222-222222222222","email":"yabanci6@ornek.com"}';
do $$
begin
  assert (select count(*) from storage.objects where bucket_id = 'slayt-gorselleri') = 0, 'HATA: yabanci gorselleri goruyor';
  begin
    insert into storage.objects (bucket_id, name) values ('slayt-gorselleri', current_setting('t6.icerik') || '/' || gen_random_uuid()::text || '/1');
    raise exception 'HATA: yabanci baskasinin icerigine gorsel yazdi';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- ANON: projeksiyon modunda görsel yok
reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
begin
  assert (select count(*) from storage.objects where bucket_id = 'slayt-gorselleri') = 0, 'HATA: projeksiyon modunda gorsel okundu';
  v := ders_durumu(current_setting('t6.sid')::uuid);
  assert (v ->> 'telefon_modu')::boolean = false and v -> 'adim' -> 'gorsel' = 'null'::jsonb, 'HATA: projeksiyon modunda gorsel yolu: ' || v::text;
  assert not public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: gorsel_gorunur projeksiyon modunda true';
end $$;

-- Kumanda telefon modunu açar
do $$
declare
  v jsonb;
begin
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'telefon_ac') ->> 'durum' = 'tamam', 'HATA: telefon_ac';
  v := ders_durumu(current_setting('t6.sid')::uuid);
  assert (v ->> 'telefon_modu')::boolean and v -> 'adim' ->> 'gorsel' = current_setting('t6.yol1'), 'HATA: telefon modunda gorsel yolu: ' || v::text;

  -- Yalnızca perdedeki sayfa okunabilir
  assert public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: perdedeki gorsel gorunmuyor';
  assert not public.gorsel_gorunur(current_setting('t6.yol2')), 'HATA: siradaki slaytin gorseli onceden gorunuyor';
  assert not public.gorsel_gorunur(current_setting('t6.yol3')), 'HATA: baska sunumun gorseli gorunuyor';
  assert not public.gorsel_gorunur(current_setting('t6.icerik') || '/' || current_setting('t6.sunum') || '/x'), 'HATA: gecersiz sayfa';
  assert (select count(*) from storage.objects where bucket_id = 'slayt-gorselleri') = 1, 'HATA: depoda yalnizca 1 gorsel gorunmeli';
  assert (select name from storage.objects where bucket_id = 'slayt-gorselleri') = current_setting('t6.yol1'), 'HATA: yanlis gorsel';

  -- Sahne ilerleyince erişim de ilerler
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'git', current_setting('t6.a2')::uuid) ->> 'durum' = 'tamam', 'HATA: git';
  assert public.gorsel_gorunur(current_setting('t6.yol2')) and not public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: erisim ilerlemedi';

  -- Görselleri hazır olmayan sunumda yol yok (öğrenci metni görür)
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'git', current_setting('t6.a3')::uuid) ->> 'durum' = 'tamam', 'HATA: git 3';
  v := ders_durumu(current_setting('t6.sid')::uuid);
  assert v -> 'adim' -> 'gorsel' = 'null'::jsonb and v -> 'adim' ->> 'metin' = 'Tek', 'HATA: gorselsiz sunum: ' || v::text;
  assert not public.gorsel_gorunur(current_setting('t6.yol3')), 'HATA: gorseli hazir olmayan sunum';

  -- Telefon modunu kapatınca erişim kapanır
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'git', current_setting('t6.a1')::uuid) ->> 'durum' = 'tamam', 'HATA: git 1';
  assert public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: yeniden acilan gorsel';
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'telefon_kapat') ->> 'durum' = 'tamam', 'HATA: telefon_kapat';
  assert not public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: telefon modu kapaliyken gorsel acik';
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'telefon_ac') ->> 'durum' = 'tamam', 'HATA: telefon_ac 2';
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'bilinmeyen') ->> 'hata' = 'komut_gecersiz', 'HATA: bilinmeyen komut';
  assert kumanda_komut(current_setting('t6.sid')::uuid, repeat('0', 64), 'telefon_kapat') ->> 'hata' = 'anahtar_gecersiz', 'HATA: yanlis anahtar';
end $$;

-- Ders bitince hiçbir görsele erişilemez
reset role;
update sessions set bitti = now() where id = current_setting('t6.sid')::uuid;
set role anon;
do $$
begin
  assert not public.gorsel_gorunur(current_setting('t6.yol1')), 'HATA: biten dersin gorseli acik';
  assert (select count(*) from storage.objects where bucket_id = 'slayt-gorselleri') = 0, 'HATA: biten derste depo okundu';
end $$;

-- ---------------------------------------------------------------- Telefon modunda soru sonucunda ilk 5
reset role;
update sessions set bitti = null where id = current_setting('t6.sid')::uuid;
set role authenticated;
set request.jwt.claims = '{"sub":"61111111-1111-1111-1111-111111111111","email":"hoca6@ornek.edu.tr"}';
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t6.icerik')::uuid, 'Deneme sorusu?', 'Doğru', array['Yanlış'], 30) returning id)
select set_config('t6.q', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t6.akis')::uuid, 4, 'soru', current_setting('t6.q')::uuid) returning id)
select set_config('t6.a4', id::text, false) from a;
reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
  v_dogru int;
begin
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'git', current_setting('t6.a4')::uuid) ->> 'durum' = 'tamam', 'HATA: soruya gec';
  v := ders_durumu(current_setting('t6.sid')::uuid);
  select i - 1 into v_dogru from jsonb_array_elements_text(v -> 'adim' -> 'secenekler') with ordinality e(x, i) where x = 'Doğru';
  assert takma_ad_al(current_setting('t6.sid')::uuid, 'cihaz-tel-0001', 'Telefoncu') ->> 'durum' = 'tamam', 'HATA: takma ad';
  assert cevap_ver(current_setting('t6.sid')::uuid, 'cihaz-tel-0001', v_dogru) ->> 'durum' = 'tamam', 'HATA: cevap';
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'sonuc_goster') ->> 'durum' = 'tamam', 'HATA: sonuc';
  v := benim_sonucum(current_setting('t6.sid')::uuid, 'cihaz-tel-0001');
  assert jsonb_array_length(v -> 'puanlar') = 1 and v -> 'puanlar' -> 0 ->> 'ad' = 'Telefoncu', 'HATA: telefon modunda ilk 5: ' || v::text;
  assert kumanda_komut(current_setting('t6.sid')::uuid, current_setting('t6.kumanda'), 'telefon_kapat') ->> 'durum' = 'tamam', 'HATA: telefon_kapat 3';
  v := benim_sonucum(current_setting('t6.sid')::uuid, 'cihaz-tel-0001');
  assert v -> 'puanlar' = 'null'::jsonb, 'HATA: projeksiyon modunda ilk 5 telefona gitti: ' || v::text;
end $$;

reset role;
reset request.jwt.claims;
select '0006 tamam' as sonuc;
