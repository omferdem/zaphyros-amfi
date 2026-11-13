-- 0027: Davetle hoca katılımı (Faz 5b)
--
-- Ortak sistemde sahip, başka hocaları e-posta adresleriyle davet eder. Davet edilen hoca siteye kendi e-postasıyla
-- (bağlantı ya da şifre) girer; teachers tablosunda adresi olduğu için hoca sayılır. Her hocanın dersleri, öğrencileri ve
-- yoklamaları teacher_id ile ayrıdır (RLS); sahip bile başkasının dersini göremez.
-- * Sahip: teachers tablosundaki en eski kayıt (kurulumu ilk sahiplenen).
-- * hoca_sahip_mi(): oturumdaki hoca sahip mi (arayüz "Hocalar" sayfasını göstersin).
-- * hoca_listele(): yalnızca sahip; hocalar, ders sayıları ve ilk giriş yapıp yapmadıkları.
-- * hoca_ekle(eposta, ad): yalnızca sahip; adresi izin listesine ekler.
-- * hoca_cikar(eposta): yalnızca sahip; erişimi kaldırır (sahip çıkarılamaz). Hocanın dersleri silinmez, yeniden eklenirse döner.
-- Hepsi security definer; çağıran sahip değilse hata kodu döner, hiçbir bilgi sızmaz.

create function ozel.sahip_eposta()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.eposta from public.teachers t order by t.eklendi, t.eposta limit 1;
$$;

create function public.hoca_sahip_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.hoca_mi() and ozel.sahip_eposta() = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create function public.hoca_listele()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.hoca_sahip_mi() then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  return jsonb_build_object('hocalar', coalesce((
    select jsonb_agg(jsonb_build_object(
             'eposta', t.eposta,
             'ad_soyad', t.ad_soyad,
             'sahip', t.eposta = ozel.sahip_eposta(),
             'eklendi', t.eklendi,
             'giris_yapti', exists (select 1 from auth.users u where lower(u.email) = t.eposta),
             'ders_sayisi', (select count(*) from public.courses c join auth.users u on u.id = c.teacher_id where lower(u.email) = t.eposta)
           ) order by t.eklendi, t.eposta)
    from public.teachers t
  ), '[]'::jsonb));
end;
$$;

create function public.hoca_ekle(p_eposta text, p_ad text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eposta text := lower(btrim(coalesce(p_eposta, '')));
  v_ad     text := nullif(left(btrim(coalesce(p_ad, '')), 120), '');
begin
  if not public.hoca_sahip_mi() then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if v_eposta !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_eposta) > 200 then
    return jsonb_build_object('hata', 'eposta_gecersiz');
  end if;
  if exists (select 1 from public.teachers t where t.eposta = v_eposta) then
    return jsonb_build_object('hata', 'zaten_var');
  end if;
  insert into public.teachers (eposta, ad_soyad) values (v_eposta, v_ad);
  return jsonb_build_object('durum', 'tamam', 'eposta', v_eposta);
end;
$$;

create function public.hoca_cikar(p_eposta text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eposta text := lower(btrim(coalesce(p_eposta, '')));
begin
  if not public.hoca_sahip_mi() then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if v_eposta = ozel.sahip_eposta() then
    return jsonb_build_object('hata', 'sahip_cikarilamaz');
  end if;
  delete from public.teachers t where t.eposta = v_eposta;
  if not found then
    return jsonb_build_object('hata', 'bulunamadi');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function ozel.sahip_eposta()              from public;
revoke all on function public.hoca_sahip_mi()           from public;
revoke all on function public.hoca_listele()            from public;
revoke all on function public.hoca_ekle(text, text)     from public;
revoke all on function public.hoca_cikar(text)          from public;
grant execute on function public.hoca_sahip_mi()        to authenticated;
grant execute on function public.hoca_listele()         to authenticated;
grant execute on function public.hoca_ekle(text, text)  to authenticated;
grant execute on function public.hoca_cikar(text)       to authenticated;
