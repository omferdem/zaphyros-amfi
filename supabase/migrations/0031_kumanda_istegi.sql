-- 0031: Telefon kumandasından Kahoot, oyun ve quiz başlatma
--
-- Kumanda telefonu hoca girişi yapmadan çalışır (yalnızca kumanda anahtarı vardır); Kahoot akışı kurmak, quiz oluşturmak
-- ise hoca yetkisi ister. Bu yüzden kumanda yalnızca bir "istek" bırakır; perdede açık duran sahne ekranı (hoca girişli)
-- isteği realtime ile alır, mevcut Kahoot ve quiz kodlarıyla uygular ve isteği temizler.
-- * sessions.kumanda_istek: bekleyen istek ({ tur, paket, mod, sure, t }); sahne işleyince boşaltır.
-- * kumanda_paketler(oturum, anahtar): kumandada gösterilecek soru paketleri (ad, soru sayısı, önerilen oyun modu).
-- * kumanda_istek(oturum, anahtar, istek): tür 'kahoot' (paket + oyun modu), 'quiz' (paket + süre dk), 'quiz_bitir' ya da 'derse_don'.
-- Kumanda anahtarı olmayan hiçbir şey yapamaz; istek yalnızca açık (bitmemiş) oturuma yazılır.

alter table public.sessions add column kumanda_istek jsonb;

create function public.kumanda_paketler(p_session uuid, p_anahtar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_subject uuid;
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select c.subject_id into v_subject
  from public.sessions s join public.courses c on c.id = s.course_id
  where s.id = p_session;
  return jsonb_build_object('paketler', coalesce((
    select jsonb_agg(t.x order by t.x ->> 'ad')
    from (
      select jsonb_build_object('ad', btrim(q.ek ->> 'paket'), 'sayi', count(*), 'mod', coalesce(max(q.ek ->> 'mod'), '')) as x
      from public.questions q
      where q.subject_id = v_subject and coalesce(btrim(q.ek ->> 'paket'), '') <> ''
      group by btrim(q.ek ->> 'paket')
    ) t
  ), '[]'::jsonb));
end;
$$;

create function public.kumanda_istek(p_session uuid, p_anahtar text, p_istek jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tur   text := p_istek ->> 'tur';
  v_paket text := left(btrim(coalesce(p_istek ->> 'paket', '')), 200);
  v_mod   text := coalesce(p_istek ->> 'mod', 'oneri');
  v_sure  integer;
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if v_tur is null or v_tur not in ('kahoot', 'quiz', 'quiz_bitir', 'derse_don') then
    return jsonb_build_object('hata', 'istek_gecersiz');
  end if;
  if v_tur in ('kahoot', 'quiz') and v_paket = '' then
    return jsonb_build_object('hata', 'paket_yok');
  end if;
  if v_mod not in ('oneri', '', 'takim', 'halat', 'hoca', 'zombi', 'roket', 'ejderha', 'arena', 'kule', 'merdiven') then
    return jsonb_build_object('hata', 'istek_gecersiz');
  end if;
  v_sure := least(240, greatest(1, coalesce((p_istek ->> 'sure')::integer, 10)));

  update public.sessions
     set kumanda_istek = jsonb_build_object('tur', v_tur, 'paket', v_paket, 'mod', v_mod, 'sure', v_sure,
                                            't', floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
   where id = p_session and bitti is null;
  if not found then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function public.kumanda_paketler(uuid, text)       from public;
revoke all on function public.kumanda_istek(uuid, text, jsonb)   from public;
grant execute on function public.kumanda_paketler(uuid, text)    to anon, authenticated;
grant execute on function public.kumanda_istek(uuid, text, jsonb) to anon, authenticated;
