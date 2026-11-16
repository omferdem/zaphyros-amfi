-- 0049: Final turu: oyun turunun son 3 sorusunda puan x2
--
-- Geride kalana geri dönüş şansı: Zapoot ve oyun turlarında (en az 6 soruluk tur) son 3 soruda doğru cevabın puanı iki katı olur.
-- * ozel.final_turu(adim): bu adım, kendi turunun son 3 sorusundan biri mi (turu olmayan normal ders soruları hiçbir zaman değil).
-- * responses.puan üst sınırı 2000'e çıkar (tek soru en çok 2000).
-- * cevap_ver: final turunda doğru cevap puanı x2 (yanlış 0 kalır).
-- * ozel.durum: adim.final_turu alanı; perde "FİNAL TURU x2" duyurur, telefon etiket gösterir.

-- Final turunda tek soru 2000 puana çıkabilir
alter table public.responses drop constraint if exists responses_puan_check;
alter table public.responses add constraint responses_puan_check check (puan between 0 and 2000);

create function ozel.final_turu(p_adim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    with t as (
      select st.id, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
      from public.lesson_steps st
      where st.tur_id = (select x.tur_id from public.lesson_steps x where x.id = p_adim)
    )
    select t.toplam >= 6 and t.no > t.toplam - 3 from t where t.id = p_adim
  ), false);
$$;

revoke all on function ozel.final_turu(uuid) from public;

create or replace function public.cevap_ver(p_session uuid, p_cihaz text, p_secim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r          record;
  v_ms       integer;
  v_secenek  text[];
  v_dogru    boolean;
  v_puan     integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.soru_basladi, s.bitti, q.id as soru, q.dogru, q.sure_sn
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'soru'
  join public.questions q on q.id = st.question_id
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'soru_yok');
  end if;
  v_ms := floor(extract(epoch from (clock_timestamp() - r.soru_basladi)) * 1000)::integer;
  -- Ağ gecikmesi için 1,5 saniye pay
  if r.bitti is not null or r.soru_durum is distinct from 'acik' or v_ms > r.sure_sn * 1000 + 1500 then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;
  if ozel.oyuncu_adi(p_session, p_cihaz) is null then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;

  v_secenek := ozel.secenekler(p_session, r.soru);
  if p_secim is null or p_secim < 0 or p_secim >= cardinality(v_secenek) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;

  v_dogru := v_secenek[p_secim + 1] = r.dogru;
  v_puan := case when v_dogru
    then 1000 - round(500.0 * least(greatest(v_ms, 0), r.sure_sn * 1000) / (r.sure_sn * 1000))::integer
    else 0 end;
  -- Final turu: oyun turunun son 3 sorusunda (tur en az 6 soruysa) doğru cevabın puanı iki katıdır
  if v_dogru and ozel.final_turu(r.aktif_adim) then
    v_puan := v_puan * 2;
  end if;

  insert into public.responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
  values (p_session, r.aktif_adim, r.soru, p_cihaz, p_secim, v_dogru, v_puan, greatest(v_ms, 0))
  on conflict do nothing;
  if not found then
    return jsonb_build_object('hata', 'zaten_cevapladin');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'telefon_modu', s.telefon_modu,
    'ekran_goruntusu', s.ekran_goruntusu,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'final_turu', (a.tur_id is not null and a.toplam >= 6 and a.no > a.toplam - 3),
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end,
        'gorsel', case when s.telefon_modu and a.tur = 'slayt' and p.gorseller_hazir
          then p.subject_id::text || '/' || p.id::text || '/' || a.sayfa_no::text end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'elenen', (select j.veri -> 'elenen' from public.soru_jokerleri j where j.session_id = s.id and j.step_id = a.id and j.tur = 'yarim'),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      )
      when a.tur in ('fikir', 'oylama', 'video') then ozel.etkinlik(s.id, a.id)
      else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
          -- Oyun turlarında sıra ve toplam yalnızca etkin turun adımlarını sayar (eski turların adımları saymaz)
          and st.tur_id is not distinct from (select x.tur_id from public.lesson_steps x where x.id = s.aktif_adim)
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;
