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
