-- 0015: Takım yarışması
--
-- Hoca bir oturumda takım modunu açar (2-6 takım). Öğrenci telefonunda bir takım seçer; bilgi yarışmasındaki
-- puanlar takım bazında toplanır ve takımlar arası sıralama perdede görünür.
-- * takim_ayar: oturumun takım sayısı (0 = takım modu kapalı).
-- * takim_uyeleri: hangi cihaz hangi takımda. Öğrenci ilk cevabını verdikten sonra takım değiştiremez
--   (kazanan takıma geçerek puan toplanamasın).
-- * Takım sırası, üye başına ortalama puana göredir (takımların üye sayısı eşit olmayabilir); toplam puan da gösterilir.
-- Öğrenci (anon) tabloları okuyamaz; hoca sahnede anahtarsız, kumandada anahtarla aynı RPC'leri çağırır
-- (ozel.sinif_yetki, 0014).

create table public.takim_ayar (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  sayi        smallint not null default 0 check (sayi = 0 or sayi between 2 and 6)
);
alter table public.takim_ayar enable row level security;
create policy "hoca takim ayarini gorur" on public.takim_ayar
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.takim_uyeleri (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  takim       smallint not null check (takim between 1 and 6),
  primary key (session_id, cihaz_id)
);
alter table public.takim_uyeleri enable row level security;
create policy "hoca takim uyelerini gorur" on public.takim_uyeleri
  for select to authenticated
  using (public.oturum_benim(session_id));

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Dönen: { sayi, takim } (takim: seçilmemişse null)
create function public.takim_durumum(p_session uuid, p_cihaz text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  return jsonb_build_object(
    'sayi', coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0),
    'takim', (select u.takim from public.takim_uyeleri u where u.session_id = p_session and u.cihaz_id = p_cihaz)
  );
end;
$$;

create function public.takim_sec(p_session uuid, p_cihaz text, p_takim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sayi   integer;
  v_mevcut smallint;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'ders_yok');
  end if;
  select a.sayi into v_sayi from public.takim_ayar a where a.session_id = p_session;
  if coalesce(v_sayi, 0) = 0 then
    return jsonb_build_object('hata', 'takim_modu_kapali');
  end if;
  if p_takim is null or p_takim < 1 or p_takim > v_sayi then
    return jsonb_build_object('hata', 'takim_gecersiz');
  end if;
  if ozel.sinif_adi(p_session, p_cihaz) is null then
    return jsonb_build_object('hata', 'katilmadin');
  end if;
  perform pg_advisory_xact_lock(hashtext('takim:' || p_session::text || p_cihaz));
  select u.takim into v_mevcut from public.takim_uyeleri u where u.session_id = p_session and u.cihaz_id = p_cihaz;
  if v_mevcut is not null and v_mevcut <> p_takim
     and exists (select 1 from public.responses r where r.session_id = p_session and r.cihaz_id = p_cihaz) then
    return jsonb_build_object('hata', 'kilitli');
  end if;
  insert into public.takim_uyeleri (session_id, cihaz_id, takim) values (p_session, p_cihaz, p_takim)
  on conflict (session_id, cihaz_id) do update set takim = excluded.takim;
  return jsonb_build_object('durum', 'tamam', 'takim', p_takim);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca (sahne anahtarsız, kumanda anahtarla)
-- ---------------------------------------------------------------------------
-- Takım sayısı ve takım sıralaması. Üyesi olmayan takım da listelenir.
create function public.takim_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sayi integer;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0) into v_sayi;
  return jsonb_build_object(
    'sayi', v_sayi,
    'takimlar', coalesce((
      select jsonb_agg(jsonb_build_object(
               'takim', s.takim, 'uye', s.uye, 'puan', s.puan, 'dogru', s.dogru, 'ortalama', s.ortalama, 'sira', s.sira
             ) order by s.sira, s.takim)
      from (
        select t.*, rank() over (order by t.ortalama desc, t.puan desc)::integer as sira
        from (
          select g.takim,
                 (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim)::integer as uye,
                 coalesce(sum(r.puan), 0)::integer as puan,
                 (count(*) filter (where r.dogru))::integer as dogru,
                 case when (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim) = 0 then 0
                      else round(coalesce(sum(r.puan), 0)::numeric
                                 / (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim))::integer
                 end as ortalama
          from generate_series(1, v_sayi) as g(takim)
          left join public.takim_uyeleri m on m.session_id = p_session and m.takim = g.takim
          left join public.responses r on r.session_id = p_session and r.cihaz_id = m.cihaz_id
          group by g.takim
        ) t
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- Takım sayısını ayarlar (0: kapat). Sayı azalırsa dışarıda kalan takımların üyeleri yeniden seçer.
create function public.takim_ayarla(p_session uuid, p_anahtar text, p_sayi integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if p_sayi is null or not (p_sayi = 0 or p_sayi between 2 and 6) then
    return jsonb_build_object('hata', 'sayi_gecersiz');
  end if;
  insert into public.takim_ayar (session_id, sayi) values (p_session, p_sayi)
  on conflict (session_id) do update set sayi = excluded.sayi;
  delete from public.takim_uyeleri where session_id = p_session and (p_sayi = 0 or takim > p_sayi);
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select on public.takim_ayar to authenticated;
grant select on public.takim_uyeleri to authenticated;

revoke all on function public.takim_durumum(uuid, text)        from public;
revoke all on function public.takim_sec(uuid, text, integer)   from public;
revoke all on function public.takim_goster(uuid, text)         from public;
revoke all on function public.takim_ayarla(uuid, text, integer) from public;

grant execute on function public.takim_durumum(uuid, text)         to anon, authenticated;
grant execute on function public.takim_sec(uuid, text, integer)    to anon, authenticated;
grant execute on function public.takim_goster(uuid, text)          to anon, authenticated;
grant execute on function public.takim_ayarla(uuid, text, integer) to anon, authenticated;
