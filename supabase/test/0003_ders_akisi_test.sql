-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0003 tamam" yazar.
-- Testler her zaman en güncel şemaya karşı çalışır (0004'ten beri sunum ve akışlar ders içeriğine bağlı).
-- Kullanım (taklit + 0001 + 0002 + 0003 yüklendikten sonra):
--   psql -d amfi_test -X -v ON_ERROR_STOP=1 -f supabase/test/0003_ders_akisi_test.sql

insert into auth.users (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'hoca3@ornek.edu.tr'),
  ('32222222-2222-2222-2222-222222222222', 'yabanci3@ornek.com');

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"31111111-1111-1111-1111-111111111111","email":"hoca3@ornek.edu.tr"}';
select public.kurulumu_sahiplen();
-- Sahiplenme başka bir testte yapılmış olabilir; bu hocayı listeye doğrudan ekleyerek ilerle.
reset role;
insert into public.teachers (eposta) values ('hoca3@ornek.edu.tr') on conflict do nothing;
set role authenticated;

with d as (insert into courses (ad) values ('Din Felsefesi 3') returning id)
select set_config('t.ders', id::text, false) from d;
with d as (insert into courses (ad) values ('Başka Ders') returning id)
select set_config('t.ders2', id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t.ders')::uuid, '22010101001', 'Ali Yılmaz');

with p as (
  insert into presentations (subject_id, ad, sayfa_sayisi, metinler)
  values ((select subject_id from courses where id = current_setting('t.ders')::uuid), '3. Hafta', 2, '["Giriş\nTanrı kanıtları", "Ontolojik kanıt"]')
  returning id)
select set_config('t.sunum', id::text, false) from p;
with p as (
  insert into presentations (subject_id, ad, sayfa_sayisi) values ((select subject_id from courses where id = current_setting('t.ders2')::uuid), 'Başka', 1) returning id)
select set_config('t.sunum2', id::text, false) from p;

with l as (insert into lessons (subject_id, ad) values ((select subject_id from courses where id = current_setting('t.ders')::uuid), '3. Hafta akışı') returning id)
select set_config('t.akis', id::text, false) from l;
with l as (insert into lessons (subject_id, ad) values ((select subject_id from courses where id = current_setting('t.ders')::uuid), 'Diğer akış') returning id)
select set_config('t.akis2', id::text, false) from l;

with a as (insert into lesson_steps (lesson_id, sira, tur) values (current_setting('t.akis')::uuid, 1, 'yoklama') returning id)
select set_config('t.a_yok', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, presentation_id, sayfa_no)
           values (current_setting('t.akis')::uuid, 2, 'slayt', current_setting('t.sunum')::uuid, 1) returning id)
select set_config('t.a_s1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, presentation_id, sayfa_no)
           values (current_setting('t.akis')::uuid, 3, 'slayt', current_setting('t.sunum')::uuid, 2) returning id)
select set_config('t.a_s2', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur) values (current_setting('t.akis2')::uuid, 1, 'yoklama') returning id)
select set_config('t.a_diger', id::text, false) from a;

do $$
begin
  -- Başka dersin sunumu akışa eklenemez
  begin
    insert into lesson_steps (lesson_id, tur, presentation_id, sayfa_no)
    values (current_setting('t.akis')::uuid, 'slayt', current_setting('t.sunum2')::uuid, 1);
    raise exception 'HATA: baska dersin sunumu akisa eklendi';
  exception when insufficient_privilege then null;
  end;
  -- Slayt adımında sunum ve sayfa zorunlu
  begin
    insert into lesson_steps (lesson_id, tur) values (current_setting('t.akis')::uuid, 'slayt');
    raise exception 'HATA: sunumsuz slayt adimi eklendi';
  exception when check_violation then null;
  end;
end $$;

-- Sıralama: s2, yoklama, s1
select akis_sirala(current_setting('t.akis')::uuid,
  array[current_setting('t.a_s2'), current_setting('t.a_yok'), current_setting('t.a_s1')]::uuid[]);
do $$
begin
  assert (select array_agg(id order by sira) from lesson_steps where lesson_id = current_setting('t.akis')::uuid)
       = array[current_setting('t.a_s2'), current_setting('t.a_yok'), current_setting('t.a_s1')]::uuid[],
    'HATA: akis_sirala sirayi yazmadi';
end $$;

-- Oturum
with s as (
  insert into sessions (course_id, baslik, lesson_id, aktif_adim)
  values (current_setting('t.ders')::uuid, '3. hafta', current_setting('t.akis')::uuid, current_setting('t.a_yok')::uuid)
  returning id)
select set_config('t.sid', id::text, false) from s;

do $$
begin
  begin
    update sessions set aktif_adim = current_setting('t.a_diger')::uuid where id = current_setting('t.sid')::uuid;
    raise exception 'HATA: baska akisin adimi perdeye kondu';
  exception when check_violation then null;
  end;
end $$;

select set_config('t.kod', ders_kodu(current_setting('t.sid')::uuid) ->> 'kod', false);
select set_config('t.kumanda', kumanda_anahtari(current_setting('t.sid')::uuid), false);
do $$
begin
  assert current_setting('t.kod') ~ '^[0-9]{6}$', 'HATA: ders kodu 6 hane degil';
  assert current_setting('t.kumanda') ~ '^[0-9a-f]{64}$', 'HATA: kumanda anahtari bicimi';
  assert public.depo_dersi_benim(current_setting('t.ders') || '/x.pdf'), 'HATA: hoca kendi dosya yolunu goremedi';
  assert not public.depo_dersi_benim('abc/x.pdf'), 'HATA: gecersiz yol kabul edildi';
end $$;

