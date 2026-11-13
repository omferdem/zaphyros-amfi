-- YALNIZCA YEREL TEST İÇİN. Adlar ve numaralar uydurmadır. Düz SQL: hepsi geçerse son satırda "0022 tamam" yazar.
-- Beklenen: derse (yoklamaya) girmiş cihaz, kod ve numara girmeden açık quizi görür ve başlatır;
-- yoklaması olmayan cihaz kimliksiz görünür ve başlatamaz; bitiren öğrenci "bitti" görür; quiz yoksa boş döner.

insert into auth.users (id, email) values ('c2222222-2222-2222-2222-222222222201', 'hoca22@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca22@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2222222-2222-2222-2222-222222222201","email":"hoca22@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Oturum Quiz Dersi') returning id, subject_id)
select set_config('t22.ders', id::text, false), set_config('t22.icerik', subject_id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('t22.ders')::uuid, '22001', 'Ayşe Oturum'),
  (current_setting('t22.ders')::uuid, '22002', 'Mehmet Oturum');
with q as (insert into questions (subject_id, soru, dogru, yanlislar)
           values (current_setting('t22.icerik')::uuid, 'Soru?', 'Doğru', array['Yanlış a', 'Yanlış b']) returning id)
select set_config('t22.s1', id::text, false) from q;
with o as (insert into sessions (course_id) values (current_setting('t22.ders')::uuid) returning id)
select set_config('t22.oturum', id::text, false) from o;
reset role;
insert into attendance (session_id, student_id, cihaz_id, yontem)
select current_setting('t22.oturum')::uuid, id, 'cihaz-oturum-001', 'qr' from students where ogrenci_no = '22001' and course_id = current_setting('t22.ders')::uuid;

-- Quiz henüz yok
set role anon;
do $$
begin
  assert public.oturum_quizi(current_setting('t22.oturum')::uuid, 'cihaz-oturum-001') -> 'quiz' = 'null'::jsonb, 'HATA: quiz yokken bos donmedi';
  assert public.oturum_quizi_baslat(current_setting('t22.oturum')::uuid, 'cihaz-oturum-001') ->> 'hata' = 'quiz_yok', 'HATA: quiz_yok';
end $$;

reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"c2222222-2222-2222-2222-222222222201","email":"hoca22@ornek.edu.tr"}';
do $$
declare v jsonb;
begin
  v := quiz_olustur(current_setting('t22.ders')::uuid, 'Oturum quizi', 5, array[current_setting('t22.s1')::uuid], false);
  perform set_config('t22.quiz', v ->> 'id', false);
end $$;

reset request.jwt.claims;
set role anon;
do $$
declare
  v jsonb;
  o uuid := current_setting('t22.oturum')::uuid;
begin
  v := public.oturum_quizi(o, 'cihaz-oturum-001');
  assert v -> 'quiz' ->> 'baslik' = 'Oturum quizi' and (v -> 'quiz' ->> 'kimlik')::boolean and not (v -> 'quiz' ->> 'bitti')::boolean, 'HATA: kimlikli cihaz: ' || v::text;
  -- Yoklaması olmayan cihaz kimliksiz
  v := public.oturum_quizi(o, 'cihaz-oturum-002');
  assert not (v -> 'quiz' ->> 'kimlik')::boolean, 'HATA: yoklamasiz cihaz kimlikli gorundu: ' || v::text;
  assert public.oturum_quizi_baslat(o, 'cihaz-oturum-002') ->> 'hata' = 'yoklama_yok', 'HATA: yoklamasiz basladi';
  assert public.oturum_quizi(o, 'kisa') ->> 'hata' = 'cihaz_gecersiz', 'HATA: cihaz kontrolu';
  assert public.oturum_quizi_baslat(gen_random_uuid(), 'cihaz-oturum-001') ->> 'hata' = 'oturum_yok', 'HATA: oturum_yok';

  v := public.oturum_quizi_baslat(o, 'cihaz-oturum-001');
  assert v ->> 'attempt' is not null and jsonb_array_length(v -> 'sorular') = 1, 'HATA: baslatilamadi: ' || v::text;
  perform set_config('t22.attempt', v ->> 'attempt', false);
  -- Tekrar çağrı kaldığı yerden devam ettirir
  assert (public.oturum_quizi_baslat(o, 'cihaz-oturum-001') ->> 'attempt') = v ->> 'attempt', 'HATA: devam edilemedi';
  perform quiz_bitir((v ->> 'attempt')::uuid, 'cihaz-oturum-001');
  assert (public.oturum_quizi(o, 'cihaz-oturum-001') -> 'quiz' ->> 'bitti')::boolean, 'HATA: bitti gorunmedi';
  assert public.oturum_quizi_baslat(o, 'cihaz-oturum-001') ->> 'hata' = 'zaten_bitti', 'HATA: bitince yeniden basladi';
end $$;

reset role;
select '0022 tamam' as sonuc;
