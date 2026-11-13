-- 0026: Öğrenciye devam serisi
--
-- Derse giren öğrencinin telefonunda "🔥 4 ders üst üste" gibi bir rozet göstermek için.
-- devam_serisi(p_session, p_cihaz): cihaz bu oturumun yoklamasındaysa, öğrencinin şubesindeki en son derslerden başlayarak
-- kaç dersin üst üste katıldığını döndürür. Yalnızca en az bir öğrencinin katıldığı oturumlar "yapılmış ders" sayılır
-- (deneme ya da yanlışlıkla açılmış oturum seriyi bozmaz). Öğrencinin adını ya da başkalarının bilgisini döndürmez.
-- Yoklaması olmayan cihaz için { seri: 0 } döner.

create function public.devam_serisi(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ogrenci uuid;
  v_course  uuid;
  v_seri    integer;
  v_katilan integer;
  v_toplam  integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('seri', 0, 'katilan', 0, 'toplam', 0);
  end if;
  select a.student_id, s.course_id into v_ogrenci, v_course
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  where a.session_id = p_session and a.cihaz_id = p_cihaz;
  if v_ogrenci is null then
    return jsonb_build_object('seri', 0, 'katilan', 0, 'toplam', 0);
  end if;

  with dersler as (
    select s.id, s.basladi,
           exists (select 1 from public.attendance a where a.session_id = s.id and a.student_id = v_ogrenci) as geldi
    from public.sessions s
    where s.course_id = v_course
      and exists (select 1 from public.attendance x where x.session_id = s.id)
  ),
  sirali as (
    select geldi,
           sum(case when geldi then 0 else 1 end) over (order by basladi desc, id rows unbounded preceding) as bosluk
    from dersler
  )
  select coalesce((select count(*) from sirali where geldi and bosluk = 0), 0)::integer,
         (select count(*) from dersler where geldi)::integer,
         (select count(*) from dersler)::integer
    into v_seri, v_katilan, v_toplam;

  return jsonb_build_object('seri', v_seri, 'katilan', v_katilan, 'toplam', v_toplam);
end;
$$;

revoke all on function public.devam_serisi(uuid, text) from public;
grant execute on function public.devam_serisi(uuid, text) to anon, authenticated;
