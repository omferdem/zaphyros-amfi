-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0041 tamam" yazar.
-- Beklenen: takımdaki her oyuncunun açılmış sorulardaki sonucu (1/0/-1) ve açılmamış soruda null döner; yanlış anahtar yetkisizdir.

insert into auth.users (id, email) values ('c4141414-4141-4141-4141-414141414101', 'hoca41@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca41@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4141414-4141-4141-4141-414141414101","email":"hoca41@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Kale Dersi') returning id, subject_id) select set_config('t41.ders', id::text, false), set_config('t41.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t41.icerik')::uuid, '⚡ K', -1) returning id) select set_config('t41.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar) values (current_setting('t41.icerik')::uuid, 'S?', 'A', array['B']) returning id) select set_config('t41.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t41.ders')::uuid, current_setting('t41.akis')::uuid) returning id) select set_config('t41.sid', id::text, false) from s;
select set_config('t41.k', kumanda_anahtari(current_setting('t41.sid')::uuid), false);
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t41.akis')::uuid, 1, 'soru', current_setting('t41.soru')::uuid) returning id) select set_config('t41.a1', id::text, false) from a;
with a as (insert into lesson_steps (lesson_id, sira, tur, question_id) values (current_setting('t41.akis')::uuid, 2, 'soru', current_setting('t41.soru')::uuid) returning id) select set_config('t41.a2', id::text, false) from a;
reset request.jwt.claims;
reset role;

insert into takim_ayar (session_id, sayi) values (current_setting('t41.sid')::uuid, 2);
insert into session_players (session_id, cihaz_id, takma_ad) values
  (current_setting('t41.sid')::uuid, 'cihaz-kale-0001', 'Bir'), (current_setting('t41.sid')::uuid, 'cihaz-kale-0002', 'Iki');
insert into takim_uyeleri (session_id, cihaz_id, takim) values
  (current_setting('t41.sid')::uuid, 'cihaz-kale-0001', 1), (current_setting('t41.sid')::uuid, 'cihaz-kale-0002', 2);
insert into responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms) values
  (current_setting('t41.sid')::uuid, current_setting('t41.a1')::uuid, current_setting('t41.soru')::uuid, 'cihaz-kale-0001', 0, true, 800, 100),
  (current_setting('t41.sid')::uuid, current_setting('t41.a1')::uuid, current_setting('t41.soru')::uuid, 'cihaz-kale-0002', 0, false, 0, 100);
update sessions set aktif_adim = current_setting('t41.a2')::uuid where id = current_setting('t41.sid')::uuid;

do $$
declare v jsonb;
begin
  v := takim_oyuncu_sonuclari(current_setting('t41.sid')::uuid, current_setting('t41.k'));
  assert jsonb_array_length(v -> 'oyuncular') = 2, 'HATA: oyuncu sayisi: ' || v::text;
  assert (v -> 'oyuncular' -> 0 ->> 'takim')::int = 1 and (v -> 'oyuncular' -> 0 -> 'sonuc' ->> 0)::int = 1, 'HATA: takim 1 sonucu: ' || v::text;
  assert (v -> 'oyuncular' -> 1 -> 'sonuc' ->> 0)::int = 0, 'HATA: yanlis: ' || v::text;
  assert (v -> 'oyuncular' -> 0 -> 'sonuc' -> 1) = 'null'::jsonb, 'HATA: acilmamis soru null olmali: ' || v::text;
  assert takim_oyuncu_sonuclari(current_setting('t41.sid')::uuid, 'yanlis') ->> 'hata' = 'yetki_yok', 'HATA: yetkisiz';
end $$;

select '0041 tamam' as sonuc;
