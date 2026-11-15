-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0042 tamam" yazar.
-- Beklenen: hoca açık soruda yarı yarıya (2 yanlış şık elenir, doğru şık elenmez), +15 sn (kalan süre uzar) ve seyirci
-- (ilk 10 sn dağılımı) jokerini turda bir kez kullanır; kapalı soruda ve yanlış anahtarla kullanılamaz.

insert into auth.users (id, email) values ('c4242424-4242-4242-4242-424242424201', 'hoca42@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca42@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4242424-4242-4242-4242-424242424201","email":"hoca42@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Joker Dersi') returning id, subject_id) select set_config('t42.ders', id::text, false), set_config('t42.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t42.icerik')::uuid, '⚡ J', -1) returning id) select set_config('t42.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t42.icerik')::uuid, 'S?', 'A', array['B', 'C', 'D'], 20) returning id) select set_config('t42.soru', id::text, false) from q;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t42.akis')::uuid, 1, 'soru', current_setting('t42.soru')::uuid) returning id) select set_config('t42.a1', id::text, false) from a;
with s as (insert into sessions (course_id, lesson_id, aktif_adim) values (current_setting('t42.ders')::uuid, current_setting('t42.akis')::uuid, current_setting('t42.a1')::uuid) returning id) select set_config('t42.sid', id::text, false) from s;
select set_config('t42.k', kumanda_anahtari(current_setting('t42.sid')::uuid), false);
reset request.jwt.claims;
reset role;

do $$
declare
  sid uuid := current_setting('t42.sid')::uuid;
  k   text := current_setting('t42.k');
  v   jsonb;
  d   jsonb;
  dogru_i integer;
begin
  assert (select soru_durum from sessions where id = sid) = 'acik', 'HATA: soru acik degil';
  assert joker_kullan(sid, 'yanlis', 'yarim') ->> 'hata' = 'yetki_yok', 'HATA: yetkisiz';
  assert joker_kullan(sid, k, 'hile') ->> 'hata' = 'joker_gecersiz', 'HATA: gecersiz joker';

  -- yarı yarıya: iki yanlış şık elenir, doğru şık elenmez
  v := joker_kullan(sid, k, 'yarim');
  assert v ->> 'durum' = 'tamam' and jsonb_array_length(v -> 'veri' -> 'elenen') = 2, 'HATA: yarim: ' || v::text;
  dogru_i := array_position(ozel.secenekler(sid, current_setting('t42.soru')::uuid), 'A') - 1;
  assert not (v -> 'veri' -> 'elenen') @> to_jsonb(dogru_i), 'HATA: dogru sik elendi';
  assert joker_kullan(sid, k, 'yarim') ->> 'hata' = 'kullanildi', 'HATA: ikinci kullanim';

  -- ders durumu telefona elenen şıkları verir
  d := ozel.durum(sid);
  assert jsonb_array_length(d -> 'adim' -> 'elenen') = 2, 'HATA: durum elenen: ' || d::text;

  -- +15 sn: kalan süre normal süreyi aşar
  v := joker_kullan(sid, k, 'sure');
  assert v ->> 'durum' = 'tamam', 'HATA: sure';
  d := ozel.durum(sid);
  assert (d -> 'adim' ->> 'kalan_ms')::int > 20000, 'HATA: kalan ms: ' || d::text;

  -- seyirci
  v := joker_kullan(sid, k, 'seyirci');
  assert v ->> 'durum' = 'tamam' and jsonb_array_length(v -> 'veri' -> 'dagilim') = 4, 'HATA: seyirci: ' || v::text;

  v := joker_durumu(sid, k);
  assert jsonb_array_length(v -> 'kullanilan') = 3, 'HATA: joker durumu: ' || v::text;
end $$;

-- Soru kapalıyken joker kullanılamaz
update sessions set soru_durum = 'sonuc' where id = current_setting('t42.sid')::uuid;
do $$
begin
  assert joker_kullan(current_setting('t42.sid')::uuid, current_setting('t42.k'), 'yarim') ->> 'hata' in ('soru_acik_degil', 'kullanildi'), 'HATA: kapali soruda joker';
end $$;

select '0042 tamam' as sonuc;
