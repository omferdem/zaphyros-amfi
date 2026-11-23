-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0052 tamam" yazar.
-- Beklenen: etkinlik arşive alınıp geri alınır; akış bağlanır; akış silinince bağ boşalır, satır kalır.

insert into auth.users (id, email) values ('c5252525-5252-5252-5252-525252525201', 'hoca52@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca52@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c5252525-5252-5252-5252-525252525201","email":"hoca52@ornek.edu.tr"}';
with d as (insert into courses (ad, kod, donem) values ('Etkinlik Slayt', '__etkinlik_zapoot', '__etkinlik') returning id, subject_id)
  select set_config('t52.ders', id::text, false), set_config('t52.icerik', subject_id::text, false) from d;
with a as (insert into lessons (subject_id, ad) values (current_setting('t52.icerik')::uuid, 'Etkinlik akışı') returning id)
  select set_config('t52.akis', id::text, false) from a;
insert into etkinlikler (course_id, ad, akis_id) values (current_setting('t52.ders')::uuid, 'Slaytlı etkinlik', current_setting('t52.akis')::uuid);
do $$
begin
  assert (select arsiv from etkinlikler) = false, 'HATA: varsayilan arsiv kapali olmali';
  update etkinlikler set arsiv = true;
  assert (select count(*) from etkinlikler where arsiv) = 1, 'HATA: arsive alinmali';
  update etkinlikler set arsiv = false;
  assert (select akis_id from etkinlikler) = current_setting('t52.akis')::uuid, 'HATA: akis bagi';
  delete from lessons where id = current_setting('t52.akis')::uuid;
  assert (select count(*) from etkinlikler) = 1, 'HATA: akis silinince satir kalmali';
  assert (select akis_id from etkinlikler) is null, 'HATA: akis bagi bosalmali';
end $$;
reset request.jwt.claims;
reset role;

select '0052 tamam' as sonuc;
