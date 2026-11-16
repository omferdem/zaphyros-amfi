-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0049 tamam" yazar.
-- Beklenen: 8 soruluk turda 6., 7., 8. sorular final turudur (puan x2); tursuz akışta ve kısa turda final turu yoktur.

insert into auth.users (id, email) values ('c4999999-4444-4444-4444-444444444401', 'hoca49@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca49@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4999999-4444-4444-4444-444444444401","email":"hoca49@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Final Dersi') returning id, subject_id) select set_config('t49.ders', id::text, false), set_config('t49.icerik', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad, sira) values (current_setting('t49.icerik')::uuid, 'Akis', 1) returning id) select set_config('t49.akis', id::text, false) from l;
with q as (insert into questions (subject_id, soru, dogru, yanlislar, sure_sn) values (current_setting('t49.icerik')::uuid, 'S?', 'A', array['B', 'C'], 30) returning id) select set_config('t49.soru', id::text, false) from q;
with s as (insert into sessions (course_id, lesson_id) values (current_setting('t49.ders')::uuid, current_setting('t49.akis')::uuid) returning id) select set_config('t49.sid', id::text, false) from s;
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t49.sid')::uuid, current_setting('t49.akis')::uuid, 'P', 'zombi') returning id) select set_config('t49.tur', id::text, false) from t;
with t as (insert into oyun_turlari (session_id, lesson_id, paket, mod) values (current_setting('t49.sid')::uuid, current_setting('t49.akis')::uuid, 'K', 'zombi') returning id) select set_config('t49.kisa', id::text, false) from t;
reset request.jwt.claims;
reset role;

-- tursuz bir normal adım, 8 adımlık tur, 4 adımlık kısa tur
insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id) values (current_setting('t49.akis')::uuid, 1, 'soru', current_setting('t49.soru')::uuid, null);
insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id)
  select current_setting('t49.akis')::uuid, 10 + g, 'soru', current_setting('t49.soru')::uuid, current_setting('t49.tur')::uuid from generate_series(1, 8) g;
insert into lesson_steps (lesson_id, sira, tur, question_id, tur_id)
  select current_setting('t49.akis')::uuid, 30 + g, 'soru', current_setting('t49.soru')::uuid, current_setting('t49.kisa')::uuid from generate_series(1, 4) g;
insert into session_players (session_id, cihaz_id, takma_ad) values (current_setting('t49.sid')::uuid, 'cihaz-fin-00001', 'Oyuncu');

do $$
declare
  v_adim uuid;
  v_idx integer;
  v_puan integer;
begin
  for g in 1..8 loop
    select id into v_adim from lesson_steps where tur_id = current_setting('t49.tur')::uuid and sira = 10 + g;
    assert ozel.final_turu(v_adim) = (g >= 6), 'HATA: 8 soruluk turda ' || g || '. soru';
  end loop;
  select id into v_adim from lesson_steps where tur_id is null and lesson_id = current_setting('t49.akis')::uuid;
  assert ozel.final_turu(v_adim) = false, 'HATA: tursuz adım final turu sayıldı';
  select id into v_adim from lesson_steps where tur_id = current_setting('t49.kisa')::uuid and sira = 34;
  assert ozel.final_turu(v_adim) = false, 'HATA: kısa turun son sorusu final turu sayıldı';

  -- puan: 2. soru normal (en çok 1000), 7. soru x2 (en az 1000)
  select id into v_adim from lesson_steps where tur_id = current_setting('t49.tur')::uuid and sira = 12;
  update sessions set aktif_adim = v_adim, soru_durum = 'acik', soru_basladi = now() where id = current_setting('t49.sid')::uuid;
  v_idx := array_position(ozel.secenekler(current_setting('t49.sid')::uuid, current_setting('t49.soru')::uuid), 'A') - 1;
  perform cevap_ver(current_setting('t49.sid')::uuid, 'cihaz-fin-00001', v_idx);
  select puan into v_puan from responses where step_id = v_adim and cihaz_id = 'cihaz-fin-00001';
  assert v_puan between 500 and 1000, 'HATA: normal soru puanı: ' || v_puan;

  select id into v_adim from lesson_steps where tur_id = current_setting('t49.tur')::uuid and sira = 17;
  update sessions set aktif_adim = v_adim, soru_durum = 'acik', soru_basladi = now() where id = current_setting('t49.sid')::uuid;
  perform cevap_ver(current_setting('t49.sid')::uuid, 'cihaz-fin-00001', v_idx);
  select puan into v_puan from responses where step_id = v_adim and cihaz_id = 'cihaz-fin-00001';
  assert v_puan between 1000 and 2000, 'HATA: final turu puanı x2 değil: ' || v_puan;

  assert (ozel.durum(current_setting('t49.sid')::uuid) -> 'adim' ->> 'final_turu')::boolean = true, 'HATA: durum.final_turu';
end $$;

select '0049 tamam' as sonuc;
