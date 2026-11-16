-- 0051: Etkinlikler (derse bağlı olmayan, yoklamasız, kodla girilen Zapoot / Oyun / Quiz alanı)
--
-- Hoca anasayfadan Zapoot, Oyunlar ya da Quiz bölümüne girer; her bölümde kendi adlandırdığı etkinlik satırları vardır
-- (ad + soru paketi + oyun modu + soru sayısı + zorluk). Satıra tıklayınca yoklamasız bir oturum açılır, öğrenciler kodla girer.
-- * Her bölümün soru bankası gizli bir derse bağlıdır (ders adı "__etkinlik_zapoot" gibi; istemci ilk kullanımda açar).
-- * Bu tablo yalnızca etkinlik satırlarını tutar; oturumlar ve sonuçlar mevcut tablolarda kalır, şube yoklamasına yazılmaz.

create table public.etkinlikler (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  ad          text not null check (length(btrim(ad)) between 1 and 120),
  paket       text not null default '' check (length(paket) <= 200),
  mod         text not null default 'bireysel' check (length(mod) between 1 and 40),
  adet        smallint not null default 20 check (adet between 1 and 100),
  zorluk      text not null default 'orta' check (zorluk in ('kolay', 'orta', 'zor')),
  sira        integer not null default 0,
  olusturuldu timestamptz not null default now()
);
create index etkinlikler_ders_idx on public.etkinlikler (course_id, sira);
alter table public.etkinlikler enable row level security;

create policy "hoca kendi etkinliklerini yonetir" on public.etkinlikler
  for all to authenticated
  using (public.ders_benim(course_id))
  with check (public.ders_benim(course_id));

grant select, insert, update, delete on public.etkinlikler to authenticated;
