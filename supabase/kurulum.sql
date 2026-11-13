-- AmfiOS kurulum SQL'i (bu dosya otomatik üretilir, elle düzenleme; kaynağı supabase/migrations)
-- Yeni bir Supabase projesinde SQL Editor'e bu dosyanın tamamını yapıştırıp bir kez çalıştır.
-- İçerdiği migration'lar: 0001_saglik.sql, 0002_yoklama.sql, 0003_ders_akisi.sql, 0004_ders_icerigi.sql, 0005_bilgi_yarismasi.sql, 0006_telefon_modu.sql, 0007_donem_sube_plan.sql, 0008_sube_gorunur.sql, 0009_uyandir.sql, 0010_tartisma.sql, 0011_kumanda_dersi_bitir.sql, 0012_quiz.sql, 0013_misafir_ogrenci.sql, 0014_sinif_etkilesimi.sql, 0015_takim_yarismasi.sql, 0016_hocayla_yaris.sql, 0017_bilgi_merdiveni.sql, 0018_ilk_ad.sql, 0019_oyun_adimi.sql, 0020_yoklama_haftalari.sql, 0021_kod_10sn.sql

-- ===========================================================================
-- 0001_saglik.sql
-- ===========================================================================

-- 0001: Sağlık kontrolü
-- Panelin "sunucu bağlantısı" göstergesi ve keepalive iş akışı bu fonksiyonu çağırır.
-- Her çağrı veritabanında gerçek bir sorgu çalıştırır; böylece Supabase Free
-- projesi "hareketsiz" sayılıp duraklatılmaz.

create or replace function public.saglik()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.saglik() from public;
grant execute on function public.saglik() to anon, authenticated;

-- ===========================================================================
-- 0002_yoklama.sql
-- ===========================================================================

-- 0002: Faz 1, QR yoklama
--
-- Tablolar: teachers, courses, students, sessions, attendance
-- Gizli şema: ozel (Data API'ye kapalı; oturum anahtarları burada)
-- RPC: hoca_mi, kurulum_sahipsiz, kurulumu_sahiplen, qr_token, katilim_bileti, check_in
--
-- Yoklama güvenliği kısaca:
-- * Her oturumun rastgele bir gizli anahtarı var (ozel.session_secrets). Bu anahtar
--   hiçbir rol tarafından doğrudan okunamaz, yalnızca aşağıdaki fonksiyonlar kullanır.
-- * QR içindeki kod, anahtar ve 10 saniyelik zaman penceresinden türetilir. Veritabanına
--   her 10 saniyede yazma yapılmaz; sahne ekranı qr_token() ile güncel kodu sorar.
-- * Öğrenci QR'ı okutunca katilim_bileti() kodu hemen doğrular (son 3 pencere, en fazla
--   30 sn) ve cihaza bağlı, 3 dakika geçerli bir bilet verir. Numara bu biletle girilir.
--   Böylece numarayı yazmak için acele etmek gerekmez ama eski bir QR fotoğrafı da işe yaramaz.
-- * check_in() bileti, öğrenci listesini ve tek cihaz / tek numara kuralını denetler.

-- ---------------------------------------------------------------------------
-- Gizli şema
-- ---------------------------------------------------------------------------
create schema if not exists ozel;
revoke all on schema ozel from public;
revoke all on schema ozel from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hocalar: izin listesi. Burada e-postası olmayan biri giriş yapsa bile ders açamaz.
-- Data API'ye açılmaz (grant yok); kontrol hoca_mi() ile yapılır.
-- ---------------------------------------------------------------------------
create table public.teachers (
  eposta    text primary key check (eposta = lower(eposta)),
  ad_soyad  text,
  unvan     text,
  eklendi   timestamptz not null default now()
);
alter table public.teachers enable row level security;

create function public.hoca_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t
    where t.eposta = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- Dersler
-- ---------------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ad           text not null check (length(btrim(ad)) between 1 and 200),
  kod          text check (length(kod) <= 40),
  donem        text check (length(donem) <= 40),
  olusturuldu  timestamptz not null default now()
);
create index courses_teacher_idx on public.courses (teacher_id);
alter table public.courses enable row level security;

create policy "hoca kendi derslerini yonetir" on public.courses
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()) and (select public.hoca_mi()));

-- Yardımcı: bu ders oturum açmış hocanın mı?
create function public.ders_benim(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Öğrenciler (dersin sınıf listesi)
-- ---------------------------------------------------------------------------
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  ogrenci_no  text not null check (ogrenci_no ~ '^[0-9A-Za-z]{1,20}$'),
  ad_soyad    text not null check (length(btrim(ad_soyad)) between 1 and 120),
  eklendi     timestamptz not null default now(),
  unique (course_id, ogrenci_no)
);
alter table public.students enable row level security;

create policy "hoca kendi ogrencilerini yonetir" on public.students
  for all to authenticated
  using (public.ders_benim(course_id))
  with check (public.ders_benim(course_id));

-- ---------------------------------------------------------------------------
-- Oturumlar (canlı ders)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  baslik        text check (length(baslik) <= 200),
  yoklama_acik  boolean not null default true,
  basladi       timestamptz not null default now(),
  bitti         timestamptz
);
create index sessions_course_idx on public.sessions (course_id);
alter table public.sessions enable row level security;

create policy "hoca kendi oturumlarini yonetir" on public.sessions
  for all to authenticated
  using (public.ders_benim(course_id))
  with check (public.ders_benim(course_id));

create function public.oturum_benim(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.courses c on c.id = s.course_id
    where s.id = p_session and c.teacher_id = auth.uid()
  );
$$;

-- Oturumun gizli anahtarı. RLS açık, politika yok, grant yok: kimse doğrudan okuyamaz.
create table ozel.session_secrets (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  anahtar     text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  )
);
alter table ozel.session_secrets enable row level security;

create function ozel.oturum_anahtari_olustur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ozel.session_secrets (session_id) values (new.id);
  return new;
end;
$$;

create trigger sessions_anahtar
  after insert on public.sessions
  for each row execute function ozel.oturum_anahtari_olustur();

-- Anahtar + pencere + amaçtan 16 haneli kod türetir.
create function ozel.kod(p_anahtar text, p_pencere bigint, p_amac text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substr(encode(sha256(convert_to(p_amac || ':' || p_pencere::text || ':' || p_anahtar, 'UTF8')), 'hex'), 1, 16);
$$;

-- Şu anki 10 saniyelik pencerenin numarası.
create function ozel.pencere()
returns bigint
language sql
volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) / 10)::bigint;
$$;

-- ---------------------------------------------------------------------------
-- Yoklama kayıtları
-- ---------------------------------------------------------------------------
create table public.attendance (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  cihaz_id    text check (length(cihaz_id) between 8 and 64),
  yontem      text not null default 'qr' check (yontem in ('qr', 'elle')),
  zaman       timestamptz not null default now(),
  primary key (session_id, student_id)
);
create unique index attendance_cihaz_tekil on public.attendance (session_id, cihaz_id)
  where cihaz_id is not null;
create index attendance_student_idx on public.attendance (student_id);
alter table public.attendance enable row level security;

-- Elle eklenen kaydın öğrencisi, oturumla aynı dersten olmalı.
create function public.yoklama_yazilabilir(p_session uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    join public.courses c on c.id = s.course_id
    join public.students st on st.course_id = s.course_id
    where s.id = p_session and st.id = p_student and c.teacher_id = auth.uid()
  );
$$;

create policy "hoca yoklamayi gorur" on public.attendance
  for select to authenticated
  using (public.oturum_benim(session_id));

create policy "hoca elle yoklama ekler" on public.attendance
  for insert to authenticated
  with check (
    yontem = 'elle' and cihaz_id is null
    and public.yoklama_yazilabilir(session_id, student_id)
  );

create policy "hoca yoklama siler" on public.attendance
  for delete to authenticated
  using (public.oturum_benim(session_id));

