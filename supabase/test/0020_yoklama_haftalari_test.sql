-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0020 tamam" yazar.
-- Beklenen: şubenin yoklama sayısı ve birimi ayarlanır (sınırlar denetlenir); bir şubede bir hafta numarası tek oturumda
-- bulunur; aynı hafta yeniden açılınca aynı oturum kullanılır; hafta numarası olmayan ek oturumlar sınırsızdır.

insert into auth.users (id, email) values ('fb111111-1111-1111-1111-111111111111', 'hoca20@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca20@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"fb111111-1111-1111-1111-111111111111","email":"hoca20@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Hafta Dersi') returning id) select set_config('t20.ders', id::text, false) from d;

do $$
declare
  ders uuid := current_setting('t20.ders')::uuid;
  s1 uuid;
  hata boolean;
begin
  assert (select yoklama_sayisi from courses where id = ders) = 15, 'HATA: varsayilan yoklama sayisi';
  assert (select yoklama_birimi from courses where id = ders) = 'hafta', 'HATA: varsayilan birim';

  update courses set yoklama_sayisi = 30, yoklama_birimi = 'ders' where id = ders;
  assert (select yoklama_sayisi from courses where id = ders) = 30, 'HATA: sayi guncellenmedi';

  hata := false;
  begin update courses set yoklama_sayisi = 61 where id = ders; exception when check_violation then hata := true; end;
  assert hata, 'HATA: 61 yoklama kabul edildi';
  hata := false;
  begin update courses set yoklama_sayisi = 0 where id = ders; exception when check_violation then hata := true; end;
  assert hata, 'HATA: 0 yoklama kabul edildi';
  hata := false;
  begin update courses set yoklama_birimi = 'gun' where id = ders; exception when check_violation then hata := true; end;
  assert hata, 'HATA: gecersiz birim kabul edildi';

  insert into sessions (course_id, hafta_no, yoklama_acik) values (ders, 2, true) returning id into s1;
  hata := false;
  begin insert into sessions (course_id, hafta_no) values (ders, 2); exception when unique_violation then hata := true; end;
  assert hata, 'HATA: ayni hafta ikinci oturumda acildi';

  -- Hafta yeniden açılır: aynı oturum kapatılıp açılabilir
  update sessions set yoklama_acik = false, bitti = now() where id = s1;
  update sessions set yoklama_acik = true, bitti = null where id = s1;
  assert (select yoklama_acik from sessions where id = s1), 'HATA: hafta yeniden acilamadi';

  hata := false;
  begin insert into sessions (course_id, hafta_no) values (ders, 99); exception when check_violation then hata := true; end;
  assert hata, 'HATA: 99. hafta kabul edildi';

  -- Hafta numarasız ek oturumlar sınırsız
  insert into sessions (course_id) values (ders);
  insert into sessions (course_id) values (ders);
  insert into sessions (course_id, hafta_no) values (ders, 3);
  assert (select count(*) from sessions where course_id = ders) = 4, 'HATA: oturum sayisi';
end $$;

reset request.jwt.claims;
reset role;
select '0020 tamam' as sonuc;
