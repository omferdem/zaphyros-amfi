-- 0014: Sınıf etkileşimi: parmak kaldır, soru sor, "sıkıldım" ve çekiliş
--
-- Öğrenci telefonundaki üç düğme:
-- * el      (parmak kaldır): öğrencinin adı perdenin kenarında sıraya girer; hoca söz verince indirir.
-- * soru    (soru sor): yazılı soru (3-280 harf) perdede soran kişinin adıyla zarf olarak görünür; hoca uygun
--           olunca açıp cevaplar ve "cevaplandı" der.
-- * sikildim: sınıfın yüzde 25'i basınca perdede uyarı çıkar; hoca dersi durdurur (mola), sıkıldım diyenler
--           arasından çekiliş çeker (en fazla 3), seçilen fıkra anlatır, sonra derse dönülür.
-- Öğrenci (anon) hiçbir tabloyu okuyamaz; yalnızca RPC'lerle çalışır. Kişi, oturumun gizli anahtarı ve cihaz
-- kimliğinden türetilen bir özetle tanınır (katkılardaki gibi). Görünen ad, yoklamadaki öğrencinin kısa adı
-- ("Ahmet Y.") ya da takma addır; yoklaması ya da takma adı olmayan cihaz düğmeleri kullanamaz.
-- Hoca tarafı: sahne (giriş yapmış hoca) anahtarsız, kumanda (girişsiz) kumanda anahtarıyla aynı RPC'leri çağırır.

create table public.sinif_olaylari (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  kisi        text not null check (length(kisi) = 32),
  ad          text not null check (length(ad) between 1 and 40),
  tur         text not null check (tur in ('el', 'soru', 'sikildim')),
  metin       text not null default '' check (length(metin) <= 280),
  -- bekliyor: sırada; cekildi: sıkıldım çekilişinde seçildi; tamam: bitti (söz verildi, cevaplandı, derse dönüldü)
  durum       text not null default 'bekliyor' check (durum in ('bekliyor', 'cekildi', 'tamam')),
  zaman       timestamptz not null default now()
);
create index sinif_olaylari_oturum_idx on public.sinif_olaylari (session_id, tur, durum);
create unique index sinif_el_tekil on public.sinif_olaylari (session_id, kisi) where tur = 'el' and durum = 'bekliyor';
create unique index sinif_sikildim_tekil on public.sinif_olaylari (session_id, kisi) where tur = 'sikildim' and durum in ('bekliyor', 'cekildi');
alter table public.sinif_olaylari enable row level security;

create policy "hoca sinif olaylarini gorur" on public.sinif_olaylari
  for select to authenticated
  using (public.oturum_benim(session_id));

-- Oturumun mola ve çekiliş durumu
create table public.sinif_durum (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  mola        boolean not null default false,
  cekilis     integer not null default 0 check (cekilis between 0 and 3)
);
alter table public.sinif_durum enable row level security;

create policy "hoca sinif durumunu gorur" on public.sinif_durum
  for select to authenticated
  using (public.oturum_benim(session_id));

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
-- Cihazın bu oturumdaki görünen adı: yoklamadaki öğrencinin kısa adı ya da takma ad. Yoksa null.
create function ozel.sinif_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(regexp_replace(btrim(x.ad), '^(\S+)(?:\s+\S+)*\s+(\S)\S*$', '\1 \2.'), 40)
  from (
    select coalesce(
      (select st.ad_soyad from public.attendance a join public.students st on st.id = a.student_id
        where a.session_id = p_session and a.cihaz_id = p_cihaz),
      (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
    ) as ad
  ) x
  where x.ad is not null;
$$;

-- Hoca yetkisi: kumanda anahtarı ya da oturumun sahibi olarak giriş yapmış hoca
create function ozel.sinif_yetki(p_session uuid, p_anahtar text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_anahtar is not null then ozel.kumanda_dogru(p_session, p_anahtar)
    else auth.uid() is not null and public.oturum_benim(p_session)
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- p_tur: 'el' | 'el_indir' | 'soru' | 'sikildim' | 'sikildim_geri'. Dönen: { durum: 'tamam' } ya da { hata }.
create function public.sinif_gonder(p_session uuid, p_cihaz text, p_tur text, p_metin text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kisi  text;
  v_ad    text;
  v_metin text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if p_tur not in ('el', 'el_indir', 'soru', 'sikildim', 'sikildim_geri') then
    return jsonb_build_object('hata', 'tur_gecersiz');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'ders_yok');
  end if;
  v_ad := ozel.sinif_adi(p_session, p_cihaz);
  if v_ad is null then
    return jsonb_build_object('hata', 'katilmadin');
  end if;
  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  perform pg_advisory_xact_lock(hashtext('sinif:' || v_kisi));

  if p_tur = 'el_indir' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and kisi = v_kisi and tur = 'el' and durum = 'bekliyor';
    return jsonb_build_object('durum', 'tamam');
  end if;
  if p_tur = 'sikildim_geri' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and kisi = v_kisi and tur = 'sikildim' and durum = 'bekliyor';
    return jsonb_build_object('durum', 'tamam');
  end if;

  -- Uydurma cihaz kimlikleriyle yığma yapılmasın diye oturum başına üst sınır
  if (select count(*) from public.sinif_olaylari o where o.session_id = p_session) >= 3000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if p_tur = 'soru' then
    if length(v_metin) < 3 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > 280 then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    if (select count(*) from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'soru' and o.durum = 'bekliyor') >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    insert into public.sinif_olaylari (session_id, kisi, ad, tur, metin) values (p_session, v_kisi, v_ad, 'soru', v_metin);
  elsif p_tur = 'el' then
    insert into public.sinif_olaylari (session_id, kisi, ad, tur) values (p_session, v_kisi, v_ad, 'el') on conflict do nothing;
  else
    insert into public.sinif_olaylari (session_id, kisi, ad, tur) values (p_session, v_kisi, v_ad, 'sikildim') on conflict do nothing;
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Öğrencinin kendi düğmelerinin durumu ve molada seçilip seçilmediği
create function public.sinif_durumum(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kisi text;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  return jsonb_build_object(
    'el', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'el' and o.durum = 'bekliyor'),
    'sikildim', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'sikildim' and o.durum in ('bekliyor', 'cekildi')),
    'secildim', exists (select 1 from public.sinif_olaylari o where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'sikildim' and o.durum = 'cekildi'),
    'mola', coalesce((select d.mola from public.sinif_durum d where d.session_id = p_session), false),
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object('metin', q.metin, 'durum', q.durum) order by q.zaman desc)
      from (select o.metin, o.durum, o.zaman from public.sinif_olaylari o
            where o.session_id = p_session and o.kisi = v_kisi and o.tur = 'soru' order by o.zaman desc limit 5) q
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca (sahne anahtarsız, kumanda anahtarla)
-- ---------------------------------------------------------------------------
create function public.sinif_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  return jsonb_build_object(
    'olaylar', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'tur', o.tur, 'ad', o.ad, 'metin', o.metin, 'durum', o.durum, 'zaman', o.zaman) order by o.zaman, o.id)
      from public.sinif_olaylari o
      where o.session_id = p_session and o.durum <> 'tamam'
    ), '[]'::jsonb),
    'mola', coalesce((select d.mola from public.sinif_durum d where d.session_id = p_session), false),
    'cekilis', coalesce((select d.cekilis from public.sinif_durum d where d.session_id = p_session), 0),
    'katilan', (select count(*) from public.attendance a where a.session_id = p_session)
               + (select count(*) from public.session_players p where p.session_id = p_session
                  and not exists (select 1 from public.attendance a where a.session_id = p_session and a.cihaz_id = p.cihaz_id))
  );
