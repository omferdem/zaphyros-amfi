-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0030 tamam" yazar.
-- Beklenen: projeksiyonlu derste kod sabittir (tekrar sorulunca aynı) ve kodla katılım çalışır; projeksiyonsuz derste kod
-- dakikalık pencereden üretilir, önceki iki dakikanın kodu kabul edilir, üç dakika öncesi reddedilir.

insert into auth.users (id, email) values ('c3030303-3030-3030-3030-303030303001', 'hoca30@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca30@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3030303-3030-3030-3030-303030303001","email":"hoca30@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Sabit Kod Dersi') returning id) select set_config('t30.ders', id::text, false) from d;
with s as (insert into sessions (course_id, yoklama_acik, telefon_modu) values (current_setting('t30.ders')::uuid, true, false) returning id) select set_config('t30.perde', id::text, false) from s;
with s as (insert into sessions (course_id, yoklama_acik, telefon_modu, basladi) values (current_setting('t30.ders')::uuid, true, true, now() + interval '1 minute') returning id) select set_config('t30.telefon', id::text, false) from s;
select set_config('t30.kod_perde', ders_kodu(current_setting('t30.perde')::uuid) ->> 'kod', false);
select set_config('t30.kod_perde2', ders_kodu(current_setting('t30.perde')::uuid) ->> 'kod', false);
select set_config('t30.kod_telefon', ders_kodu(current_setting('t30.telefon')::uuid) ->> 'kod', false);
reset request.jwt.claims;
reset role;

do $$
declare
  a_p text;
  a_t text;
  dk bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
begin
  assert current_setting('t30.kod_perde') = current_setting('t30.kod_perde2'), 'HATA: projeksiyonlu derste kod degisti';
  select g.anahtar into a_t from ozel.session_secrets g where g.session_id = current_setting('t30.telefon')::uuid;
  perform set_config('t30.t1', ozel.ders_kodu(a_t, dk - 1), false);
  perform set_config('t30.t3', ozel.ders_kodu(a_t, dk - 3), false);
end $$;

set role anon;
do $$
declare v jsonb;
begin
  v := kodla_katil(current_setting('t30.kod_perde'), 'cihaz-kod-3000001');
  assert v ->> 'oturum' = current_setting('t30.perde') and not v ? 'bilet', 'HATA: sabit kod: ' || v::text;
  v := kodla_katil(current_setting('t30.kod_telefon'), 'cihaz-kod-3000002');
  assert v ->> 'oturum' = current_setting('t30.telefon') and v ? 'bilet', 'HATA: projeksiyonsuz guncel kod: ' || v::text;
  v := kodla_katil(current_setting('t30.t1'), 'cihaz-kod-3000003');
  assert v ->> 'oturum' = current_setting('t30.telefon'), 'HATA: onceki dakikanin kodu kabul edilmedi: ' || v::text;
  v := kodla_katil(current_setting('t30.t3'), 'cihaz-kod-3000004');
  assert v ->> 'hata' = 'kod_yanlis' or current_setting('t30.t3') = current_setting('t30.kod_perde'), 'HATA: uc dakika onceki kod kabul edildi: ' || v::text;
end $$;
reset role;

select '0030 tamam' as sonuc;
