-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0037 tamam" yazar.
-- Beklenen: öğrenci yalnızca kendi fikrini siler ve hakkı geri gelir; başkasının fikri silinmez; kapalıyken silinmez.
-- Hocayla yarış: sınıf cevabı olmasa da hocanın doğru cevabı geçilen soruda skora yazılır.

insert into auth.users (id, email) values ('c3737373-3737-3737-3737-373737373701', 'hoca37@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca37@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3737373-3737-3737-3737-373737373701","email":"hoca37@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Katki Dersi') returning id, subject_id)
select set_config('t37.ders', id::text, false), set_config('t37.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t37.icerik')::uuid, 'Katki') returning id)
select set_config('t37.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur, ayar) values
  (current_setting('t37.akis')::uuid, 1, 'fikir', '{"soru":"Bir fikir yaz"}') returning id)
select set_config('t37.fikir', id::text, false) from a;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t37.icerik')::uuid, 'Soru?', 'A', array['B']) returning id)
select set_config('t37.soru', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t37.akis')::uuid, 2, 'soru', current_setting('t37.soru')::uuid) returning id)
select set_config('t37.adim', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id, aktif_adim) values (current_setting('t37.ders')::uuid, current_setting('t37.akis')::uuid, current_setting('t37.fikir')::uuid) returning id)
select set_config('t37.sid', id::text, false) from s;
select set_config('t37.k', kumanda_anahtari(current_setting('t37.sid')::uuid), false);
reset request.jwt.claims;
reset role;

set role anon;
do $$
declare
  sid uuid := current_setting('t37.sid')::uuid;
  v jsonb;
begin
  assert katki_gonder(sid, 'cihaz-sil-0001', 'Adalet') ->> 'durum' = 'tamam', 'HATA: fikir 1';
  assert katki_gonder(sid, 'cihaz-sil-0001', 'Özgürlük') ->> 'durum' = 'tamam', 'HATA: fikir 2';
  assert katki_gonder(sid, 'cihaz-sil-0002', 'Adalet') ->> 'durum' = 'tamam', 'HATA: baska ogrenci';
  v := katki_sil(sid, 'cihaz-sil-0001', ' adalet ');
  assert v ->> 'durum' = 'tamam' and (v ->> 'kalan')::int = 2, 'HATA: silme: ' || v::text;
  -- Hak geri gelir: yeniden yazabilir
  assert katki_gonder(sid, 'cihaz-sil-0001', 'Adalet') ->> 'durum' = 'tamam', 'HATA: hak geri gelmedi';
  -- Yabancı cihaz kimliği kendi fikrini silemez diye başkasınınkini de silemez
  v := katki_sil(sid, 'cihaz-sil-0003', 'Özgürlük');
  assert katki_sil(sid, 'kisa', 'x') ->> 'hata' = 'cihaz_gecersiz', 'HATA: gecersiz cihaz';
end $$;
reset role;
do $$
begin
  assert (select count(*) from public.contributions where session_id = current_setting('t37.sid')::uuid) = 3, 'HATA: fikir sayisi';
end $$;

-- Kapalıyken silinemez
update public.sessions set soru_durum = 'sonuc' where id = current_setting('t37.sid')::uuid;
set role anon;
do $$
begin
  assert katki_sil(current_setting('t37.sid')::uuid, 'cihaz-sil-0001', 'Adalet') ->> 'hata' = 'kapali', 'HATA: kapaliyken silindi';
end $$;
reset role;

-- Hocayla yarış: sınıf cevabı yok, hoca doğru bildi, soru geçildi
insert into public.hoca_cevaplari (session_id, step_id, secim)
  values (current_setting('t37.sid')::uuid, current_setting('t37.adim')::uuid, 'A');
update public.sessions set aktif_adim = current_setting('t37.fikir')::uuid where id = current_setting('t37.sid')::uuid;
do $$
declare v jsonb;
begin
  v := hoca_yaris_goster(current_setting('t37.sid')::uuid, current_setting('t37.k'));
  assert (v ->> 'hoca')::int = 1 and (v ->> 'soru')::int = 1, 'HATA: hocanin puani yazilmadi: ' || v::text;
end $$;

select '0037 tamam' as sonuc;
