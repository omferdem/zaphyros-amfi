-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0040 tamam" yazar.
-- Beklenen: kumanda isteği soru sayısını (adet) taşır; verilmezse 20, sınır dışı değerler 5-100 aralığına çekilir.

insert into auth.users (id, email) values ('c4040404-4040-4040-4040-404040404001', 'hoca40@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca40@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4040404-4040-4040-4040-404040404001","email":"hoca40@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Adet Dersi') returning id) select set_config('t40.ders', id::text, false) from d;
with s as (insert into sessions (course_id) values (current_setting('t40.ders')::uuid) returning id) select set_config('t40.sid', id::text, false) from s;
select set_config('t40.k', kumanda_anahtari(current_setting('t40.sid')::uuid), false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare sid uuid := current_setting('t40.sid')::uuid; k text := current_setting('t40.k');
begin
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"zombi","adet":30}') ->> 'durum' = 'tamam', 'HATA: istek';
end $$;
reset role;
do $$
begin
  assert (select (kumanda_istek ->> 'adet')::int from public.sessions where id = current_setting('t40.sid')::uuid) = 30, 'HATA: adet yazilmadi';
end $$;
set role anon;
do $$
declare sid uuid := current_setting('t40.sid')::uuid; k text := current_setting('t40.k');
begin
  perform kumanda_istek(sid, k, '{"tur":"quiz","paket":"P"}');
end $$;
reset role;
do $$
begin
  assert (select (kumanda_istek ->> 'adet')::int from public.sessions where id = current_setting('t40.sid')::uuid) = 20, 'HATA: varsayilan adet';
end $$;
set role anon;
do $$
declare sid uuid := current_setting('t40.sid')::uuid; k text := current_setting('t40.k');
begin
  perform kumanda_istek(sid, k, '{"tur":"quiz","paket":"P","adet":500}');
end $$;
reset role;
do $$
begin
  assert (select (kumanda_istek ->> 'adet')::int from public.sessions where id = current_setting('t40.sid')::uuid) = 100, 'HATA: ust sinir';
end $$;

select '0040 tamam' as sonuc;
