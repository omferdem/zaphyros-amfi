-- 0052: Etkinlik arşivi ve slaytlı (ders gibi işlenen) etkinlik
--
-- * etkinlikler.arsiv: silmeden saklamak için; arşivdeki etkinlikler listeden gizlenir, geri alınabilir.
-- * etkinlikler.akis_id: etkinliğe bir ders akışı (slayt, video, soru adımları) bağlanır; "Başlat" akışı yoklamasız oturum olarak açar.
--   Akış silinirse etkinlik satırı kalır, bağı boşalır.

alter table public.etkinlikler
  add column arsiv   boolean not null default false,
  add column akis_id uuid references public.lessons (id) on delete set null;

create index etkinlikler_akis_idx on public.etkinlikler (akis_id) where akis_id is not null;
