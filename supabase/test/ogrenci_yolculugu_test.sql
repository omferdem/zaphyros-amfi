-- YALNIZCA YEREL TEST İÇİN. Adlar ve numaralar uydurmadır. Düz SQL: hepsi geçerse son satırda "ogrenci yolculugu tamam" yazar.
-- Bir öğrencinin derste gördüğü yolun tamamı, telefonun çağırdığı RPC'lerle sırayla:
-- yoklama -> takım seçimi -> açık uçlu cevap -> bilgi yarışması cevabı -> sonucum -> zombi piramidi verisi -> kodsuz quiz -> quiz bitirme.
-- Bir sürümde bu zincirin herhangi bir halkası kırılırsa test hata verir ve yayın durur.

insert into auth.users (id, email) values ('c9999999-9999-9999-9999-999999999901', 'hocayolculuk@ornek.edu.tr');
insert into public.teachers (eposta) values ('hocayolculuk@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c9999999-9999-9999-9999-999999999901","email":"hocayolculuk@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Yolculuk Dersi') returning id, subject_id)
select set_config('ty.ders', id::text, false), set_config('ty.icerik', subject_id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('ty.ders')::uuid, '99001', 'Ayşe Yolculuk'),
  (current_setting('ty.ders')::uuid, '99002', 'Mehmet Yolculuk');
