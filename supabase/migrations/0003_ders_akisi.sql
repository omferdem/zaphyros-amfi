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
