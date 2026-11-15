-- Zapoot puanlama ve lobi.
-- 1) Puan tablosu ve öğrencinin kendi sırası perdedeki oyun turuna göre hesaplanır (aktif_tur boşsa bütün oturum, eskisi gibi).
-- 2) Seri bonusu: bir doğru serisi 3'e ulaşınca +100, 5'e ulaşınca ek +200 (seri başına en çok +300).
-- 3) Lobi: takım üyelerinin adları, "Takımları dengele" ve "Rastgele dağıt".

create function ozel.oyuncu_puanlari(p_session uuid)
returns table (cihaz_id text, toplam integer, dogru_say integer, en_seri integer)
language sql
stable
security definer
set search_path = ''
as $$
  with kapsam as (
    select s.aktif_tur as tur from public.sessions s where s.id = p_session
  ),
  r as (
    select x.cihaz_id as cid, x.dogru as d, x.puan as p, st.sira as sr, st.id as adim
    from public.responses x
    join public.lesson_steps st on st.id = x.step_id
    where x.session_id = p_session
      and ((select k.tur from kapsam k) is null or st.tur_id = (select k.tur from kapsam k))
  ),
  g as (
    select r.*,
           row_number() over (partition by r.cid order by r.sr, r.adim)
           - row_number() over (partition by r.cid, r.d order by r.sr, r.adim) as grp
    from r
  ),
  kosu as (
    select g.cid, g.grp, count(*)::integer as uz from g where g.d group by g.cid, g.grp
  )
  select r.cid,
         (sum(r.p) + coalesce((select sum(case when k.uz >= 5 then 300 when k.uz >= 3 then 100 else 0 end)
                                from kosu k where k.cid = r.cid), 0))::integer,
         (count(*) filter (where r.d))::integer,
         coalesce((select max(k.uz) from kosu k where k.cid = r.cid), 0)::integer
  from r
  group by r.cid;
$$;

create or replace function ozel.puanlar(p_session uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ad', t.ad, 'puan', t.puan, 'dogru', t.dogru, 'seri', t.seri, 'sira', t.sira) order by t.sira, t.ad), '[]'::jsonb)
  from (
    select coalesce(ozel.oyuncu_adi(p_session, o.cihaz_id), 'İsimsiz') as ad,
           o.toplam as puan,
           o.dogru_say as dogru,
           o.en_seri as seri,
           rank() over (order by o.toplam desc)::integer as sira
    from ozel.oyuncu_puanlari(p_session) o
    order by o.toplam desc
    limit greatest(1, least(p_limit, 1000))
  ) t;
$$;

create or replace function public.benim_sonucum(p_session uuid, p_cihaz text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select q.cihaz_id, q.toplam, q.dogru_say, q.en_seri, rank() over (order by q.toplam desc)::integer as sira
    from ozel.oyuncu_puanlari(p_session) q
  )
  select jsonb_build_object(
    'ad', ozel.oyuncu_adi(p_session, p_cihaz),
    'cevapladi', r.cihaz_id is not null,
    'secim', r.secim,
    'dogru', case when s.soru_durum = 'sonuc' then r.dogru end,
    'puan', case when s.soru_durum = 'sonuc' then r.puan end,
    'toplam', coalesce((select x.toplam from o x where x.cihaz_id = p_cihaz), 0),
    'sira', (select x.sira from o x where x.cihaz_id = p_cihaz),
    'dogru_say', coalesce((select x.dogru_say from o x where x.cihaz_id = p_cihaz), 0),
    'seri', coalesce((select x.en_seri from o x where x.cihaz_id = p_cihaz), 0),
    'oyuncu', (select count(*) from o),
    'puanlar', case when s.telefon_modu and s.soru_durum = 'sonuc' then ozel.puanlar(p_session, 5) end
  )
  from public.sessions s
  left join public.responses r on r.session_id = s.id and r.step_id = s.aktif_adim and r.cihaz_id = p_cihaz
  where s.id = p_session;
$$;

-- Lobi: her takımın üyelerinin görünen adları
create function public.takim_listesi(p_session uuid, p_anahtar text default null)
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
  return jsonb_build_object('takimlar', coalesce((
    select jsonb_agg(jsonb_build_object('takim', g.takim, 'adlar', g.adlar) order by g.takim)
    from (
      select u.takim,
             jsonb_agg(coalesce(ozel.oyuncu_adi(p_session, u.cihaz_id), 'Öğrenci') order by u.cihaz_id) as adlar
      from public.takim_uyeleri u
      where u.session_id = p_session
      group by u.takim
    ) g
  ), '[]'::jsonb));
end;
$$;

-- Lobi: üyeleri takımlara dağıtır. 'dengele': takımlar arası fark en çok 1; 'rastgele': karıştırıp eşit paylaştırır.
create function public.takim_dagit(p_session uuid, p_anahtar text, p_yontem text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sayi  integer;
  v_en    integer;
  v_az    integer;
  v_en_n  integer;
  v_az_n  integer;
  v_cihaz text;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if p_yontem not in ('dengele', 'rastgele') then
    return jsonb_build_object('hata', 'yontem_gecersiz');
  end if;
  select a.sayi into v_sayi from public.takim_ayar a where a.session_id = p_session;
  if coalesce(v_sayi, 0) < 2 then
    return jsonb_build_object('hata', 'takim_yok');
  end if;

  if p_yontem = 'rastgele' then
    update public.takim_uyeleri u
    set takim = d.yeni
    from (
      select m.cihaz_id, (1 + ((row_number() over (order by random()) - 1) % v_sayi))::smallint as yeni
      from public.takim_uyeleri m where m.session_id = p_session
    ) d
    where u.session_id = p_session and u.cihaz_id = d.cihaz_id;
    return jsonb_build_object('durum', 'tamam');
  end if;

  loop
    select t.takim, t.n into v_en, v_en_n
    from (
      select g.takim, (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim)::integer as n
      from generate_series(1, v_sayi) as g(takim)
    ) t order by t.n desc, t.takim limit 1;
    select t.takim, t.n into v_az, v_az_n
    from (
      select g.takim, (select count(*) from public.takim_uyeleri u where u.session_id = p_session and u.takim = g.takim)::integer as n
      from generate_series(1, v_sayi) as g(takim)
    ) t order by t.n, t.takim limit 1;
    exit when v_en_n - v_az_n <= 1;
    select u.cihaz_id into v_cihaz from public.takim_uyeleri u
    where u.session_id = p_session and u.takim = v_en order by random() limit 1;
    update public.takim_uyeleri set takim = v_az where session_id = p_session and cihaz_id = v_cihaz;
  end loop;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

revoke all on function ozel.oyuncu_puanlari(uuid) from public;
revoke all on function public.takim_listesi(uuid, text) from public;
revoke all on function public.takim_dagit(uuid, text, text) from public;
grant execute on function public.takim_listesi(uuid, text) to anon, authenticated;
grant execute on function public.takim_dagit(uuid, text, text) to anon, authenticated;