with l as (insert into lessons (subject_id, ad) values (current_setting('ty.icerik')::uuid, 'Yolculuk') returning id)
select set_config('ty.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('ty.icerik')::uuid, 'Soru bir?', 'Doğru', array['Yanlış a', 'Yanlış b']) returning id)
select set_config('ty.soru1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('ty.icerik')::uuid, 'Soru iki?', 'Doğru', array['Yanlış a', 'Yanlış b']) returning id)
select set_config('ty.soru2', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values (current_setting('ty.akis')::uuid, 1, 'fikir', '{"soru":"Açık uçlu?","mod":"acik"}') returning id)
select set_config('ty.acik', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('ty.akis')::uuid, 2, 'soru', current_setting('ty.soru1')::uuid) returning id)
select set_config('ty.adim1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('ty.akis')::uuid, 3, 'soru', current_setting('ty.soru2')::uuid) returning id)
select set_config('ty.adim2', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('ty.ders')::uuid, current_setting('ty.akis')::uuid) returning id)
select set_config('ty.sid', id::text, false) from s;
select set_config('ty.kumanda', kumanda_anahtari(current_setting('ty.sid')::uuid), false);
-- Hoca takım modunu açar (3 takım)
select takim_ayarla(current_setting('ty.sid')::uuid, null, 3);

-- Yoklama: öğrenciler karekodla girmiş sayılır (token akışı 0021 testinde ayrıca sınanır)
reset request.jwt.claims;
reset role;
insert into attendance (session_id, student_id, cihaz_id, yontem)
select current_setting('ty.sid')::uuid, id, 'cihaz-yolculuk-' || ogrenci_no, 'qr' from students where course_id = current_setting('ty.ders')::uuid;

set role anon;
do $$
declare
  sid uuid := current_setting('ty.sid')::uuid;
  c1  text := 'cihaz-yolculuk-99001';
  c2  text := 'cihaz-yolculuk-99002';
  v   jsonb;
begin
  -- Takım seçimi
  assert takim_sec(sid, c1, 1) ->> 'durum' = 'tamam', 'HATA: takim secimi: ' || takim_sec(sid, c1, 1)::text;
  assert takim_sec(sid, c2, 2) ->> 'durum' = 'tamam', 'HATA: takim secimi 2';
  -- Ders durumu telefonda: açık uçlu etkinlik
  v := ders_durumu(sid);
  assert v -> 'adim' ->> 'tur' is null, 'HATA: yoklama ekraninda adim varmis';
end $$;

-- Hoca açık uçlu adıma geçer
reset role;
update sessions set aktif_adim = current_setting('ty.acik')::uuid where id = current_setting('ty.sid')::uuid;
set role anon;
do $$
declare
  sid uuid := current_setting('ty.sid')::uuid;
  v   jsonb;
begin
  v := ders_durumu(sid);
  assert v -> 'adim' ->> 'tur' = 'fikir' and v -> 'adim' ->> 'mod' = 'acik', 'HATA: acik uclu adim telefonda gorunmedi: ' || v::text;
  assert katki_gonder(sid, 'cihaz-yolculuk-99001', 'Bence akıl ve vahiy birbirini tamamlar çünkü ikisi de aynı hakikate yönelir.') ->> 'durum' = 'tamam', 'HATA: acik uclu cevap';
  assert katki_gonder(sid, 'cihaz-yolculuk-99001', 'ikinci cevap') ->> 'hata' = 'sinir', 'HATA: ikinci cevap sinirlanmadi';
  v := ders_durumu(sid);
  assert (v -> 'adim' ->> 'cevap_sayisi')::int = 1, 'HATA: cevap sayisi: ' || v::text;
end $$;

-- Hoca ilk soruya geçer; iki öğrenci cevaplar (biri doğru, biri yanlış)
reset role;
update sessions set aktif_adim = current_setting('ty.adim1')::uuid where id = current_setting('ty.sid')::uuid;
set role anon;
do $$
declare
  sid uuid := current_setting('ty.sid')::uuid;
  v   jsonb;
  dogru_i int;
  yanlis_i int;
begin
  v := ders_durumu(sid);
  assert v -> 'adim' ->> 'tur' = 'soru', 'HATA: soru telefonda gorunmedi: ' || v::text;
  assert position('"dogru"' in (v -> 'adim')::text) = 0, 'HATA: dogru cevap telefona sizdi';
  select i - 1 into dogru_i from jsonb_array_elements_text(v -> 'adim' -> 'secenekler') with ordinality t(x, i) where x = 'Doğru';
  yanlis_i := (dogru_i + 1) % 3;
  assert cevap_ver(sid, 'cihaz-yolculuk-99001', dogru_i) ->> 'durum' = 'tamam', 'HATA: dogru cevap alinmadi';
  assert cevap_ver(sid, 'cihaz-yolculuk-99002', yanlis_i) ->> 'durum' = 'tamam', 'HATA: yanlis cevap alinmadi';
  assert cevap_ver(sid, 'cihaz-yolculuk-99001', dogru_i) ->> 'hata' = 'zaten_cevapladin', 'HATA: ikinci cevap kabul edildi';
end $$;

-- Hoca sonucu açar; öğrenci kendi sonucunu görür; takım tablosu ve zombi verisi oluşur
reset role;
update sessions set soru_durum = 'sonuc' where id = current_setting('ty.sid')::uuid;
set role anon;
do $$
declare
  sid uuid := current_setting('ty.sid')::uuid;
  v   jsonb;
begin
  v := benim_sonucum(sid, 'cihaz-yolculuk-99001');
  assert (v ->> 'dogru')::boolean is true and (v ->> 'puan')::int > 0, 'HATA: benim sonucum: ' || v::text;
  v := benim_sonucum(sid, 'cihaz-yolculuk-99002');
  assert (v ->> 'dogru')::boolean is false, 'HATA: yanlis cevabin sonucu: ' || v::text;
  v := zombi_goster(sid, current_setting('ty.kumanda'));
  assert jsonb_array_length(v -> 'oyuncular') = 2, 'HATA: zombi oyuncu sayisi: ' || v::text;
  assert (v -> 'sorular' -> 0 ->> 'acildi')::boolean, 'HATA: acilan soru zombi verisinde yok: ' || v::text;
  v := takim_goster(sid, current_setting('ty.kumanda'));
  assert (v -> 'takimlar' -> 0 ->> 'dogru')::int = 1, 'HATA: takim dogru sayisi: ' || v::text;
end $$;

-- Quiz: hoca açar, yoklamalı öğrenci kod girmeden başlatır ve bitirir
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"c9999999-9999-9999-9999-999999999901","email":"hocayolculuk@ornek.edu.tr"}';
select quiz_olustur(current_setting('ty.ders')::uuid, 'Yolculuk quizi', 5, array[current_setting('ty.soru1')::uuid, current_setting('ty.soru2')::uuid], false);
reset request.jwt.claims;
reset role;
set role anon;
do $$
declare
  sid uuid := current_setting('ty.sid')::uuid;
  v   jsonb;
begin
  v := oturum_quizi(sid, 'cihaz-yolculuk-99001');
  assert v -> 'quiz' ->> 'baslik' = 'Yolculuk quizi' and (v -> 'quiz' ->> 'kimlik')::boolean, 'HATA: quiz bandi: ' || v::text;
  v := oturum_quizi_baslat(sid, 'cihaz-yolculuk-99001');
  assert v ->> 'attempt' is not null and jsonb_array_length(v -> 'sorular') = 2, 'HATA: quiz baslamadi: ' || v::text;
  assert quiz_bitir((v ->> 'attempt')::uuid, 'cihaz-yolculuk-99001') ->> 'durum' = 'tamam', 'HATA: quiz bitmedi';
  assert (oturum_quizi(sid, 'cihaz-yolculuk-99001') -> 'quiz' ->> 'bitti')::boolean, 'HATA: bitti gorunmedi';
end $$;

reset role;
select 'ogrenci yolculugu tamam' as sonuc;
