-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0008 tamam" yazar.
-- Beklenen: öğrenciye giden ve kumandaya giden ders adı şube adını taşır ("Ders · B"); şubesiz derste yalnızca ders adı.

insert into auth.users (id, email) values ('81111111-1111-1111-1111-111111111111', 'hoca8@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca8@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"81111111-1111-1111-1111-111111111111","email":"hoca8@ornek.edu.tr"}';

with d as (insert into courses (ad, sube, donem) values ('Şube Dersi', 'B', '2030 Güz') returning id, subject_id)
select set_config('t8.sube', id::text, false), set_config('t8.icerik', subject_id::text, false) from d;
with d as (insert into courses (ad, donem, subject_id) values ('Şube Dersi', '2031 Güz', current_setting('t8.icerik')::uuid) returning id)
select set_config('t8.subesiz', id::text, false) from d;

with s as (insert into sessions (course_id) values (current_setting('t8.sube')::uuid) returning id)
select set_config('t8.s1', id::text, false) from s;
with s as (insert into sessions (course_id) values (current_setting('t8.subesiz')::uuid) returning id)
select set_config('t8.s2', id::text, false) from s;

select set_config('t8.qr', (qr_token(current_setting('t8.s1')::uuid) ->> 'token'), false);
select set_config('t8.kod', (ders_kodu(current_setting('t8.s1')::uuid) ->> 'kod'), false);
select set_config('t8.kumanda', kumanda_anahtari(current_setting('t8.s1')::uuid), false);

reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
begin
  v := katilim_bileti(current_setting('t8.s1')::uuid, current_setting('t8.qr'), 'cihaz-sube-0001');
  assert v ->> 'ders' = 'Şube Dersi · B', 'HATA: katilim_bileti ders adi: ' || v::text;

  v := kodla_katil(current_setting('t8.kod'), 'cihaz-sube-0002');
  assert v ->> 'ders' = 'Şube Dersi · B', 'HATA: kodla_katil ders adi: ' || v::text;

  assert ders_durumu(current_setting('t8.s1')::uuid) ->> 'ders' = 'Şube Dersi · B', 'HATA: ders_durumu sube';
  assert ders_durumu(current_setting('t8.s2')::uuid) ->> 'ders' = 'Şube Dersi', 'HATA: subesiz ders adi degismemeli';

  v := kumanda_durumu(current_setting('t8.s1')::uuid, current_setting('t8.kumanda'));
  assert v ->> 'ders' = 'Şube Dersi · B', 'HATA: kumanda_durumu ders adi: ' || v::text;
end $$;

reset role;
select '0008 tamam' as sonuc;
