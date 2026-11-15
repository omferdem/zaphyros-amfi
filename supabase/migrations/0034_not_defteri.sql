-- 0034: Not defteri
--
-- Kullanıcı isteği (15 Kasım 2026): ana sayfada genel notlar, her şubede o şubeye özel notlar tutulabilsin.
-- * notlar: hocaya ait not kartları. course_id boşsa genel not, doluysa o şubenin notudur (şube silinirse notları da silinir).
-- Yalnızca notun sahibi hoca okur, yazar, siler; başka hoca (sahip dahil) görmez.

create table public.notlar (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id    uuid references public.courses (id) on delete cascade,
  metin        text not null default '' check (length(metin) <= 20000),
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now()
);
create index notlar_teacher_idx on public.notlar (teacher_id, course_id, guncellendi desc);
alter table public.notlar enable row level security;

create policy "hoca kendi notlarini yonetir" on public.notlar
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (
    teacher_id = (select auth.uid())
    and (select public.hoca_mi())
    and (course_id is null or public.ders_benim(course_id))
  );

-- Güncelleme zamanı kendiliğinden yenilenir
create function ozel.not_guncellendi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.guncellendi := clock_timestamp();
  return new;
end;
$$;

create trigger notlar_guncellendi
  before update on public.notlar
  for each row execute function ozel.not_guncellendi();

grant select, insert, update, delete on public.notlar to authenticated;
revoke all on function ozel.not_guncellendi() from public;
