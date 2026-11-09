-- YALNIZCA YEREL TEST İÇİN (bkz. supabase_taklit.sql).
-- Düz SQL'dir: her denetim başarısızsa hata verir, hepsi geçerse son satırda "0009 tamam" yazar.
-- Beklenen: girişsiz çağrı tabloya yazar ve saatte en fazla bir kez; tabloyu doğrudan okuyamaz.

set role anon;
do $$
declare
  v1 jsonb;
  v2 jsonb;
  v_sayac bigint;
begin
  v1 := public.uyandir();
  assert (v1 ->> 'tamam')::boolean and (v1 ->> 'yazildi')::boolean, 'HATA: ilk cagri yazmadi: ' || v1::text;
  v2 := public.uyandir();
  assert (v2 ->> 'tamam')::boolean and not (v2 ->> 'yazildi')::boolean, 'HATA: ikinci cagri saat dolmadan yazdi: ' || v2::text;

  begin
    perform 1 from ozel.nabiz;
    raise exception 'HATA: anon nabiz tablosunu okudu';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Saat dolunca tekrar yazar
reset role;
update ozel.nabiz set zaman = now() - interval '2 hours' where id = 1;
set role anon;
do $$
begin
  assert (public.uyandir() ->> 'yazildi')::boolean, 'HATA: saat dolunca yazmadi';
end $$;

reset role;
do $$
begin
  assert (select sayac from ozel.nabiz where id = 1) = 2, 'HATA: sayac';
end $$;
select '0009 tamam' as sonuc;
