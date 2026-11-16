-- 0050: Kumanda isteğine oyun zorluğu
--
-- Telefon kumandasından oyun başlatırken zorluk (kolay / orta / zor) seçilebilir; perde isteği alınca zorluğu oyunun başında uygular.
-- Başka bir değişiklik yok: kumanda_istek önceki tanımın aynısıdır, yalnızca `zorluk` alanını (varsayılan orta) taşır ve doğrular.

create or replace function public.kumanda_istek(p_session uuid, p_anahtar text, p_istek jsonb)
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
  v_adet  integer;
  v_zorluk text := coalesce(p_istek ->> 'zorluk', 'orta');
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
  if v_mod not in ('oneri', '', 'takim', 'halat', 'hoca', 'zombi', 'roket', 'ejderha', 'arena', 'kule', 'kale', 'merdiven', 'orman') then
    return jsonb_build_object('hata', 'istek_gecersiz');
  end if;
  if v_zorluk not in ('kolay', 'orta', 'zor') then
    return jsonb_build_object('hata', 'istek_gecersiz');
  end if;
  v_sure := least(240, greatest(1, coalesce((p_istek ->> 'sure')::integer, 10)));
  v_adet := least(100, greatest(5, coalesce((p_istek ->> 'adet')::integer, 20)));

  update public.sessions
     set kumanda_istek = jsonb_build_object('tur', v_tur, 'paket', v_paket, 'mod', v_mod, 'sure', v_sure, 'adet', v_adet, 'zorluk', v_zorluk,
                                            't', floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
   where id = p_session and bitti is null;
  if not found then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;
