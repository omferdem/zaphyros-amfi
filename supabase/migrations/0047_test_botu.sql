-- 0047: Test botu için doğru cevap sorgusu
--
-- scripts/bot.mjs gerçek ders yolundan sanal öğrencilerle cevap verir ve ayarlanan başarı oranına uymak için doğru şıkkı bilmelidir.
-- Bu işlev doğru şıkkı YALNIZCA dersin adı "TEST-BOT" ile başlayan bir şubede, soru açıkken döndürür.
-- Gerçek derslerde her zaman { hata: 'test_dersi_degil' } döner; öğrenciye hiçbir bilgi sızmaz.

create function public.test_dogru_index(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.sessions s join public.courses c on c.id = s.course_id
      where s.id = p_session and s.bitti is null and c.ad like 'TEST-BOT%'
    ) then jsonb_build_object('hata', 'test_dersi_degil')
    else coalesce((
      select jsonb_build_object('adim', st.id, 'dogru_index', array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1)
      from public.sessions s
      join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'soru'
      join public.questions q on q.id = st.question_id
      where s.id = p_session and s.soru_durum = 'acik'
    ), jsonb_build_object('hata', 'soru_acik_degil'))
  end;
$$;

revoke all on function public.test_dogru_index(uuid) from public;
grant execute on function public.test_dogru_index(uuid) to anon, authenticated;
