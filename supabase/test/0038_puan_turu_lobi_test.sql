-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0038 tamam" yazar.
-- Beklenen: puan tablosu yalnızca perdedeki turu sayar; 3'lü seri +100, 5'li seri +300 bonus verir;
-- öğrencinin kendi sırası aynı sayıdan gelir; lobi takım adlarını verir, dengele farkı en çok 1 yapar, rastgele üye kaybetmez.

insert into auth.users (id, email) values ('c3838383-3838-3838-3838-383838383801', 'hoca38@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca38@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3838383-3838-3838-3838-383838383801","email":"hoca38@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Puan Dersi') returning id, subject_id)
select set_config('t38.ders', id::text, false), set_config('t38.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t38.icerik')::uuid, '⚡ P', -1) returning id)
select set_config('t38.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t38.icerik')::uuid, 'S?', 'A', array['B']) returning id)
select set_config('t38.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t38.ders')::uuid, current_setting('t38.akis')::uuid) returning id)
select set_config('t38.sid', id::text, false) from s;
select set_config('t38.k', kumanda_anahtari(current_setting('t38.sid')::uuid), false);
with t as (insert into oyun_turlari (session_id, lesson_id) values (current_setting('t38.sid')::uuid, current_setting('t38.akis')::uuid) returning id)
select set_config('t38.tur', id::text, false) from t;
reset request.jwt.claims;
reset role;

-- 5 tur adımı + tura ait olmayan 1 eski adım
do $$
declare
  i integer;
  a uuid;
  sid uuid := current_setting('t38.sid')::uuid;
begin
  for i in 1..5 loop
    insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id)
    values (current_setting('t38.akis')::uuid, i, 'soru', current_setting('t38.soru')::uuid, current_setting('t38.tur')::uuid) returning id into a;
    -- cihaz 1: bes doğru (500 bonus yok, 300 bonus var); cihaz 2: ilk üç doğru, sonra yanlış, doğru
    insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
    values (sid, a, current_setting('t38.soru')::uuid, 'cihaz-puan-0001', 0, true, 1000, 100);
    insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
    values (sid, a, current_setting('t38.soru')::uuid, 'cihaz-puan-0002', 0, i <> 4, case when i <> 4 then 1000 else 0 end, 100);
  end loop;
  insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t38.akis')::uuid, 9, 'soru', current_setting('t38.soru')::uuid) returning id into a;
  insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
  values (sid, a, current_setting('t38.soru')::uuid, 'cihaz-puan-0002', 0, true, 1000, 100);
end $$;

update sessions set aktif_tur = current_setting('t38.tur')::uuid where id = current_setting('t38.sid')::uuid;
do $$
declare
  sid uuid := current_setting('t38.sid')::uuid;
  v   jsonb;
begin
  -- cihaz 1: 5000 + 300; cihaz 2: 4000 + 100 (ilk üç seri)  (eski adım sayılmaz)
  assert (select toplam from ozel.oyuncu_puanlari(sid) where cihaz_id = 'cihaz-puan-0001') = 5300, 'HATA: cihaz 1 puani';
  assert (select toplam from ozel.oyuncu_puanlari(sid) where cihaz_id = 'cihaz-puan-0002') = 4100, 'HATA: cihaz 2 puani (eski adim sizdi mi?)';
  assert (select en_seri from ozel.oyuncu_puanlari(sid) where cihaz_id = 'cihaz-puan-0001') = 5, 'HATA: seri';
  v := benim_sonucum(sid, 'cihaz-puan-0002');
  assert (v ->> 'toplam')::int = 4100 and (v ->> 'sira')::int = 2 and (v ->> 'oyuncu')::int = 2, 'HATA: benim sonucum: ' || v::text;
  v := ozel.puanlar(sid, 5);
  assert (v -> 0 ->> 'puan')::int = 5300 and (v -> 0 ->> 'sira')::int = 1, 'HATA: puan tablosu: ' || v::text;
end $$;
-- Tur dışı: bütün oturum sayılır
update sessions set aktif_tur = null where id = current_setting('t38.sid')::uuid;
do $$
begin
  assert (select toplam from ozel.oyuncu_puanlari(current_setting('t38.sid')::uuid) where cihaz_id = 'cihaz-puan-0002') = 5100, 'HATA: turdisi toplam';
end $$;

-- Lobi
insert into takim_ayar (session_id, sayi) values (current_setting('t38.sid')::uuid, 3);
insert into takim_uyeleri (session_id, cihaz_id, takim)
select current_setting('t38.sid')::uuid, 'cihaz-lobi-' || lpad(g::text, 4, '0'), 1 from generate_series(1, 7) g;
do $$
declare
  sid uuid := current_setting('t38.sid')::uuid;
  k   text := current_setting('t38.k');
  v   jsonb;
  mx  integer;
  mn  integer;
begin
  v := takim_listesi(sid, k);
  assert jsonb_array_length(v -> 'takimlar') = 1 and jsonb_array_length(v -> 'takimlar' -> 0 -> 'adlar') = 7, 'HATA: takim listesi: ' || v::text;
  assert takim_listesi(sid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yanlis anahtar';
  assert takim_dagit(sid, k, 'dengele') ->> 'durum' = 'tamam', 'HATA: dengele';
  select max(n), min(n) into mx, mn from (
    select g.takim, (select count(*) from takim_uyeleri u where u.session_id = sid and u.takim = g.takim) as n from generate_series(1, 3) g(takim)) t;
  assert mx - mn <= 1 and mx + mn + 0 >= 4, 'HATA: dengesiz ' || mx || '/' || mn;
  assert (select count(*) from takim_uyeleri where session_id = sid) = 7, 'HATA: uye kaybi';
  assert takim_dagit(sid, k, 'rastgele') ->> 'durum' = 'tamam', 'HATA: rastgele';
  assert (select count(*) from takim_uyeleri where session_id = sid) = 7, 'HATA: rastgele uye kaybi';
  assert (select count(distinct takim) from takim_uyeleri where session_id = sid) = 3, 'HATA: rastgele takim sayisi';
  assert takim_dagit(sid, k, 'hile') ->> 'hata' = 'yontem_gecersiz', 'HATA: yontem';
  assert takim_dagit(sid, 'yanlis', 'dengele') ->> 'hata' = 'yetki_yok', 'HATA: yetkisiz dagit';
end $$;

select '0038 tamam' as sonuc;
