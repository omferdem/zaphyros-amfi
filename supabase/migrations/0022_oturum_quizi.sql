-- 0022: Derse girmiş öğrenci quize kod girmeden katılır
--
-- Kullanıcı sorusu (14 Kasım 2026): öğrenci zaten derse (yoklamaya) girmişken quiz için ayrıca kod ve numara girmesi gereksiz.
-- Hoca şubede bir quiz açtığında, o şubenin açık oturumunda yoklaması alınmış öğrencinin telefonunda "Quiz başladı" çıkar;
-- öğrenci tek dokunuşla başlar. Kimlik, derse girişteki yoklama kaydından alınır (numara yeniden girilmez).
-- * oturum_quizi(p_session, p_cihaz): şubenin açık quizi varsa özetini döndürür (başlık, süre, bu cihazın kimliği var mı,
--   bu öğrenci quizi bitirmiş mi). Yoklaması olmayan cihaz kimliksiz görünür ve eski yolla (kod + numara) girer.
-- * oturum_quizi_baslat(p_session, p_cihaz): yoklama kaydındaki öğrenciyle quizi başlatır ya da kaldığı yerden devam ettirir;
--   mevcut quiz_baslat'ı çağırır, böylece bütün kurallar (tek cihaz, süre, karıştırma) aynen geçerlidir.
-- Kod ve numara ile girme yolu değişmeden durur (yoklamasız ya da başka sınıfta çözdürülen quizler için).

create function public.oturum_quizi(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course  uuid;
  z         record;
  v_student uuid;
  v_bitti   boolean := false;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  select s.course_id into v_course from public.sessions s where s.id = p_session and s.bitti is null;
  if v_course is null then
    return jsonb_build_object('quiz', null);
  end if;
  select q.id, q.baslik, q.sure_dk into z
  from public.quizzes q
  where q.course_id = v_course and q.durum = 'acik'
  order by q.basladi desc
  limit 1;
  if not found then
    return jsonb_build_object('quiz', null);
  end if;
  select a.student_id into v_student
  from public.attendance a
  where a.session_id = p_session and a.cihaz_id = p_cihaz;
  if v_student is not null then
    select (qa.bitti is not null) into v_bitti from public.quiz_attempts qa where qa.quiz_id = z.id and qa.student_id = v_student;
  end if;
  return jsonb_build_object('quiz', jsonb_build_object(
    'baslik', z.baslik,
    'sure_dk', z.sure_dk,
    'kimlik', v_student is not null,
    'bitti', coalesce(v_bitti, false)
  ));
end;
$$;

create function public.oturum_quizi_baslat(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course  uuid;
  z         record;
  v_no      text;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  select s.course_id into v_course from public.sessions s where s.id = p_session and s.bitti is null;
  if v_course is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  select q.id, q.kod into z
  from public.quizzes q
  where q.course_id = v_course and q.durum = 'acik'
  order by q.basladi desc
  limit 1;
  if not found then
    return jsonb_build_object('hata', 'quiz_yok');
  end if;
  select st.ogrenci_no into v_no
  from public.attendance a
  join public.students st on st.id = a.student_id
  where a.session_id = p_session and a.cihaz_id = p_cihaz;
  if v_no is null then
    return jsonb_build_object('hata', 'yoklama_yok');
  end if;
  return public.quiz_baslat(z.kod, v_no, p_cihaz);
end;
$$;

revoke all on function public.oturum_quizi(uuid, text)        from public;
revoke all on function public.oturum_quizi_baslat(uuid, text) from public;
grant execute on function public.oturum_quizi(uuid, text)        to anon, authenticated;
grant execute on function public.oturum_quizi_baslat(uuid, text) to anon, authenticated;
