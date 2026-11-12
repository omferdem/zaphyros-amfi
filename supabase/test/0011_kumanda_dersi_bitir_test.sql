-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql). Adlar uydurmadır.
-- Düz SQL'dir: hepsi geçerse son satırda "0011 tamam" yazar.
-- Beklenen: kumanda anahtarıyla ders bitirilir (yoklama kapanır, ders_durumu bitti döner), yeniden açılır;
-- yanlış anahtar bitiremez; kapalı derste öğrenci yoklama bileti alamaz.

insert into auth.users (id, email) values ('b1111111-1111-1111-1111-111111111111', 'hoca11@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca11@ornek.edu.tr') on conflict do nothing;

set role authenticated;
set request.jwt.claims = '{"sub":"b1111111-1111-1111-1111-111111111111","email":"hoca11@ornek.edu.tr"}';

with d as (insert into courses (ad) values ('Bitiş Dersi') returning id)
select set_config('t11.ders', id::text, false) from d;
with s as (insert into sessions (course_id, yoklama_acik) values (current_setting('t11.ders')::uuid, true) returning id)
select set_config('t11.sid', id::text, false) from s;
select set_config('t11.kumanda', kumanda_anahtari(current_setting('t11.sid')::uuid), false);

reset request.jwt.claims;
set role anon;
do $$
declare
  v   jsonb;
  sid uuid := current_setting('t11.sid')::uuid;
begin
  assert (ders_durumu(sid) ->> 'bitti')::boolean = false, 'HATA: ders baslangicta bitmis gorunuyor';

  assert kumanda_komut(sid, 'yanlis-anahtar', 'ders_bitir') ->> 'hata' = 'anahtar_gecersiz', 'HATA: yanlis anahtarla ders bitti';
  assert (ders_durumu(sid) ->> 'bitti')::boolean = false, 'HATA: yanlis anahtar dersi bitirdi';

  v := kumanda_komut(sid, current_setting('t11.kumanda'), 'ders_bitir');
  assert v ->> 'durum' = 'tamam', 'HATA: ders bitirilemedi: ' || v::text;
  v := ders_durumu(sid);
  assert (v ->> 'bitti')::boolean and not (v ->> 'yoklama_acik')::boolean, 'HATA: bitis durumu: ' || v::text;

  -- İkinci kez bitirmek bitiş zamanını bozmaz; kapalı derste yoklama bileti verilmez
  v := kumanda_komut(sid, current_setting('t11.kumanda'), 'ders_bitir');
  assert v ->> 'durum' = 'tamam', 'HATA: ikinci bitirme';
  assert katilim_bileti(sid, 'x', 'cihaz-bitis-0001') ->> 'hata' in ('yoklama_kapali', 'kod_eski'), 'HATA: bitmis derste bilet';

  v := kumanda_komut(sid, current_setting('t11.kumanda'), 'ders_ac');
  assert v ->> 'durum' = 'tamam', 'HATA: ders acilamadi';
  v := ders_durumu(sid);
  assert not (v ->> 'bitti')::boolean, 'HATA: ders yeniden acilmadi: ' || v::text;
  -- Yeniden açılan derste yoklama kapalı kalır
  assert not (v ->> 'yoklama_acik')::boolean, 'HATA: yoklama kendiliginden acildi: ' || v::text;
end $$;

reset role;
select '0011 tamam' as sonuc;
