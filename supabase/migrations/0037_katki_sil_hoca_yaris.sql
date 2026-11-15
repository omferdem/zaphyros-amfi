-- Öğrencinin kendi beyin fırtınası fikrini silmesi ve hocayla yarış skorunun düzeltilmesi.
-- katki_sil: yalnızca kendi cihazının, açık ve süren etkinlikteki fikri; silinen fikir hakkı geri verir.

create function public.katki_sil(p_session uuid, p_cihaz text, p_metin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r       record;
  v_kisi  text;
  v_metin text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
  v_sayi  integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  select s.aktif_adim, s.soru_durum, s.bitti into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'fikir'
  where s.id = p_session;
  if not found then
    return jsonb_build_object('hata', 'etkinlik_yok');
  end if;
  if r.bitti is not null or r.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  perform pg_advisory_xact_lock(hashtext(v_kisi));
  delete from public.contributions k
  where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi
    and k.taraf is null and lower(k.metin) = lower(v_metin);
  select count(*) into v_sayi from public.contributions k
  where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi and k.taraf is null;
  return jsonb_build_object('durum', 'tamam', 'kalan', greatest(0, 3 - v_sayi));
end;
$$;
revoke all on function public.katki_sil(uuid, text, text) from public;
grant execute on function public.katki_sil(uuid, text, text) to anon, authenticated;

-- Hocayla yarış: hoca cevabı verilmiş ve geçilmiş (ya da sonucu açılmış) her soru sayılır; sınıf cevabı olmasa da skor işler.
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
      'sinif', coalesce(sum(case when t.sinif_orani >= 50 then 1 else 0 end), 0),
      'soru', count(*),
      'cevapladi', exists (select 1 from public.hoca_cevaplari c where c.session_id = p_session and c.step_id = v_aktif),
      'son', (
        select jsonb_build_object('hoca_dogru', x.hoca_dogru, 'sinif_orani', x.sinif_orani)
        from (
          select (c.secim = q.dogru) as hoca_dogru,
                 (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                    from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
          from public.hoca_cevaplari c
          join public.lesson_steps st on st.id = c.step_id
          join public.questions q on q.id = st.question_id
          where c.session_id = p_session and c.step_id = v_aktif and v_durum = 'sonuc'
        ) x
      )
    )
    from (
      select (c.secim = q.dogru) as hoca_dogru,
             (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
      from public.hoca_cevaplari c
      join public.lesson_steps st on st.id = c.step_id
      join public.questions q on q.id = st.question_id
      where c.session_id = p_session
        and st.lesson_id = v_lesson and st.tur_id is not distinct from v_tur
        and (c.step_id is distinct from v_aktif or v_durum = 'sonuc')
    ) t
  );
end;
$$;

