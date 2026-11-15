-- 0041: Kale hücre haritası için oyuncu bazında takım ve soru sonuçları
--
-- takim_oyuncu_sonuclari: perdedeki turun soruları için takımdaki her oyuncunun sonucu (1 doğru, 0 yanlış, -1 cevapsız, null açılmamış).
-- Yalnızca okur; perde (anahtarsız hoca) ya da kumanda (anahtarla) çağırır (ozel.sinif_yetki).

create function public.takim_oyuncu_sonuclari(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sayi   integer;
  v_lesson uuid;
  v_aktif  uuid;
  v_durum  text;
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0) into v_sayi;
  select s.lesson_id, s.aktif_adim, s.soru_durum, s.aktif_tur into v_lesson, v_aktif, v_durum, v_tur from public.sessions s where s.id = p_session;
  return (
    with sorular as (
      select st.id,
             row_number() over (order by st.sira, st.id)::integer as n,
             ((st.id is distinct from v_aktif or v_durum = 'sonuc')
              and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = st.id)) as acildi
      from public.lesson_steps st
      where st.lesson_id = v_lesson and st.tur = 'soru' and st.tur_id is not distinct from v_tur
    )
    select jsonb_build_object(
      'sayi', v_sayi,
      'sorular', coalesce((select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'acildi', x.acildi) order by x.n) from sorular x), '[]'::jsonb),
      'oyuncular', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ad', coalesce(ozel.oyuncu_adi(p_session, u.cihaz_id), 'Öğrenci'),
          'takim', u.takim,
          'sonuc', (
            select jsonb_agg(
              case when not x.acildi then null
                   when r.dogru is null then -1
                   when r.dogru then 1
                   else 0 end
              order by x.n)
            from sorular x
            left join public.responses r on r.session_id = p_session and r.step_id = x.id and r.cihaz_id = u.cihaz_id
          )
        ) order by u.takim, u.cihaz_id)
        from (select * from public.takim_uyeleri m where m.session_id = p_session and m.takim <= v_sayi order by m.takim, m.cihaz_id limit 250) u
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.takim_oyuncu_sonuclari(uuid, text) from public;
grant execute on function public.takim_oyuncu_sonuclari(uuid, text) to anon, authenticated;
