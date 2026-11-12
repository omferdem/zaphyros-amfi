-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0013 tamam" yazar.
-- Beklenen: misafir satır başka şubedeki asıl kayda bağlanır; aynı şubeye, başka hocaya, misafirin misafirine bağlanamaz;
-- asıl silinince misafir de silinir.

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'hoca13a@ornek.edu.tr'),
  ('d2222222-2222-2222-2222-222222222222', 'hoca13b@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca13a@ornek.edu.tr'), ('hoca13b@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","email":"hoca13a@ornek.edu.tr"}';

with a as (insert into courses (ad, sube) values ('Misafir Dersi', 'A') returning id) select set_config('t13.a', id::text, false) from a;
with b as (insert into courses (ad, sube) values ('Misafir Dersi', 'B') returning id) select set_config('t13.b', id::text, false) from b;
with s as (insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t13.a')::uuid, '1301', 'Ahmet Deneme') returning id)
select set_config('t13.ahmet', id::text, false) from s;

do $$
declare
  a uuid := current_setting('t13.a')::uuid;
  b uuid := current_setting('t13.b')::uuid;
  ahmet uuid := current_setting('t13.ahmet')::uuid;
  misafir uuid;
  yabanci uuid;
  hata boolean;
begin
  -- B'ye misafir olarak eklenir
  insert into students (course_id, ogrenci_no, ad_soyad, asil_id) values (b, '1301', 'Ahmet Deneme', ahmet) returning id into misafir;
  assert (select asil_id from students where id = misafir) = ahmet, 'HATA: misafir baglanmadi';

  -- Aynı şubeye bağlanamaz
  hata := false;
  begin
    insert into students (course_id, ogrenci_no, ad_soyad, asil_id) values (a, '1302', 'Kendi Subesi', ahmet);
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: ayni subeye misafir eklendi';

  -- Misafirin misafiri olamaz
  hata := false;
  begin
    insert into students (course_id, ogrenci_no, ad_soyad, asil_id) values (a, '1303', 'Zincir', misafir);
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: misafirin misafiri eklendi';

  -- Misafiri olan kayıt misafir yapılamaz
  insert into courses (ad, sube) values ('Misafir Dersi', 'C') returning id into yabanci;
  insert into students (course_id, ogrenci_no, ad_soyad) values (yabanci, '1399', 'Ucuncu') ;
  hata := false;
  begin
    update students set asil_id = (select id from students where course_id = yabanci) where id = ahmet;
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: misafiri olan kayit misafir yapildi';
end $$;

-- Başka hocanın öğrencisine bağlanamaz
set request.jwt.claims = '{"sub":"d2222222-2222-2222-2222-222222222222","email":"hoca13b@ornek.edu.tr"}';
with c as (insert into courses (ad) values ('Baska Hoca') returning id) select set_config('t13.c', id::text, false) from c;
do $$
declare hata boolean := false;
begin
  begin
    insert into students (course_id, ogrenci_no, ad_soyad, asil_id)
    values (current_setting('t13.c')::uuid, '1301', 'Hirsiz', current_setting('t13.ahmet')::uuid);
  exception when check_violation or insufficient_privilege then hata := true; end;
  assert hata, 'HATA: baska hocanin ogrencisine baglandi';
end $$;

-- Asıl silinince misafir de gider
set request.jwt.claims = '{"sub":"d1111111-1111-1111-1111-111111111111","email":"hoca13a@ornek.edu.tr"}';
do $$
begin
  delete from students where id = current_setting('t13.ahmet')::uuid;
  assert not exists (select 1 from students where asil_id = current_setting('t13.ahmet')::uuid), 'HATA: misafir silinmedi';
end $$;

reset request.jwt.claims;
reset role;
select '0013 tamam' as sonuc;
