-- 0030: Ders kodu sabit (yoklama yazdırmadığı için dönmesine gerek yok)
--
-- Kullanıcı isteği (14 Kasım 2026): ders giriş kodu yoklamaya dahil olmadığına göre 6 saniyede bir değişmesi gerekmez.
-- * Projeksiyonlu derste kod oturum boyunca sabittir; öğrenciyi yalnızca derse (etkinlik, quiz, oyun) dahil eder.
--   Yoklamanın sahteciliğe karşı koruması karekodda kalır (6 saniyede bir değişir).
-- * Projeksiyonsuz derste (telefon_modu açık) kod yoklamayı da yazdırdığı için 60 saniyede bir değişir; hoca kodu sesli
--   okuyabilsin diye süre uzundur. Güncel ve önceki iki pencerenin kodu (en fazla 3 dakika) kabul edilir.
-- ozel.kod_bilgisi: sabit kodda kalan süre olarak 30 sn döner (istemci bu aralıkla yeniden sorar ve mod değişimini yakalar).

create or replace function ozel.kod_bilgisi(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_simdi   double precision := extract(epoch from clock_timestamp());
  v_dakika  bigint := floor(v_simdi / 60)::bigint;
  v_anahtar text;
  v_telefon boolean;
begin
  select g.anahtar, s.telefon_modu into v_anahtar, v_telefon
  from ozel.session_secrets g
  join public.sessions s on s.id = g.session_id
  where g.session_id = p_session;
  if v_anahtar is null then
    return null;
  end if;
  if v_telefon then
    return jsonb_build_object(
      'kod', ozel.ders_kodu(v_anahtar, v_dakika),
      'kalan_ms', ceil(((v_dakika + 1) * 60 - v_simdi) * 1000)
    );
  end if;
  return jsonb_build_object('kod', ozel.ders_kodu(v_anahtar, 0), 'kalan_ms', 30000);
end;
$$;

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
  v_dakika  bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
  r         record;
  v_sonuc   jsonb;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_kod) <> 6 then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  select s.id, s.yoklama_acik, s.telefon_modu, s.baslik, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), '') as ders, g.anahtar
    into r
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.bitti is null
    and s.basladi > now() - interval '12 hours'
    and (
      (not s.telefon_modu and v_kod = ozel.ders_kodu(g.anahtar, 0))
      or (s.telefon_modu and v_kod in (ozel.ders_kodu(g.anahtar, v_dakika), ozel.ders_kodu(g.anahtar, v_dakika - 1), ozel.ders_kodu(g.anahtar, v_dakika - 2)))
    )
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
