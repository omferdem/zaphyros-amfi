-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Beklenen: hoca kendi verisini görür; başka kullanıcı ve anon hiçbir tabloyu okuyamaz;
-- eski kod, sahte bilet, liste dışı numara, aynı cihazdan ikinci numara reddedilir.
\set ON_ERROR_STOP 0
insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','hoca@ornek.edu.tr'),('22222222-2222-2222-2222-222222222222','yabanci@ornek.com');
-- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"Hoca@Ornek.edu.tr"}';
select 'sahipsiz mi (t)' t, public.kurulum_sahipsiz();
select 'hoca_mi once (f)' t, public.hoca_mi();
select 'sahiplen (t)' t, public.kurulumu_sahiplen();
select 'hoca_mi (t)' t, public.hoca_mi();
insert into courses (ad,kod,donem) values ('Din Felsefesi','DFL101','2026 Güz') returning id \gset
insert into students (course_id,ogrenci_no,ad_soyad) values (:'id','1001','Ali Veli Yılmaz'),(:'id','1002','Ayşe Kaya'),(:'id','1003','Mehmet');
insert into sessions (course_id,baslik) values (:'id','1. hafta') returning id as sid \gset
select 'qr' t, qr_token(:'sid') \gset q_
select :'q_qr_token'::jsonb->>'token' as tok \gset
select 'gizliyi okuyabilir mi' t; select * from ozel.session_secrets;
-- YABANCI
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"yabanci@ornek.com"}';
select 'yabanci hoca_mi (f)' t, public.hoca_mi();
select 'yabanci sahiplen (f)' t, public.kurulumu_sahiplen();
select 'yabanci teachers' t; select * from teachers;
select 'yabanci ders gorur' t, count(*) from courses;
select 'yabanci ogrenci gorur' t, count(*) from students;
insert into courses (ad) values ('Sahte');
select 'yabanci qr' t; select qr_token(:'sid');
insert into attendance (session_id, student_id, yontem) select :'sid', id, 'elle' from students limit 1;
-- ANON
reset request.jwt.claims; set role anon;
select 'anon sahiplen' t; select kurulumu_sahiplen();
select 'anon students' t; select * from students;
select 'anon sessions' t; select * from sessions;
select 'yanlis kod' t, katilim_bileti(:'sid','abc','cihaz-aaaa-1111');
select 'kisa cihaz' t, katilim_bileti(:'sid',:'tok','x');
select katilim_bileti(:'sid',:'tok','cihaz-aaaa-1111')->>'bilet' as b1 \gset
select 'bilet' t, :'b1';
select 'baska cihaz bileti' t, check_in(:'sid',:'b1','cihaz-bbbb-2222','1001');
select 'liste disi' t, check_in(:'sid',:'b1','cihaz-aaaa-1111','9999');
select 'tamam' t, check_in(:'sid',:'b1','cihaz-aaaa-1111',' 10 01 ');
select 'tekrar ayni' t, check_in(:'sid',:'b1','cihaz-aaaa-1111','1001');
select 'ayni cihaz baska no' t, check_in(:'sid',:'b1','cihaz-aaaa-1111','1002');
select katilim_bileti(:'sid',:'tok','cihaz-bbbb-2222')->>'bilet' as b2 \gset
select 'numara kullanildi' t, check_in(:'sid',:'b2','cihaz-bbbb-2222','1001');
select 'tek isim' t, check_in(:'sid',:'b2','cihaz-bbbb-2222','1003');
select 'sahte bilet' t, check_in(:'sid','99999999.0123456789abcdef','cihaz-cccc-3333','1002');
select 'anon attendance' t; select * from attendance;
-- HOCA tekrar
reset role; set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"hoca@ornek.edu.tr"}';
select 'hoca yoklama' t, count(*) from attendance;
insert into attendance (session_id, student_id, yontem) select :'sid', id, 'elle' from students where ogrenci_no='1002';
insert into attendance (session_id, student_id, yontem, cihaz_id) select :'sid', id, 'qr','sahte-cihaz-1' from students where ogrenci_no='1002';
select 'sonra' t, count(*) from attendance;
update sessions set yoklama_acik=false where id=:'sid';
reset role; set role anon;
select 'kapali' t, katilim_bileti(:'sid',:'tok','cihaz-dddd-4444');
reset role;
