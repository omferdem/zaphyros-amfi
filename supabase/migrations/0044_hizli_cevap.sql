-- 0044: Oyuncu başına hızlı doğru ve "cevap verdi" bilgisi
--
-- zombi_goster her oyuncu için iki alan daha döndürür (eski alanlar aynen durur):
-- * hizli: soru sırasıyla 1 (doğru ve sürenin ilk üçte birinde cevaplandı) ya da 0;
-- * cevapladi: açık soruda bu oyuncu cevap verdi mi (doğruluğu sızdırmaz).

create or replace function public.zombi_goster(p_session uuid, p_anahtar text default null)
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
    with sorular as (
      select st.id, q.sure_sn,
             row_number() over (order by st.sira, st.id)::integer as n,
             ((st.id is distinct from v_aktif or v_durum = 'sonuc')
              and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = st.id)) as acildi
      from public.lesson_steps st
      join public.questions q on q.id = st.question_id
      where st.lesson_id = v_lesson and st.tur = 'soru' and st.tur_id is not distinct from v_tur
    ),
    cihazlar as (
      select a.cihaz_id as cihaz from public.attendance a where a.session_id = p_session and a.cihaz_id is not null
      union
      select r.cihaz_id from public.responses r where r.session_id = p_session and r.step_id in (select x.id from sorular x)
    ),
    oyuncular as (
      select c.cihaz from cihazlar c order by c.cihaz limit 250
    )
    select jsonb_build_object(
      'sorular', coalesce((select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'acildi', x.acildi) order by x.n) from sorular x), '[]'::jsonb),
      'oyuncular', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ad', coalesce(ozel.oyuncu_adi(p_session, o.cihaz), 'Öğrenci'),
          'sonuc', (
            select jsonb_agg(
              case when not x.acildi then null
                   when r.dogru is null then -1
                   when r.dogru then 1
                   else 0 end
              order by x.n)
            from sorular x
            left join public.responses r on r.session_id = p_session and r.step_id = x.id and r.cihaz_id = o.cihaz
          ),
          'hizli', (
            select jsonb_agg(case when x.acildi and r.dogru and r.sure_ms <= x.sure_sn * 1000 / 3 then 1 else 0 end order by x.n)
            from sorular x
            left join public.responses r on r.session_id = p_session and r.step_id = x.id and r.cihaz_id = o.cihaz
          ),
          'cevapladi', (v_durum = 'acik' and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = v_aktif and r.cihaz_id = o.cihaz))
        ))
        from oyuncular o
      ), '[]'::jsonb)
    )
  );
end;
$$;
