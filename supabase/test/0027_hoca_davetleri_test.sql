-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0027 tamam" yazar.
-- Beklenen: sahip (en eski hoca) hoca ekler, listeler, çıkarır; sahip çıkarılamaz; sahip olmayan hoca ve yabancı hiçbir
-- şey yapamaz; eklenen hoca kendi dersini açar ve başkasının dersini göremez; çıkarılan hoca ders açamaz.

insert into auth.users (id, email) values
  ('c2727272-2727-2727-2727-272727272701', 'sahip27@ornek.edu.tr'),
  ('c2727272-2727-2727-2727-272727272702', 'yeni27@ornek.edu.tr'),
  ('c2727272-2727-2727-2727-272727272703', 'yabanci27@ornek.com');
insert into public.teachers (eposta, eklendi) values ('sahip27@ornek.edu.tr', now() - interval '1 day') on conflict do nothing;

-- Sahip bu veritabanında teachers tablosunun en eskisi olmayabilir (önceki testlerden kalan kayıtlar); testte sahibi belirleyelim
update public.teachers set eklendi = now() - interval '10 years' where eposta = 'sahip27@ornek.edu.tr';

set role authenticated;
set request.jwt.claims = '{"sub":"c2727272-2727-2727-2727-272727272701","email":"sahip27@ornek.edu.tr"}';
do $$
declare v jsonb;
begin
  assert hoca_sahip_mi(), 'HATA: sahip sahip gorunmedi';
  v := hoca_ekle('  Yeni27@Ornek.edu.tr ', 'Yeni Hoca');
  assert v ->> 'durum' = 'tamam' and v ->> 'eposta' = 'yeni27@ornek.edu.tr', 'HATA: ekleme: ' || v::text;
  assert hoca_ekle('yeni27@ornek.edu.tr') ->> 'hata' = 'zaten_var', 'HATA: ayni hoca iki kez eklendi';
  assert hoca_ekle('gecersiz') ->> 'hata' = 'eposta_gecersiz', 'HATA: gecersiz eposta kabul edildi';
  v := hoca_listele();
  assert exists (select 1 from jsonb_array_elements(v -> 'hocalar') h where h ->> 'eposta' = 'yeni27@ornek.edu.tr' and (h ->> 'giris_yapti')::boolean and h ->> 'ad_soyad' = 'Yeni Hoca'), 'HATA: liste: ' || v::text;
  assert hoca_ekle('henuz27@ornek.edu.tr') ->> 'durum' = 'tamam', 'HATA: ikinci ekleme';
  assert exists (select 1 from jsonb_array_elements(hoca_listele() -> 'hocalar') h where h ->> 'eposta' = 'henuz27@ornek.edu.tr' and not (h ->> 'giris_yapti')::boolean), 'HATA: giris yapmamis hoca';
  assert exists (select 1 from jsonb_array_elements(v -> 'hocalar') h where h ->> 'eposta' = 'sahip27@ornek.edu.tr' and (h ->> 'sahip')::boolean), 'HATA: sahip isareti';
  assert hoca_cikar('sahip27@ornek.edu.tr') ->> 'hata' = 'sahip_cikarilamaz', 'HATA: sahip cikarildi';
  insert into courses (ad) values ('Sahibin Dersi');
end $$;

-- Eklenen hoca: sahip değil, hiçbir yönetim işi yapamaz; kendi dersini açar, sahibinkini göremez
set request.jwt.claims = '{"sub":"c2727272-2727-2727-2727-272727272702","email":"yeni27@ornek.edu.tr"}';
do $$
declare n int;
begin
  assert not hoca_sahip_mi(), 'HATA: yeni hoca sahip gorundu';
  assert hoca_listele() ->> 'hata' = 'yetki_yok', 'HATA: yeni hoca listeledi';
  assert hoca_ekle('baska27@ornek.edu.tr') ->> 'hata' = 'yetki_yok', 'HATA: yeni hoca hoca ekledi';
  assert hoca_cikar('sahip27@ornek.edu.tr') ->> 'hata' = 'yetki_yok', 'HATA: yeni hoca sahibi cikardi';
  insert into courses (ad) values ('Yeni Hocanin Dersi');
  select count(*) into n from courses where ad = 'Sahibin Dersi';
  assert n = 0, 'HATA: yeni hoca sahibin dersini gordu';
  select count(*) into n from courses where ad = 'Yeni Hocanin Dersi';
  assert n = 1, 'HATA: yeni hoca kendi dersini goremedi';
end $$;

-- Yabancı (listede değil): hiçbir şey yapamaz
set request.jwt.claims = '{"sub":"c2727272-2727-2727-2727-272727272703","email":"yabanci27@ornek.com"}';
do $$
begin
  assert not hoca_sahip_mi() and not hoca_mi(), 'HATA: yabanci hoca gorundu';
  assert hoca_ekle('x27@ornek.com') ->> 'hata' = 'yetki_yok', 'HATA: yabanci hoca ekledi';
end $$;

-- Sahip hocayı çıkarır; çıkarılan ders açamaz
set request.jwt.claims = '{"sub":"c2727272-2727-2727-2727-272727272701","email":"sahip27@ornek.edu.tr"}';
do $$
begin
  assert hoca_cikar('yeni27@ornek.edu.tr') ->> 'durum' = 'tamam', 'HATA: cikarma';
  assert hoca_cikar('yeni27@ornek.edu.tr') ->> 'hata' = 'bulunamadi', 'HATA: ikinci cikarma';
end $$;
set request.jwt.claims = '{"sub":"c2727272-2727-2727-2727-272727272702","email":"yeni27@ornek.edu.tr"}';
do $$
begin
  assert not hoca_mi(), 'HATA: cikarilan hoca hala hoca';
  begin
    insert into courses (ad) values ('Cikarilanin Dersi');
    raise exception 'HATA: cikarilan hoca ders acti';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

reset request.jwt.claims;
reset role;
select '0027 tamam' as sonuc;
