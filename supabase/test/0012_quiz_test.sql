-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0012 tamam" yazar.
-- Beklenen: quiz yalnızca dersin kendi sorularıyla açılır; öğrenci listede olmalı, tek cihazdan girer;
-- doğru cevap öğrenciye gitmez; süre ve kapanış sunucuda uygulanır; öğrenci puanı yalnızca izin varsa görür;
-- hoca kendi quizini okur, yabancı hoca göremez; cevaplar öğrenciye bağlı kaydedilir.

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'hoca12@ornek.edu.tr'),
  ('c2222222-2222-2222-2222-222222222222', 'yabanci12@ornek.com');
insert into public.teachers (eposta) values ('hoca12@ornek.edu.tr'), ('yabanci12@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","email":"hoca12@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Quiz Dersi') returning id, subject_id)
select set_config('t12.ders', id::text, false), set_config('t12.icerik', subject_id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('t12.ders')::uuid, '12001', 'Ayşe Quiz'),
  (current_setting('t12.ders')::uuid, '12002', 'Mehmet Quiz');

with q as (insert into questions (subject_id, soru, dogru, yanlislar, ek)
           values (current_setting('t12.icerik')::uuid, 'Soru bir?', 'Doğru bir', array['Yanlış a', 'Yanlış b', 'Yanlış c'], '{"outcome":"K1"}') returning id)
select set_config('t12.s1', id::text, false) from q;
with q as (insert into questions (subject_id, soru, dogru, yanlislar)
           values (current_setting('t12.icerik')::uuid, 'Soru iki?', 'Doğru iki', array['Yanlış d']) returning id)
select set_config('t12.s2', id::text, false) from q;

-- Başka içeriğin sorusu quize girmez
reset role;
do $$
declare
  v_icerik uuid;
  v_soru   uuid;
begin
  insert into courses (ad, teacher_id) values ('Başka Ders', 'c2222222-2222-2222-2222-222222222222') returning subject_id into v_icerik;
  insert into questions (subject_id, soru, dogru, yanlislar) values (v_icerik, 'Başkası?', 'x', array['y']) returning id into v_soru;
  perform set_config('t12.yabanci_soru', v_soru::text, false);
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","email":"hoca12@ornek.edu.tr"}';

do $$
declare v jsonb;
begin
  begin
    perform quiz_olustur(current_setting('t12.ders')::uuid, 'X', 10, array[current_setting('t12.yabanci_soru')::uuid]);
    raise exception 'HATA: baska icerigin sorusuyla quiz acildi';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform quiz_olustur(current_setting('t12.ders')::uuid, 'X', 10, '{}');
    raise exception 'HATA: sorusuz quiz acildi';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform quiz_olustur(current_setting('t12.ders')::uuid, 'X', 0, array[current_setting('t12.s1')::uuid]);
    raise exception 'HATA: 0 dakikalik quiz acildi';
  exception when check_violation then null;
  end;

  v := quiz_olustur(current_setting('t12.ders')::uuid, 'Habersiz quiz', 10, array[current_setting('t12.s1')::uuid, current_setting('t12.s2')::uuid], false);
  perform set_config('t12.quiz', v ->> 'id', false);
  perform set_config('t12.kod', v ->> 'kod', false);
  assert v ->> 'kod' ~ '^[0-9]{6}$', 'HATA: kod bicimi: ' || v::text;
end $$;

-- ---------------------------------------------------------------- ANON (öğrenci)
reset request.jwt.claims;
set role anon;
do $$
declare
  v       jsonb;
  kod     text := current_setting('t12.kod');
  at      uuid;
  s1      uuid := current_setting('t12.s1')::uuid;
  secenek jsonb;
  dogru_i int;
  yanlis_i int;
