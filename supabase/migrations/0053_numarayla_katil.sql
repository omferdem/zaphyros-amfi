-- 0053: Derste kodla giren öğrenci numarasıyla kimliğini bildirir (yoklama yazılmaz)
--
-- Kullanıcı kararı (24 Kasım 2026): ders başladıktan sonra perdedeki ders koduyla giren öğrenci takma ad yerine
-- öğrenci numarasını girer; numara şube listesinden ad soyada çevrilir ve oyunlarda ilk adıyla görünür.
-- Kod sınıfta paylaşılabileceği için bu yol YOKLAMA YAZMAZ (yoklama yalnızca karekodla).
-- * Numara oturumun şubesinin listesinde olmalı (misafir öğrenciler dahil, şubeye eklenmiş her kayıt).
-- * Görünen ad ilk addır ("Ahmet Can Yılmaz" -> "Ahmet Can"); aynı oturumda bu ad alınmışsa soyadın baş harfi eklenir.
--   Aynı numarayı başka cihaz kullanıyorsa 'numara_kullanildi' döner.
-- * Ders dışı etkinliklerde (gizli __etkinlik_* dersleri) liste olmadığı için kullanılmaz; orada yalnızca takma ad vardır.

alter table public.session_players add column ogrenci_id uuid references public.students (id) on delete cascade;

create function public.numarayla_katil(p_session uuid, p_cihaz text, p_numara text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_no      text := btrim(coalesce(p_numara, ''));
  v_ders    uuid;
  v_ogr     public.students;
  v_ilk     text;
  v_soyad   text;
  v_ad      text;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if v_no !~ '^[0-9A-Za-z]{1,20}$' then
    return jsonb_build_object('hata', 'numara_gecersiz');
  end if;
  select s.course_id into v_ders from public.sessions s where s.id = p_session and s.bitti is null;
  if v_ders is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  select * into v_ogr from public.students st where st.course_id = v_ders and lower(st.ogrenci_no) = lower(v_no);
  if not found then
    return jsonb_build_object('hata', 'numara_gecersiz');
  end if;
  -- Aynı numara bu oturumda başka cihazdan alınmış mı?
  if exists (select 1 from public.session_players p where p.session_id = p_session and p.cihaz_id <> p_cihaz and p.ogrenci_id = v_ogr.id) then
    return jsonb_build_object('hata', 'numara_kullanildi');
  end if;
  v_ilk := case when btrim(v_ogr.ad_soyad) ~ '\s' then regexp_replace(btrim(v_ogr.ad_soyad), '\s+\S+$', '') else btrim(v_ogr.ad_soyad) end;
  v_soyad := case when btrim(v_ogr.ad_soyad) ~ '\s' then regexp_replace(btrim(v_ogr.ad_soyad), '^.*\s', '') else '' end;
  v_ad := left(v_ilk, 24);
  begin
    insert into public.session_players (session_id, cihaz_id, takma_ad, ogrenci_id) values (p_session, p_cihaz, v_ad, v_ogr.id)
    on conflict (session_id, cihaz_id) do update set takma_ad = excluded.takma_ad, ogrenci_id = excluded.ogrenci_id;
  exception when unique_violation then
    v_ad := left(v_ilk || ' ' || left(v_soyad, 1) || '.', 24);
    begin
      insert into public.session_players (session_id, cihaz_id, takma_ad, ogrenci_id) values (p_session, p_cihaz, v_ad, v_ogr.id)
      on conflict (session_id, cihaz_id) do update set takma_ad = excluded.takma_ad, ogrenci_id = excluded.ogrenci_id;
    exception when unique_violation then
      return jsonb_build_object('hata', 'numara_kullanildi');
    end;
  end;
  return jsonb_build_object('durum', 'tamam', 'ad', v_ad);
end;
$$;

revoke all on function public.numarayla_katil(uuid, text, text) from public;
grant execute on function public.numarayla_katil(uuid, text, text) to anon, authenticated;