-- ---------------------------------------------------------------------------
-- RPC: sahne ekranı için güncel QR kodu (yalnızca oturumun sahibi hoca)
-- ---------------------------------------------------------------------------
create function public.qr_token(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
  v_simdi   double precision := extract(epoch from clock_timestamp());
  v_pencere bigint := floor(v_simdi / 10)::bigint;
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
    'kalan_ms', ceil(((v_pencere + 1) * 10 - v_simdi) * 1000)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci QR'ı okuttuğunda (girişsiz)
-- Dönen değer: { bilet, ders, baslik } ya da { hata }
-- ---------------------------------------------------------------------------
create function public.katilim_bileti(p_session uuid, p_token text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
  v_acik    boolean;
  v_bitti   timestamptz;
  v_ders    text;
  v_baslik  text;
  v_pencere bigint := ozel.pencere();
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select g.anahtar, s.yoklama_acik, s.bitti, c.ad, s.baslik
    into v_anahtar, v_acik, v_bitti, v_ders, v_baslik
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.id = p_session;

  if v_anahtar is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  if not v_acik or v_bitti is not null then
    return jsonb_build_object('hata', 'yoklama_kapali');
  end if;

  if p_token is null or p_token not in (
    ozel.kod(v_anahtar, v_pencere, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 1, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 2, 'qr')
  ) then
    return jsonb_build_object('hata', 'kod_eski');
  end if;

  return jsonb_build_object(
    'bilet', v_pencere::text || '.' || ozel.kod(v_anahtar, v_pencere, 'bilet:' || p_cihaz),
    'ders', v_ders,
    'baslik', v_baslik
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci numarasını girer (girişsiz)
-- Dönen değer: { durum: 'tamam', ad, zaten } ya da { hata }
-- ---------------------------------------------------------------------------
create function public.check_in(p_session uuid, p_bilet text, p_cihaz text, p_ogrenci_no text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar  text;
  v_course   uuid;
  v_acik     boolean;
  v_bitti    timestamptz;
  v_pencere  bigint;
  v_no       text := upper(regexp_replace(coalesce(p_ogrenci_no, ''), '\s', '', 'g'));
  v_student  uuid;
  v_ad       text;
  v_mevcut   text;
  v_diger    uuid;
  v_kisa     text;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if p_bilet is null or p_bilet !~ '^[0-9]{1,15}\.[0-9a-f]{16}$' then
    return jsonb_build_object('hata', 'bilet_gecersiz');
  end if;
  if v_no !~ '^[0-9A-Z]{1,20}$' then
    return jsonb_build_object('hata', 'numara_gecersiz');
  end if;

  select g.anahtar, s.course_id, s.yoklama_acik, s.bitti
    into v_anahtar, v_course, v_acik, v_bitti
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  where s.id = p_session;

  if v_anahtar is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  if not v_acik or v_bitti is not null then
    return jsonb_build_object('hata', 'yoklama_kapali');
  end if;

  v_pencere := split_part(p_bilet, '.', 1)::bigint;
  if ozel.pencere() - v_pencere not between 0 and 18
     or split_part(p_bilet, '.', 2) <> ozel.kod(v_anahtar, v_pencere, 'bilet:' || p_cihaz) then
    return jsonb_build_object('hata', 'bilet_gecersiz');
  end if;

  select st.id, st.ad_soyad into v_student, v_ad
  from public.students st
  where st.course_id = v_course and upper(st.ogrenci_no) = v_no;

  if v_student is null then
    return jsonb_build_object('hata', 'liste_disi');
  end if;

  -- Ekranda tam ad yerine "Ad S." biçimi gösterilir.
  v_kisa := split_part(btrim(v_ad), ' ', 1);
  if btrim(v_ad) ~ '\s' then
    v_kisa := v_kisa || ' ' || left(regexp_replace(btrim(v_ad), '^.*\s', ''), 1) || '.';
  end if;

  -- Bu numara bu oturumda zaten yoklamaya girdi mi?
  select a.cihaz_id into v_mevcut
  from public.attendance a
  where a.session_id = p_session and a.student_id = v_student;

  if found then
    if v_mevcut = p_cihaz then
      return jsonb_build_object('durum', 'tamam', 'ad', v_kisa, 'zaten', true);
    end if;
    return jsonb_build_object('hata', 'numara_kullanildi');
  end if;

  -- Bu cihazdan bu oturumda başka bir numara girildi mi?
  select a.student_id into v_diger
  from public.attendance a
  where a.session_id = p_session and a.cihaz_id = p_cihaz;

  if found then
    return jsonb_build_object('hata', 'cihaz_kullanildi');
  end if;

  begin
    insert into public.attendance (session_id, student_id, cihaz_id, yontem)
    values (p_session, v_student, p_cihaz, 'qr');
  exception when unique_violation then
    return jsonb_build_object('hata', 'tekrar_dene');
  end;

  return jsonb_build_object('durum', 'tamam', 'ad', v_kisa, 'zaten', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler (yeni tablolar Data API'ye kendiliğinden açılmaz)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.courses  to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, delete         on public.attendance to authenticated;

revoke all on function public.hoca_mi()                         from public;
revoke all on function public.ders_benim(uuid)                  from public;
revoke all on function public.oturum_benim(uuid)                from public;
revoke all on function public.yoklama_yazilabilir(uuid, uuid)   from public;
revoke all on function public.qr_token(uuid)                    from public;
revoke all on function public.katilim_bileti(uuid, text, text)  from public;
revoke all on function public.check_in(uuid, text, text, text)  from public;
revoke all on function ozel.oturum_anahtari_olustur()           from public;
revoke all on function ozel.kod(text, bigint, text)             from public;
revoke all on function ozel.pencere()                           from public;

grant execute on function public.hoca_mi()                       to authenticated;
grant execute on function public.ders_benim(uuid)                to authenticated;
grant execute on function public.oturum_benim(uuid)              to authenticated;
grant execute on function public.yoklama_yazilabilir(uuid, uuid) to authenticated;
grant execute on function public.qr_token(uuid)                  to authenticated;
grant execute on function public.katilim_bileti(uuid, text, text) to anon, authenticated;
grant execute on function public.check_in(uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: sahne ekranı yeni yoklama kayıtlarını ve oturum durumunu dinler.
-- (RLS geçerli: her hoca yalnızca kendi oturumunun olaylarını alır.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.sessions;

-- ---------------------------------------------------------------------------
-- Kurulumun sahibi
-- Her hoca kendi kopyasını kendi Supabase projesinde çalıştırır. Yeni kurulumda
-- teachers tablosu boştur; siteye ilk giriş yapan hoca "kurulumu sahiplen" der ve
-- listeye kendisi eklenir. Sonra kimse bu yolla hoca olamaz.
-- ---------------------------------------------------------------------------
create function public.kurulum_sahipsiz()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.teachers);
$$;

create function public.kurulumu_sahiplen()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eposta text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_eposta = '' then
    return false;
  end if;
  -- Aynı anda iki kişi denerse yalnızca biri kazansın.
  lock table public.teachers in exclusive mode;
  if exists (select 1 from public.teachers) then
    return false;
  end if;
  insert into public.teachers (eposta) values (v_eposta);
  return true;
end;
$$;

revoke all on function public.kurulum_sahipsiz()  from public;
revoke all on function public.kurulumu_sahiplen() from public;
grant execute on function public.kurulum_sahipsiz()  to authenticated;
grant execute on function public.kurulumu_sahiplen() to authenticated;

-- ===========================================================================
-- 0003_ders_akisi.sql
-- ===========================================================================

-- 0003: Faz 2a, ders akışı ve slayt
--
-- Tablolar: presentations (sunumlar), lessons (ders akışları), lesson_steps (akış adımları)
-- sessions'a eklenen alanlar: lesson_id (oturumda izlenen akış), aktif_adim (perdedeki adım)
-- Depo: "sunumlar" kovası (özel). Dosya yolu: <ders id>/<sunum id>.pdf
-- RPC: ders_durumu, kodla_katil (girişsiz); ders_kodu, kumanda_anahtari, akis_sirala (hoca);
--      kumanda_durumu, kumanda_komut (kumanda anahtarıyla, girişsiz)
--
-- Kısaca:
-- * Akış, sıralı adımlardan oluşur. Faz 2a'da adım türleri: yoklama, slayt. Sonraki fazlarda
--   video, beyin fırtınası, quiz gibi türler aynı tabloya eklenir.
-- * Sunum yüklenirken her sayfanın metni tarayıcıda çıkarılıp presentations.metinler
--   dizisine yazılır. Öğrenci telefonu perdedeki slaytın metnini buradan alır.
-- * Ders kodu: 6 haneli, dakikada bir değişir, oturumun gizli anahtarından türetilir.
--   Geç gelen öğrenci bu kodla katılır; yoklama açıksa kodla katılan da yoklamaya yazılır.
-- * Kumanda: her oturumun ayrı bir kumanda anahtarı var. Sahnedeki kumanda QR'ı bu anahtarı
--   içerir; hoca telefonunda giriş yapmadan akışı yönetir.
-- * Öğrenci (anon) hiçbir tabloyu okuyamaz. Perdedeki adım değişince veritabanı
--   "oturum:<id>" Realtime kanalına güncel durumu yayınlar; öğrenci ayrıca ders_durumu()
--   ile sorabilir.

-- ---------------------------------------------------------------------------
-- Sunumlar
-- ---------------------------------------------------------------------------
create table public.presentations (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  ad            text not null check (length(btrim(ad)) between 1 and 200),
  -- Faz 2c'de PPTX/PPT çevirisi için: yüklenen dosyanın türü ve çeviri durumu
  kaynak        text not null default 'pdf' check (kaynak in ('pdf', 'pptx', 'ppt')),
  durum         text not null default 'hazir' check (durum in ('hazir', 'cevriliyor', 'hata')),
  sayfa_sayisi  integer not null default 0 check (sayfa_sayisi between 0 and 1000),
  metinler      jsonb not null default '[]' check (jsonb_typeof(metinler) = 'array'),
  olusturuldu   timestamptz not null default now()
);
create index presentations_course_idx on public.presentations (course_id);
alter table public.presentations enable row level security;

create policy "hoca kendi sunumlarini yonetir" on public.presentations
  for all to authenticated
  using (public.ders_benim(course_id))
  with check (public.ders_benim(course_id));

-- ---------------------------------------------------------------------------
-- Ders akışları ve adımları
-- ---------------------------------------------------------------------------
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  ad           text not null check (length(btrim(ad)) between 1 and 200),
  olusturuldu  timestamptz not null default now()
);
create index lessons_course_idx on public.lessons (course_id);
alter table public.lessons enable row level security;

create policy "hoca kendi akislarini yonetir" on public.lessons
  for all to authenticated
  using (public.ders_benim(course_id))
  with check (public.ders_benim(course_id));

create table public.lesson_steps (
  id               uuid primary key default gen_random_uuid(),
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  sira             integer not null default 0,
  tur              text not null check (tur in ('yoklama', 'slayt')),
  presentation_id  uuid references public.presentations (id) on delete cascade,
  sayfa_no         integer check (sayfa_no between 1 and 1000),
  ayar             jsonb not null default '{}' check (jsonb_typeof(ayar) = 'object'),
  check ((tur = 'slayt') = (presentation_id is not null and sayfa_no is not null))
);
create index lesson_steps_lesson_idx on public.lesson_steps (lesson_id, sira);
create index lesson_steps_presentation_idx on public.lesson_steps (presentation_id);
alter table public.lesson_steps enable row level security;

create function public.akis_benim(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson and c.teacher_id = auth.uid()
  );
$$;

-- Akışa eklenen sunum, akışla aynı dersten olmalı.
create function public.sunum_akisla_uyumlu(p_lesson uuid, p_sunum uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sunum is null or exists (
    select 1 from public.lessons l
    join public.presentations p on p.course_id = l.course_id
    where l.id = p_lesson and p.id = p_sunum
  );
$$;

create policy "hoca kendi akis adimlarini yonetir" on public.lesson_steps
  for all to authenticated
  using (public.akis_benim(lesson_id))
  with check (public.akis_benim(lesson_id) and public.sunum_akisla_uyumlu(lesson_id, presentation_id));

-- Adımların yeni sırası tek seferde yazılır (sürükle bırak ya da yukarı/aşağı).
create function public.akis_sirala(p_lesson uuid, p_adimlar uuid[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.lesson_steps st
     set sira = u.n
    from unnest(p_adimlar) with ordinality as u(id, n)
   where st.id = u.id and st.lesson_id = p_lesson;
$$;

-- ---------------------------------------------------------------------------
-- Oturum: izlenen akış ve perdedeki adım
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column lesson_id  uuid references public.lessons (id) on delete set null,
  add column aktif_adim uuid references public.lesson_steps (id) on delete set null;

-- Oturuma başka dersin akışı ya da akışta olmayan bir adım yazılamaz.
-- (Yalnızca değişen ve boş olmayan değerler denetlenir; akış ya da adım silinince
-- veritabanının kendiliğinden yaptığı "boşalt" güncellemeleri engellenmez.)
create function ozel.oturum_akisi_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lesson_id is not null
     and (tg_op = 'INSERT' or new.lesson_id is distinct from old.lesson_id)
     and not exists (select 1 from public.lessons l where l.id = new.lesson_id and l.course_id = new.course_id) then
    raise exception 'akis bu derse ait degil' using errcode = '23514';
  end if;
  if new.aktif_adim is not null
     and (tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim or new.lesson_id is distinct from old.lesson_id)
     and not exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.lesson_id = new.lesson_id) then
    raise exception 'adim bu akista yok' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger sessions_akis_denetimi
  before insert or update on public.sessions
  for each row execute function ozel.oturum_akisi_denetle();

-- Oturumun kumanda anahtarı (mevcut oturumlara da ayrı ayrı rastgele değer verilir).
alter table ozel.session_secrets
  add column kumanda text not null default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  );

create function ozel.kumanda_dogru(p_session uuid, p_anahtar text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_anahtar ~ '^[0-9a-f]{64}$' and exists (
    select 1 from ozel.session_secrets g
    where g.session_id = p_session and g.kumanda = p_anahtar
  );
$$;

-- ---------------------------------------------------------------------------
-- Ders kodu: 6 hane, dakikada bir değişir
-- ---------------------------------------------------------------------------
create function ozel.ders_kodu(p_anahtar text, p_dakika bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select lpad(
    ((('x' || substr(encode(sha256(convert_to('ders_kodu:' || p_dakika::text || ':' || p_anahtar, 'UTF8')), 'hex'), 1, 7))::bit(28)::integer) % 1000000)::text,
    6, '0');
$$;

create function ozel.kod_bilgisi(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_simdi  double precision := extract(epoch from clock_timestamp());
  v_dakika bigint := floor(v_simdi / 60)::bigint;
  v_anahtar text;
begin
  select g.anahtar into v_anahtar from ozel.session_secrets g where g.session_id = p_session;
  if v_anahtar is null then
    return null;
  end if;
  return jsonb_build_object(
    'kod', ozel.ders_kodu(v_anahtar, v_dakika),
    'kalan_ms', ceil(((v_dakika + 1) * 60 - v_simdi) * 1000)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Ders durumu: öğrencinin ve kumandanın gördüğü özet
-- ---------------------------------------------------------------------------
create function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad,
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end
      )
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- Perdedeki adım, yoklama ya da oturum durumu değişince öğrencilere yayınlanır.
create function ozel.durum_yayinla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aktif_adim is distinct from old.aktif_adim
     or new.lesson_id is distinct from old.lesson_id
     or new.yoklama_acik is distinct from old.yoklama_acik
     or new.bitti is distinct from old.bitti then
    begin
      perform realtime.send(ozel.durum(new.id), 'durum', 'oturum:' || new.id::text, false);
    exception when others then
      -- Yayın başarısız olsa da ders akmaya devam etsin; öğrenci sayfası yedek sorguyla yetişir.
      null;
    end;
  end if;
  return new;
end;
$$;

create trigger sessions_durum_yayini
  after update on public.sessions
  for each row execute function ozel.durum_yayinla();

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
create function public.ders_durumu(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ozel.durum(p_session), jsonb_build_object('hata', 'oturum_yok'));
$$;

-- Geç gelen öğrenci perdedeki 6 haneli kodla katılır.
-- Dönen değer: { oturum, ders, baslik, yoklama, bilet? } ya da { hata }
-- Yoklama açıksa bilet de döner; öğrenci numarasını check_in() ile her zamanki gibi girer.
create function public.kodla_katil(p_kod text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kod     text := regexp_replace(coalesce(p_kod, ''), '[^0-9]', '', 'g');
  v_dakika  bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
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

  -- Kod içinde bulunulan ya da bir önceki dakikanınki olabilir (yazarken dakika dönerse).
  select s.id, s.yoklama_acik, s.baslik, c.ad as ders, g.anahtar
    into r
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.bitti is null
    and s.basladi > now() - interval '12 hours'
    and v_kod in (ozel.ders_kodu(g.anahtar, v_dakika), ozel.ders_kodu(g.anahtar, v_dakika - 1))
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

-- ---------------------------------------------------------------------------
-- RPC: hoca (giriş yapmış)
-- ---------------------------------------------------------------------------
create function public.ders_kodu(p_session uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.oturum_benim(p_session) then
    raise exception 'oturum bulunamadi' using errcode = 'P0002';
  end if;
  return ozel.kod_bilgisi(p_session);
end;
$$;

create function public.kumanda_anahtari(p_session uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
begin
  if not public.oturum_benim(p_session) then
    raise exception 'oturum bulunamadi' using errcode = 'P0002';
  end if;
  select g.kumanda into v_anahtar from ozel.session_secrets g where g.session_id = p_session;
  return v_anahtar;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: kumanda (hocanın telefonu, kumanda anahtarıyla, girişsiz)
-- ---------------------------------------------------------------------------
-- Dönen değer: ders durumu + adım listesi + katılım sayısı + ders kodu, ya da { hata }
create function public.kumanda_durumu(p_session uuid, p_anahtar text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_lesson uuid;
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  select s.course_id, s.lesson_id into v_course, v_lesson from public.sessions s where s.id = p_session;

  return ozel.durum(p_session) || jsonb_build_object(
    'katilan', (select count(*) from public.attendance a where a.session_id = p_session),
    'mevcut', (select count(*) from public.students st where st.course_id = v_course),
    'kod', ozel.kod_bilgisi(p_session),
    'adimlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'tur', st.tur,
        'sunum', p.ad,
        'sayfa_no', st.sayfa_no,
        'ozet', left(case when st.tur = 'slayt' then p.metinler ->> (st.sayfa_no - 1) end, 140)
      ) order by st.sira, st.id)
      from public.lesson_steps st
      left join public.presentations p on p.id = st.presentation_id
      where st.lesson_id = v_lesson
    ), '[]'::jsonb)
  );
end;
$$;

-- Komutlar: 'git' (p_adim adımına geç), 'yoklama_ac', 'yoklama_kapat'
create function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Depo: sunum dosyaları (özel kova; yalnızca dersin hocası okur ve yazar)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sunumlar', 'sunumlar', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- Dosya yolunun ilk klasörü ders kimliğidir: <ders id>/<sunum id>.pdf
create function public.depo_dersi_benim(p_yol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_yol, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.ders_benim(split_part(p_yol, '/', 1)::uuid)
    else false
  end;
$$;

create policy "hoca kendi sunum dosyalarini okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'sunumlar' and public.depo_dersi_benim(name));

create policy "hoca kendi sunum dosyalarini yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sunumlar' and public.depo_dersi_benim(name));

create policy "hoca kendi sunum dosyalarini gunceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'sunumlar' and public.depo_dersi_benim(name))
  with check (bucket_id = 'sunumlar' and public.depo_dersi_benim(name));

create policy "hoca kendi sunum dosyalarini siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sunumlar' and public.depo_dersi_benim(name));

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.presentations to authenticated;
grant select, insert, update, delete on public.lessons       to authenticated;
grant select, insert, update, delete on public.lesson_steps  to authenticated;

revoke all on function public.akis_benim(uuid)                      from public;
revoke all on function public.sunum_akisla_uyumlu(uuid, uuid)       from public;
revoke all on function public.akis_sirala(uuid, uuid[])             from public;
revoke all on function public.ders_durumu(uuid)                     from public;
revoke all on function public.kodla_katil(text, text)               from public;
revoke all on function public.ders_kodu(uuid)                       from public;
revoke all on function public.kumanda_anahtari(uuid)                from public;
revoke all on function public.kumanda_durumu(uuid, text)            from public;
revoke all on function public.kumanda_komut(uuid, text, text, uuid) from public;
revoke all on function public.depo_dersi_benim(text)                from public;
revoke all on function ozel.oturum_akisi_denetle()                  from public;
revoke all on function ozel.kumanda_dogru(uuid, text)               from public;
revoke all on function ozel.ders_kodu(text, bigint)                 from public;
revoke all on function ozel.kod_bilgisi(uuid)                       from public;
revoke all on function ozel.durum(uuid)                             from public;
revoke all on function ozel.durum_yayinla()                         from public;

grant execute on function public.akis_benim(uuid)                      to authenticated;
grant execute on function public.sunum_akisla_uyumlu(uuid, uuid)       to authenticated;
grant execute on function public.akis_sirala(uuid, uuid[])             to authenticated;
grant execute on function public.ders_kodu(uuid)                       to authenticated;
grant execute on function public.kumanda_anahtari(uuid)                to authenticated;
grant execute on function public.depo_dersi_benim(text)                to authenticated;
grant execute on function public.ders_durumu(uuid)                     to anon, authenticated;
grant execute on function public.kodla_katil(text, text)               to anon, authenticated;
grant execute on function public.kumanda_durumu(uuid, text)            to anon, authenticated;
grant execute on function public.kumanda_komut(uuid, text, text, uuid) to anon, authenticated;

-- ===========================================================================
-- 0004_ders_icerigi.sql
-- ===========================================================================

-- 0004: Dönemler arası ortak ders içeriği
--
-- Kullanıcı kararı (19 Ekim 2026): hoca hazırladığı akışları ve sunumları her yıl yeniden
-- kullanır ve düzenler. Bu yüzden içerik dönemden ayrılır:
-- * subjects (ders içeriği): akışlar ve sunumlar buna bağlıdır, dönemden bağımsızdır.
-- * courses (dönemin dersi): öğrenci listesi, oturumlar ve yoklamalar; bir içeriğe bağlanır.
--   Aynı içerik birden fazla döneme bağlanabilir; içerikte yapılan değişiklik hepsinde görünür.
-- * Yeni ders içeriği seçilmeden açılırsa, dersin adıyla yeni bir içerik kendiliğinden oluşur.
-- * Var olan her ders için bir içerik açılır; dersin akışları ve sunumları oraya taşınır.
-- * Depo yolu: <içerik id>/<sunum id>.pdf (0003 döneminde yüklenmiş <ders id>/... yolları da okunur).

-- ---------------------------------------------------------------------------
-- Ders içerikleri
-- ---------------------------------------------------------------------------
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ad           text not null check (length(btrim(ad)) between 1 and 200),
  olusturuldu  timestamptz not null default now()
);
create index subjects_teacher_idx on public.subjects (teacher_id);
alter table public.subjects enable row level security;

create policy "hoca kendi ders iceriklerini yonetir" on public.subjects
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()) and (select public.hoca_mi()));

create function public.icerik_benim(p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subjects s
    where s.id = p_subject and s.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Dönemin dersi bir içeriğe bağlanır
-- ---------------------------------------------------------------------------
alter table public.courses add column subject_id uuid references public.subjects (id) on delete restrict;
create index courses_subject_idx on public.courses (subject_id);

-- Var olan her derse kendi adıyla bir içerik
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select id, teacher_id, ad from public.courses where subject_id is null loop
    insert into public.subjects (teacher_id, ad) values (r.teacher_id, r.ad) returning id into v_id;
    update public.courses set subject_id = v_id where id = r.id;
  end loop;
end $$;

-- Ders içerik seçilmeden açılırsa içerik kendiliğinden oluşur; başka hocanın içeriğine bağlanamaz.
create function ozel.ders_icerigi_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.subject_id is null then
    insert into public.subjects (teacher_id, ad) values (new.teacher_id, new.ad) returning id into new.subject_id;
  elsif not exists (select 1 from public.subjects s where s.id = new.subject_id and s.teacher_id = new.teacher_id) then
    raise exception 'icerik bu hocaya ait degil' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger courses_icerik
  before insert or update of subject_id on public.courses
  for each row execute function ozel.ders_icerigi_denetle();

alter table public.courses alter column subject_id set not null;

-- ---------------------------------------------------------------------------
-- Sunumlar ve akışlar içeriğe taşınır
-- ---------------------------------------------------------------------------
drop policy "hoca kendi sunumlarini yonetir" on public.presentations;
drop policy "hoca kendi akislarini yonetir" on public.lessons;

alter table public.presentations add column subject_id uuid references public.subjects (id) on delete cascade;
alter table public.lessons       add column subject_id uuid references public.subjects (id) on delete cascade;

update public.presentations p set subject_id = c.subject_id from public.courses c where c.id = p.course_id;
update public.lessons l       set subject_id = c.subject_id from public.courses c where c.id = l.course_id;

alter table public.presentations alter column subject_id set not null;
alter table public.lessons       alter column subject_id set not null;

drop index public.presentations_course_idx;
drop index public.lessons_course_idx;
alter table public.presentations drop column course_id;
alter table public.lessons       drop column course_id;
create index presentations_subject_idx on public.presentations (subject_id);
create index lessons_subject_idx on public.lessons (subject_id);

create policy "hoca kendi sunumlarini yonetir" on public.presentations
  for all to authenticated
  using (public.icerik_benim(subject_id))
  with check (public.icerik_benim(subject_id));

create policy "hoca kendi akislarini yonetir" on public.lessons
  for all to authenticated
  using (public.icerik_benim(subject_id))
  with check (public.icerik_benim(subject_id));

-- Yardımcılar yeni bağa göre
create or replace function public.akis_benim(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l
    join public.subjects s on s.id = l.subject_id
    where l.id = p_lesson and s.teacher_id = auth.uid()
  );
$$;

create or replace function public.sunum_akisla_uyumlu(p_lesson uuid, p_sunum uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sunum is null or exists (
    select 1 from public.lessons l
    join public.presentations p on p.subject_id = l.subject_id
    where l.id = p_lesson and p.id = p_sunum
  );
$$;

-- Oturumda izlenen akış, dersin bağlı olduğu içerikten olmalı.
create or replace function ozel.oturum_akisi_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lesson_id is not null
     and (tg_op = 'INSERT' or new.lesson_id is distinct from old.lesson_id)
     and not exists (
       select 1 from public.lessons l
       join public.courses c on c.subject_id = l.subject_id
       where l.id = new.lesson_id and c.id = new.course_id
     ) then
    raise exception 'akis bu derse ait degil' using errcode = '23514';
  end if;
  if new.aktif_adim is not null
     and (tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim or new.lesson_id is distinct from old.lesson_id)
     and not exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.lesson_id = new.lesson_id) then
    raise exception 'adim bu akista yok' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Depo: yolun ilk klasörü içerik (ya da 0003 döneminden kalma ders) kimliğidir.
create or replace function public.depo_dersi_benim(p_yol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_yol, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.icerik_benim(split_part(p_yol, '/', 1)::uuid)
        or public.ders_benim(split_part(p_yol, '/', 1)::uuid)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.subjects to authenticated;

revoke all on function public.icerik_benim(uuid)          from public;
revoke all on function ozel.ders_icerigi_denetle()        from public;
grant execute on function public.icerik_benim(uuid)       to authenticated;

-- ===========================================================================
-- 0005_bilgi_yarismasi.sql
-- ===========================================================================

-- 0005: Faz 3, soru bankası ve bilgi yarışması
--
-- Kullanıcı kararları (19 Ekim 2026):
-- * Sorular ders içeriğine bağlıdır (yıllarca kullanılır); ZOMR biçiminden içe aktarılır.
-- * Soru adımı akışta slaytların arasına eklenir; yalnızca sorulardan oluşan akış da olur.
-- * Puan Kahoot gibi hıza göre: doğru cevap 500 ile 1000 arası (erken cevap daha çok), yanlış 0.
-- * Yoklaması alınmış öğrenci adıyla ("Ali Y."), yoklamasız derste takma adla yarışır.
--
-- Tablolar: questions (soru bankası), session_players (takma adlar), responses (cevaplar)
-- sessions'a eklenenler: soru_durum ('acik' = cevap alınıyor, 'sonuc' = doğru cevap açıklandı), soru_basladi
-- RPC: cevap_ver, takma_ad_al, benim_sonucum (girişsiz); puan_tablosu (hoca)
--
-- Şıkların sırası her oturumda karışıktır ama herkes için aynıdır (oturum ve soru kimliğinden türetilir).
-- Öğrenci şıkkın sırasını gönderir; sunucu aynı sırayı yeniden hesaplayıp doğruyu kendisi denetler.

-- ---------------------------------------------------------------------------
-- Soru bankası
-- ---------------------------------------------------------------------------
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  soru         text not null check (length(btrim(soru)) between 1 and 1000),
  dogru        text not null check (length(btrim(dogru)) between 1 and 300),
  yanlislar    text[] not null check (cardinality(yanlislar) between 1 and 5),
  sure_sn      integer not null default 20 check (sure_sn between 5 and 300),
  -- ZOMR'daki #EASINESS, #BLOOM, #OUTCOME gibi ek bilgiler
  ek           jsonb not null default '{}' check (jsonb_typeof(ek) = 'object'),
  olusturuldu  timestamptz not null default now(),
  check (not (dogru = any (yanlislar)))
);
create index questions_subject_idx on public.questions (subject_id);
alter table public.questions enable row level security;

create policy "hoca kendi sorularini yonetir" on public.questions
  for all to authenticated
  using (public.icerik_benim(subject_id))
  with check (public.icerik_benim(subject_id));

-- ---------------------------------------------------------------------------
-- Akışta soru adımı
-- ---------------------------------------------------------------------------
alter table public.lesson_steps add column question_id uuid references public.questions (id) on delete cascade;
create index lesson_steps_question_idx on public.lesson_steps (question_id);

alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps drop constraint lesson_steps_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru')),
  add constraint lesson_steps_slayt_check check ((tur = 'slayt') = (presentation_id is not null and sayfa_no is not null)),
  add constraint lesson_steps_soru_check check ((tur = 'soru') = (question_id is not null));

-- Akışa eklenen soru, akışla aynı içerikten olmalı.
create function public.soru_akisla_uyumlu(p_lesson uuid, p_soru uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_soru is null or exists (
    select 1 from public.lessons l
    join public.questions q on q.subject_id = l.subject_id
    where l.id = p_lesson and q.id = p_soru
  );
$$;

drop policy "hoca kendi akis adimlarini yonetir" on public.lesson_steps;
create policy "hoca kendi akis adimlarini yonetir" on public.lesson_steps
  for all to authenticated
  using (public.akis_benim(lesson_id))
  with check (
    public.akis_benim(lesson_id)
    and public.sunum_akisla_uyumlu(lesson_id, presentation_id)
    and public.soru_akisla_uyumlu(lesson_id, question_id)
  );

-- ---------------------------------------------------------------------------
-- Oturumda sorunun durumu
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column soru_durum   text check (soru_durum in ('acik', 'sonuc')),
  add column soru_basladi timestamptz;

-- Perdeye soru adımı gelince cevap alma başlar (sahneden de kumandadan da aynı kural).
create function ozel.soru_durumu_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim then
    if exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.tur = 'soru') then
      new.soru_durum := 'acik';
      new.soru_basladi := clock_timestamp();
    else
      new.soru_durum := null;
      new.soru_basladi := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger sessions_soru_durumu
  before insert or update on public.sessions
  for each row execute function ozel.soru_durumu_ayarla();

-- Şıklar: doğru + yanlışlar, oturuma ve soruya göre karıştırılmış sırayla
create function ozel.secenekler(p_session uuid, p_soru uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(x order by md5(p_session::text || ':' || p_soru::text || ':' || x))
  from public.questions q, unnest(array[q.dogru] || q.yanlislar) as x
  where q.id = p_soru;
$$;

-- ---------------------------------------------------------------------------
-- Takma adlar ve cevaplar
-- ---------------------------------------------------------------------------
create table public.session_players (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  takma_ad    text not null check (length(btrim(takma_ad)) between 1 and 24),
  primary key (session_id, cihaz_id)
);
create unique index session_players_ad_tekil on public.session_players (session_id, lower(takma_ad));
alter table public.session_players enable row level security;

create policy "hoca takma adlari gorur" on public.session_players
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.responses (
  session_id   uuid not null references public.sessions (id) on delete cascade,
  step_id      uuid not null references public.lesson_steps (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  cihaz_id     text not null check (length(cihaz_id) between 8 and 64),
  secim        integer not null,
  dogru        boolean not null,
  puan         integer not null check (puan between 0 and 1000),
  sure_ms      integer not null,
  zaman        timestamptz not null default now(),
  primary key (session_id, step_id, cihaz_id)
);
create index responses_session_idx on public.responses (session_id, cihaz_id);
alter table public.responses enable row level security;

create policy "hoca cevaplari gorur" on public.responses
  for select to authenticated
  using (public.oturum_benim(session_id));

create policy "hoca cevaplari siler" on public.responses
  for delete to authenticated
  using (public.oturum_benim(session_id));

-- "Ali Veli Yılmaz" -> "Ali Y."
create function ozel.kisa_ad(p_ad text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(p_ad) ~ '\s'
      then split_part(btrim(p_ad), ' ', 1) || ' ' || left(regexp_replace(btrim(p_ad), '^.*\s', ''), 1) || '.'
    else btrim(p_ad)
  end;
$$;

-- Yarışmada görünen ad: yoklaması alındıysa listedeki adı, değilse takma adı
create function ozel.oyuncu_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ozel.kisa_ad(st.ad_soyad) from public.attendance a
       join public.students st on st.id = a.student_id
      where a.session_id = p_session and a.cihaz_id = p_cihaz),
    (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
  );
$$;

-- Puan tablosu: her oyuncunun toplamı, doğru sayısı ve sırası
create function ozel.puanlar(p_session uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ad', t.ad, 'puan', t.puan, 'dogru', t.dogru, 'sira', t.sira) order by t.sira, t.ad), '[]'::jsonb)
  from (
    select coalesce(ozel.oyuncu_adi(p_session, r.cihaz_id), 'İsimsiz') as ad,
           sum(r.puan)::integer as puan,
           count(*) filter (where r.dogru)::integer as dogru,
           rank() over (order by sum(r.puan) desc)::integer as sira
    from public.responses r
    where r.session_id = p_session
    group by r.cihaz_id
    order by sum(r.puan) desc
    limit greatest(1, least(p_limit, 1000))
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- Ders durumu: soru adımında soru, şıklar, kalan süre; sonuçta doğru şık ve dağılım
-- ---------------------------------------------------------------------------
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad,
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      ) else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- Soru açılınca ya da sonuç açıklanınca da öğrencilere yayınlanır.
create or replace function ozel.durum_yayinla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aktif_adim is distinct from old.aktif_adim
     or new.lesson_id is distinct from old.lesson_id
     or new.yoklama_acik is distinct from old.yoklama_acik
     or new.bitti is distinct from old.bitti
     or new.soru_durum is distinct from old.soru_durum then
    begin
      perform realtime.send(ozel.durum(new.id), 'durum', 'oturum:' || new.id::text, false);
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Yoklamasız derste yarışmak için takma ad. Dönen değer: { durum: 'tamam', ad } ya da { hata }
create function public.takma_ad_al(p_session uuid, p_cihaz text, p_ad text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ad text := left(regexp_replace(btrim(coalesce(p_ad, '')), '\s+', ' ', 'g'), 24);
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_ad) < 2 then
    return jsonb_build_object('hata', 'ad_kisa');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  begin
    insert into public.session_players (session_id, cihaz_id, takma_ad) values (p_session, p_cihaz, v_ad)
    on conflict (session_id, cihaz_id) do update set takma_ad = excluded.takma_ad;
  exception when unique_violation then
    return jsonb_build_object('hata', 'ad_kullaniliyor');
  end;
  return jsonb_build_object('durum', 'tamam', 'ad', v_ad);
end;
$$;

-- Dönen değer: { durum: 'tamam' } ya da { hata }. Doğru mu, sonuç açıklanınca benim_sonucum() söyler.
create function public.cevap_ver(p_session uuid, p_cihaz text, p_secim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r          record;
  v_ms       integer;
  v_secenek  text[];
  v_dogru    boolean;
  v_puan     integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.soru_basladi, s.bitti, q.id as soru, q.dogru, q.sure_sn
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'soru'
  join public.questions q on q.id = st.question_id
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'soru_yok');
  end if;
  v_ms := floor(extract(epoch from (clock_timestamp() - r.soru_basladi)) * 1000)::integer;
  -- Ağ gecikmesi için 1,5 saniye pay
  if r.bitti is not null or r.soru_durum is distinct from 'acik' or v_ms > r.sure_sn * 1000 + 1500 then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;
  if ozel.oyuncu_adi(p_session, p_cihaz) is null then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;

  v_secenek := ozel.secenekler(p_session, r.soru);
  if p_secim is null or p_secim < 0 or p_secim >= cardinality(v_secenek) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;

  v_dogru := v_secenek[p_secim + 1] = r.dogru;
  v_puan := case when v_dogru
    then 1000 - round(500.0 * least(greatest(v_ms, 0), r.sure_sn * 1000) / (r.sure_sn * 1000))::integer
    else 0 end;

  insert into public.responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
  values (p_session, r.aktif_adim, r.soru, p_cihaz, p_secim, v_dogru, v_puan, greatest(v_ms, 0))
  on conflict do nothing;
  if not found then
    return jsonb_build_object('hata', 'zaten_cevapladin');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Öğrencinin kendi durumu: bu sorudaki cevabı (sonuç açıklandıysa doğru mu, kaç puan), toplamı ve sırası
create function public.benim_sonucum(p_session uuid, p_cihaz text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ad', ozel.oyuncu_adi(p_session, p_cihaz),
    'cevapladi', r.cihaz_id is not null,
    'secim', r.secim,
    'dogru', case when s.soru_durum = 'sonuc' then r.dogru end,
    'puan', case when s.soru_durum = 'sonuc' then r.puan end,
    'toplam', (select coalesce(sum(x.puan), 0) from public.responses x where x.session_id = p_session and x.cihaz_id = p_cihaz),
    'sira', (
      select t.sira from (
        select x.cihaz_id, rank() over (order by sum(x.puan) desc) as sira
        from public.responses x where x.session_id = p_session group by x.cihaz_id
      ) t where t.cihaz_id = p_cihaz
    ),
    'oyuncu', (select count(distinct x.cihaz_id) from public.responses x where x.session_id = p_session)
  )
  from public.sessions s
  left join public.responses r on r.session_id = s.id and r.step_id = s.aktif_adim and r.cihaz_id = p_cihaz
  where s.id = p_session;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca ve kumanda
-- ---------------------------------------------------------------------------
create function public.puan_tablosu(p_session uuid, p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.oturum_benim(p_session) then
    raise exception 'oturum bulunamadi' using errcode = 'P0002';
  end if;
  return ozel.puanlar(p_session, p_limit);
end;
$$;

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
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  select s.course_id, s.lesson_id into v_course, v_lesson from public.sessions s where s.id = p_session;

  return ozel.durum(p_session) || jsonb_build_object(
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
        end, 140)
      ) order by st.sira, st.id)
      from public.lesson_steps st
      left join public.presentations p on p.id = st.presentation_id
      left join public.questions q on q.id = st.question_id
      where st.lesson_id = v_lesson
    ), '[]'::jsonb)
  );
end;
$$;

-- Yeni komut: 'sonuc_goster' (sorunun doğru cevabını açıklar)
create or replace function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  elsif p_komut = 'sonuc_goster' then
    update public.sessions set soru_durum = 'sonuc' where id = p_session and soru_durum = 'acik';
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.questions to authenticated;
grant select                         on public.session_players to authenticated;
grant select, delete                 on public.responses to authenticated;

revoke all on function public.soru_akisla_uyumlu(uuid, uuid)        from public;
revoke all on function public.takma_ad_al(uuid, text, text)         from public;
revoke all on function public.cevap_ver(uuid, text, integer)        from public;
revoke all on function public.benim_sonucum(uuid, text)             from public;
revoke all on function public.puan_tablosu(uuid, integer)           from public;
revoke all on function ozel.soru_durumu_ayarla()                    from public;
revoke all on function ozel.secenekler(uuid, uuid)                  from public;
revoke all on function ozel.kisa_ad(text)                           from public;
revoke all on function ozel.oyuncu_adi(uuid, text)                  from public;
revoke all on function ozel.puanlar(uuid, integer)                  from public;

grant execute on function public.soru_akisla_uyumlu(uuid, uuid)  to authenticated;
grant execute on function public.puan_tablosu(uuid, integer)     to authenticated;
grant execute on function public.takma_ad_al(uuid, text, text)   to anon, authenticated;
grant execute on function public.cevap_ver(uuid, text, integer)  to anon, authenticated;
grant execute on function public.benim_sonucum(uuid, text)       to anon, authenticated;

-- Sahne gelen cevap sayısını canlı izler.
alter publication supabase_realtime add table public.responses;

-- ===========================================================================
-- 0006_telefon_modu.sql
-- ===========================================================================

-- 0006: Faz 2b, yalnız telefon modu
--
-- Kullanıcı kararı (19 Ekim 2026): bilgisayar ya da projeksiyon yoksa hoca dersi telefonundan yönetir;
-- perdede görünecek ekran öğrencilerin telefonunda görünür.
--
-- * sessions.telefon_modu: oturum projeksiyonsuz yürütülür.
-- * presentations.gorseller_hazir: sunumun sayfa görselleri yüklendi (tarayıcıda küçültülüp yüklenir).
-- * Depo: "slayt-gorselleri" kovası (özel). Dosya yolu: <içerik id>/<sunum id>/<sayfa no>
-- * Öğrenci (girişsiz) bir görseli yalnızca telefon modundaki açık bir dersin PERDEDEKİ slaytı için okuyabilir.
--   Sonraki slaytları önceden indiremez; ders bitince hiçbir görsele erişemez.
-- * Telefon modunda öğrenci telefonuna: slayt görseli (ders_durumu), soru sonucunda ilk 5 (benim_sonucum).
-- * Kumandadan telefon modu açılıp kapatılabilir.

-- ---------------------------------------------------------------------------
-- Sütunlar
-- ---------------------------------------------------------------------------
alter table public.sessions      add column telefon_modu boolean not null default false;
alter table public.presentations add column gorseller_hazir boolean not null default false;

-- ---------------------------------------------------------------------------
-- Depo: slayt görselleri
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slayt-gorselleri', 'slayt-gorselleri', false, 614400, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Perdedeki slaytın görseli: telefon modundaki açık bir oturumda, o an aktif adımın sunumu ve sayfası
create function public.gorsel_gorunur(p_yol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions s
    join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'slayt'
    join public.presentations p on p.id = st.presentation_id
    where s.telefon_modu
      and s.bitti is null
      and p.gorseller_hazir
      and split_part(p_yol, '/', 1) = p.subject_id::text
      and split_part(p_yol, '/', 2) = p.id::text
      and split_part(p_yol, '/', 3) = st.sayfa_no::text
  );
$$;

create policy "hoca kendi slayt gorsellerini okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini gunceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name))
  with check (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "ogrenci perdedeki slaytin gorselini okur" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'slayt-gorselleri' and public.gorsel_gorunur(name));

-- ---------------------------------------------------------------------------
-- Ders durumu: telefon modu ve slayt görselinin yolu
-- ---------------------------------------------------------------------------
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad,
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'telefon_modu', s.telefon_modu,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end,
        'gorsel', case when s.telefon_modu and a.tur = 'slayt' and p.gorseller_hazir
          then p.subject_id::text || '/' || p.id::text || '/' || a.sayfa_no::text end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      ) else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- Telefon modu değişince de öğrencilere yayınlanır.
create or replace function ozel.durum_yayinla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aktif_adim is distinct from old.aktif_adim
     or new.lesson_id is distinct from old.lesson_id
     or new.yoklama_acik is distinct from old.yoklama_acik
     or new.bitti is distinct from old.bitti
     or new.soru_durum is distinct from old.soru_durum
     or new.telefon_modu is distinct from old.telefon_modu then
    begin
      perform realtime.send(ozel.durum(new.id), 'durum', 'oturum:' || new.id::text, false);
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- Telefon modunda soru sonucunda öğrencinin telefonuna ilk 5 de gelir (perde yok).
create or replace function public.benim_sonucum(p_session uuid, p_cihaz text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ad', ozel.oyuncu_adi(p_session, p_cihaz),
    'cevapladi', r.cihaz_id is not null,
    'secim', r.secim,
    'dogru', case when s.soru_durum = 'sonuc' then r.dogru end,
    'puan', case when s.soru_durum = 'sonuc' then r.puan end,
    'toplam', (select coalesce(sum(x.puan), 0) from public.responses x where x.session_id = p_session and x.cihaz_id = p_cihaz),
    'sira', (
      select t.sira from (
        select x.cihaz_id, rank() over (order by sum(x.puan) desc) as sira
        from public.responses x where x.session_id = p_session group by x.cihaz_id
      ) t where t.cihaz_id = p_cihaz
    ),
    'oyuncu', (select count(distinct x.cihaz_id) from public.responses x where x.session_id = p_session),
    'puanlar', case when s.telefon_modu and s.soru_durum = 'sonuc' then ozel.puanlar(p_session, 5) end
  )
  from public.sessions s
  left join public.responses r on r.session_id = s.id and r.step_id = s.aktif_adim and r.cihaz_id = p_cihaz
  where s.id = p_session;
$$;

-- Yeni komutlar: 'telefon_ac', 'telefon_kapat'
create or replace function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  elsif p_komut = 'sonuc_goster' then
    update public.sessions set soru_durum = 'sonuc' where id = p_session and soru_durum = 'acik';
  elsif p_komut = 'telefon_ac' then
    update public.sessions set telefon_modu = true where id = p_session;
  elsif p_komut = 'telefon_kapat' then
    update public.sessions set telefon_modu = false where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke all on function public.gorsel_gorunur(text) from public;
grant execute on function public.gorsel_gorunur(text) to anon, authenticated;

-- ===========================================================================
-- 0007_donem_sube_plan.sql
-- ===========================================================================

-- 0007: Dönemler, şubeler ve hafta planı
--
-- Kullanıcının düzeni (26 Ekim 2026): yılda 2 dönem, dönemde 3 4 ders, bazı derslerde 6 7 şube.
-- Her şubenin ayrı sınıf listesi ve ayrı yoklaması vardır; içerik (akışlar, sunumlar, sorular) her yıl
-- kullanılır ve geliştirilir; gelecek dönemler önceden planlanabilir.
--
-- * terms (dönem): "2026-2027 Güz" gibi; başlangıç tarihiyle sıralanır, önceden açılabilir.
-- * courses.term_id: dersin (şubenin) bağlı olduğu dönem. courses.sube: şube adı ("A", "1. Şube"...).
--   Bir dönemde aynı içeriğin aynı adlı iki şubesi olamaz. courses.donem metni dönem adından kendiliğinden doldurulur.
-- * lessons.sira: içerikteki akışların hafta sırası (1. akış = 1. hafta).
-- * RPC: hafta_plani (şube x hafta özeti), donemi_planla (önceki dönemin ders ve şube yapısını boş listelerle kopyalar),
--   akislari_sirala (hafta sırası).

-- ---------------------------------------------------------------------------
-- Dönemler
-- ---------------------------------------------------------------------------
create table public.terms (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ad           text not null check (length(btrim(ad)) between 1 and 40),
  baslangic    date not null default current_date,
  olusturuldu  timestamptz not null default now()
);
create unique index terms_ad_tekil on public.terms (teacher_id, lower(btrim(ad)));
alter table public.terms enable row level security;

create policy "hoca kendi donemlerini yonetir" on public.terms
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()) and (select public.hoca_mi()));

-- ---------------------------------------------------------------------------
-- Ders (şube) bir döneme bağlanır
-- ---------------------------------------------------------------------------
alter table public.courses
  add column term_id uuid references public.terms (id) on delete restrict,
  add column sube    text check (sube is null or length(btrim(sube)) between 1 and 40);

-- Var olan dersler: dönem metninden dönem kayıtları açılır (metni olmayanlar "Dönemsiz" olur)
insert into public.terms (teacher_id, ad, baslangic)
select c.teacher_id, left(btrim(c.donem), 40), min(c.olusturuldu)::date
from public.courses c
where c.donem is not null and btrim(c.donem) <> ''
group by c.teacher_id, left(btrim(c.donem), 40)
on conflict do nothing;

insert into public.terms (teacher_id, ad, baslangic)
select c.teacher_id, 'Dönemsiz', min(c.olusturuldu)::date
from public.courses c
where c.donem is null or btrim(c.donem) = ''
group by c.teacher_id
on conflict do nothing;

update public.courses c
   set term_id = (
     select t.id from public.terms t
     where t.teacher_id = c.teacher_id
       and lower(btrim(t.ad)) = lower(left(coalesce(nullif(btrim(c.donem), ''), 'Dönemsiz'), 40))
   );

-- Dönem verilmeden (eski istemci ya da dönem metniyle) açılan derse dönem bulunur ya da açılır;
-- başka hocanın dönemine bağlanamaz; donem metni dönem adıyla eşitlenir.
create function ozel.ders_donemi_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad text;
begin
  if new.term_id is null then
    v_ad := left(coalesce(nullif(btrim(coalesce(new.donem, '')), ''), 'Dönemsiz'), 40);
    select t.id into new.term_id
    from public.terms t
    where t.teacher_id = new.teacher_id and lower(btrim(t.ad)) = lower(v_ad);
    if new.term_id is null then
      insert into public.terms (teacher_id, ad) values (new.teacher_id, v_ad) returning id into new.term_id;
    end if;
  elsif not exists (select 1 from public.terms t where t.id = new.term_id and t.teacher_id = new.teacher_id) then
    raise exception 'donem bu hocaya ait degil' using errcode = '23514';
  end if;
  select t.ad into new.donem from public.terms t where t.id = new.term_id;
  return new;
end;
$$;

create trigger courses_donem
  before insert or update of term_id, donem on public.courses
  for each row execute function ozel.ders_donemi_ayarla();

-- Dönem adı değişince dersler de değişir.
create function ozel.donem_adi_esitle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.courses set donem = new.ad where term_id = new.id;
  return new;
end;
$$;

create trigger terms_ad_degisti
  after update of ad on public.terms
  for each row execute function ozel.donem_adi_esitle();

alter table public.courses alter column term_id set not null;
create index courses_term_idx on public.courses (term_id);

-- Bir dönemde aynı içeriğin aynı adlı iki şubesi olamaz.
create unique index courses_sube_tekil on public.courses (term_id, subject_id, lower(btrim(coalesce(sube, ''))));

-- ---------------------------------------------------------------------------
-- Akışların hafta sırası
-- ---------------------------------------------------------------------------
alter table public.lessons add column sira integer not null default 0;

update public.lessons l
   set sira = r.n
  from (select id, row_number() over (partition by subject_id order by olusturuldu, id)::integer as n from public.lessons) r
 where r.id = l.id;

create function ozel.akis_sirasi_ver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sira = 0 then
    select coalesce(max(l.sira), 0) + 1 into new.sira from public.lessons l where l.subject_id = new.subject_id;
  end if;
  return new;
end;
$$;

create trigger lessons_sira
  before insert on public.lessons
  for each row execute function ozel.akis_sirasi_ver();

-- Akışların yeni hafta sırası tek seferde yazılır (RLS geçerli: yalnızca kendi içeriği).
create function public.akislari_sirala(p_subject uuid, p_akislar uuid[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.lessons l
     set sira = u.n
    from unnest(p_akislar) with ordinality as u(id, n)
   where l.id = u.id and l.subject_id = p_subject;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hafta planı özeti ve dönem planlama (RLS geçerli: yalnızca kendi verisi)
-- ---------------------------------------------------------------------------
-- Dönemdeki bir içeriğin şubelerinde akışla başlatılmış oturumlar; yoklamaya katılan ve sınıf mevcudu sayılarıyla.
create function public.hafta_plani(p_term uuid, p_subject uuid)
returns table (course_id uuid, lesson_id uuid, oturum_id uuid, basladi timestamptz, katilan bigint, mevcut bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.course_id,
         s.lesson_id,
         s.id,
         s.basladi,
         (select count(*) from public.attendance a where a.session_id = s.id),
         (select count(*) from public.students st where st.course_id = s.course_id)
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where c.term_id = p_term and c.subject_id = p_subject and s.lesson_id is not null
  order by s.basladi desc;
$$;

-- Yeni dönem açar. Kaynak dönem verilirse onun ders ve şube yapısı kopyalanır; sınıf listeleri,
-- oturumlar ve yoklamalar kopyalanmaz (içerik zaten ortaktır).
create function public.donemi_planla(p_ad text, p_baslangic date, p_kaynak uuid default null)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.terms (ad, baslangic)
  values (btrim(p_ad), coalesce(p_baslangic, current_date))
  returning id into v_id;

  if p_kaynak is not null then
    insert into public.courses (ad, kod, subject_id, sube, term_id)
    select c.ad, c.kod, c.subject_id, c.sube, v_id
    from public.courses c
    where c.term_id = p_kaynak;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.terms to authenticated;

revoke all on function public.akislari_sirala(uuid, uuid[])          from public;
revoke all on function public.hafta_plani(uuid, uuid)                from public;
revoke all on function public.donemi_planla(text, date, uuid)        from public;
revoke all on function ozel.ders_donemi_ayarla()                     from public;
revoke all on function ozel.donem_adi_esitle()                       from public;
revoke all on function ozel.akis_sirasi_ver()                        from public;

grant execute on function public.akislari_sirala(uuid, uuid[])       to authenticated;
grant execute on function public.hafta_plani(uuid, uuid)             to authenticated;
grant execute on function public.donemi_planla(text, date, uuid)     to authenticated;

-- ===========================================================================
-- 0008_sube_gorunur.sql
-- ===========================================================================

-- 0008: Şube adı ekranlarda görünür
--
-- Bir dersin 6 7 şubesi olduğunda perdede, kumandada ve öğrenci telefonunda hangi şubenin açık olduğu
-- görünmelidir ("Din Felsefesi I · B"). Öğrenciye giden ders adı (katilim_bileti, kodla_katil, ders_durumu
-- ve kumanda_durumu) şube adını da taşır; şubesiz derslerde değişen bir şey olmaz.
-- Yalnızca ders adı metni değişir; fonksiyonların diğer davranışı aynıdır.

-- 0002'deki katilim_bileti
create or replace function public.katilim_bileti(p_session uuid, p_token text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_anahtar text;
  v_acik    boolean;
  v_bitti   timestamptz;
  v_ders    text;
  v_baslik  text;
  v_pencere bigint := ozel.pencere();
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select g.anahtar, s.yoklama_acik, s.bitti, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''), s.baslik
    into v_anahtar, v_acik, v_bitti, v_ders, v_baslik
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.id = p_session;

  if v_anahtar is null then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  if not v_acik or v_bitti is not null then
    return jsonb_build_object('hata', 'yoklama_kapali');
  end if;

  if p_token is null or p_token not in (
    ozel.kod(v_anahtar, v_pencere, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 1, 'qr'),
    ozel.kod(v_anahtar, v_pencere - 2, 'qr')
  ) then
    return jsonb_build_object('hata', 'kod_eski');
  end if;

  return jsonb_build_object(
    'bilet', v_pencere::text || '.' || ozel.kod(v_anahtar, v_pencere, 'bilet:' || p_cihaz),
    'ders', v_ders,
    'baslik', v_baslik
  );
end;
$$;

-- 0003'teki kodla_katil
create or replace function public.kodla_katil(p_kod text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kod     text := regexp_replace(coalesce(p_kod, ''), '[^0-9]', '', 'g');
  v_dakika  bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
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

  -- Kod içinde bulunulan ya da bir önceki dakikanınki olabilir (yazarken dakika dönerse).
  select s.id, s.yoklama_acik, s.baslik, c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), '') as ders, g.anahtar
    into r
  from public.sessions s
  join ozel.session_secrets g on g.session_id = s.id
  join public.courses c on c.id = s.course_id
  where s.bitti is null
    and s.basladi > now() - interval '12 hours'
    and v_kod in (ozel.ders_kodu(g.anahtar, v_dakika), ozel.ders_kodu(g.anahtar, v_dakika - 1))
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

-- 0006'daki ozel.durum (ders_durumu ve kumanda_durumu bunu kullanır)
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'telefon_modu', s.telefon_modu,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end,
        'gorsel', case when s.telefon_modu and a.tur = 'slayt' and p.gorseller_hazir
          then p.subject_id::text || '/' || p.id::text || '/' || a.sayfa_no::text end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      ) else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- ===========================================================================
-- 0009_uyandir.sql
-- ===========================================================================

-- 0009: Gerçek veritabanı hareketi (Supabase Free duraklatmasını önlemek için)
--
-- Sorun (9 Kasım 2026): Supabase Free projesi, her iki günde bir başarıyla çalışan keepalive iş akışına
-- rağmen "7 günden uzun süredir yeterli hareket görmedi" uyarısı verdi. Eski iş akışı saglik() çağırıyordu;
-- bu fonksiyon yalnızca "select true" döndürür, hiçbir tabloya dokunmaz. Supabase'in "hareket"i neyle
-- ölçtüğü belgelenmemiş; bu yüzden gerçek bir tabloya yazma ve gerçek tablolardan okuma yapılır.
--
-- * ozel.nabiz: tek satırlık küçük tablo (son uyandırma zamanı ve sayaç). API'ye kapalı (ozel şeması).
-- * public.uyandir(): satırı günceller ve dersler ile öğrenciler tablolarını okur. Girişsiz çağrılabilir
--   ama en fazla saatte bir yazar; art arda çağrı spam'i veritabanını yormaz. Veri döndürmez.
-- * saglik() panelin bağlantı göstergesi için olduğu gibi kalır.

create table ozel.nabiz (
  id     integer primary key check (id = 1),
  zaman  timestamptz not null default now(),
  sayac  bigint not null default 0
);
alter table ozel.nabiz enable row level security;
insert into ozel.nabiz (id, zaman, sayac) values (1, now() - interval '1 day', 0);

create function public.uyandir()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_yazildi  boolean;
  v_dersler  bigint;
  v_ogr      bigint;
begin
  update ozel.nabiz
     set zaman = now(), sayac = sayac + 1
   where id = 1 and zaman < now() - interval '1 hour';
  v_yazildi := found;

  -- Gerçek tablolardan okuma (sonuç dışarı verilmez)
  select count(*) into v_dersler from public.courses;
  select count(*) into v_ogr from public.students;

  return jsonb_build_object('tamam', true, 'yazildi', v_yazildi);
end;
$$;

revoke all on function public.uyandir() from public;
grant execute on function public.uyandir() to anon, authenticated;

-- ===========================================================================
-- 0010_tartisma.sql
-- ===========================================================================

-- 0010: Faz 4, tartışma araçları
--
-- Üç yeni adım türü (ayarları lesson_steps.ayar içinde durur):
-- * fikir  (beyin fırtınası): ayar.soru. Öğrenci en çok 3 kısa fikir yazar (2-40 harf); perdede kelime bulutu.
-- * oylama (şeytanın avukatı): ayar.soru (önerme), isteğe bağlı ayar.etiketler [sol, sağ]. Öğrenci bir taraf
--   seçer, isterse gerekçe yazar (en çok 200 harf); açıkken fikrini değiştirebilir.
-- * video: ayar.url (https), isteğe bağlı ayar.baslik. Perdede oynatılır.
--
-- Açık/kapalı durumu bilgi yarışmasıyla aynı alanı kullanır: sessions.soru_durum.
--   'acik'  = katkı alınıyor (oylamada sayılar gizli)
--   'sonuc' = katkı kapandı; oylamada sayılar ve gerekçeler açıklanır
--
-- KVKK: görüşler öğrencinin kimliğine bağlanmaz. Katkı satırı cihaz kimliğini değil, oturumun gizli
-- anahtarıyla karılmış bir özetini (kisi) taşır; bu özet yoklama kaydıyla Data API üzerinden eşlenemez.
-- Yalnızca "aynı kişi mi" sorusuna (3 fikir sınırı, tek oy) cevap verir.

-- ---------------------------------------------------------------------------
-- Adım türleri
-- ---------------------------------------------------------------------------
alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru', 'fikir', 'oylama', 'video')),
  add constraint lesson_steps_etkinlik_check check (
    case
      when tur in ('fikir', 'oylama') then length(btrim(coalesce(ayar ->> 'soru', ''))) between 1 and 300
      when tur = 'video' then coalesce(ayar ->> 'url', '') ~ '^https://[^\s]{4,255}$'
      else true
    end
  );

-- Perdeye soru, beyin fırtınası ya da oylama gelince katkı alma başlar.
create or replace function ozel.soru_durumu_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim then
    if exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.tur in ('soru', 'fikir', 'oylama')) then
      new.soru_durum := 'acik';
      new.soru_basladi := clock_timestamp();
    else
      new.soru_durum := null;
      new.soru_basladi := null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Katkılar
-- ---------------------------------------------------------------------------
create table public.contributions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  step_id     uuid not null references public.lesson_steps (id) on delete cascade,
  kisi        text not null check (length(kisi) = 32),
  -- Oylamada seçilen taraf (0 = sol, 1 = sağ); beyin fırtınasında boş
  taraf       smallint check (taraf in (0, 1)),
  -- Beyin fırtınasında fikir, oylamada gerekçe (boş olabilir)
  metin       text not null default '' check (length(metin) <= 200),
  -- Hoca uygunsuz bir katkıyı perdeden kaldırabilir
  gizli       boolean not null default false,
  zaman       timestamptz not null default now()
);
create index contributions_adim_idx on public.contributions (session_id, step_id);
-- Oylamada kişi başına tek oy
create unique index contributions_oy_tekil on public.contributions (session_id, step_id, kisi) where taraf is not null;
alter table public.contributions enable row level security;

create policy "hoca katkilari gorur" on public.contributions
  for select to authenticated
  using (public.oturum_benim(session_id));

create policy "hoca katkiyi gizler" on public.contributions
  for update to authenticated
  using (public.oturum_benim(session_id))
  with check (public.oturum_benim(session_id));

create policy "hoca katkiyi siler" on public.contributions
  for delete to authenticated
  using (public.oturum_benim(session_id));

create function ozel.katki_kisi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5('katki:' || g.anahtar || ':' || p_cihaz)
  from ozel.session_secrets g
  where g.session_id = p_session;
$$;

-- Bir tartışma ya da video adımının öğrenciye ve kumandaya giden özeti.
-- p_hepsi: oylamanın sayıları ve gerekçeleri sonuç açıklanmadan da verilir (yalnızca kumanda için).
create function ozel.etkinlik(p_session uuid, p_adim uuid, p_hepsi boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when st.tur = 'video' then jsonb_build_object('video', st.ayar ->> 'url', 'soru', st.ayar ->> 'baslik')
    else jsonb_build_object(
      'soru', st.ayar ->> 'soru',
      'soru_durum', s.soru_durum,
      'cevap_sayisi', (select count(distinct k.kisi) from public.contributions k where k.session_id = s.id and k.step_id = st.id)
    ) || case
      when st.tur = 'fikir' then jsonb_build_object(
        'fikirler', coalesce((
          select jsonb_agg(jsonb_build_object('m', f.metin, 'n', f.sayi) order by f.sayi desc, f.ilk)
          from (
            select min(k.metin) as metin, count(*) as sayi, min(k.zaman) as ilk
            from public.contributions k
            where k.session_id = s.id and k.step_id = st.id and not k.gizli
            group by lower(k.metin)
            order by count(*) desc, min(k.zaman)
            limit 60
          ) f
        ), '[]'::jsonb)
      )
      else jsonb_build_object(
        'etiketler', case
          when jsonb_typeof(st.ayar -> 'etiketler') = 'array' and jsonb_array_length(st.ayar -> 'etiketler') = 2
            then st.ayar -> 'etiketler'
          else '["Katılıyorum", "Katılmıyorum"]'::jsonb
        end,
        'sayilar', case when p_hepsi or s.soru_durum = 'sonuc' then (
          select jsonb_build_array(count(*) filter (where k.taraf = 0), count(*) filter (where k.taraf = 1))
          from public.contributions k where k.session_id = s.id and k.step_id = st.id
        ) end,
        'gerekceler', case when p_hepsi or s.soru_durum = 'sonuc' then coalesce((
          select jsonb_agg(jsonb_build_object('t', g.taraf, 'm', g.metin) order by g.zaman desc)
          from (
            select k.taraf, k.metin, k.zaman
            from public.contributions k
            where k.session_id = s.id and k.step_id = st.id and not k.gizli and k.metin <> ''
            order by k.zaman desc
            limit 40
          ) g
        ), '[]'::jsonb) end
      )
    end
  end
  from public.sessions s
  join public.lesson_steps st on st.id = p_adim
  where s.id = p_session;
$$;

-- 0008'deki ozel.durum: tartışma ve video adımlarının özeti eklendi
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'telefon_modu', s.telefon_modu,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end,
        'gorsel', case when s.telefon_modu and a.tur = 'slayt' and p.gorseller_hazir
          then p.subject_id::text || '/' || p.id::text || '/' || a.sayfa_no::text end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      )
      when a.tur in ('fikir', 'oylama', 'video') then ozel.etkinlik(s.id, a.id)
      else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Dönen değer: { durum: 'tamam', kalan } ya da { hata }. kalan: beyin fırtınasında yazabileceği fikir sayısı.
create function public.katki_gonder(p_session uuid, p_cihaz text, p_metin text, p_taraf integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r        record;
  v_kisi   text;
  v_metin  text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
  v_sayi   integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.bitti, st.tur
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur in ('fikir', 'oylama')
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'etkinlik_yok');
  end if;
  if r.bitti is not null or r.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;

  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  -- Aynı kişinin eşzamanlı istekleri sıraya girer (3 fikir sınırı aşılmasın).
  perform pg_advisory_xact_lock(hashtext(v_kisi));

  -- Uydurma cihaz kimlikleriyle yığma yapılmasın diye adım başına üst sınır
  if (select count(*) from public.contributions k where k.session_id = p_session and k.step_id = r.aktif_adim) >= 2000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if r.tur = 'fikir' then
    if length(v_metin) < 2 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > 40 then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    select count(*) into v_sayi from public.contributions k
    where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi;
    if v_sayi >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    if exists (
      select 1 from public.contributions k
      where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi and lower(k.metin) = lower(v_metin)
    ) then
      return jsonb_build_object('hata', 'ayni');
    end if;
    insert into public.contributions (session_id, step_id, kisi, metin) values (p_session, r.aktif_adim, v_kisi, v_metin);
    return jsonb_build_object('durum', 'tamam', 'kalan', 2 - v_sayi);
  end if;

  if p_taraf is null or p_taraf not in (0, 1) then
    return jsonb_build_object('hata', 'taraf_gecersiz');
  end if;
  if length(v_metin) > 200 then
    return jsonb_build_object('hata', 'metin_uzun');
  end if;
  insert into public.contributions as k (session_id, step_id, kisi, taraf, metin)
  values (p_session, r.aktif_adim, v_kisi, p_taraf, v_metin)
  on conflict (session_id, step_id, kisi) where taraf is not null
  do update set taraf = excluded.taraf,
                -- Gizlenen gerekçe aynı metinle yeniden gönderilirse gizli kalır
                gizli = k.gizli and k.metin = excluded.metin,
                metin = excluded.metin,
                zaman = now();
  return jsonb_build_object('durum', 'tamam', 'kalan', 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: kumanda
-- ---------------------------------------------------------------------------
-- 0005'teki kumanda_durumu: tartışma adımında sayılar ve gerekçeler hocaya her zaman görünür; adım
-- listesinde yeni türlerin özeti.
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
        end, 140)
      ) order by st.sira, st.id)
      from public.lesson_steps st
      left join public.presentations p on p.id = st.presentation_id
      left join public.questions q on q.id = st.question_id
      where st.lesson_id = v_lesson
    ), '[]'::jsonb)
  );