begin
  begin
    perform 1 from quiz_answers;
    raise exception 'HATA: anon quiz cevaplarini okudu';
  exception when insufficient_privilege then null;
  end;

  assert quiz_bul(kod) ->> 'baslik' = 'Habersiz quiz', 'HATA: quiz_bul';
  assert quiz_bul('000000') ->> 'hata' = 'kod_yanlis', 'HATA: yanlis kod bulundu';

  assert quiz_baslat(kod, '12001', 'kisa') ->> 'hata' = 'cihaz_gecersiz', 'HATA: cihaz';
  assert quiz_baslat(kod, '!!', 'cihaz-quiz-0001') ->> 'hata' = 'numara_gecersiz', 'HATA: numara';
  assert quiz_baslat('999999', '12001', 'cihaz-quiz-0001') ->> 'hata' = 'kod_yanlis', 'HATA: kod';
  assert quiz_baslat(kod, '99999', 'cihaz-quiz-0001') ->> 'hata' = 'liste_disi', 'HATA: liste disi';

  v := quiz_baslat(kod, ' 12001 ', 'cihaz-quiz-0001');
  assert v ->> 'attempt' is not null, 'HATA: baslatilamadi: ' || v::text;
  at := (v ->> 'attempt')::uuid;
  assert jsonb_array_length(v -> 'sorular') = 2, 'HATA: soru sayisi: ' || v::text;
  assert (v ->> 'kalan_ms')::int between 590000 and 600000, 'HATA: kalan sure: ' || v::text;
  -- Doğru cevap hiçbir yerde gönderilmez
  assert position('dogru' in v::text) = 0 or position('"dogru"' in v::text) = 0, 'HATA: dogru anahtari sizdi';
  perform set_config('t12.attempt', at::text, false);

  -- Aynı öğrenci aynı cihazdan devam eder; başka cihaz ve başka numara kuralları
  assert (quiz_baslat(kod, '12001', 'cihaz-quiz-0001') ->> 'attempt')::uuid = at, 'HATA: devam edilemedi';
  assert quiz_baslat(kod, '12001', 'cihaz-quiz-0002') ->> 'hata' = 'numara_kullanildi', 'HATA: baska cihazdan ayni numara';
  assert quiz_baslat(kod, '12002', 'cihaz-quiz-0001') ->> 'hata' = 'cihaz_kullanildi', 'HATA: ayni cihazdan ikinci numara';

  -- Birinci sorunun şıklarında doğruyu bul (öğrenci bilmez; test için)
  select e into secenek from jsonb_array_elements(v -> 'sorular') e where e ->> 'id' = s1::text;
  select i - 1 into dogru_i from jsonb_array_elements_text(secenek -> 'secenekler') with ordinality t(x, i) where x = 'Doğru bir';
  yanlis_i := (dogru_i + 1) % 4;

  assert quiz_cevapla(at, 'baska-cihaz-01', s1, dogru_i) ->> 'hata' = 'kimlik_yok', 'HATA: baska cihazla cevap';
  assert quiz_cevapla(at, 'cihaz-quiz-0001', s1, 9) ->> 'hata' = 'secim_gecersiz', 'HATA: gecersiz secim';
  assert quiz_cevapla(at, 'cihaz-quiz-0001', current_setting('t12.yabanci_soru')::uuid, 0) ->> 'hata' = 'soru_yok', 'HATA: quiz disi soru';
  assert quiz_cevapla(at, 'cihaz-quiz-0001', s1, yanlis_i) ->> 'durum' = 'tamam', 'HATA: cevap';
  -- Süre içinde fikir değiştirilir: tek satır kalır
  assert quiz_cevapla(at, 'cihaz-quiz-0001', s1, dogru_i) ->> 'durum' = 'tamam', 'HATA: cevap degistirme';

  -- Sayfa yenilenirse cevap geri gelir
  v := quiz_baslat(kod, '12001', 'cihaz-quiz-0001');
  select e into secenek from jsonb_array_elements(v -> 'sorular') e where e ->> 'id' = s1::text;
  assert (secenek ->> 'secim')::int = dogru_i, 'HATA: kayitli cevap donmedi: ' || secenek::text;

  -- İzin yoksa puan dönmez
  v := quiz_bitir(at, 'cihaz-quiz-0001');
  assert v ->> 'durum' = 'tamam' and not (v ? 'dogru'), 'HATA: puan izinsiz dondu: ' || v::text;
  assert quiz_cevapla(at, 'cihaz-quiz-0001', s1, yanlis_i) ->> 'hata' = 'bitti', 'HATA: bitince cevap';
  assert quiz_baslat(kod, '12001', 'cihaz-quiz-0001') ->> 'hata' = 'zaten_bitti', 'HATA: bitince yeniden basladi';

  -- İkinci öğrenci: yalnızca bir soruya cevap verir, sonra hoca kapatır
  v := quiz_baslat(kod, '12002', 'cihaz-quiz-0002');
  perform set_config('t12.attempt2', v ->> 'attempt', false);
  assert quiz_cevapla((v ->> 'attempt')::uuid, 'cihaz-quiz-0002', s1, 0) ->> 'durum' = 'tamam', 'HATA: ikinci ogrenci cevabi';
end $$;

-- ---------------------------------------------------------------- HOCA: okur ve kapatır
set role authenticated;
set request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","email":"hoca12@ornek.edu.tr"}';
do $$
declare
  qid uuid := current_setting('t12.quiz')::uuid;
