-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar ve numaralar uydurmadır.
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0004 tamam" yazar.
-- Beklenen: içerik dönemler arasında paylaşılır; yeni dönem aynı akışı kullanır; başka hocanın
-- içeriğine bağlanılamaz; dönem silinince içerik kalır; dersi olan içerik silinemez.

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'hoca4@ornek.edu.tr'),
  ('42222222-2222-2222-2222-222222222222', 'yabanci4@ornek.com');
insert into public.teachers (eposta) values ('hoca4@ornek.edu.tr'), ('yabanci4@ornek.com') on conflict do nothing;

-- ---------------------------------------------------------------- HOCA
set role authenticated;
set request.jwt.claims = '{"sub":"41111111-1111-1111-1111-111111111111","email":"hoca4@ornek.edu.tr"}';

-- İçerik seçilmeden açılan derse kendiliğinden içerik bağlanır
with d as (insert into courses (ad, donem) values ('Din Felsefesi I', '2026 Güz') returning id, subject_id)
select set_config('t4.ders26', id::text, false), set_config('t4.icerik', subject_id::text, false) from d;

do $$
begin
  assert current_setting('t4.icerik') <> '', 'HATA: derse icerik baglanmadi';
  assert (select ad from subjects where id = current_setting('t4.icerik')::uuid) = 'Din Felsefesi I', 'HATA: icerik adi';
end $$;

-- Gelecek yılın dönemi aynı içeriğe bağlanır
with d as (insert into courses (ad, donem, subject_id) values ('Din Felsefesi I', '2027 Güz', current_setting('t4.icerik')::uuid) returning id)
select set_config('t4.ders27', id::text, false) from d;

with l as (insert into lessons (subject_id, ad) values (current_setting('t4.icerik')::uuid, '1. hafta') returning id)
select set_config('t4.akis', id::text, false) from l;
with a as (insert into lesson_steps (lesson_id, sira, tur) values (current_setting('t4.akis')::uuid, 1, 'yoklama') returning id)
select set_config('t4.adim', id::text, false) from a;

-- Başka bir içerik ve onun akışı
with d as (insert into courses (ad) values ('Başka Ders') returning subject_id)
select set_config('t4.icerik2', subject_id::text, false) from d;
with l as (insert into lessons (subject_id, ad) values (current_setting('t4.icerik2')::uuid, 'Başka akış') returning id)
select set_config('t4.akis2', id::text, false) from l;

-- İki dönemin oturumu da ortak akışı kullanabilir
with s as (insert into sessions (course_id, lesson_id, aktif_adim)
           values (current_setting('t4.ders27')::uuid, current_setting('t4.akis')::uuid, current_setting('t4.adim')::uuid) returning id)
select set_config('t4.sid27', id::text, false) from s;
insert into sessions (course_id, lesson_id) values (current_setting('t4.ders26')::uuid, current_setting('t4.akis')::uuid);

do $$
begin
  begin
    insert into sessions (course_id, lesson_id) values (current_setting('t4.ders27')::uuid, current_setting('t4.akis2')::uuid);
    raise exception 'HATA: baska icerigin akisi oturuma baglandi';
  exception when check_violation then null;
  end;
  assert public.depo_dersi_benim(current_setting('t4.icerik') || '/x.pdf'), 'HATA: icerik yolu okunamadi';
  assert (ders_durumu(current_setting('t4.sid27')::uuid) -> 'adim' ->> 'tur') = 'yoklama', 'HATA: ders durumu';
end $$;

-- ---------------------------------------------------------------- YABANCI
set request.jwt.claims = '{"sub":"42222222-2222-2222-2222-222222222222","email":"yabanci4@ornek.com"}';
do $$
begin
  assert (select count(*) from subjects) = 0, 'HATA: yabanci icerik goruyor';
  assert not public.depo_dersi_benim(current_setting('t4.icerik') || '/x.pdf'), 'HATA: yabanci icerik yoluna erisiyor';
  begin
    insert into courses (ad, subject_id) values ('Çalıntı', current_setting('t4.icerik')::uuid);
    raise exception 'HATA: yabanci baskasinin icerigine ders bagladi';
  exception when check_violation then null;
  end;
  begin
    insert into lessons (subject_id, ad) values (current_setting('t4.icerik')::uuid, 'Sızma');
    raise exception 'HATA: yabanci baskasinin icerigine akis ekledi';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- SİLME
set request.jwt.claims = '{"sub":"41111111-1111-1111-1111-111111111111","email":"hoca4@ornek.edu.tr"}';
delete from courses where id = current_setting('t4.ders26')::uuid;
do $$
begin
  assert exists (select 1 from subjects where id = current_setting('t4.icerik')::uuid), 'HATA: donem silinince icerik gitti';
  assert exists (select 1 from lessons where id = current_setting('t4.akis')::uuid), 'HATA: donem silinince akis gitti';
  begin
    delete from subjects where id = current_setting('t4.icerik')::uuid;
    raise exception 'HATA: dersi olan icerik silindi';
  exception when restrict_violation or foreign_key_violation then null;
  end;
end $$;

reset role;
reset request.jwt.claims;
select '0004 tamam' as sonuc;
