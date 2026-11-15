-- Takım oyunları (halat, kule, kale) için soru bazında takım sayımı ve hocayla yarış kuralı.
-- 1) takim_soru_ozeti: perdedeki turun her sorusu için her takımın doğru ve yanlış sayısı (cevap vermeyen = üye - doğru - yanlış).
-- 2) hoca_yaris_goster: hoca cevap vermediyse soru kaybedilmiş sayılır; sınıf puanı için doğru oranı en az %60 olmalı.

create function public.takim_soru_ozeti(p_session uuid, p_anahtar text default null)
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
    ),
    takimlar as (
      select g.takim,
             (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim)::integer as uye
      from generate_series(1, v_sayi) as g(takim)
    )
    select jsonb_build_object(
      'sayi', v_sayi,
      'sorular', coalesce((select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'acildi', x.acildi) order by x.n) from sorular x), '[]'::jsonb),
      'takimlar', coalesce((
        select jsonb_agg(jsonb_build_object(
          'takim', t.takim,
          'uye', t.uye,
          'sorular', (
            select jsonb_agg(jsonb_build_object(
              'dogru', case when x.acildi then (
                  select count(*) from public.responses r
                  join public.takim_uyeleri u on u.session_id = r.session_id and u.cihaz_id = r.cihaz_id
                  where r.session_id = p_session and r.step_id = x.id and u.takim = t.takim and r.dogru)::integer else 0 end,
              'yanlis', case when x.acildi then (
                  select count(*) from public.responses r
                  join public.takim_uyeleri u on u.session_id = r.session_id and u.cihaz_id = r.cihaz_id
                  where r.session_id = p_session and r.step_id = x.id and u.takim = t.takim and not r.dogru)::integer else 0 end
            ) order by x.n)
            from sorular x)
        ) order by t.takim)
        from takimlar t
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.takim_soru_ozeti(uuid, text) from public;
grant execute on function public.takim_soru_ozeti(uuid, text) to anon, authenticated;

-- Hocayla yarış: geçilmiş ya da sonucu açılmış her soru sayılır; hoca cevap vermediyse kaybeder; sınıf doğru oranı en az %60 ise sınıf kazanır.
create or replace function public.hoca_yaris_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson uuid;
  v_aktif  uuid;
  v_durum  text;
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum, s.aktif_tur into v_lesson, v_aktif, v_durum, v_tur from public.sessions s where s.id = p_session;
  return (
    select jsonb_build_object(
      'acik', coalesce((select y.acik from public.hoca_yaris y where y.session_id = p_session), false),
      'hoca', coalesce(sum(case when t.hoca_dogru then 1 else 0 end), 0),
      'sinif', coalesce(sum(case when t.sinif_orani >= 60 then 1 else 0 end), 0),
      'soru', count(*),
      'cevapladi', exists (select 1 from public.hoca_cevaplari c where c.session_id = p_session and c.step_id = v_aktif),
      'son', (
        select jsonb_build_object('hoca_dogru', x.hoca_dogru, 'sinif_orani', x.sinif_orani)
        from (
          select coalesce(c.secim = q.dogru, false) as hoca_dogru,
                 (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                    from public.responses r where r.session_id = p_session and r.step_id = st.id) as sinif_orani
          from public.lesson_steps st
          join public.questions q on q.id = st.question_id
          left join public.hoca_cevaplari c on c.session_id = p_session and c.step_id = st.id
          where st.id = v_aktif and v_durum = 'sonuc'
        ) x
      )
    )
    from (
      select coalesce(c.secim = q.dogru, false) as hoca_dogru,
             (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                from public.responses r where r.session_id = p_session and r.step_id = st.id) as sinif_orani
      from public.lesson_steps st
      join public.questions q on q.id = st.question_id
      left join public.hoca_cevaplari c on c.session_id = p_session and c.step_id = st.id
      where st.lesson_id = v_lesson and st.tur = 'soru' and st.tur_id is not distinct from v_tur
        and (st.id is distinct from v_aktif or v_durum = 'sonuc')
        and (c.step_id is not null or exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = st.id))
    ) t
  );
end;
$$;
