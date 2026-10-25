-- 0008: Şube adı ekranlarda görünür
--
-- Bir dersin 6 7 şubesi olduğunda perdede, kumandada ve öğrenci telefonunda hangi şubenin açık olduğu
-- görünmelidir ("Din Felsefesi I · B"). Öğrenciye giden ders adı (katilim_bileti, kodla_katil, ders_durumu
-- ve kumanda_durumu) şube adını da taşır; şubesiz derslerde değişen bir şey olmaz.
-- Yalnızca ders adı metni değişir; fonksiyonların diğer davranışı aynıdır.

-- 0002'deki katilim_bileti
create or replace function public.katilim_bileti(p_session uuid, p_token text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
  v_acik    boolean;
  v_bitti   timestamptz;
  v_ders    text;
  v_baslik  text;
  v_pencere bigint := ozel.pencere();
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select g.anahtar, s.yoklama_acik, s.bitti, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''), s.baslik
    into v_anahtar, v_acik, v_bitti, v_ders, v_baslik
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.id = p_session;

  if v_anahtar is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  if not v_acik or v_bitti is not null then
    return jsonb_build_object('hata', 'yoklama_kapali');
  end if;

  if p_token is null or p_token not in (
    ozel.kod(v_anahtar, v_pencere, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 1, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 2, 'qr')
  ) then
    return jsonb_build_object('hata', 'kod_eski');
  end if;

  return jsonb_build_object(
    'bilet', v_pencere::text || '.' || ozel.kod(v_anahtar, v_pencere, 'bilet:' || p_cihaz),
    'ders', v_ders,
    'baslik', v_baslik
  );
end;
$$;

-- 0003'teki kodla_katil
create or replace function public.kodla_katil(p_kod text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kod     text := regexp_replace(coalesce(p_kod, ''), '[^0-9]', '', 'g');
  v_dakika  bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
  v_pencere bigint := ozel.pencere();
  r         record;
  v_sonuc   jsonb;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_kod) <> 6 then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  -- Kod içinde bulunulan ya da bir önceki dakikanınki olabilir (yazarken dakika dönerse).
  select s.id, s.yoklama_acik, s.baslik, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), '') as ders, g.anahtar
    into r
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.bitti is null
    and s.basladi > now() - interval '12 hours'
    and v_kod in (ozel.ders_kodu(g.anahtar, v_dakika), ozel.ders_kodu(g.anahtar, v_dakika - 1))
  order by s.basladi desc
  limit 1;

  if not found then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  v_sonuc := jsonb_build_object('oturum', r.id, 'ders', r.ders, 'baslik', r.baslik, 'yoklama', r.yoklama_acik);
  if r.yoklama_acik then
    v_sonuc := v_sonuc || jsonb_build_object(
      'bilet', v_pencere::text || '.' || ozel.kod(r.anahtar, v_pencere, 'bilet:' || p_cihaz)
    );
  end if;
  return v_sonuc;
end;
$$;

-- 0006'daki ozel.durum (ders_durumu ve kumanda_durumu bunu kullanır)
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
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
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
      ) else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;