end;
$$;

-- Yeni komut: 'yeniden_ac' (kapatılan beyin fırtınası ya da oylama yeniden katkı alır)
create or replace function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  elsif p_komut = 'sonuc_goster' then
    update public.sessions set soru_durum = 'sonuc' where id = p_session and soru_durum = 'acik';
  elsif p_komut = 'yeniden_ac' then
    update public.sessions s set soru_durum = 'acik'
    where s.id = p_session and s.soru_durum = 'sonuc'
      and exists (select 1 from public.lesson_steps st where st.id = s.aktif_adim and st.tur in ('fikir', 'oylama'));
  elsif p_komut = 'telefon_ac' then
    update public.sessions set telefon_modu = true where id = p_session;
  elsif p_komut = 'telefon_kapat' then
    update public.sessions set telefon_modu = false where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Kumandadan uygunsuz katkıyı kaldırma (projeksiyonsuz derste sahne yoktur): perdedeki adımda bu metni
-- taşıyan bütün katkılar gizlenir ya da geri açılır.
create function public.kumanda_gizle(p_session uuid, p_anahtar text, p_metin text, p_gizli boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  update public.contributions k set gizli = coalesce(p_gizli, true)
  from public.sessions s
  where s.id = p_session and k.session_id = s.id and k.step_id = s.aktif_adim
    and lower(k.metin) = lower(btrim(coalesce(p_metin, ''))) and k.metin <> '';
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select, delete on public.contributions to authenticated;
grant update (gizli) on public.contributions to authenticated;

revoke all on function ozel.katki_kisi(uuid, text)                         from public;
revoke all on function ozel.etkinlik(uuid, uuid, boolean)                  from public;
revoke all on function public.katki_gonder(uuid, text, text, integer)      from public;
revoke all on function public.kumanda_gizle(uuid, text, text, boolean)     from public;

grant execute on function public.katki_gonder(uuid, text, text, integer)   to anon, authenticated;
grant execute on function public.kumanda_gizle(uuid, text, text, boolean)  to anon, authenticated;

-- Sahne gelen katkıları canlı izler.
alter publication supabase_realtime add table public.contributions;

-- Supabase'in "Automatic RLS" özelliğinin olay tetikleyicisi fonksiyonu Data API'den çağrılabilir
-- görünüyordu (güvenlik danışmanı uyarısı). Çağrılınca zaten hata verir; yetkisi yine de kaldırılır.
-- Yalnızca bu fonksiyonun bulunduğu kurulumlarda çalışır.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- ===========================================================================
-- 0011_kumanda_dersi_bitir.sql
-- ===========================================================================

-- 0011: Kumandadan dersi bitirme ve yeniden açma
--
-- Hoca telefonundaki kumandadan dersi bitirebilir (ders_bitir) ve bitmiş dersi yeniden açabilir (ders_ac).
-- Bitirince yoklama kapanır ve öğrencilerin telefonunda "Ders bitti" görünür (sessions tetikleyicisi
-- bunu zaten yayınlar). Yalnızca kumanda_komut'a iki komut eklenir; geri kalanı 0010'daki gibidir.

create or replace function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  elsif p_komut = 'sonuc_goster' then
    update public.sessions set soru_durum = 'sonuc' where id = p_session and soru_durum = 'acik';
  elsif p_komut = 'yeniden_ac' then
    update public.sessions s set soru_durum = 'acik'
    where s.id = p_session and s.soru_durum = 'sonuc'
      and exists (select 1 from public.lesson_steps st where st.id = s.aktif_adim and st.tur in ('fikir', 'oylama'));
  elsif p_komut = 'telefon_ac' then
    update public.sessions set telefon_modu = true where id = p_session;
  elsif p_komut = 'telefon_kapat' then
    update public.sessions set telefon_modu = false where id = p_session;
  elsif p_komut = 'ders_bitir' then
    update public.sessions set yoklama_acik = false, bitti = coalesce(bitti, now()) where id = p_session;
  elsif p_komut = 'ders_ac' then
    update public.sessions set bitti = null where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ===========================================================================
-- 0012_quiz.sql
-- ===========================================================================

-- 0012: Habersiz quiz
--
-- Kahoot tarzı canlı yarışmadan ayrı bir mod. Hoca (şube için) bir soru kümesinden quiz açar ve 6 haneli bir
-- kod alır. Öğrenci kodu ve öğrenci numarasını girer, soruları kendi hızında, kendi sırasıyla çözer. Sonuçlar
-- öğrenciye bağlı kaydedilir (gelişim raporuna girer); canlı sıralama yoktur.
--
-- * Numara şubenin listesinde olmalı (yoklamadaki kural). Bir numara tek cihazdan, bir cihaz tek numarayla girer.
-- * Soru sırası ve şıkların sırası her öğrenci için ayrıca karışır; doğru cevap öğrenciye hiç gönderilmez.
-- * Süre öğrenciye göre başladığı andan işler (sure_dk); süre dolunca ya da hoca kapatınca cevap alınmaz.
-- * Öğrenci kendi puanını yalnızca hoca "sonucu öğrenciye göster" dediyse görür.
-- * Hoca yalnızca kendi şubelerinin quizlerini okur; quiz oluşturma ve kapatma RPC ile yapılır.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses (id) on delete cascade,
  baslik           text not null check (length(btrim(baslik)) between 1 and 200),
  kod              text not null check (kod ~ '^[0-9]{6}$'),
  sure_dk          integer not null check (sure_dk between 1 and 240),
  sonuc_ogrenciye  boolean not null default false,
  durum            text not null default 'acik' check (durum in ('acik', 'kapali')),
  basladi          timestamptz not null default now(),
  kapandi          timestamptz
);
-- Açık quizler arasında kod tekil
create unique index quizzes_acik_kod on public.quizzes (kod) where durum = 'acik';
create index quizzes_course_idx on public.quizzes (course_id);
alter table public.quizzes enable row level security;

