-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0045 tamam" yazar.
-- Beklenen: ekran_goruntusu varsayılan açık ve ders durumunda görünür; kumanda şubenin not defterine not ekler (yanlış anahtar, boş metin reddedilir).

insert into auth.users (id, email) values ('c4545454-4545-4545-4545-454545454501', 'hoca45@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca45@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c4545454-4545-4545-4545-454545454501","email":"hoca45@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Not Dersi') returning id) select set_config('t45.ders', id::text, false) from d;
with s as (insert into sessions (course_id) values (current_setting('t45.ders')::uuid) returning id) select set_config('t45.sid', id::text, false) from s;
select set_config('t45.k', kumanda_anahtari(current_setting('t45.sid')::uuid), false);
reset request.jwt.claims;
reset role;

do $$
declare sid uuid := current_setting('t45.sid')::uuid;
begin
  assert (ozel.durum(sid) ->> 'ekran_goruntusu')::boolean = true, 'HATA: varsayilan acik degil';
  update sessions set ekran_goruntusu = false where id = sid;
  assert (ozel.durum(sid) ->> 'ekran_goruntusu')::boolean = false, 'HATA: kapali gorunmuyor';
end $$;

set role anon;
do $$
declare sid uuid := current_setting('t45.sid')::uuid; k text := current_setting('t45.k');
begin
  assert kumanda_not_ekle(sid, k, '  Not metni  ') ->> 'durum' = 'tamam', 'HATA: not eklenmedi';
  assert kumanda_not_ekle(sid, k, '   ') ->> 'hata' = 'metin_bos', 'HATA: bos metin';
  assert kumanda_not_ekle(sid, 'yanlis', 'x') ->> 'hata' = 'yetki_yok', 'HATA: yetkisiz';
end $$;
reset role;
do $$
begin
  assert (select count(*) from public.notlar where course_id = current_setting('t45.ders')::uuid and metin = 'Not metni') = 1, 'HATA: not defterinde yok';
  assert (select teacher_id from public.notlar where course_id = current_setting('t45.ders')::uuid limit 1) = 'c4545454-4545-4545-4545-454545454501'::uuid, 'HATA: not sahibi';
end $$;

select '0045 tamam' as sonuc;
