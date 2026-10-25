-- AmfiOS kurulum SQL'i (bu dosya otomatik üretilir, elle düzenleme; kaynağı supabase/migrations)
-- Yeni bir Supabase projesinde SQL Editor'e bu dosyanın tamamını yapıştırıp bir kez çalıştır.
-- İçerdiği migration'lar: 0001_saglik.sql, 0002_yoklama.sql, 0003_ders_akisi.sql, 0004_ders_icerigi.sql, 0005_bilgi_yarismasi.sql, 0006_telefon_modu.sql

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