-- ---------------------------------------------------------------- YABANCI
set request.jwt.claims = '{"sub":"32222222-2222-2222-2222-222222222222","email":"yabanci3@ornek.com"}';
do $$
begin
  assert (select count(*) from lessons) = 0, 'HATA: yabanci akis goruyor';
  assert (select count(*) from lesson_steps) = 0, 'HATA: yabanci adim goruyor';
  assert (select count(*) from presentations) = 0, 'HATA: yabanci sunum goruyor';
  assert not public.depo_dersi_benim(current_setting('t.ders') || '/x.pdf'), 'HATA: yabanci dosya yoluna erisiyor';
  begin
    perform kumanda_anahtari(current_setting('t.sid')::uuid);
    raise exception 'HATA: yabanci kumanda anahtarini aldi';
  exception when no_data_found then null;
  end;
  begin
    perform ders_kodu(current_setting('t.sid')::uuid);
    raise exception 'HATA: yabanci ders kodunu aldi';
  exception when no_data_found then null;
  end;
end $$;

-- ---------------------------------------------------------------- ANON (öğrenci ve kumanda)
reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
begin
  begin
    perform 1 from lessons;
    raise exception 'HATA: anon akis tablosunu okudu';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from presentations;
    raise exception 'HATA: anon sunum tablosunu okudu';
  exception when insufficient_privilege then null;
  end;

  v := ders_durumu(current_setting('t.sid')::uuid);
  assert v -> 'adim' ->> 'tur' = 'yoklama', 'HATA: ders durumu yoklama adimini gostermiyor: ' || v::text;
  assert (v -> 'adim' ->> 'sira')::int = 2 and (v -> 'adim' ->> 'toplam')::int = 3, 'HATA: adim sirasi/toplami: ' || v::text;
  assert ders_durumu(gen_random_uuid()) ->> 'hata' = 'oturum_yok', 'HATA: olmayan oturum';

  -- Kodla katılım (yoklama açık): bilet döner, numara check_in ile girilir
  v := kodla_katil(current_setting('t.kod'), 'cihaz-kod-0001');
  assert v ->> 'oturum' = current_setting('t.sid'), 'HATA: kod oturumu bulamadi: ' || v::text;
  assert (v ->> 'yoklama')::boolean and v ? 'bilet', 'HATA: yoklama acikken bilet donmedi';
  v := check_in(current_setting('t.sid')::uuid, v ->> 'bilet', 'cihaz-kod-0001', '22010101001');
  assert v ->> 'durum' = 'tamam', 'HATA: kodla gelen yoklamaya giremedi: ' || v::text;
  assert kodla_katil('000000', 'cihaz-kod-0002') ->> 'hata' = 'kod_yanlis'
      or current_setting('t.kod') = '000000', 'HATA: yanlis kod kabul edildi';
  assert kodla_katil('12', 'cihaz-kod-0002') ->> 'hata' = 'kod_yanlis', 'HATA: kisa kod kabul edildi';

  -- Kumanda
  assert kumanda_durumu(current_setting('t.sid')::uuid, repeat('0', 64)) ->> 'hata' = 'anahtar_gecersiz', 'HATA: yanlis kumanda anahtari';
  v := kumanda_durumu(current_setting('t.sid')::uuid, current_setting('t.kumanda'));
  assert jsonb_array_length(v -> 'adimlar') = 3, 'HATA: kumanda adim listesi: ' || v::text;
  assert (v ->> 'katilan')::int = 1 and (v ->> 'mevcut')::int = 1, 'HATA: kumanda sayilari: ' || v::text;
  assert v -> 'kod' ->> 'kod' = current_setting('t.kod'), 'HATA: kumanda ders kodu';

  v := kumanda_komut(current_setting('t.sid')::uuid, current_setting('t.kumanda'), 'git', current_setting('t.a_s2')::uuid);
  assert v ->> 'durum' = 'tamam', 'HATA: kumanda git: ' || v::text;
  v := ders_durumu(current_setting('t.sid')::uuid);
  assert v -> 'adim' ->> 'metin' = 'Ontolojik kanıt' and (v -> 'adim' ->> 'sayfa_no')::int = 2,
    'HATA: slayt metni gelmedi: ' || v::text;

  v := kumanda_komut(current_setting('t.sid')::uuid, current_setting('t.kumanda'), 'git', current_setting('t.a_diger')::uuid);
  assert v ->> 'hata' = 'adim_yok', 'HATA: baska akisin adimina gecildi';

  v := kumanda_komut(current_setting('t.sid')::uuid, current_setting('t.kumanda'), 'yoklama_kapat');
  v := kodla_katil(current_setting('t.kod'), 'cihaz-kod-0003');
  assert v ->> 'oturum' = current_setting('t.sid') and not (v ->> 'yoklama')::boolean and not v ? 'bilet',
    'HATA: yoklama kapaliyken bilet dondu: ' || v::text;
  assert (ders_durumu(current_setting('t.sid')::uuid) ->> 'yoklama_acik')::boolean = false, 'HATA: yoklama kapanmadi';
end $$;

-- ---------------------------------------------------------------- SİLME
set role authenticated;
set request.jwt.claims = '{"sub":"31111111-1111-1111-1111-111111111111","email":"hoca3@ornek.edu.tr"}';
delete from lesson_steps where id = current_setting('t.a_s2')::uuid;
do $$
begin
  assert (select aktif_adim from sessions where id = current_setting('t.sid')::uuid) is null, 'HATA: silinen adim perdede kaldi';
end $$;
delete from lessons where id = current_setting('t.akis')::uuid;
delete from presentations where id = current_setting('t.sunum')::uuid;
do $$
begin
  assert (select lesson_id from sessions where id = current_setting('t.sid')::uuid) is null, 'HATA: silinen akis oturumda kaldi';
end $$;

reset role;
select '0003 tamam' as sonuc;
