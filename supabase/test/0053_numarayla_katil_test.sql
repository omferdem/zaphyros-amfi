-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0053 tamam" yazar.
-- Beklenen: kodla giren numarasıyla ilk adıyla katılır, yoklama yazılmaz; yanlış numara reddedilir; aynı numara ikinci cihazdan reddedilir.

insert into auth.users (id, email) values ('c5353535-5353-5353-5353-535353535301', 'hoca53@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca53@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c5353535-5353-5353-5353-535353535301","email":"hoca53@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Numara Dersi') returning id) select set_config('t53.ders', id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('t53.ders')::uuid, '1001', 'Ahmet Can Yılmaz'),
  (current_setting('t53.ders')::uuid, '1002', 'Ahmet Demir');
with s as (insert into sessions (course_id) values (current_setting('t53.ders')::uuid) returning id) select set_config('t53.sid', id::text, false) from s;
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare sid uuid := current_setting('t53.sid')::uuid; v jsonb;
begin
  v := numarayla_katil(sid, 'cihaz-0001-aaaa', '1001');
  assert v ->> 'durum' = 'tamam' and v ->> 'ad' = 'Ahmet Can', 'HATA: ilk ad: ' || v::text;
  v := numarayla_katil(sid, 'cihaz-0002-bbbb', '1002');
  assert v ->> 'durum' = 'tamam' and v ->> 'ad' = 'Ahmet', 'HATA: ikinci ogrenci: ' || v::text;
  assert numarayla_katil(sid, 'cihaz-0003-cccc', '9999') ->> 'hata' = 'numara_gecersiz', 'HATA: gecersiz numara';
  assert numarayla_katil(sid, 'cihaz-0004-dddd', '1001') ->> 'hata' = 'numara_kullanildi', 'HATA: ayni numara ikinci cihaz';
  assert numarayla_katil(sid, 'kisa', '1001') ->> 'hata' = 'cihaz_gecersiz', 'HATA: cihaz';
end $$;
reset role;

do $$
declare sid uuid := current_setting('t53.sid')::uuid;
begin
  assert (select count(*) from session_players where session_id = sid) = 2, 'HATA: iki oyuncu olmali';
  assert (select count(*) from attendance where session_id = sid) = 0, 'HATA: yoklama yazilmamali';
end $$;

select '0053 tamam' as sonuc;
