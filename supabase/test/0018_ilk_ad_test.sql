-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0018 tamam" yazar.
-- Beklenen: oyunlarda ve sınıf düğmelerinde öğrencinin ilk adı görünür; aynı ilk ad ikinci kez gelirse soyad baş harfi eklenir;
-- takma ad olduğu gibi kalır.

insert into auth.users (id, email) values ('f9999999-9999-9999-9999-999999999999', 'hoca18@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca18@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"f9999999-9999-9999-9999-999999999999","email":"hoca18@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Ilk Ad Dersi') returning id) select set_config('t18.ders', id::text, false) from d;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t18.ders')::uuid, '1801', 'Ali Veli') returning id) select set_config('t18.ali1', id::text, false) from s;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t18.ders')::uuid, '1802', 'Ali Yilmaz') returning id) select set_config('t18.ali2', id::text, false) from s;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t18.ders')::uuid, '1803', 'Ahmet Can Demir') returning id) select set_config('t18.ahmet', id::text, false) from s;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t18.ders')::uuid, '1804', 'Zeynep') returning id) select set_config('t18.zeynep', id::text, false) from s;
with s as (insert into sessions (course_id) values (current_setting('t18.ders')::uuid) returning id) select set_config('t18.sid', id::text, false) from s;

reset request.jwt.claims;
reset role;
insert into attendance (session_id, student_id, yontem, cihaz_id) values
  (current_setting('t18.sid')::uuid, current_setting('t18.ahmet')::uuid, 'qr', 'cihaz-ilkad-0001'),
  (current_setting('t18.sid')::uuid, current_setting('t18.zeynep')::uuid, 'qr', 'cihaz-ilkad-0002'),
  (current_setting('t18.sid')::uuid, current_setting('t18.ali1')::uuid, 'qr', 'cihaz-ilkad-0003');
insert into session_players (session_id, cihaz_id, takma_ad) values (current_setting('t18.sid')::uuid, 'cihaz-ilkad-0009', 'Kral Can');

do $$
declare sid uuid := current_setting('t18.sid')::uuid;
begin
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0001') = 'Ahmet Can', 'HATA: cok adli ilk ad: ' || coalesce(ozel.oyuncu_adi(sid, 'cihaz-ilkad-0001'), 'null');
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0002') = 'Zeynep', 'HATA: tek ad';
  -- Aynı ilk adı taşıyan tek yoklamalı öğrenci: soyad eklenmez
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0003') = 'Ali', 'HATA: tek Ali: ' || coalesce(ozel.oyuncu_adi(sid, 'cihaz-ilkad-0003'), 'null');
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0009') = 'Kral Can', 'HATA: takma ad degisti';
  assert ozel.sinif_adi(sid, 'cihaz-ilkad-0001') = 'Ahmet Can', 'HATA: sinif adi';
  assert ozel.oyuncu_adi(sid, 'cihaz-yok-000000') is null, 'HATA: yabanci cihaz adli';

  -- İkinci Ali yoklamaya girince ikisine de soyad baş harfi eklenir
  insert into attendance (session_id, student_id, yontem, cihaz_id) values (sid, current_setting('t18.ali2')::uuid, 'qr', 'cihaz-ilkad-0004');
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0003') = 'Ali V.', 'HATA: cakisan ad (1): ' || ozel.oyuncu_adi(sid, 'cihaz-ilkad-0003');
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0004') = 'Ali Y.', 'HATA: cakisan ad (2): ' || ozel.oyuncu_adi(sid, 'cihaz-ilkad-0004');
  assert ozel.oyuncu_adi(sid, 'cihaz-ilkad-0001') = 'Ahmet Can', 'HATA: baska ad etkilendi';
end $$;

select '0018 tamam' as sonuc;
