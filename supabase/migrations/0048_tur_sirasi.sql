-- 0048: Soru sırası ve toplamı yalnızca etkin oyun turunun adımlarını saysın
--
-- Aynı gizli ⚡ akışta her oyun turu yeni adım satırları ekler; eski turların adımları silinmez. ders_durumu "Soru 11 / 20" gibi
-- eski turları da sayıyordu (ikinci oyunda 1/10 yerine 11/20). Sıra ve toplam artık etkin adımla aynı tura ait adımlardan hesaplanır;
-- normal ders akışında (tur_id boş) davranış aynen kalır.

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
