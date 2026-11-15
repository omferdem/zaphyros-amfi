-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0034 tamam" yazar.
-- Beklenen: hoca genel ve şubeye özel not ekler, düzenler, siler; başka hoca ve yabancı notları göremez ve başkasının
-- şubesine not yazamaz; şube silinince notları da silinir.

insert into auth.users (id, email) values
  ('c3434343-3434-3434-3434-343434343401', 'hoca34a@ornek.edu.tr'),
  ('c3434343-3434-3434-3434-343434343402', 'hoca34b@ornek.edu.tr'),
  ('c3434343-3434-3434-3434-343434343403', 'yabanci34@ornek.com');
insert into public.teachers (eposta) values ('hoca34a@ornek.edu.tr'), ('hoca34b@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c3434343-3434-3434-3434-343434343401","email":"hoca34a@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Not Dersi A') returning id) select set_config('t34.ders', id::text, false) from d;
insert into notlar (metin) values ('Genel not');
insert into notlar (course_id, metin) values (current_setting('t34.ders')::uuid, 'Şube notu');
do $$
declare t1 timestamptz; t2 timestamptz;
begin
  assert (select count(*) from notlar) = 2, 'HATA: hoca kendi notlarini goremedi';
  select guncellendi into t1 from notlar where metin = 'Genel not';
  perform pg_sleep(0.05);
  update notlar set metin = 'Genel not 2' where metin = 'Genel not';
  select guncellendi into t2 from notlar where metin = 'Genel not 2';
  assert t2 > t1, 'HATA: guncellendi yenilenmedi';
end $$;

-- Başka hoca: göremez, başkasının şubesine not yazamaz
set request.jwt.claims = '{"sub":"c3434343-3434-3434-3434-343434343402","email":"hoca34b@ornek.edu.tr"}';
do $$
begin
  assert (select count(*) from notlar) = 0, 'HATA: baska hoca notlari gordu';
  begin
    insert into notlar (course_id, metin) values (current_setting('t34.ders')::uuid, 'sizma');
    raise exception 'HATA: baska hoca baskasinin subesine not yazdi';
  exception when insufficient_privilege or check_violation then null;
  end;
  insert into notlar (metin) values ('B genel notu');
end $$;

-- Yabancı: hoca olmadığı için yazamaz
set request.jwt.claims = '{"sub":"c3434343-3434-3434-3434-343434343403","email":"yabanci34@ornek.com"}';
do $$
begin
  assert (select count(*) from notlar) = 0, 'HATA: yabanci not gordu';
  begin
    insert into notlar (metin) values ('yabanci');
    raise exception 'HATA: yabanci not yazdi';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- Sahibi siler; şube silinince şube notları da gider
set request.jwt.claims = '{"sub":"c3434343-3434-3434-3434-343434343401","email":"hoca34a@ornek.edu.tr"}';
do $$
begin
  delete from notlar where metin = 'Genel not 2';
  assert (select count(*) from notlar) = 1, 'HATA: silme';
  delete from courses where id = current_setting('t34.ders')::uuid;
  assert (select count(*) from notlar) = 0, 'HATA: sube silinince notu gitmedi';
end $$;

reset request.jwt.claims;
reset role;
select '0034 tamam' as sonuc;
