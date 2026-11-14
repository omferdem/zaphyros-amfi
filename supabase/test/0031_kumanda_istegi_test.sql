-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0031 tamam" yazar.
-- Beklenen: kumanda anahtarı olan paketleri listeler ve istek bırakabilir; yanlış anahtar, geçersiz tür/mod reddedilir;
-- istek yalnızca açık oturuma yazılır.

insert into auth.users (id, email) values ('c3131313-3131-3131-3131-313131313101', 'hoca31@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca31@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3131313-3131-3131-3131-313131313101","email":"hoca31@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Kumanda İstek Dersi') returning id) select set_config('t31.ders', id::text, false) from d;
insert into questions (subject_id, soru, dogru, yanlislar, ek) values
  ((select subject_id from courses where id = current_setting('t31.ders')::uuid), 'S1?', 'A', array['B'], '{"paket":"1. Hafta Kahoot","mod":"zombi"}'),
  ((select subject_id from courses where id = current_setting('t31.ders')::uuid), 'S2?', 'A', array['B'], '{"paket":"1. Hafta Kahoot","mod":"zombi"}'),
  ((select subject_id from courses where id = current_setting('t31.ders')::uuid), 'S3?', 'A', array['B'], '{"paket":"1. Hafta Quiz"}'),
  ((select subject_id from courses where id = current_setting('t31.ders')::uuid), 'S4?', 'A', array['B'], '{}');
with s as (insert into sessions (course_id) values (current_setting('t31.ders')::uuid) returning id) select set_config('t31.sid', id::text, false) from s;
select set_config('t31.k', kumanda_anahtari(current_setting('t31.sid')::uuid), false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare v jsonb;
begin
  v := kumanda_paketler(current_setting('t31.sid')::uuid, current_setting('t31.k'));
  assert jsonb_array_length(v -> 'paketler') = 2, 'HATA: paket sayisi: ' || v::text;
  assert exists (select 1 from jsonb_array_elements(v -> 'paketler') p where p ->> 'ad' = '1. Hafta Kahoot' and (p ->> 'sayi')::int = 2 and p ->> 'mod' = 'zombi'), 'HATA: paket ozeti: ' || v::text;
  assert kumanda_paketler(current_setting('t31.sid')::uuid, 'yanlis-anahtar') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla paket listesi';

  v := kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"kahoot","paket":"1. Hafta Kahoot","mod":"zombi"}');
  assert v ->> 'durum' = 'tamam', 'HATA: istek: ' || v::text;
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"quiz","paket":"1. Hafta Quiz","sure":15}') ->> 'durum' = 'tamam', 'HATA: quiz istegi';
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"derse_don"}') ->> 'durum' = 'tamam', 'HATA: derse don istegi';
  assert kumanda_istek(current_setting('t31.sid')::uuid, 'yanlis-anahtar', '{"tur":"derse_don"}') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtarla istek';
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"sil"}') ->> 'hata' = 'istek_gecersiz', 'HATA: gecersiz tur';
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"kahoot","paket":"x","mod":"hile"}') ->> 'hata' = 'istek_gecersiz', 'HATA: gecersiz mod';
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"kahoot"}') ->> 'hata' = 'paket_yok', 'HATA: paketsiz kahoot';
end $$;
reset role;

-- Son geçerli istek oturuma yazılmıştır; bitmiş oturuma istek yazılmaz
do $$
begin
  assert (select kumanda_istek ->> 'tur' from public.sessions where id = current_setting('t31.sid')::uuid) = 'derse_don', 'HATA: istek yazilmadi';
end $$;
update public.sessions set bitti = now() where id = current_setting('t31.sid')::uuid;
set role anon;
do $$
begin
  assert kumanda_istek(current_setting('t31.sid')::uuid, current_setting('t31.k'), '{"tur":"derse_don"}') ->> 'hata' = 'oturum_yok', 'HATA: bitmis oturuma istek yazildi';
end $$;
reset role;

select '0031 tamam' as sonuc;
