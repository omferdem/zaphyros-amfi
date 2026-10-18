-- 0002: Faz 1, QR yoklama
--
-- Tablolar: teachers, courses, students, sessions, attendance
-- Gizli şema: ozel (Data API'ye kapalı; oturum anahtarları burada)
-- RPC: hoca_mi, qr_token, katilim_bileti, check_in
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
-- İlk hoca
-- ---------------------------------------------------------------------------
insert into public.teachers (eposta, ad_soyad, unvan)
values ('omferdem@gmail.com', 'Ömer Faruk Erdem', 'Doç. Dr.')
on conflict (eposta) do nothing;
