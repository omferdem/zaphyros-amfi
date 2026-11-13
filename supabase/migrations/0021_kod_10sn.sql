-- 0021: Ders kodu da karekod gibi 10 saniyede bir değişir
--
-- Kullanıcı isteği (13 Kasım 2026): perdedeki 6 haneli giriş kodu, karekodla aynı sürede (10 saniye) değişsin; kod
-- dışarıdaki birine verilip derse girilemesin. Karekodda olduğu gibi içinde bulunulan ve önceki iki pencerenin kodu
-- kabul edilir (toplam en fazla 30 saniye), böylece yavaş yazan öğrenci de girebilir.
-- * ozel.kod_bilgisi: kod, 10 saniyelik pencere numarasından türetilir; kalan süre pencerenin bitişine göredir.
-- * public.kodla_katil: 0008'deki fonksiyon aynı mantıkla, dakika yerine pencere numarasıyla eşleşir.

create or replace function ozel.kod_bilgisi(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_simdi   double precision := extract(epoch from clock_timestamp());
  v_pencere bigint := floor(v_simdi / 10)::bigint;
  v_anahtar text;
begin
  select g.anahtar into v_anahtar from ozel.session_secrets g where g.session_id = p_session;
  if v_anahtar is null then
    return null;
  end if;
  return jsonb_build_object(
    'kod', ozel.ders_kodu(v_anahtar, v_pencere),
    'kalan_ms', ceil(((v_pencere + 1) * 10 - v_simdi) * 1000)
  );
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
  r         record;
  v_sonuc   jsonb;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_kod) <> 6 then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  -- Kod içinde bulunulan ya da önceki iki pencerenin (10 sn) kodu olabilir (yazarken pencere dönebilir).
  select s.id, s.yoklama_acik, s.baslik, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), '') as ders, g.anahtar
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
  if r.yoklama_acik then
    v_sonuc := v_sonuc || jsonb_build_object(
      'bilet', v_pencere::text || '.' || ozel.kod(r.anahtar, v_pencere, 'bilet:' || p_cihaz)
    );
  end if;
  return v_sonuc;
end;
$$;