end;
$$;

-- Komutlar: soru_tamam, el_indir (p_id), eller_indir, mola_ac, cekilis, cekilis_anlatti, derse_don
create function public.sinif_komut(p_session uuid, p_anahtar text, p_komut text, p_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cekilis integer;
  v_secilen record;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  insert into public.sinif_durum (session_id) values (p_session) on conflict do nothing;

  if p_komut = 'soru_tamam' then
    update public.sinif_olaylari set durum = 'tamam' where id = p_id and session_id = p_session and tur = 'soru';
  elsif p_komut = 'el_indir' then
    update public.sinif_olaylari set durum = 'tamam' where id = p_id and session_id = p_session and tur = 'el';
  elsif p_komut = 'eller_indir' then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'el' and durum = 'bekliyor';
  elsif p_komut = 'mola_ac' then
    update public.sinif_durum set mola = true where session_id = p_session;
  elsif p_komut = 'cekilis' then
    select cekilis into v_cekilis from public.sinif_durum where session_id = p_session for update;
    if v_cekilis >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    -- Önceki seçilen kabul etmediyse bir daha çekilmez
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'sikildim' and durum = 'cekildi';
    select o.id, o.ad into v_secilen from public.sinif_olaylari o
      where o.session_id = p_session and o.tur = 'sikildim' and o.durum = 'bekliyor'
      order by random() limit 1;
    if not found then
      return jsonb_build_object('hata', 'kimse_yok');
    end if;
    update public.sinif_olaylari set durum = 'cekildi' where id = v_secilen.id;
    update public.sinif_durum set mola = true, cekilis = cekilis + 1 where session_id = p_session;
    return jsonb_build_object('durum', 'tamam', 'secilen', v_secilen.ad);
  elsif p_komut in ('derse_don', 'cekilis_anlatti') then
    update public.sinif_olaylari set durum = 'tamam' where session_id = p_session and tur = 'sikildim' and durum <> 'tamam';
    update public.sinif_durum set mola = false, cekilis = 0 where session_id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select on public.sinif_olaylari to authenticated;
grant select on public.sinif_durum to authenticated;

revoke all on function ozel.sinif_adi(uuid, text)    from public;
revoke all on function ozel.sinif_yetki(uuid, text)  from public;
revoke all on function public.sinif_gonder(uuid, text, text, text) from public;
revoke all on function public.sinif_durumum(uuid, text)             from public;
revoke all on function public.sinif_goster(uuid, text)              from public;
revoke all on function public.sinif_komut(uuid, text, text, uuid)   from public;

grant execute on function public.sinif_gonder(uuid, text, text, text) to anon, authenticated;
grant execute on function public.sinif_durumum(uuid, text)             to anon, authenticated;
grant execute on function public.sinif_goster(uuid, text)              to anon, authenticated;
grant execute on function public.sinif_komut(uuid, text, text, uuid)   to anon, authenticated;

alter publication supabase_realtime add table public.sinif_olaylari;
alter publication supabase_realtime add table public.sinif_durum;
