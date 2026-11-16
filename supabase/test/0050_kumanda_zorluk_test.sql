-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0050 tamam" yazar.
-- Beklenen: kumanda isteği zorluğu taşır (varsayılan orta); geçersiz zorluk reddedilir.

insert into auth.users (id, email) values ('c5050505-5050-5050-5050-505050505001', 'hoca50@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca50@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c5050505-5050-5050-5050-505050505001","email":"hoca50@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Zorluk Dersi') returning id) select set_config('t50.ders', id::text, false) from d;
with s as (insert into sessions (course_id) values (current_setting('t50.ders')::uuid) returning id) select set_config('t50.sid', id::text, false) from s;
select set_config('t50.k', kumanda_anahtari(current_setting('t50.sid')::uuid), false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare sid uuid := current_setting('t50.sid')::uuid; k text := current_setting('t50.k'); v jsonb;
begin
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"ejderha","adet":20,"zorluk":"zor"}') ->> 'durum' = 'tamam', 'HATA: zor';
end $$;
reset role;

do $$
declare sid uuid := current_setting('t50.sid')::uuid; v jsonb;
begin
  select kumanda_istek into v from public.sessions where id = sid;
  assert v ->> 'zorluk' = 'zor', 'HATA: zorluk saklanmadi: ' || v::text;
end $$;

set role anon;
do $$
declare sid uuid := current_setting('t50.sid')::uuid; k text := current_setting('t50.k');
begin
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"zombi"}') ->> 'durum' = 'tamam', 'HATA: varsayilan';
  assert kumanda_istek(sid, k, '{"tur":"kahoot","paket":"P","mod":"zombi","zorluk":"imkansiz"}') ->> 'hata' = 'istek_gecersiz', 'HATA: gecersiz zorluk';
end $$;
reset role;

do $$
declare sid uuid := current_setting('t50.sid')::uuid;
begin
  assert (select kumanda_istek ->> 'zorluk' from public.sessions where id = sid) = 'orta', 'HATA: varsayilan zorluk orta degil';
end $$;

select '0050 tamam' as sonuc;
