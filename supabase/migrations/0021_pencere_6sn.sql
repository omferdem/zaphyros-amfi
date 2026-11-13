-- 0021: Karekod ve ders kodu 6 saniyede bir değişir
--
-- Kullanıcı isteği (13 Kasım 2026): karekod ve yoklama (ders) kodu süresi uzun bulundu; ikisi de 6 saniyede bir değişsin ki
-- kod ya da karekod dışarıdaki birine iletilip derse girilemesin. Tek bir pencere süresi (6 sn) hepsini yönetir:
-- * ozel.pencere(): içinde bulunulan 6 saniyelik pencerenin numarası (karekod, ders kodu ve bilet bunu kullanır).
-- * public.qr_token: sahnedeki karekodun içeriği 6 saniyelik pencereden türetilir.
-- * ozel.kod_bilgisi: ders kodu 6 saniyelik pencereden türetilir; kalan süre pencerenin bitişine göredir.
-- * katilim_bileti ve kodla_katil: içinde bulunulan ve önceki iki pencerenin (en fazla 18 sn) karekodu ya da kodu kabul edilir,
--   yavaş okutan ya da yazan öğrenci de girebilir. Öğrenciye verilen bilet, numarayı yazması için yaklaşık 108 sn geçerlidir.

create or replace function ozel.pencere()
returns bigint
language sql
volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) / 6)::bigint;
$$;

create or replace function public.qr_token(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
  v_simdi   double precision := extract(epoch from clock_timestamp());
  v_pencere bigint := floor(v_simdi / 6)::bigint;
begin
  select g.anahtar into v_anahtar
  from ozel.session_secrets g
  join public.sessions s on s.id = g.session_id
  join public.courses c on c.id = s.course_id
  where g.session_id = p_session and c.teacher_id = auth.uid();

  if v_anahtar is null then
    raise exception 'oturum bulunamadi' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'token', ozel.kod(v_anahtar, v_pencere, 'qr'),
    'kalan_ms', ceil(((v_pencere + 1) * 6 - v_simdi) * 1000)
  );
end;
$$;

create or replace function ozel.kod_bilgisi(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_simdi   double precision := extract(epoch from clock_timestamp());
  v_pencere bigint := floor(v_simdi / 6)::bigint;
  v_anahtar text;
begin
  select g.anahtar into v_anahtar from ozel.session_secrets g where g.session_id = p_session;
  if v_anahtar is null then
    return null;
  end if;
  return jsonb_build_object(
    'kod', ozel.ders_kodu(v_anahtar, v_pencere),
    'kalan_ms', ceil(((v_pencere + 1) * 6 - v_simdi) * 1000)
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

  -- Kod içinde bulunulan ya da önceki iki pencerenin (6 sn) kodu olabilir (yazarken pencere dönebilir).
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
