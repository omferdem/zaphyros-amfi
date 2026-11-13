-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0019 tamam" yazar.
-- Beklenen: akışa geçerli bir oyun adımı eklenir; bilinmeyen oyun, oyunsuz adım ve çok uzun açıklama reddedilir.

insert into auth.users (id, email) values ('fa111111-1111-1111-1111-111111111111', 'hoca19@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca19@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"fa111111-1111-1111-1111-111111111111","email":"hoca19@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Oyun Dersi') returning subject_id) select set_config('t19.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t19.icerik')::uuid, 'Oyun') returning id) select set_config('t19.akis', id::text, false) from l;

do $$
declare
  akis uuid := current_setting('t19.akis')::uuid;
  hata boolean;
begin
  insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 1, 'oyun', '{"oyun":"halat"}');
  insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 2, 'oyun', '{"oyun":"merdiven","baslik":"Bu haftanın oyunu","aciklama":"Kısa açıklama"}');
  assert (select count(*) from lesson_steps where lesson_id = akis and tur = 'oyun') = 2, 'HATA: oyun adimlari eklenmedi';

  hata := false;
  begin
    insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 3, 'oyun', '{"oyun":"bilinmeyen"}');
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: bilinmeyen oyun kabul edildi';

  hata := false;
  begin
    insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 4, 'oyun', '{}');
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: oyunsuz oyun adimi kabul edildi';

  hata := false;
  begin
    insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 5, 'oyun', jsonb_build_object('oyun', 'takim', 'aciklama', repeat('a', 301)));
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: uzun aciklama kabul edildi';

  -- Eski adım türleri etkilenmedi
  insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 6, 'fikir', '{"soru":"Bir soru?"}');
  insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 7, 'video', '{"url":"https://www.youtube.com/watch?v=abcdefghijk"}');
  hata := false;
  begin
    insert into lesson_steps (lesson_id, sira, tur, ayar) values (akis, 8, 'video', '{"url":"http://guvensiz.example/x"}');
  exception when check_violation then hata := true; end;
  assert hata, 'HATA: guvensiz video adresi kabul edildi';
end $$;

reset request.jwt.claims;
reset role;
select '0019 tamam' as sonuc;
