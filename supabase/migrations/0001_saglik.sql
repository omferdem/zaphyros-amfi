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
