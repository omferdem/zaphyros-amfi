-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0051 tamam" yazar.
-- Beklenen: hoca kendi etkinlik satırını ekler/okur; başka hoca göremez ve ekleyemez; anon erişemez; ders silinince satırlar gider.

insert into auth.users (id, email) values
  ('c5151515-5151-5151-5151-515151515101', 'hoca51a@ornek.edu.tr'),
  ('c5151515-5151-5151-5151-515151515102', 'hoca51b@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca51a@ornek.edu.tr'), ('hoca51b@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c5151515-5151-5151-5151-515151515101","email":"hoca51a@ornek.edu.tr"}';
with d as (insert into courses (ad, kod, donem) values ('Etkinlik Zapoot', '__etkinlik_zapoot', '__etkinlik') returning id)
  select set_config('t51.ders', id::text, false) from d;
insert into etkinlikler (course_id, ad, paket, mod, adet, zorluk)
  values (current_setting('t51.ders')::uuid, 'Hafta 1 ısınma', 'Paket A', 'ejderha', 10, 'zor');
do $$
begin
  assert (select count(*) from etkinlikler) = 1, 'HATA: hoca kendi satirini gormeli';
  assert (select zorluk from etkinlikler) = 'zor', 'HATA: zorluk';
end $$;
reset request.jwt.claims;

set request.jwt.claims = '{"sub":"c5151515-5151-5151-5151-515151515102","email":"hoca51b@ornek.edu.tr"}';
do $$
begin
  assert (select count(*) from etkinlikler) = 0, 'HATA: baska hoca satiri gormemeli';
  begin
    insert into etkinlikler (course_id, ad) values (current_setting('t51.ders')::uuid, 'Sizma');
    assert false, 'HATA: baska hoca ekleyememeli';
  exception when others then
    if sqlerrm like 'HATA%' then raise; end if;
  end;
  begin
    update etkinlikler set zorluk = 'kolay';
  end;
end $$;
reset request.jwt.claims;
reset role;

set role anon;
do $$
begin
  begin
    perform count(*) from etkinlikler;
    assert false, 'HATA: anon okuyamamali';
  exception when others then
    if sqlerrm like 'HATA%' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  begin
    insert into etkinlikler (course_id, ad, zorluk) values (current_setting('t51.ders')::uuid, 'Kotu', 'imkansiz');
    assert false, 'HATA: gecersiz zorluk reddedilmeli';
  exception when check_violation then null;
  end;
  delete from courses where id = current_setting('t51.ders')::uuid;
  assert (select count(*) from etkinlikler) = 0, 'HATA: ders silinince etkinlikler gitmeli';
end $$;

select '0051 tamam' as sonuc;