create table public.quiz_questions (
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  sira         integer not null,
  primary key (quiz_id, question_id)
);
alter table public.quiz_questions enable row level security;

create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  basladi     timestamptz not null default now(),
  bitti       timestamptz,
  unique (quiz_id, student_id),
  unique (quiz_id, cihaz_id)
);
create index quiz_attempts_student_idx on public.quiz_attempts (student_id);
alter table public.quiz_attempts enable row level security;

create table public.quiz_answers (
  attempt_id   uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  -- Sorgu kolaylığı için denormalize: hangi quiz ve hangi öğrenci
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  secim        integer not null,
  dogru        boolean not null,
  zaman        timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index quiz_answers_quiz_idx on public.quiz_answers (quiz_id);
alter table public.quiz_answers enable row level security;

-- Hoca yalnızca kendi şubesinin quizlerini görür.
create function public.quiz_benim(p_quiz uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quizzes z
    join public.courses c on c.id = z.course_id
    where z.id = p_quiz and c.teacher_id = auth.uid()
  );
$$;

create policy "hoca quizlerini gorur" on public.quizzes
  for select to authenticated using (public.ders_benim(course_id));
create policy "hoca quizlerini siler" on public.quizzes
  for delete to authenticated using (public.ders_benim(course_id));
create policy "hoca quiz sorularini gorur" on public.quiz_questions
  for select to authenticated using (public.quiz_benim(quiz_id));
create policy "hoca denemeleri gorur" on public.quiz_attempts
  for select to authenticated using (public.quiz_benim(quiz_id));
-- Hoca bir öğrencinin denemesini silebilir (öğrenci quizi yeniden çözebilir).
create policy "hoca denemeyi siler" on public.quiz_attempts
  for delete to authenticated using (public.quiz_benim(quiz_id));
create policy "hoca quiz cevaplarini gorur" on public.quiz_answers
  for select to authenticated using (public.quiz_benim(quiz_id));

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
-- Şıklar: doğru + yanlışlar, denemeye ve soruya göre karıştırılmış sırayla (her öğrencide farklı)
create function ozel.quiz_secenekler(p_attempt uuid, p_soru uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(x order by md5(p_attempt::text || ':' || p_soru::text || ':' || x))
  from public.questions q, unnest(array[q.dogru] || q.yanlislar) as x
  where q.id = p_soru;
$$;

-- Öğrenciye giden quiz içeriği: sorular karışık sırada, doğru cevap yok
create function ozel.quiz_paket(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt', a.id,
    'baslik', z.baslik,
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'sure_dk', z.sure_dk,
    'kalan_ms', greatest(0, z.sure_dk * 60000 - floor(extract(epoch from (clock_timestamp() - a.basladi)) * 1000))::integer,
    'bitti', a.bitti is not null,
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'soru', q.soru,
        'secenekler', to_jsonb(ozel.quiz_secenekler(a.id, q.id)),
        'secim', ans.secim
      ) order by md5(a.id::text || q.id::text))
      from public.quiz_questions qq
      join public.questions q on q.id = qq.question_id
      left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
      where qq.quiz_id = z.id
    ), '[]'::jsonb)
  )
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  join public.courses c on c.id = z.course_id
  where a.id = p_attempt;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca
