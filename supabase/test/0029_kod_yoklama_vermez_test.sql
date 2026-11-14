-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0029 tamam" yazar.
-- Beklenen: projeksiyonlu derste kod yoklama bileti vermez (karekod verir); projeksiyonsuz derste (telefon_modu) kod bilet verir;
-- yoklama kapalıysa hiçbirinde bilet yoktur.

insert into auth.users (id, email) values ('c2929292-2929-2929-2929-292929292901', 'hoca29@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca29@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2929292-2929-2929-2929-292929292901","email":"hoca29@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Kod Yoklama Dersi') returning id) select set_config('t29.ders', id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values (current_setting('t29.ders')::uuid, '29001', 'Deniz Kod');
with s as (insert into sessions (course_id, yoklama_acik, telefon_modu) values (current_setting('t29.ders')::uuid, true, false) returning id) select set_config('t29.perde', id::text, false) from s;
with s as (insert into sessions (course_id, yoklama_acik, telefon_modu, basladi) values (current_setting('t29.ders')::uuid, true, true, now() + interval '1 minute') returning id) select set_config('t29.telefon', id::text, false) from s;
select set_config('t29.kod_perde', ders_kodu(current_setting('t29.perde')::uuid) ->> 'kod', false);
select set_config('t29.kod_telefon', ders_kodu(current_setting('t29.telefon')::uuid) ->> 'kod', false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare v jsonb;
begin
  -- Projeksiyonlu ders: kod derse alır ama bilet vermez
  v := kodla_katil(current_setting('t29.kod_perde'), 'cihaz-kod-2900001');
  assert v ->> 'oturum' = current_setting('t29.perde') and (v ->> 'yoklama')::boolean and not v ? 'bilet', 'HATA: projeksiyonlu derste kod bilet verdi: ' || v::text;
  -- Projeksiyonsuz ders: kod bilet verir ve numara girilebilir
  v := kodla_katil(current_setting('t29.kod_telefon'), 'cihaz-kod-2900002');
  assert v ->> 'oturum' = current_setting('t29.telefon') and v ? 'bilet', 'HATA: projeksiyonsuz derste bilet donmedi: ' || v::text;
  v := check_in(current_setting('t29.telefon')::uuid, v ->> 'bilet', 'cihaz-kod-2900002', '29001');
  assert v ->> 'durum' = 'tamam', 'HATA: projeksiyonsuz derste kodla yoklama girilemedi: ' || v::text;
end $$;
reset role;

-- Yoklama kapanınca projeksiyonsuz derste de bilet yoktur
update public.sessions set yoklama_acik = false where id = current_setting('t29.telefon')::uuid;
set role anon;
do $$
declare v jsonb;
begin
  v := kodla_katil(current_setting('t29.kod_telefon'), 'cihaz-kod-2900003');
  assert v ->> 'oturum' = current_setting('t29.telefon') and not (v ->> 'yoklama')::boolean and not v ? 'bilet', 'HATA: yoklama kapaliyken bilet dondu: ' || v::text;
end $$;
reset role;

select '0029 tamam' as sonuc;
