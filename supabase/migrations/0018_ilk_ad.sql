-- 0018: Oyunlarda ve sınıf düğmelerinde öğrencinin ilk adı görünür
--
-- Kullanıcı kararı (13 Kasım 2026): derse herkes kayıtlı numarasıyla girdiği için oyunlarda takma ad yerine
-- öğrencinin ilk adı görünsün.
-- * İlk ad: ad soyaddaki soyad hariç kısım ("Ahmet Can Yılmaz" -> "Ahmet Can", "Ayşe Kaya" -> "Ayşe").
-- * Aynı oturumda aynı ilk adı taşıyan başka bir yoklamalı öğrenci varsa soyadın baş harfi eklenir ("Ali V.").
-- * Yoklaması olmayan, takma ad almış cihazın görünen adı takma adın kendisidir (kısaltılmaz).
-- Değişen: ozel.oyuncu_adi (puan tablosu, podyum, sonuçlar) ve ozel.sinif_adi (parmak, soru, sıkıldım, takım).

create function ozel.ilk_ad(p_session uuid, p_student uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when s.ad !~ '\s' then s.ad
           when exists (
             select 1
             from public.attendance a
             join public.students o on o.id = a.student_id
             where a.session_id = p_session
               and o.id <> p_student
               and lower(regexp_replace(btrim(o.ad_soyad), '\s+\S+$', '')) = lower(s.ilk)
           ) then s.ilk || ' ' || left(regexp_replace(s.ad, '^.*\s', ''), 1) || '.'
           else s.ilk
         end
  from (
    select btrim(st.ad_soyad) as ad,
           case when btrim(st.ad_soyad) ~ '\s' then regexp_replace(btrim(st.ad_soyad), '\s+\S+$', '') else btrim(st.ad_soyad) end as ilk
    from public.students st
    where st.id = p_student
  ) s;
$$;

create or replace function ozel.oyuncu_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ozel.ilk_ad(p_session, a.student_id) from public.attendance a
      where a.session_id = p_session and a.cihaz_id = p_cihaz),
    (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
  );
$$;

create or replace function ozel.sinif_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(ozel.oyuncu_adi(p_session, p_cihaz), 40);
$$;

revoke all on function ozel.ilk_ad(uuid, uuid) from public;
