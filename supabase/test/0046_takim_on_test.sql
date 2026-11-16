-- YALNIZCA YEREL TEST İÇİN. Adlar uydurmadır. Düz SQL: hepsi geçerse son satırda "0046 tamam" yazar.
-- Beklenen: 10 takıma kadar ayarlanabilir ve takım seçilebilir; 11 ve 1 reddedilir.

insert into auth.users (id, email) values ('c4646464-4646-4646-4646-464646464601', 'hoca46@ornek.edu.tr');
insert into public.teachers (eposta) values ('hoca46@ornek.edu.tr') on conflict do nothing;
set role authenticated;
set request.jwt.claims = '{"sub":"c4646464-4646-4646-4646-464646464601","email":"hoca46@ornek.edu.tr"}';
with d as (insert into courses (ad) values ('Takim On Dersi') returning id) select set_config('t46.ders', id::text, false) from d;
with s as (insert into sessions (course_id) values (current_setting('t46.ders')::uuid) returning id) select set_config('t46.sid', id::text, false) from s;
select set_config('t46.k', kumanda_anahtari(current_setting('t46.sid')::uuid), false);
reset request.jwt.claims;
reset role;
insert into session_players (session_id, cihaz_id, takma_ad) values (current_setting('t46.sid')::uuid, 'cihaz-on-000001', 'Oyuncu');

set role anon;
do $$
declare sid uuid := current_setting('t46.sid')::uuid; k text := current_setting('t46.k'); v jsonb;
begin
  assert takim_ayarla(sid, k, 10) ->> 'durum' = 'tamam', 'HATA: 10 takim';
  assert takim_ayarla(sid, k, 11) ->> 'hata' = 'sayi_gecersiz', 'HATA: 11 takim kabul edildi';
  assert takim_ayarla(sid, k, 1) ->> 'hata' = 'sayi_gecersiz', 'HATA: 1 takim kabul edildi';
  assert takim_ayarla(sid, k, 10) ->> 'durum' = 'tamam', 'HATA: 10 takim 2';
  v := takim_sec(sid, 'cihaz-on-000001', 10);
  assert v ->> 'durum' = 'tamam' or v ->> 'takim' is not null, 'HATA: 10. takima girilemedi: ' || v::text;
  assert jsonb_array_length(takim_goster(sid, k) -> 'takimlar') = 10, 'HATA: takim listesi';
end $$;
reset role;
select '0046 tamam' as sonuc;
