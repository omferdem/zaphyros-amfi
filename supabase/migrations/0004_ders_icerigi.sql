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
