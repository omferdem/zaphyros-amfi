-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0043 tamam" yazar.
-- Beklenen: kumanda isteği orman modunu kabul eder; tanımsız mod hâlâ reddedilir.

insert into auth.users (id, email) values ('c4343434-4343-4343-4343-434343434301', 'hoca43@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca43@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4343434-4343-4343-4343-434343434301","email":"hoca43@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Orman Dersi') returning id) select set_config('t43.ders', id::text, false) from d;
with s as (insert into sessions (course_id) values (current_setting('t43.ders')::uuid) returning id) select set_config('t43.sid', id::text, false) from s;
select set_config('t43.k', kumanda_anahtari(current_setting('t43.sid')::uuid), false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare sid uuid := current_setting('t43.sid')::uuid; k text := current_setting('t43.k');
begin
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"orman","adet":20}') ->> 'durum' = 'tamam', 'HATA: orman modu';
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"hile"}') ->> 'hata' = 'istek_gecersiz', 'HATA: gecersiz mod';
end $$;
reset role;

select '0043 tamam' as sonuc;