-- ---------------------------------------------------------------------------
-- Dönen değer: { id, kod }
create function public.quiz_olustur(p_course uuid, p_baslik text, p_sure_dk integer, p_sorular uuid[], p_sonuc_ogrenciye boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sorular uuid[] := array(select distinct x from unnest(coalesce(p_sorular, '{}')) as x);
  v_say     integer;
  v_kod     text;
  v_id      uuid;
begin
  if not public.ders_benim(p_course) then
    raise exception 'ders bulunamadi' using errcode = 'P0002';
  end if;
  if cardinality(v_sorular) = 0 or cardinality(v_sorular) > 100 then
    raise exception 'soru sayisi 1 ile 100 arasinda olmali' using errcode = '22023';
  end if;
  -- Sorular dersin içeriğine ait olmalı
  select count(*) into v_say
  from public.questions q
  join public.courses c on c.subject_id = q.subject_id
  where c.id = p_course and q.id = any (v_sorular);
  if v_say <> cardinality(v_sorular) then
    raise exception 'sorular bu dersin icerigine ait degil' using errcode = '22023';
  end if;

  for i in 1..30 loop
    v_kod := lpad((floor(random() * 900000) + 100000)::integer::text, 6, '0');
    exit when not exists (select 1 from public.quizzes z where z.kod = v_kod and z.durum = 'acik');
    v_kod := null;
  end loop;
  if v_kod is null then
    raise exception 'kod uretilemedi' using errcode = '55000';
  end if;

  insert into public.quizzes (course_id, baslik, kod, sure_dk, sonuc_ogrenciye)
  values (p_course, btrim(p_baslik), v_kod, p_sure_dk, coalesce(p_sonuc_ogrenciye, false))
  returning id into v_id;

  insert into public.quiz_questions (quiz_id, question_id, sira)
  select v_id, x, o from unnest(p_sorular) with ordinality as t(x, o)
  where x = any (v_sorular)
  on conflict do nothing;

  return jsonb_build_object('id', v_id, 'kod', v_kod);
end;
$$;

-- Quizi kapatır; bitirmemiş öğrencilerin denemeleri de o ana kadarki cevaplarla biter.
create function public.quiz_kapat(p_quiz uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.quiz_benim(p_quiz) then
    raise exception 'quiz bulunamadi' using errcode = 'P0002';
  end if;
  update public.quizzes set durum = 'kapali', kapandi = coalesce(kapandi, now()) where id = p_quiz;
  update public.quiz_attempts set bitti = coalesce(bitti, now()) where quiz_id = p_quiz;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Kod bir quize ait mi? { baslik, ders } ya da { hata: 'kod_yanlis' }
create function public.quiz_bul(p_kod text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('baslik', z.baslik, 'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''))
     from public.quizzes z join public.courses c on c.id = z.course_id
     where z.kod = regexp_replace(coalesce(p_kod, ''), '\D', '', 'g') and z.durum = 'acik'),
    jsonb_build_object('hata', 'kod_yanlis')
  );
$$;

-- Quize başlar ya da yarıda kalan denemeye devam eder. Dönen değer: quiz içeriği ya da { hata }
create function public.quiz_baslat(p_kod text, p_ogrenci_no text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z         record;
  a         record;
  v_no      text := upper(regexp_replace(coalesce(p_ogrenci_no, ''), '\s', '', 'g'));
  v_student uuid;
  v_id      uuid;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if v_no !~ '^[0-9A-Z]{1,20}$' then
    return jsonb_build_object('hata', 'numara_gecersiz');
  end if;

  select id, course_id into z
  from public.quizzes
  where kod = regexp_replace(coalesce(p_kod, ''), '\D', '', 'g') and durum = 'acik';
  if not found then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  select st.id into v_student
  from public.students st
  where st.course_id = z.course_id and upper(st.ogrenci_no) = v_no;
  if v_student is null then
    return jsonb_build_object('hata', 'liste_disi');
  end if;

  select id, cihaz_id, bitti into a from public.quiz_attempts where quiz_id = z.id and student_id = v_student;
  if found then
    if a.cihaz_id <> p_cihaz then
      return jsonb_build_object('hata', 'numara_kullanildi');
    end if;
    if a.bitti is not null then
      return jsonb_build_object('hata', 'zaten_bitti');
    end if;
    return ozel.quiz_paket(a.id);
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = z.id and cihaz_id = p_cihaz) then
    return jsonb_build_object('hata', 'cihaz_kullanildi');
  end if;

  begin
    insert into public.quiz_attempts (quiz_id, student_id, cihaz_id) values (z.id, v_student, p_cihaz) returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('hata', 'tekrar_dene');
  end;
  return ozel.quiz_paket(v_id);
end;
$$;

-- Bir soruya cevap yazar (süre içinde değiştirilebilir). Dönen değer: { durum: 'tamam' } ya da { hata }
create function public.quiz_cevapla(p_attempt uuid, p_cihaz text, p_soru uuid, p_secim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r         record;
  v_secenek text[];
  v_dogru   text;
begin
  select a.id, a.cihaz_id, a.bitti, a.basladi, a.student_id, z.id as quiz_id, z.durum, z.sure_dk
    into r
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;

  if not found or p_cihaz is null or r.cihaz_id <> p_cihaz then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;
  if r.bitti is not null then
    return jsonb_build_object('hata', 'bitti');
  end if;
  if r.durum <> 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  -- Ağ gecikmesi için 10 saniye pay
  if extract(epoch from (clock_timestamp() - r.basladi)) > r.sure_dk * 60 + 10 then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;
  if not exists (select 1 from public.quiz_questions where quiz_id = r.quiz_id and question_id = p_soru) then
    return jsonb_build_object('hata', 'soru_yok');
  end if;

  v_secenek := ozel.quiz_secenekler(p_attempt, p_soru);
  if p_secim is null or p_secim < 0 or p_secim >= cardinality(v_secenek) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;
  select q.dogru into v_dogru from public.questions q where q.id = p_soru;

  insert into public.quiz_answers (attempt_id, question_id, quiz_id, student_id, secim, dogru)
  values (p_attempt, p_soru, r.quiz_id, r.student_id, p_secim, v_secenek[p_secim + 1] = v_dogru)
  on conflict (attempt_id, question_id)
  do update set secim = excluded.secim, dogru = excluded.dogru, zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Denemeyi bitirir. Hoca izin verdiyse { dogru, toplam } da döner.
create function public.quiz_bitir(p_attempt uuid, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select a.id, a.cihaz_id, z.id as quiz_id, z.sonuc_ogrenciye
    into r
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;

  if not found or p_cihaz is null or r.cihaz_id <> p_cihaz then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;

  update public.quiz_attempts set bitti = coalesce(bitti, now()) where id = p_attempt;

  return jsonb_build_object('durum', 'tamam') || case when r.sonuc_ogrenciye then jsonb_build_object(
    'dogru', (select count(*) from public.quiz_answers x where x.attempt_id = p_attempt and x.dogru),
    'toplam', (select count(*) from public.quiz_questions x where x.quiz_id = r.quiz_id)
  ) else '{}'::jsonb end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, delete on public.quizzes       to authenticated;
grant select         on public.quiz_questions to authenticated;
grant select, delete on public.quiz_attempts to authenticated;
grant select         on public.quiz_answers  to authenticated;

revoke all on function public.quiz_benim(uuid)                              from public;
revoke all on function ozel.quiz_secenekler(uuid, uuid)                     from public;
revoke all on function ozel.quiz_paket(uuid)                                from public;
revoke all on function public.quiz_olustur(uuid, text, integer, uuid[], boolean) from public;
revoke all on function public.quiz_kapat(uuid)                              from public;
revoke all on function public.quiz_bul(text)                                from public;
revoke all on function public.quiz_baslat(text, text, text)                 from public;
revoke all on function public.quiz_cevapla(uuid, text, uuid, integer)       from public;
revoke all on function public.quiz_bitir(uuid, text)                        from public;

grant execute on function public.quiz_benim(uuid)                           to authenticated;
grant execute on function public.quiz_olustur(uuid, text, integer, uuid[], boolean) to authenticated;
grant execute on function public.quiz_kapat(uuid)                           to authenticated;
grant execute on function public.quiz_bul(text)                             to anon, authenticated;
grant execute on function public.quiz_baslat(text, text, text)              to anon, authenticated;
grant execute on function public.quiz_cevapla(uuid, text, uuid, integer)    to anon, authenticated;
grant execute on function public.quiz_bitir(uuid, text)                     to anon, authenticated;

-- ===========================================================================
-- 0013_misafir_ogrenci.sql
-- ===========================================================================

-- 0013: Misafir öğrenci (başka şubede derse giren öğrenci)
--
-- Ahmet A şubesinde kayıtlıdır ama B şubesinde derse girer. Hoca Ahmet'i B'nin listesine misafir olarak ekler;
-- misafir satır asıl öğrenciye (A'daki kayıt) bağlanır. Böylece Ahmet B'de yoklamaya ve etkinliklere katılır,
-- B'nin listesinde görünür; A'nın yoklama raporu ise onun B'deki katılımını kendi listesine yazar.
-- * students.asil_id: misafir satırın asıl kaydı (başka şubede, aynı hocanın, kendisi misafir olmayan bir öğrenci).
-- * Asıl öğrenci silinirse misafir satırlar da silinir.

alter table public.students add column asil_id uuid references public.students (id) on delete cascade;
create index students_asil_idx on public.students (asil_id) where asil_id is not null;

create function ozel.misafir_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asil public.students;
begin
  if new.asil_id is null then
    return new;
  end if;
  select * into v_asil from public.students where id = new.asil_id;
  if not found then
    raise exception 'asil ogrenci bulunamadi' using errcode = '23514';
  end if;
  if v_asil.course_id = new.course_id then
    raise exception 'asil ogrenci baska subede olmali' using errcode = '23514';
  end if;
  if v_asil.asil_id is not null then
    raise exception 'asil ogrenci kendisi misafir olamaz' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.courses a join public.courses b on b.teacher_id = a.teacher_id
    where a.id = v_asil.course_id and b.id = new.course_id
  ) then
    raise exception 'sube baska hocaya ait' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_misafir
  before insert or update of asil_id, course_id on public.students
  for each row execute function ozel.misafir_denetle();

-- Misafirleri olan bir kayıt misafir yapılamaz (zincir oluşmasın).
create function ozel.misafirli_kayit_misafir_olmasin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asil_id is not null and exists (select 1 from public.students m where m.asil_id = new.id) then
    raise exception 'misafirleri olan kayit misafir olamaz' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_misafirli_kayit
  before update of asil_id on public.students
  for each row execute function ozel.misafirli_kayit_misafir_olmasin();

-- ===========================================================================
-- 0014_sinif_etkilesimi.sql
-- ===========================================================================

-- 0014: Sınıf etkileşimi: parmak kaldır, soru sor, "sıkıldım" ve çekiliş
--
-- Öğrenci telefonundaki üç düğme:
-- * el      (parmak kaldır): öğrencinin adı perdenin kenarında sıraya girer; hoca söz verince indirir.
-- * soru    (soru sor): yazılı soru (3-280 harf) perdede soran kişinin adıyla zarf olarak görünür; hoca uygun
--           olunca açıp cevaplar ve "cevaplandı" der.
-- * sikildim: sınıfın yüzde 25'i basınca perdede uyarı çıkar; hoca dersi durdurur (mola), sıkıldım diyenler
--           arasından çekiliş çeker (en fazla 3), seçilen fıkra anlatır, sonra derse dönülür.
-- Öğrenci (anon) hiçbir tabloyu okuyamaz; yalnızca RPC'lerle çalışır. Kişi, oturumun gizli anahtarı ve cihaz
-- kimliğinden türetilen bir özetle tanınır (katkılardaki gibi). Görünen ad, yoklamadaki öğrencinin kısa adı
-- ("Ahmet Y.") ya da takma addır; yoklaması ya da takma adı olmayan cihaz düğmeleri kullanamaz.
-- Hoca tarafı: sahne (giriş yapmış hoca) anahtarsız, kumanda (girişsiz) kumanda anahtarıyla aynı RPC'leri çağırır.

create table public.sinif_olaylari (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  kisi        text not null check (length(kisi) = 32),
  ad          text not null check (length(ad) between 1 and 40),
  tur         text not null check (tur in ('el', 'soru', 'sikildim')),
  metin       text not null default '' check (length(metin) <= 280),
  -- bekliyor: sırada; cekildi: sıkıldım çekilişinde seçildi; tamam: bitti (söz verildi, cevaplandı, derse dönüldü)
  durum       text not null default 'bekliyor' check (durum in ('bekliyor', 'cekildi', 'tamam')),
  zaman       timestamptz not null default now()
);
create index sinif_olaylari_oturum_idx on public.sinif_olaylari (session_id, tur, durum);
create unique index sinif_el_tekil on public.sinif_olaylari (session_id, kisi) where tur = 'el' and durum = 'bekliyor';
create unique index sinif_sikildim_tekil on public.sinif_olaylari (session_id, kisi) where tur = 'sikildim' and durum in ('bekliyor', 'cekildi');
alter table public.sinif_olaylari enable row level security;

create policy "hoca sinif olaylarini gorur" on public.sinif_olaylari
  for select to authenticated
  using (public.oturum_benim(session_id));

-- Oturumun mola ve çekiliş durumu
create table public.sinif_durum (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  mola        boolean not null default false,
  cekilis     integer not null default 0 check (cekilis between 0 and 3)
);
alter table public.sinif_durum enable row level security;

create policy "hoca sinif durumunu gorur" on public.sinif_durum
  for select to authenticated
  using (public.oturum_benim(session_id));

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
-- Cihazın bu oturumdaki görünen adı: yoklamadaki öğrencinin kısa adı ya da takma ad. Yoksa null.
create function ozel.sinif_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(regexp_replace(btrim(x.ad), '^(\S+)(?:\s+\S+)*\s+(\S)\S*$', '\1 \2.'), 40)
  from (
    select coalesce(
      (select st.ad_soyad from public.attendance a join public.students st on st.id = a.student_id
        where a.session_id = p_session and a.cihaz_id = p_cihaz),
      (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
    ) as ad
  ) x
  where x.ad is not null;
$$;

-- Hoca yetkisi: kumanda anahtarı ya da oturumun sahibi olarak giriş yapmış hoca
create function ozel.sinif_yetki(p_session uuid, p_anahtar text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_anahtar is not null then ozel.kumanda_dogru(p_session, p_anahtar)
    else auth.uid() is not null and public.oturum_benim(p_session)
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- p_tur: 'el' | 'el_indir' | 'soru' | 'sikildim' | 'sikildim_geri'. Dönen: { durum: 'tamam' } ya da { hata }.
create function public.sinif_gonder(p_session uuid, p_cihaz text, p_tur text, p_metin text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kisi  text;
  v_ad    text;
  v_metin text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if p_tur not in ('el', 'el_indir', 'soru', 'sikildim', 'sikildim_geri') then
    return jsonb_build_object('hata', 'tur_gecersiz');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'ders_yok');
  end if;
  v_ad := ozel.sinif_adi(p_session, p_cihaz);
  if v_ad is null then
    return jsonb_build_object('hata', 'katilmadin');
  end if;
  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  perform pg_advisory_xact_lock(hashtext('sinif:' || v_kisi));

  if p_tur = 'el_indir' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and kisi = v_kisi and tur = 'el' and durum = 'bekliyor';
    return jsonb_build_object('durum', 'tamam');
  end if;
  if p_tur = 'sikildim_geri' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and kisi = v_kisi and tur = 'sikildim' and durum = 'bekliyor';
    return jsonb_build_object('durum', 'tamam');
  end if;

  -- Uydurma cihaz kimlikleriyle yığma yapılmasın diye oturum başına üst sınır
  if (select count(*) from public.sinif_olaylari o where o.session_id = p_session) >= 3000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if p_tur = 'soru' then
    if length(v_metin) < 3 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > 280 then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    if (select count(*) from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'soru' and o.durum = 'bekliyor') >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    insert into public.sinif_olaylari (session_id, kisi, ad, tur, metin) values (p_session, v_kisi, v_ad, 'soru', v_metin);
  elsif p_tur = 'el' then
    insert into public.sinif_olaylari (session_id, kisi, ad, tur) values (p_session, v_kisi, v_ad, 'el') on conflict do nothing;
  else
    insert into public.sinif_olaylari (session_id, kisi, ad, tur) values (p_session, v_kisi, v_ad, 'sikildim') on conflict do nothing;
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Öğrencinin kendi düğmelerinin durumu ve molada seçilip seçilmediği
create function public.sinif_durumum(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kisi text;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  return jsonb_build_object(
    'el', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'el' and o.durum = 'bekliyor'),
    'sikildim', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'sikildim' and o.durum in ('bekliyor', 'cekildi')),
    'secildim', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'sikildim' and o.durum = 'cekildi'),
    'mola', coalesce((select d.mola from public.sinif_durum d where d.session_id = p_session), false),
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object('metin', q.metin, 'durum', q.durum) order by q.zaman desc)
      from (select o.metin, o.durum, o.zaman from public.sinif_olaylari o
            where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'soru' order by o.zaman desc limit 5) q
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca (sahne anahtarsız, kumanda anahtarla)
-- ---------------------------------------------------------------------------
create function public.sinif_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  return jsonb_build_object(
    'olaylar', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'tur', o.tur, 'ad', o.ad, 'metin', o.metin, 'durum', o.durum, 'zaman', o.zaman) order by o.zaman, o.id)
      from public.sinif_olaylari o
      where o.session_id = p_session and o.durum <> 'tamam'
    ), '[]'::jsonb),
    'mola', coalesce((select d.mola from public.sinif_durum d where d.session_id = p_session), false),
    'cekilis', coalesce((select d.cekilis from public.sinif_durum d where d.session_id = p_session), 0),
    'katilan', (select count(*) from public.attendance a where a.session_id = p_session)
               + (select count(*) from public.session_players p where p.session_id = p_session
                  and not exists (select 1 from public.attendance a where a.session_id = p_session and a.cihaz_id = p.cihaz_id))
  );
