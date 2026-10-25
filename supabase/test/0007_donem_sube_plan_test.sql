-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0007 tamam" yazar.
-- Beklenen: dönem metniyle açılan ders için dönem kendiliğinden bulunur; aynı dönemde aynı içeriğin aynı adlı
-- şubesi olmaz; dönem adı değişince dersler de değişir; başkasının dönemi kullanılamaz; akışlar hafta sırası alır;
-- hafta planı şube başına sayıları verir; yeni dönem planı önceki yapıyı boş listelerle kopyalar.

insert into auth.users (id, email) values
  ('71111111-1111-1111-1111-111111111111', 'hoca7@ornek.edu.tr'),
  ('72222222-2222-2222-2222-222222222222', 'yabanci7@ornek.com');
insert into public.teachers (eposta) values ('hoca7@ornek.edu.tr'), ('yabanci7@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"71111111-1111-1111-1111-111111111111","email":"hoca7@ornek.edu.tr"}';

-- Eski yol: dönem metniyle açılan ders için dönem kendiliğinden açılır
with d as (insert into courses (ad, donem, sube) values ('Mantık', '2026-2027 Güz', 'A') returning id, subject_id, term_id)
select set_config('t7.a', id::text, false), set_config('t7.icerik', subject_id::text, false), set_config('t7.donem', term_id::text, false) from d;

do $$
begin
  assert (select ad from terms where id = current_setting('t7.donem')::uuid) = '2026-2027 Güz', 'HATA: donem acilmadi';
  assert (select donem from courses where id = current_setting('t7.a')::uuid) = '2026-2027 Güz', 'HATA: donem metni';
end $$;

-- Aynı içeriğin ikinci ve üçüncü şubesi; aynı ad (büyük küçük harf fark etmez) ikinci kez açılamaz
with d as (insert into courses (ad, subject_id, term_id, sube) values ('Mantık', current_setting('t7.icerik')::uuid, current_setting('t7.donem')::uuid, 'B') returning id)
select set_config('t7.b', id::text, false) from d;
insert into courses (ad, subject_id, term_id, sube) values ('Mantık', current_setting('t7.icerik')::uuid, current_setting('t7.donem')::uuid, 'C');
do $$
begin
  begin
    insert into courses (ad, subject_id, term_id, sube) values ('Mantık', current_setting('t7.icerik')::uuid, current_setting('t7.donem')::uuid, ' a ');
    raise exception 'HATA: ayni sube ikinci kez acildi';
  exception when unique_violation then null;
  end;
  assert (select count(*) from courses where term_id = current_setting('t7.donem')::uuid and subject_id = current_setting('t7.icerik')::uuid) = 3, 'HATA: sube sayisi';
end $$;

-- Dönem adı değişince dersler de değişir
update terms set ad = '2026-2027 Güz Dönemi' where id = current_setting('t7.donem')::uuid;
do $$
begin
  assert (select count(*) from courses where donem = '2026-2027 Güz Dönemi') = 3, 'HATA: donem adi derslere yansimadi';
end $$;

-- Açık dönem: aynı ad iki kez açılamaz; başka hocanın dönemi kullanılamaz
with t as (insert into terms (ad, baslangic) values ('2027-2028 Güz', '2027-09-20') returning id)
select set_config('t7.donem2', id::text, false) from t;
do $$
begin
  begin
    insert into terms (ad) values ('2027-2028 güz');
    raise exception 'HATA: ayni donem adi ikinci kez acildi';
  exception when unique_violation then null;
  end;
end $$;

-- Hafta sırası: yeni akışlar sıra alır, yeniden sıralanabilir
with l as (insert into lessons (subject_id, ad) values (current_setting('t7.icerik')::uuid, '1. hafta') returning id)
select set_config('t7.l1', id::text, false) from l;
with l as (insert into lessons (subject_id, ad) values (current_setting('t7.icerik')::uuid, '2. hafta') returning id)
select set_config('t7.l2', id::text, false) from l;
with l as (insert into lessons (subject_id, ad) values (current_setting('t7.icerik')::uuid, '3. hafta') returning id)
select set_config('t7.l3', id::text, false) from l;
do $$
begin
  assert (select array_agg(sira order by sira) from lessons where subject_id = current_setting('t7.icerik')::uuid) = array[1,2,3], 'HATA: akis sirasi';
end $$;
select akislari_sirala(current_setting('t7.icerik')::uuid, array[current_setting('t7.l3'), current_setting('t7.l1'), current_setting('t7.l2')]::uuid[]);
do $$
begin
  assert (select ad from lessons where id = current_setting('t7.l3')::uuid) = '3. hafta'
     and (select sira from lessons where id = current_setting('t7.l3')::uuid) = 1
     and (select sira from lessons where id = current_setting('t7.l2')::uuid) = 3, 'HATA: akislar_sirala';
end $$;

-- Şube A'da 2 öğrenci, bir oturum ve 1 yoklama; şube B'de oturum yok
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('t7.a')::uuid, '7001', 'Ali Test'), (current_setting('t7.a')::uuid, '7002', 'Ayşe Test');
insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t7.b')::uuid, '7001', 'Ali Test');
with s as (insert into sessions (course_id, lesson_id, baslik) values (current_setting('t7.a')::uuid, current_setting('t7.l1')::uuid, 'A şubesi') returning id)
select set_config('t7.s', id::text, false) from s;
insert into attendance (session_id, student_id, yontem)
  select current_setting('t7.s')::uuid, id, 'elle' from students where course_id = current_setting('t7.a')::uuid and ogrenci_no = '7001';

