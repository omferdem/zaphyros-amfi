-- 0025: Açık uçlu soruda süre ve "cevapları yansıt"
--
-- Hoca açık uçlu soruyu açar; öğrenciler belirlenen süre (lesson_steps.ayar.sure_sn, 5-600 sn) içinde telefondan yazar;
-- süre bitince (ya da hoca bitirince) "Cevapları yansıt" denir ve cevaplar perdeye ancak o zaman düşer.
-- * ozel.etkinlik: sure_sn ve kalan_ms döner; mod "acik" iken cevaplar yansıtılana (soru_durum = sonuc) kadar gizlenir
--   (gizli_cevap = true). Kumanda (p_hepsi) cevapları hep görür.
-- * katki_gonder: süre verilmişse süre dolunca sure_bitti hatası verir.
-- Süresiz etkinlikler ve diğer kipler eskisi gibi çalışır.

create or replace function ozel.etkinlik(p_session uuid, p_adim uuid, p_hepsi boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when st.tur = 'video' then jsonb_build_object('video', st.ayar ->> 'url', 'soru', st.ayar ->> 'baslik')
    else jsonb_build_object(
      'soru', st.ayar ->> 'soru',
      'soru_durum', s.soru_durum,
      'cevap_sayisi', (select count(distinct k.kisi) from public.contributions k where k.session_id = s.id and k.step_id = st.id),
      'sure_sn', case when (st.ayar ->> 'sure_sn') ~ '^[0-9]{1,3}$' and (st.ayar ->> 'sure_sn')::int between 5 and 600
                      then (st.ayar ->> 'sure_sn')::int end,
      'kalan_ms', case when s.soru_durum = 'acik' and (st.ayar ->> 'sure_sn') ~ '^[0-9]{1,3}$'
                            and (st.ayar ->> 'sure_sn')::int between 5 and 600
                       then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => (st.ayar ->> 'sure_sn')::int) - clock_timestamp())) * 1000))::integer end
    ) || case
      when st.tur = 'fikir' then jsonb_build_object(
        'gizli_cevap', (st.ayar ->> 'mod' = 'acik' and not (p_hepsi or s.soru_durum = 'sonuc')),
        'fikirler', case
          when st.ayar ->> 'mod' = 'acik' and not (p_hepsi or s.soru_durum = 'sonuc') then '[]'::jsonb
          else coalesce((
            select jsonb_agg(jsonb_build_object('m', f.metin, 'n', f.sayi) order by f.sayi desc, f.ilk)
            from (
              select min(k.metin) as metin, count(*) as sayi, min(k.zaman) as ilk
              from public.contributions k
              where k.session_id = s.id and k.step_id = st.id and not k.gizli
              group by lower(k.metin)
              order by count(*) desc, min(k.zaman)
              limit case when st.ayar ->> 'mod' in ('acik', 'firtina') then 200 else 60 end
            ) f
          ), '[]'::jsonb)
        end,
        'mod', coalesce(st.ayar ->> 'mod', 'bulut')
      )
      else jsonb_build_object(
        'etiketler', case
          when jsonb_typeof(st.ayar -> 'etiketler') = 'array' and jsonb_array_length(st.ayar -> 'etiketler') = 2
            then st.ayar -> 'etiketler'
          else '["Katılıyorum", "Katılmıyorum"]'::jsonb
        end,
        'sayilar', case when p_hepsi or s.soru_durum = 'sonuc' then (
          select jsonb_build_array(count(*) filter (where k.taraf = 0), count(*) filter (where k.taraf = 1))
          from public.contributions k where k.session_id = s.id and k.step_id = st.id
        ) end,
        'gerekceler', case when p_hepsi or s.soru_durum = 'sonuc' then coalesce((
          select jsonb_agg(jsonb_build_object('t', g.taraf, 'm', g.metin) order by g.zaman desc)
          from (
            select k.taraf, k.metin, k.zaman
            from public.contributions k
            where k.session_id = s.id and k.step_id = st.id and not k.gizli and k.metin <> ''
            order by k.zaman desc
            limit 40
          ) g
        ), '[]'::jsonb) end
      )
    end
  end
  from public.sessions s
  join public.lesson_steps st on st.id = p_adim
  where s.id = p_session;
$$;

create or replace function public.katki_gonder(p_session uuid, p_cihaz text, p_metin text, p_taraf integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r        record;
  v_kisi   text;
  v_metin  text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
  v_sayi   integer;
  v_en     integer;
  v_hak    integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.soru_basladi, s.bitti, st.tur, st.ayar ->> 'mod' as mod,
         case when (st.ayar ->> 'sure_sn') ~ '^[0-9]{1,3}$' and (st.ayar ->> 'sure_sn')::int between 5 and 600
              then (st.ayar ->> 'sure_sn')::int end as sure
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur in ('fikir', 'oylama')
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'etkinlik_yok');
  end if;
  if r.bitti is not null or r.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  -- Etkinliğe süre verilmişse süre dolunca cevap alınmaz (1,5 sn ağ payı)
  if r.sure is not null and r.soru_basladi is not null
     and clock_timestamp() > r.soru_basladi + make_interval(secs => r.sure) + interval '1.5 seconds' then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;

  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  perform pg_advisory_xact_lock(hashtext(v_kisi));

  if (select count(*) from public.contributions k where k.session_id = p_session and k.step_id = r.aktif_adim) >= 2000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if r.tur = 'fikir' then
    v_en := case r.mod when 'acik' then 300 when 'firtina' then 120 else 40 end;
    v_hak := case r.mod when 'acik' then 1 else 3 end;
    if length(v_metin) < 2 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > v_en then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    select count(*) into v_sayi from public.contributions k
    where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi;
    if v_sayi >= v_hak then
      return jsonb_build_object('hata', 'sinir');
    end if;
    if exists (
      select 1 from public.contributions k
      where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi and lower(k.metin) = lower(v_metin)
    ) then
      return jsonb_build_object('hata', 'ayni');
    end if;
    insert into public.contributions (session_id, step_id, kisi, metin) values (p_session, r.aktif_adim, v_kisi, v_metin);
    return jsonb_build_object('durum', 'tamam', 'kalan', v_hak - 1 - v_sayi);
  end if;

  if p_taraf is null or p_taraf not in (0, 1) then
    return jsonb_build_object('hata', 'taraf_gecersiz');
  end if;
  if length(v_metin) > 200 then
    return jsonb_build_object('hata', 'metin_uzun');
  end if;
  insert into public.contributions as k (session_id, step_id, kisi, taraf, metin)
  values (p_session, r.aktif_adim, v_kisi, p_taraf, v_metin)
  on conflict (session_id, step_id, kisi) where taraf is not null
  do update set taraf = excluded.taraf,
                gizli = k.gizli and k.metin = excluded.metin,
                metin = excluded.metin,
                zaman = now();
  return jsonb_build_object('durum', 'tamam', 'kalan', 0);
end;
$$;
