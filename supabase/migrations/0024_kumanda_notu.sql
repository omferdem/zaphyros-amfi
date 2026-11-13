-- 0024: Hoca notu kumandada
--
-- Akış düzenlemede bir slayda yazılan hoca notu (lesson_steps.ayar.not) yalnızca düzenleme ekranında görünüyordu.
-- Kumanda (telefon) artık adımların listesinde notu da alır; sahne ve öğrenci telefonu bu notu görmez
-- (ozel.durum notu içermez). Not 600 harfe kadar kesilir. Başka hiçbir davranış değişmez: 0010'daki kumanda_durumu
-- aynen korunur, yalnızca adım özetine "not" alanı eklenir.

create or replace function public.kumanda_durumu(p_session uuid, p_anahtar text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_lesson uuid;
  v_adim   uuid;
  v_durum  jsonb;
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  select s.course_id, s.lesson_id, s.aktif_adim into v_course, v_lesson, v_adim from public.sessions s where s.id = p_session;

  v_durum := ozel.durum(p_session);
  if v_durum -> 'adim' ->> 'tur' in ('fikir', 'oylama') then
    v_durum := jsonb_set(v_durum, '{adim}', (v_durum -> 'adim') || ozel.etkinlik(p_session, v_adim, true));
  end if;

  return v_durum || jsonb_build_object(
    'katilan', (select count(*) from public.attendance a where a.session_id = p_session),
    'mevcut', (select count(*) from public.students st where st.course_id = v_course),
    'kod', ozel.kod_bilgisi(p_session),
    'puanlar', ozel.puanlar(p_session, 5),
    'adimlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'tur', st.tur,
        'sunum', p.ad,
        'sayfa_no', st.sayfa_no,
        'ozet', left(case
          when st.tur = 'slayt' then p.metinler ->> (st.sayfa_no - 1)
          when st.tur = 'soru' then q.soru
          when st.tur in ('fikir', 'oylama') then st.ayar ->> 'soru'
          when st.tur = 'video' then coalesce(nullif(st.ayar ->> 'baslik', ''), st.ayar ->> 'url')
        end, 140),
        'not', left(nullif(btrim(coalesce(st.ayar ->> 'not', '')), ''), 600)
      ) order by st.sira, st.id)
      from public.lesson_steps st
      left join public.presentations p on p.id = st.presentation_id
      left join public.questions q on q.id = st.question_id
      where st.lesson_id = v_lesson
    ), '[]'::jsonb)
  );
end;
$$;