end;
$$;

-- Komutlar: soru_tamam, el_indir (p_id), eller_indir, mola_ac, cekilis, cekilis_anlatti, derse_don
create function public.sinif_komut(p_session uuid, p_anahtar text, p_komut text, p_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cekilis integer;
  v_secilen record;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  insert into public.sinif_durum (session_id) values (p_session) on conflict do nothing;

  if p_komut = 'soru_tamam' then
    update public.sinif_olaylari set durum = 'tamam' where id = p_id and session_id = p_session and tur = 'soru';
  elsif p_komut = 'el_indir' then
    update public.sinif_olaylari set durum = 'tamam' where id = p_id and session_id = p_session and tur = 'el';
  elsif p_komut = 'eller_indir' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'el' and durum = 'bekliyor';
  elsif p_komut = 'mola_ac' then
    update public.sinif_durum set mola = true where session_id = p_session;
  elsif p_komut = 'cekilis' then
    select cekilis into v_cekilis from public.sinif_durum where session_id = p_session for update;
    if v_cekilis >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    -- Önceki seçilen kabul etmediyse bir daha çekilmez
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'sikildim' and durum = 'cekildi';
    select o.id, o.ad into v_secilen from public.sinif_olaylari o
      where o.session_id = p_session and o.tur = 'sikildim' and o.durum = 'bekliyor'
      order by random() limit 1;
    if not found then
      return jsonb_build_object('hata', 'kimse_yok');
    end if;
    update public.sinif_olaylari set durum = 'cekildi' where id = v_secilen.id;
    update public.sinif_durum set mola = true, cekilis = cekilis + 1 where session_id = p_session;
    return jsonb_build_object('durum', 'tamam', 'secilen', v_secilen.ad);
  elsif p_komut in ('derse_don', 'cekilis_anlatti') then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'sikildim' and durum <> 'tamam';
    update public.sinif_durum set mola = false, cekilis = 0 where session_id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select on public.sinif_olaylari to authenticated;
grant select on public.sinif_durum to authenticated;

revoke all on function ozel.sinif_adi(uuid, text)    from public;
revoke all on function ozel.sinif_yetki(uuid, text)  from public;
revoke all on function public.sinif_gonder(uuid, text, text, text) from public;
revoke all on function public.sinif_durumum(uuid, text)             from public;
revoke all on function public.sinif_goster(uuid, text)              from public;
revoke all on function public.sinif_komut(uuid, text, text, uuid)   from public;

grant execute on function public.sinif_gonder(uuid, text, text, text) to anon, authenticated;
grant execute on function public.sinif_durumum(uuid, text)             to anon, authenticated;
grant execute on function public.sinif_goster(uuid, text)              to anon, authenticated;
grant execute on function public.sinif_komut(uuid, text, text, uuid)   to anon, authenticated;

alter publication supabase_realtime add table public.sinif_olaylari;
alter publication supabase_realtime add table public.sinif_durum;

-- ===========================================================================
-- 0015_takim_yarismasi.sql
-- ===========================================================================

-- 0015: Takım yarışması
--
-- Hoca bir oturumda takım modunu açar (2-6 takım). Öğrenci telefonunda bir takım seçer; bilgi yarışmasındaki
-- puanlar takım bazında toplanır ve takımlar arası sıralama perdede görünür.
-- * takim_ayar: oturumun takım sayısı (0 = takım modu kapalı).
-- * takim_uyeleri: hangi cihaz hangi takımda. Öğrenci ilk cevabını verdikten sonra takım değiştiremez
--   (kazanan takıma geçerek puan toplanamasın).
-- * Takım sırası, üye başına ortalama puana göredir (takımların üye sayısı eşit olmayabilir); toplam puan da gösterilir.
-- Öğrenci (anon) tabloları okuyamaz; hoca sahnede anahtarsız, kumandada anahtarla aynı RPC'leri çağırır
-- (ozel.sinif_yetki, 0014).

create table public.takim_ayar (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  sayi        smallint not null default 0 check (sayi = 0 or sayi between 2 and 6)
);
alter table public.takim_ayar enable row level security;
create policy "hoca takim ayarini gorur" on public.takim_ayar
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.takim_uyeleri (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  takim       smallint not null check (takim between 1 and 6),
  primary key (session_id, cihaz_id)
);
alter table public.takim_uyeleri enable row level security;
create policy "hoca takim uyelerini gorur" on public.takim_uyeleri
  for select to authenticated
  using (public.oturum_benim(session_id));

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Dönen: { sayi, takim } (takim: seçilmemişse null)
create function public.takim_durumum(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  return jsonb_build_object(
    'sayi', coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0),
    'takim', (select u.takim from public.takim_uyeleri u where u.session_id = p_session and u.cihaz_id = p_cihaz)
  );
end;
$$;

create function public.takim_sec(p_session uuid, p_cihaz text, p_takim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sayi   integer;
  v_mevcut smallint;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'ders_yok');
  end if;
  select a.sayi into v_sayi from public.takim_ayar a where a.session_id = p_session;
  if coalesce(v_sayi, 0) = 0 then
    return jsonb_build_object('hata', 'takim_modu_kapali');
  end if;
  if p_takim is null or p_takim < 1 or p_takim > v_sayi then
    return jsonb_build_object('hata', 'takim_gecersiz');
  end if;
  if ozel.sinif_adi(p_session, p_cihaz) is null then
    return jsonb_build_object('hata', 'katilmadin');
  end if;
  perform pg_advisory_xact_lock(hashtext('takim:' || p_session::text || p_cihaz));
  select u.takim into v_mevcut from public.takim_uyeleri u where u.session_id = p_session and u.cihaz_id = p_cihaz;
  if v_mevcut is not null and v_mevcut <> p_takim
     and exists (select 1 from public.responses r where r.session_id = p_session and r.cihaz_id = p_cihaz) then
    return jsonb_build_object('hata', 'kilitli');
  end if;
  insert into public.takim_uyeleri (session_id, cihaz_id, takim) values (p_session, p_cihaz, p_takim)
  on conflict (session_id, cihaz_id) do update set takim = excluded.takim;
  return jsonb_build_object('durum', 'tamam', 'takim', p_takim);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca (sahne anahtarsız, kumanda anahtarla)
-- ---------------------------------------------------------------------------
-- Takım sayısı ve takım sıralaması. Üyesi olmayan takım da listelenir.
create function public.takim_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sayi integer;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0) into v_sayi;
  return jsonb_build_object(
    'sayi', v_sayi,
    'takimlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'takim', s.takim, 'uye', s.uye, 'puan', s.puan, 'dogru', s.dogru, 'ortalama', s.ortalama, 'sira', s.sira
             ) order by s.sira, s.takim)
      from (
        select t.*, rank() over (order by t.ortalama desc, t.puan desc)::integer as sira
        from (
          select g.takim,
                 (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim)::integer as uye,
                 coalesce(sum(r.puan), 0)::integer as puan,
                 (count(*) filter (where r.dogru))::integer as dogru,
                 case when (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim) = 0 then 0
                      else round(coalesce(sum(r.puan), 0)::numeric
                                 / (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim))::integer
                 end as ortalama
          from generate_series(1, v_sayi) as g(takim)
          left join public.takim_uyeleri m on m.session_id = p_session and m.takim = g.takim
          left join public.responses r on r.session_id = p_session and r.cihaz_id = m.cihaz_id
          group by g.takim
        ) t
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- Takım sayısını ayarlar (0: kapat). Sayı azalırsa dışarıda kalan takımların üyeleri yeniden seçer.
create function public.takim_ayarla(p_session uuid, p_anahtar text, p_sayi integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if p_sayi is null or not (p_sayi = 0 or p_sayi between 2 and 6) then
    return jsonb_build_object('hata', 'sayi_gecersiz');
  end if;
  insert into public.takim_ayar (session_id, sayi) values (p_session, p_sayi)
  on conflict (session_id) do update set sayi = excluded.sayi;
  delete from public.takim_uyeleri where session_id = p_session and (p_sayi = 0 or takim > p_sayi);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select on public.takim_ayar to authenticated;
grant select on public.takim_uyeleri to authenticated;

revoke all on function public.takim_durumum(uuid, text)        from public;
revoke all on function public.takim_sec(uuid, text, integer)   from public;
revoke all on function public.takim_goster(uuid, text)         from public;
revoke all on function public.takim_ayarla(uuid, text, integer) from public;

grant execute on function public.takim_durumum(uuid, text)         to anon, authenticated;
grant execute on function public.takim_sec(uuid, text, integer)    to anon, authenticated;
grant execute on function public.takim_goster(uuid, text)          to anon, authenticated;
grant execute on function public.takim_ayarla(uuid, text, integer) to anon, authenticated;

-- ===========================================================================
-- 0016_hocayla_yaris.sql
-- ===========================================================================

-- 0016: Hocayla yarış
--
-- Bilgi yarışmasında sınıf hocaya karşı oynar. Hoca her soruda kendi cevabını gizlice verir (sahnede harf
-- düğmeleriyle ya da kumandadan); soru sonucu açılınca hocanın doğru bilip bilmediği ve sınıfın başarısı
-- skora yazılır:
-- * Hoca soruyu doğru bilirse hoca 1 puan alır.
-- * Sınıfta cevap verenlerin en az yarısı doğru bilirse sınıf 1 puan alır.
-- (İkisi birden puan alabilir.) Hocanın cevabı metin olarak saklanır; şık sırası oturuma göre karıştığı için
-- sıra numarası yerine metin kullanılır. Skor yalnızca sonucu açılmış ya da geçilmiş soruları sayar, böylece
-- perdedeki skor hocanın gizli cevabını önceden belli etmez.
-- Hoca yetkisi (ozel.sinif_yetki, 0014): sahne giriş yapmış hoca olarak anahtarsız, kumanda anahtarla çağırır.

create table public.hoca_yaris (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  acik        boolean not null default false
);
alter table public.hoca_yaris enable row level security;
create policy "hoca yaris ayarini gorur" on public.hoca_yaris
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.hoca_cevaplari (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  step_id     uuid not null references public.lesson_steps (id) on delete cascade,
  secim       text not null check (length(secim) between 1 and 300),
  primary key (session_id, step_id)
);
alter table public.hoca_cevaplari enable row level security;
create policy "hoca kendi cevaplarini gorur" on public.hoca_cevaplari
  for select to authenticated
  using (public.oturum_benim(session_id));

create function public.hoca_yaris_ayarla(p_session uuid, p_anahtar text, p_acik boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  insert into public.hoca_yaris (session_id, acik) values (p_session, coalesce(p_acik, false))
  on conflict (session_id) do update set acik = excluded.acik;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Perdedeki soru için hocanın cevabı. Sonuç açıldıktan sonra değiştirilemez.
create function public.hoca_cevapla(p_session uuid, p_anahtar text, p_adim uuid, p_secim text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s record;
  v_q record;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.aktif_adim, s.soru_durum into v_s from public.sessions s where s.id = p_session;
  if not found or v_s.aktif_adim is distinct from p_adim then
    return jsonb_build_object('hata', 'adim_aktif_degil');
  end if;
  if v_s.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  select q.dogru, q.yanlislar into v_q
  from public.lesson_steps st join public.questions q on q.id = st.question_id
  where st.id = p_adim and st.tur = 'soru';
  if not found then
    return jsonb_build_object('hata', 'soru_yok');
  end if;
  if p_secim is null or not (p_secim = v_q.dogru or p_secim = any (v_q.yanlislar)) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;
  insert into public.hoca_cevaplari (session_id, step_id, secim) values (p_session, p_adim, p_secim)
  on conflict (session_id, step_id) do update set secim = excluded.secim;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Skor ve perdedeki soru için hocanın cevap verip vermediği (cevabın kendisi sonuç açılana kadar dönmez).
create function public.hoca_yaris_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aktif uuid;
  v_durum text;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.aktif_adim, s.soru_durum into v_aktif, v_durum from public.sessions s where s.id = p_session;
  return (
    select jsonb_build_object(
      'acik', coalesce((select y.acik from public.hoca_yaris y where y.session_id = p_session), false),
      'hoca', coalesce(sum(case when t.hoca_dogru then 1 else 0 end), 0),
      'sinif', coalesce(sum(case when t.sinif_orani >= 50 then 1 else 0 end), 0),
      'soru', count(*),
      'cevapladi', exists (select 1 from public.hoca_cevaplari c where c.session_id = p_session and c.step_id = v_aktif),
      'son', (
        select jsonb_build_object('hoca_dogru', x.hoca_dogru, 'sinif_orani', x.sinif_orani)
        from (
          select (c.secim = q.dogru) as hoca_dogru,
                 (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                    from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
          from public.hoca_cevaplari c
          join public.lesson_steps st on st.id = c.step_id
          join public.questions q on q.id = st.question_id
          where c.session_id = p_session and c.step_id = v_aktif and v_durum = 'sonuc'
        ) x
      )
    )
    from (
      select (c.secim = q.dogru) as hoca_dogru,
             (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
      from public.hoca_cevaplari c
      join public.lesson_steps st on st.id = c.step_id
      join public.questions q on q.id = st.question_id
      where c.session_id = p_session
        -- Yalnızca sonucu açılmış ya da geçilmiş sorular; en az bir sınıf cevabı olmalı
        and (c.step_id is distinct from v_aktif or v_durum = 'sonuc')
        and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = c.step_id)
    ) t
  );
end;
$$;

grant select on public.hoca_yaris to authenticated;
grant select on public.hoca_cevaplari to authenticated;

revoke all on function public.hoca_yaris_ayarla(uuid, text, boolean)  from public;
revoke all on function public.hoca_cevapla(uuid, text, uuid, text)    from public;
revoke all on function public.hoca_yaris_goster(uuid, text)           from public;

grant execute on function public.hoca_yaris_ayarla(uuid, text, boolean) to anon, authenticated;
grant execute on function public.hoca_cevapla(uuid, text, uuid, text)   to anon, authenticated;
grant execute on function public.hoca_yaris_goster(uuid, text)          to anon, authenticated;

-- ===========================================================================
-- 0017_bilgi_merdiveni.sql
-- ===========================================================================

-- 0017: Bilgi merdiveni
--
-- Sınıfın tek bir yarışmacı gibi basamak basamak çıktığı oyun. Her soruda sınıfın çoğunluğu (cevap verenlerin
-- en az yarısı) doğru bilirse sınıf bir basamak çıkar; bilemezse son güvenli basamağa iner. Joker ve güvenli
-- basamak kuralları tarayıcıda uygulanır; veritabanı yalnızca akıştaki soruların sonuç özetini verir.
-- Bu fonksiyon yalnızca okur: perdedeki hoca (anahtarsız) ya da kumanda (anahtarla) çağırır (ozel.sinif_yetki, 0014).
-- "acildi": sonucu açılmış ya da geçilmiş soru (çözülmekte olan soru merdiveni önceden belli etmesin).

create function public.merdiven_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson uuid;
  v_aktif  uuid;
  v_durum  text;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum into v_lesson, v_aktif, v_durum from public.sessions s where s.id = p_session;
  return jsonb_build_object(
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'cevap', x.cevap, 'oran', x.oran, 'acildi', x.acildi) order by x.n)
      from (
        select st.id,
               row_number() over (order by st.sira, st.id)::integer as n,
               (select count(*) from public.responses r where r.session_id = p_session and r.step_id = st.id)::integer as cevap,
               (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                  from public.responses r where r.session_id = p_session and r.step_id = st.id) as oran,
               (st.id is distinct from v_aktif or v_durum = 'sonuc') as acildi
        from public.lesson_steps st
        where st.lesson_id = v_lesson and st.tur = 'soru'
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.merdiven_goster(uuid, text) from public;
grant execute on function public.merdiven_goster(uuid, text) to anon, authenticated;

-- ===========================================================================
-- 0018_ilk_ad.sql
-- ===========================================================================

-- 0018: Oyunlarda ve sınıf düğmelerinde öğrencinin ilk adı görünür
--
-- Kullanıcı kararı (13 Kasım 2026): derse herkes kayıtlı numarasıyla girdiği için oyunlarda takma ad yerine
-- öğrencinin ilk adı görünsün.
-- * İlk ad: ad soyaddaki soyad hariç kısım ("Ahmet Can Yılmaz" -> "Ahmet Can", "Ayşe Kaya" -> "Ayşe").
-- * Aynı oturumda aynı ilk adı taşıyan başka bir yoklamalı öğrenci varsa soyadın baş harfi eklenir ("Ali V.").
-- * Yoklaması olmayan, takma ad almış cihazın görünen adı takma adın kendisidir (kısaltılmaz).
-- Değişen: ozel.oyuncu_adi (puan tablosu, podyum, sonuçlar) ve ozel.sinif_adi (parmak, soru, sıkıldım, takım).

create function ozel.ilk_ad(p_session uuid, p_student uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when s.ad !~ '\s' then s.ad
           when exists (
             select 1
             from public.attendance a
             join public.students o on o.id = a.student_id
             where a.session_id = p_session
               and o.id <> p_student
               and lower(regexp_replace(btrim(o.ad_soyad), '\s+\S+$', '')) = lower(s.ilk)
           ) then s.ilk || ' ' || left(regexp_replace(s.ad, '^.*\s', ''), 1) || '.'
           else s.ilk
         end
  from (
    select btrim(st.ad_soyad) as ad,
           case when btrim(st.ad_soyad) ~ '\s' then regexp_replace(btrim(st.ad_soyad), '\s+\S+$', '') else btrim(st.ad_soyad) end as ilk
    from public.students st
    where st.id = p_student
  ) s;
$$;

create or replace function ozel.oyuncu_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ozel.ilk_ad(p_session, a.student_id) from public.attendance a
      where a.session_id = p_session and a.cihaz_id = p_cihaz),
    (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
  );
$$;

create or replace function ozel.sinif_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(ozel.oyuncu_adi(p_session, p_cihaz), 40);
$$;

revoke all on function ozel.ilk_ad(uuid, uuid) from public;

-- ===========================================================================
-- 0019_oyun_adimi.sql
-- ===========================================================================

-- 0019: Akışta "oyun" adımı
--
-- Hocanın haftalık akışına "bugünün oyunu" kartı koymasını sağlar. Adım perdede oyunun adını, nasıl oynandığını ve bir
-- "Oyunu başlat" düğmesini gösterir; düğme ilgili modu açar (takım yarışması, halat çekme, hocayla yarış, bilgi merdiveni).
-- * lesson_steps.tur'a 'oyun' eklenir.
-- * ayar.oyun: 'takim' | 'halat' | 'hoca' | 'merdiven' (zorunlu); ayar.baslik ve ayar.aciklama isteğe bağlıdır (en fazla 300 harf).
-- Öğrenci telefonunda bu adım "hocanın ekranını izle" olarak görünür (başka bir değişiklik gerekmez).

alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps drop constraint lesson_steps_etkinlik_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru', 'fikir', 'oylama', 'video', 'oyun')),
  add constraint lesson_steps_etkinlik_check check (
    case
      when tur in ('fikir', 'oylama') then length(btrim(coalesce(ayar ->> 'soru', ''))) between 1 and 300
      when tur = 'video' then coalesce(ayar ->> 'url', '') ~ '^https://[^\s]{4,255}$'
      when tur = 'oyun' then coalesce(ayar ->> 'oyun', '') in ('takim', 'halat', 'hoca', 'merdiven')
        and length(coalesce(ayar ->> 'baslik', '')) <= 120
        and length(coalesce(ayar ->> 'aciklama', '')) <= 300
      else true
    end
  );

-- ===========================================================================
-- 0020_yoklama_haftalari.sql
-- ===========================================================================

-- 0020: Yoklama haftaları (yoklama şubeye bağlı, akıştan bağımsız)
--
-- Kullanıcı isteği (13 Kasım 2026): yoklama haftalık akışların içinde değil, sınıfın (şubenin) içinde olsun. Hoca şubede kaç
-- yoklama alacağını (ör. 15 hafta ya da 30 ders) belirler; hangi hafta derse girerse o haftanın yoklamasını açar, öğrenciler
-- karekodu okutur, sonra hoca akışa geçer. Bir akış iki hafta sürebilir, bir haftanın yoklaması hangi akıştan verilirse
-- verilsin aynıdır. Aynı gün o haftanın yoklaması yeniden açılırsa yeni gelenler aynı yoklamaya yazılır.
-- * courses.yoklama_sayisi: şubenin yoklama sayısı (1-60, varsayılan 15); courses.yoklama_birimi: 'hafta' ya da 'ders'.
-- * sessions.hafta_no: oturumun hangi yoklama haftasına ait olduğu (boşsa ek ders ya da yoklamasız oturum).
--   Bir şubede bir hafta numarası yalnızca bir oturumda bulunabilir; haftanın yoklaması yeniden açılırsa o oturum kullanılır.

alter table public.courses
  add column yoklama_sayisi smallint not null default 15 check (yoklama_sayisi between 1 and 60),
  add column yoklama_birimi text not null default 'hafta' check (yoklama_birimi in ('hafta', 'ders'));

alter table public.sessions
  add column hafta_no smallint check (hafta_no between 1 and 60);

create unique index sessions_hafta_tekil on public.sessions (course_id, hafta_no) where hafta_no is not null;

-- ===========================================================================
-- 0021_kod_10sn.sql
-- ===========================================================================

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