begin
  assert (select count(*) from quiz_attempts where quiz_id = qid) = 2, 'HATA: hoca denemeleri goremiyor';
  assert (select count(*) from quiz_answers where quiz_id = qid) = 2, 'HATA: hoca cevaplari goremiyor';
  -- Birinci öğrenci doğru işaretledi; ikincinin 0. şıkkı karışık sırada tesadüfen doğru olabilir
  assert (select count(*) from quiz_answers where quiz_id = qid and dogru) between 1 and 2, 'HATA: dogru sayisi';
  assert (select dogru from quiz_answers a join students s on s.id = a.student_id where a.quiz_id = qid and s.ogrenci_no = '12001'), 'HATA: birinci ogrencinin dogrusu';
  assert (select count(*) from quiz_attempts where quiz_id = qid and bitti is null) = 1, 'HATA: yarida kalan deneme';
  assert exists (select 1 from quiz_answers a join students s on s.id = a.student_id where a.quiz_id = qid and s.ogrenci_no = '12001'), 'HATA: cevap ogrenciye bagli degil';

  perform quiz_kapat(qid);
  assert (select durum from quizzes where id = qid) = 'kapali', 'HATA: quiz kapanmadi';
  assert (select count(*) from quiz_attempts where quiz_id = qid and bitti is null) = 0, 'HATA: kapaninca yarida kalan deneme bitmedi';
end $$;

reset request.jwt.claims;
set role anon;
do $$
begin
  assert quiz_bul(current_setting('t12.kod')) ->> 'hata' = 'kod_yanlis', 'HATA: kapali quiz bulundu';
  assert quiz_baslat(current_setting('t12.kod'), '12002', 'cihaz-quiz-0002') ->> 'hata' = 'kod_yanlis', 'HATA: kapali quize girildi';
  assert quiz_cevapla(current_setting('t12.attempt2')::uuid, 'cihaz-quiz-0002', current_setting('t12.s2')::uuid, 0) ->> 'hata' = 'bitti', 'HATA: kapali quizde cevap';
end $$;

-- Süre dolumu ve sonucu gösterme izni: yeni bir quiz
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"c1111111-1111-1111-1111-111111111111","email":"hoca12@ornek.edu.tr"}';
do $$
declare v jsonb;
begin
  v := quiz_olustur(current_setting('t12.ders')::uuid, 'Sonuclu quiz', 5, array[current_setting('t12.s1')::uuid, current_setting('t12.s2')::uuid], true);
  perform set_config('t12.kod2', v ->> 'kod', false);
  perform set_config('t12.quiz2', v ->> 'id', false);
end $$;
reset request.jwt.claims;
set role anon;
do $$
declare
  v   jsonb;
  at  uuid;
  s1  uuid := current_setting('t12.s1')::uuid;
begin
  v := quiz_baslat(current_setting('t12.kod2'), '12001', 'cihaz-quiz-0001');
  assert v ->> 'attempt' is not null, 'HATA: ikinci quiz baslamadi: ' || v::text;
  at := (v ->> 'attempt')::uuid;
  assert quiz_cevapla(at, 'cihaz-quiz-0001', s1, 0) ->> 'durum' = 'tamam', 'HATA: ikinci quiz cevabi';
  v := quiz_bitir(at, 'cihaz-quiz-0001');
  assert (v ->> 'toplam')::int = 2 and v ? 'dogru', 'HATA: izinli quizde puan donmedi: ' || v::text;
end $$;

-- Süre dolduysa (deneme 6 dakika önce başlamış gibi) cevap alınmaz
reset role;
update quiz_attempts set basladi = now() - interval '6 minutes' where quiz_id = current_setting('t12.quiz2')::uuid;
update quiz_attempts set bitti = null where quiz_id = current_setting('t12.quiz2')::uuid;
set role anon;
do $$
begin
  assert quiz_cevapla((select id from public.quiz_attempts where quiz_id = current_setting('t12.quiz2')::uuid limit 1), 'cihaz-quiz-0001', current_setting('t12.s2')::uuid, 0) ->> 'hata' = 'sure_bitti', 'HATA: sure dolduktan sonra cevap';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- YABANCI HOCA
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"c2222222-2222-2222-2222-222222222222","email":"yabanci12@ornek.com"}';
do $$
begin
  assert (select count(*) from quizzes) = 0, 'HATA: yabanci quiz goruyor';
  assert (select count(*) from quiz_answers) = 0, 'HATA: yabanci cevap goruyor';
  assert (select count(*) from quiz_attempts) = 0, 'HATA: yabanci deneme goruyor';
  begin
    perform quiz_kapat(current_setting('t12.quiz2')::uuid);
    raise exception 'HATA: yabanci baskasinin quizini kapatti';
  exception when no_data_found then null;
  end;
  begin
    perform quiz_olustur(current_setting('t12.ders')::uuid, 'X', 10, array[current_setting('t12.s1')::uuid]);
    raise exception 'HATA: yabanci baskasinin dersine quiz acti';
  exception when no_data_found then null;
  end;
end $$;

reset role;
reset request.jwt.claims;
select '0012 tamam' as sonuc;