do $$
declare
  r record;
begin
  select * into r from hafta_plani(current_setting('t7.donem')::uuid, current_setting('t7.icerik')::uuid);
  assert r.course_id = current_setting('t7.a')::uuid and r.lesson_id = current_setting('t7.l1')::uuid, 'HATA: hafta plani satiri';
  assert r.katilan = 1 and r.mevcut = 2, 'HATA: hafta plani sayilari: ' || r::text;
  assert (select count(*) from hafta_plani(current_setting('t7.donem')::uuid, current_setting('t7.icerik')::uuid)) = 1, 'HATA: yalniz bir oturum beklenir';
end $$;

-- Yeni dönem planı: yapı kopyalanır, listeler ve oturumlar kopyalanmaz
select set_config('t7.yeni', donemi_planla('2027-2028 Bahar', '2028-02-12', current_setting('t7.donem')::uuid)::text, false);
do $$
begin
  assert (select count(*) from courses where term_id = current_setting('t7.yeni')::uuid) = 3, 'HATA: planlanan donemde sube sayisi';
  assert (select array_agg(sube order by sube) from courses where term_id = current_setting('t7.yeni')::uuid) = array['A','B','C'], 'HATA: sube adlari';
  assert (select count(*) from students where course_id in (select id from courses where term_id = current_setting('t7.yeni')::uuid)) = 0, 'HATA: liste kopyalandi';
  assert (select count(distinct subject_id) from courses where term_id = current_setting('t7.yeni')::uuid) = 1
     and (select min(subject_id::text) from courses where term_id = current_setting('t7.yeni')::uuid) = current_setting('t7.icerik'), 'HATA: icerik ortak degil';
  assert (select donem from courses where term_id = current_setting('t7.yeni')::uuid limit 1) = '2027-2028 Bahar', 'HATA: planlanan donem metni';
  begin
    perform donemi_planla('2027-2028 Bahar', null, null);
    raise exception 'HATA: ayni donem adi planlandi';
  exception when unique_violation then null;
  end;
end $$;

-- Dönem silme: dersi olan dönem silinemez, boş dönem silinebilir
do $$
begin
  begin
    delete from terms where id = current_setting('t7.yeni')::uuid;
    raise exception 'HATA: dersi olan donem silindi';
  exception when restrict_violation or foreign_key_violation then null;
  end;
end $$;
delete from terms where id = current_setting('t7.donem2')::uuid;

-- ---------------------------------------------------------------- YABANCI
set request.jwt.claims = '{"sub":"72222222-2222-2222-2222-222222222222","email":"yabanci7@ornek.com"}';
do $$
begin
  assert (select count(*) from terms) = 0, 'HATA: yabanci donem goruyor';
  assert (select count(*) from hafta_plani(current_setting('t7.donem')::uuid, current_setting('t7.icerik')::uuid)) = 0, 'HATA: yabanci hafta planini goruyor';
  begin
    insert into courses (ad, term_id) values ('Çalıntı', current_setting('t7.donem')::uuid);
    raise exception 'HATA: yabanci baskasinin donemine ders ekledi';
  exception when check_violation then null;
  end;
end $$;
-- Yabancı başkasının akış sırasını değiştirmeye çalışır; RLS satırı güncellemez
select akislari_sirala(current_setting('t7.icerik')::uuid, array[current_setting('t7.l1')]::uuid[]);

reset role;
do $$
begin
  assert (select sira from lessons where id = current_setting('t7.l1')::uuid) = 2, 'HATA: yabanci akis sirasini degistirdi';
end $$;
reset request.jwt.claims;
select '0007 tamam' as sonuc;
