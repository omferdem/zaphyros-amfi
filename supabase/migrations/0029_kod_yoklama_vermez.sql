-- 0029: Derse katılım kodu yoklama yazdırmaz (projeksiyonsuz ders hariç)
--
-- Kullanıcı isteği (14 Kasım 2026): perdedeki 6 haneli ders kodu yalnızca öğrenciyi derse (etkinlik, quiz, oyun) dahil etsin;
-- yoklama yalnızca karekodla alınsın. Hoca yoklamayı kapatınca yoklama durur; geç gelenler kodla derse girer, hoca isterse
-- karekodu yeniden açıp onların da yoklamasını alır (aynı haftanın yoklamasına yazılır).
-- İstisna: projeksiyonsuz derste (telefon_modu açık; karekod gösterilecek perde yoktur) kod yoklamayı da yazdırır, yani
-- yoklama açıkken kodu giren öğrenciye numara girişi için bilet verilir.
-- Dönen "yoklama" alanı yoklamanın o an açık olup olmadığını bildirir.

create or replace function public.kodla_katil(p_kod text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kod     text := regexp_replace(coalesce(p_kod, ''), '[^0-9]', '', 'g');
  v_pencere bigint := ozel.pencere();
  r         record;
  v_sonuc   jsonb;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_kod) <> 6 then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  -- Kod içinde bulunulan ya da önceki iki pencerenin (6 sn) kodu olabilir (yazarken pencere dönebilir).
  select s.id, s.yoklama_acik, s.telefon_modu, s.baslik, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), '') as ders, g.anahtar
    into r
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.bitti is null
    and s.basladi > now() - interval '12 hours'
    and v_kod in (ozel.ders_kodu(g.anahtar, v_pencere), ozel.ders_kodu(g.anahtar, v_pencere - 1), ozel.ders_kodu(g.anahtar, v_pencere - 2))
  order by s.basladi desc
  limit 1;

  if not found then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  v_sonuc := jsonb_build_object('oturum', r.id, 'ders', r.ders, 'baslik', r.baslik, 'yoklama', r.yoklama_acik);
  if r.yoklama_acik and r.telefon_modu then
    v_sonuc := v_sonuc || jsonb_build_object('bilet', v_pencere::text || '.' || ozel.kod(r.anahtar, v_pencere, 'bilet:' || p_cihaz));
  end if;
  return v_sonuc;
end;
$$;
