-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0048 tamam" yazar.
-- Beklenen: etkin adım bir oyun turundaysa sıra ve toplam yalnızca o turun adımlarını sayar; normal akışta tüm normal adımları sayar.

insert into auth.users (id, email) values ('c4888888-4444-4444-4444-444444444401', 'hoca48@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca48@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4888888-4444-4444-4444-444444444401","email":"hoca48@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Tur Dersi') returning id, subject_id) select set_config('t48.ders', id::text, false), set_config('t48.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t48.icerik')::uuid, 'Akis', 1) returning id) select set_config('t48.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t48.icerik')::uuid, 'S?', 'A', array['B'], 30) returning id) select set_config('t48.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t48.ders')::uuid, current_setting('t48.akis')::uuid) returning id) select set_config('t48.sid', id::text, false) from s;
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t48.sid')::uuid, current_setting('t48.akis')::uuid, 'P', 'zombi') returning id) select set_config('t48.tur1', id::text, false) from t;
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t48.sid')::uuid, current_setting('t48.akis')::uuid, 'P', 'zombi') returning id) select set_config('t48.tur2', id::text, false) from t;
reset request.jwt.claims;
reset role;

insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values
  (current_setting('t48.akis')::uuid, 1, 'soru', current_setting('t48.soru')::uuid, null),
  (current_setting('t48.akis')::uuid, 2, 'soru', current_setting('t48.soru')::uuid, null),
  (current_setting('t48.akis')::uuid, 3, 'soru', current_setting('t48.soru')::uuid, current_setting('t48.tur1')::uuid),
  (current_setting('t48.akis')::uuid, 4, 'soru', current_setting('t48.soru')::uuid, current_setting('t48.tur1')::uuid),
  (current_setting('t48.akis')::uuid, 5, 'soru', current_setting('t48.soru')::uuid, current_setting('t48.tur2')::uuid),
  (current_setting('t48.akis')::uuid, 6, 'soru', current_setting('t48.soru')::uuid, current_setting('t48.tur2')::uuid),
  (current_setting('t48.akis')::uuid, 7, 'soru', current_setting('t48.soru')::uuid, current_setting('t48.tur2')::uuid);

do $$
declare v jsonb;
begin
  -- 2. turun ilk adımı: sıra 1, toplam 3
  update sessions set aktif_adim = (select id from lesson_steps where lesson_id = current_setting('t48.akis')::uuid and sira = 5) where id = current_setting('t48.sid')::uuid;
  v := ozel.durum(current_setting('t48.sid')::uuid);
  assert (v -> 'adim' ->> 'sira')::int = 1 and (v -> 'adim' ->> 'toplam')::int = 3, 'HATA: tur 2: ' || v::text;
  -- 1. turun son adımı: sıra 2, toplam 2
  update sessions set aktif_adim = (select id from lesson_steps where lesson_id = current_setting('t48.akis')::uuid and sira = 4) where id = current_setting('t48.sid')::uuid;
  v := ozel.durum(current_setting('t48.sid')::uuid);
  assert (v -> 'adim' ->> 'sira')::int = 2 and (v -> 'adim' ->> 'toplam')::int = 2, 'HATA: tur 1: ' || v::text;
  -- normal akış: sıra 2, toplam 2 (turlu adımlar sayılmaz)
  update sessions set aktif_adim = (select id from lesson_steps where lesson_id = current_setting('t48.akis')::uuid and sira = 2) where id = current_setting('t48.sid')::uuid;
  v := ozel.durum(current_setting('t48.sid')::uuid);
  assert (v -> 'adim' ->> 'sira')::int = 2 and (v -> 'adim' ->> 'toplam')::int = 2, 'HATA: normal akis: ' || v::text;
end $$;

select '0048 tamam' as sonuc;
