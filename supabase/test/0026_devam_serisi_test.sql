-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0026 tamam" yazar.
-- Beklenen: üst üste katılınan ders sayısı doğru hesaplanır, kaçırılan ders seriyi sıfırlar, boş oturum sayılmaz,
-- yoklaması olmayan cihaz için seri 0 döner.

insert into auth.users (id, email) values ('c2626262-2626-2626-2626-262626262601', 'hoca26@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca26@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"c2626262-2626-2626-2626-262626262601","email":"hoca26@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Seri Dersi') returning id)
select set_config('t26.ders', id::text, false) from d;
insert into students (course_id, ogrenci_no, ad_soyad) values
  (current_setting('t26.ders')::uuid, '26001', 'Ayşe Seri'),
  (current_setting('t26.ders')::uuid, '26002', 'Mehmet Seri');
reset request.jwt.claims;
reset role;

-- Beş ders (eskiden yeniye): s1..s5; bir de kimsenin gelmediği boş oturum
do $$
declare
  c  uuid := current_setting('t26.ders')::uuid;
  a  uuid;
  m  uuid;
  s  uuid;
  i  int;
begin
  select id into a from students where course_id = c and ogrenci_no = '26001';
  select id into m from students where course_id = c and ogrenci_no = '26002';
  for i in 1..5 loop
    insert into sessions (course_id, basladi) values (c, now() - make_interval(days => 40 - i * 7)) returning id into s;
    perform set_config('t26.s' || i, s::text, false);
    -- Ayşe her derse geldi; Mehmet 3. derse gelmedi
    insert into attendance (session_id, student_id, cihaz_id) values (s, a, 'cihaz-seri-ayse-0' || i);
    if i <> 3 then
      insert into attendance (session_id, student_id, cihaz_id) values (s, m, 'cihaz-seri-mehmet-0' || i);
    end if;
  end loop;
  -- Kimsenin gelmediği, en yeni oturum (deneme)
  insert into sessions (course_id, basladi) values (c, now() + interval '1 day');
end $$;

set role anon;
do $$
declare v jsonb;
begin
  v := devam_serisi(current_setting('t26.s5')::uuid, 'cihaz-seri-ayse-05');
  assert (v ->> 'seri')::int = 5 and (v ->> 'katilan')::int = 5 and (v ->> 'toplam')::int = 5, 'HATA: Ayse serisi: ' || v::text;
  v := devam_serisi(current_setting('t26.s5')::uuid, 'cihaz-seri-mehmet-05');
  assert (v ->> 'seri')::int = 2 and (v ->> 'katilan')::int = 4, 'HATA: Mehmet serisi (3. dersi kacirdi): ' || v::text;
  -- Eski bir dersin bakış açısından da en yeniden sayılır; yoklamasız cihaz 0
  v := devam_serisi(current_setting('t26.s5')::uuid, 'cihaz-baska-00001');
  assert (v ->> 'seri')::int = 0, 'HATA: yoklamasiz cihaz: ' || v::text;
  assert (devam_serisi(current_setting('t26.s5')::uuid, 'kisa') ->> 'seri')::int = 0, 'HATA: gecersiz cihaz';
end $$;

reset role;
select '0026 tamam' as sonuc;
