-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0021 tamam" yazar.
-- Beklenen (0030'dan sonraki hâliyle): projeksiyonlu derste ders kodu sabittir; eski 6 saniyelik pencere kodları ve dakika bazlı
-- kod tutmaz, uydurma kod reddedilir; kod bilet vermez.

insert into auth.users (id, email) values ('fc111111-1111-1111-1111-111111111111', 'hoca21@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca21@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"fc111111-1111-1111-1111-111111111111","email":"hoca21@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Kod Dersi') returning id) select set_config('t21.ders', id::text, false) from d;
with s as (insert into sessions (course_id, yoklama_acik) values (current_setting('t21.ders')::uuid, true) returning id) select set_config('t21.sid', id::text, false) from s;
select set_config('t21.kod', (ders_kodu(current_setting('t21.sid')::uuid) ->> 'kod'), false);
select set_config('t21.kalan', (ders_kodu(current_setting('t21.sid')::uuid) ->> 'kalan_ms'), false);

reset request.jwt.claims;
reset role;
do $$
declare
  kalan numeric := current_setting('t21.kalan')::numeric;
  anahtar text;
  pencere bigint := ozel.pencere();
  dakika bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
begin
  assert kalan > 0, 'HATA: kalan sure gecersiz: ' || kalan;
  select g.anahtar into anahtar from ozel.session_secrets g where g.session_id = current_setting('t21.sid')::uuid;
  -- Kodlar yetkili rolle önceden hesaplanır (anon ozel şemayı okuyamaz)
  perform set_config('t21.k1', ozel.ders_kodu(anahtar, pencere - 1), false);
  perform set_config('t21.k2', ozel.ders_kodu(anahtar, pencere - 2), false);
  perform set_config('t21.k3', ozel.ders_kodu(anahtar, pencere - 3), false);
  perform set_config('t21.kd', ozel.ders_kodu(anahtar, dakika), false);
end $$;

set role anon;
do $$
declare v jsonb;
begin
  -- Güncel kod (hoca ekranından alınan) kabul edilir ve bilet verir
  v := kodla_katil(current_setting('t21.kod'), 'cihaz-kod-0000001');
  assert v ->> 'oturum' = current_setting('t21.sid') and not v ? 'bilet', 'HATA: guncel kod kabul edilmedi ya da bilet verdi: ' || v::text;
  -- Eski 6 saniyelik pencere kodları artık tutmaz (kod sabittir)
  v := kodla_katil(current_setting('t21.k1'), 'cihaz-kod-0000002');
  assert v ->> 'hata' = 'kod_yanlis' or current_setting('t21.k1') = current_setting('t21.kod'), 'HATA: eski pencere kodu kabul edildi: ' || v::text;
  v := kodla_katil(current_setting('t21.k3'), 'cihaz-kod-0000004');
  assert v ->> 'hata' = 'kod_yanlis' or current_setting('t21.k3') = current_setting('t21.kod'), 'HATA: eski kod kabul edildi: ' || v::text;
  -- Eski sistemdeki dakika bazlı kod artık tutmaz
  v := kodla_katil(current_setting('t21.kd'), 'cihaz-kod-0000005');
  assert v ->> 'hata' = 'kod_yanlis' or current_setting('t21.kd') = current_setting('t21.kod'), 'HATA: dakika bazli kod kabul edildi';
  assert kodla_katil('123456', 'cihaz-kod-0000006') ->> 'hata' = 'kod_yanlis', 'HATA: uydurma kod kabul edildi';
  assert kodla_katil('12', 'cihaz-kod-0000006') ->> 'hata' = 'kod_yanlis', 'HATA: kisa kod kabul edildi';
end $$;
reset role;

select '0021 tamam' as sonuc;
