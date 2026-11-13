-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0025 tamam" yazar.
-- Beklenen: açık uçlu soruda cevaplar hoca yansıtana kadar perdeye (ders_durumu) gitmez, kumanda görür; yansıtınca görünür;
-- süre verilmişse dolunca cevap alınmaz ve kalan süre döner; süresiz ve diğer kipler eskisi gibi.

insert into auth.users (id, email) values ('c2525252-2525-2525-2525-252525252501', 'hoca25@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca25@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2525252-2525-2525-2525-252525252501","email":"hoca25@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Süre Dersi') returning id, subject_id)
select set_config('t25.ders', id::text, false), set_config('t25.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t25.icerik')::uuid, 'Süreli') returning id)
select set_config('t25.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t25.akis')::uuid, 1, 'fikir', '{"soru":"Açık?","mod":"acik","sure_sn":60}') returning id)
select set_config('t25.acik', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('t25.akis')::uuid, 2, 'fikir', '{"soru":"Bulut?"}') returning id)
select set_config('t25.bulut', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t25.ders')::uuid, current_setting('t25.akis')::uuid) returning id)
select set_config('t25.sid', id::text, false) from s;
select set_config('t25.kumanda', kumanda_anahtari(current_setting('t25.sid')::uuid), false);
update sessions set aktif_adim = current_setting('t25.acik')::uuid where id = current_setting('t25.sid')::uuid;

reset request.jwt.claims;
reset role;
set role anon;
do $$
declare
  sid uuid := current_setting('t25.sid')::uuid;
  v   jsonb;
begin
  assert katki_gonder(sid, 'cihaz-sure-00001', 'Birinci öğrencinin açık uçlu cevabı') ->> 'durum' = 'tamam', 'HATA: cevap alinmadi';
  v := ders_durumu(sid);
  assert (v -> 'adim' ->> 'sure_sn')::int = 60, 'HATA: sure_sn donmedi: ' || v::text;
  assert (v -> 'adim' ->> 'kalan_ms')::int between 55000 and 60000, 'HATA: kalan_ms: ' || v::text;
  assert (v -> 'adim' ->> 'gizli_cevap')::boolean, 'HATA: gizli_cevap false: ' || v::text;
  assert jsonb_array_length(v -> 'adim' -> 'fikirler') = 0, 'HATA: cevaplar yansitilmadan perdeye gitti: ' || v::text;
  assert (v -> 'adim' ->> 'cevap_sayisi')::int = 1, 'HATA: cevap sayisi gorunmeli: ' || v::text;
  -- Kumanda cevapları hep görür
  v := kumanda_durumu(sid, current_setting('t25.kumanda'));
  assert jsonb_array_length(v -> 'adim' -> 'fikirler') = 1, 'HATA: kumanda cevabi gormedi: ' || v::text;
end $$;

-- Hoca yansıtır
reset role;
update sessions set soru_durum = 'sonuc' where id = current_setting('t25.sid')::uuid;
set role anon;
do $$
declare v jsonb;
begin
  v := ders_durumu(current_setting('t25.sid')::uuid);
  assert jsonb_array_length(v -> 'adim' -> 'fikirler') = 1 and not (v -> 'adim' ->> 'gizli_cevap')::boolean, 'HATA: yansitinca gorunmedi: ' || v::text;
  assert katki_gonder(current_setting('t25.sid')::uuid, 'cihaz-sure-00002', 'Geç cevap') ->> 'hata' = 'kapali', 'HATA: yansitilmis soruya cevap alindi';
end $$;

-- Süre dolar: soru_basladi geriye çekilir
reset role;
update sessions set soru_durum = 'acik', soru_basladi = clock_timestamp() - interval '70 seconds' where id = current_setting('t25.sid')::uuid;
set role anon;
do $$
declare v jsonb;
begin
  assert katki_gonder(current_setting('t25.sid')::uuid, 'cihaz-sure-00003', 'Süre bittikten sonra') ->> 'hata' = 'sure_bitti', 'HATA: sure bitince cevap alindi';
  v := ders_durumu(current_setting('t25.sid')::uuid);
  assert (v -> 'adim' ->> 'kalan_ms')::int = 0, 'HATA: kalan_ms sifir olmali: ' || v::text;
end $$;

-- Süresiz bulut eskisi gibi: cevap hemen görünür, süre alanı yok
reset role;
update sessions set aktif_adim = current_setting('t25.bulut')::uuid where id = current_setting('t25.sid')::uuid;
set role anon;
do $$
declare v jsonb;
begin
  assert katki_gonder(current_setting('t25.sid')::uuid, 'cihaz-sure-00004', 'kelime') ->> 'durum' = 'tamam', 'HATA: bulut cevabi';
  v := ders_durumu(current_setting('t25.sid')::uuid);
  assert jsonb_array_length(v -> 'adim' -> 'fikirler') = 1 and (v -> 'adim' -> 'sure_sn') = 'null'::jsonb, 'HATA: bulut: ' || v::text;
end $$;

reset role;
select '0025 tamam' as sonuc;
