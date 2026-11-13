-- 0023: açık uçlu soru modları ve Zombi Kaçışı
--
-- 1) Akıştaki "fikir" adımı üç kipte çalışır (lesson_steps.ayar.mod):
--      (yok)    kelime bulutu: en çok 3 kısa fikir (2-40 harf), perdede bulut
--      'firtina' beyin fırtınası: en çok 3 kısa cümle (2-120 harf), perdede kartlar
--      'acik'   açık uçlu soru: 1 cevap (2-300 harf), perdede bütün cevaplar kart olarak
--    katki_gonder kipe göre sınırı uygular; ozel.etkinlik açık uçlu kiplerde 200 cevaba kadar döndürür.
-- 2) zombi_goster: Zombi Kaçışı oyununun veri kaynağı. Oturumdaki her oyuncunun (yoklamaya giren ya da cevap veren
--    cihaz) açılmış sorulardaki sonucunu verir: 1 doğru, 0 yanlış, -1 cevapsız. Kurallar (basamak, zombi hızı, %70)
--    tarayıcıda hesaplanır. Çözülmekte olan soru "acildi" olmadığı için sonucu gönderilmez (cevap önceden sızmasın).

-- Açık uçlu cevaplar 300 harfe kadar çıkabildiği için katkı metni sınırı genişler (oylama gerekçesi yine 200 ile sınırlı kalır).
alter table public.contributions drop constraint contributions_metin_check;
alter table public.contributions add constraint contributions_metin_check check (length(metin) <= 300);

create or replace function ozel.etkinlik(p_session uuid, p_adim uuid, p_hepsi boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when st.tur = 'video' then jsonb_build_object('video', st.ayar ->> 'url', 'soru', st.ayar ->> 'baslik')
    else jsonb_build_object(
      'soru', st.ayar ->> 'soru',
      'soru_durum', s.soru_durum,
      'cevap_sayisi', (select count(distinct k.kisi) from public.contributions k where k.session_id = s.id and k.step_id = st.id)
    ) || case
      when st.tur = 'fikir' then jsonb_build_object(
        'fikirler', coalesce((
          select jsonb_agg(jsonb_build_object('m', f.metin, 'n', f.sayi) order by f.sayi desc, f.ilk)
          from (
            select min(k.metin) as metin, count(*) as sayi, min(k.zaman) as ilk
            from public.contributions k
            where k.session_id = s.id and k.step_id = st.id and not k.gizli
            group by lower(k.metin)
            order by count(*) desc, min(k.zaman)
            limit case when st.ayar ->> 'mod' in ('acik', 'firtina') then 200 else 60 end
          ) f
        ), '[]'::jsonb),
        'mod', coalesce(st.ayar ->> 'mod', 'bulut')
      )
      else jsonb_build_object(
        'etiketler', case
          when jsonb_typeof(st.ayar -> 'etiketler') = 'array' and jsonb_array_length(st.ayar -> 'etiketler') = 2
            then st.ayar -> 'etiketler'
          else '["Katılıyorum", "Katılmıyorum"]'::jsonb
        end,
        'sayilar', case when p_hepsi or s.soru_durum = 'sonuc' then (
          select jsonb_build_array(count(*) filter (where k.taraf = 0), count(*) filter (where k.taraf = 1))
          from public.contributions k where k.session_id = s.id and k.step_id = st.id
        ) end,
        'gerekceler', case when p_hepsi or s.soru_durum = 'sonuc' then coalesce((
          select jsonb_agg(jsonb_build_object('t', g.taraf, 'm', g.metin) order by g.zaman desc)
          from (
            select k.taraf, k.metin, k.zaman
            from public.contributions k
            where k.session_id = s.id and k.step_id = st.id and not k.gizli and k.metin <> ''
            order by k.zaman desc
            limit 40
          ) g
        ), '[]'::jsonb) end
      )
    end
  end
  from public.sessions s
  join public.lesson_steps st on st.id = p_adim
  where s.id = p_session;
$$;

create or replace function public.katki_gonder(p_session uuid, p_cihaz text, p_metin text, p_taraf integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r        record;
  v_kisi   text;
  v_metin  text := regexp_replace(btrim(coalesce(p_metin, '')), '\s+', ' ', 'g');
  v_sayi   integer;
  v_en     integer;
  v_hak    integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.bitti, st.tur, st.ayar ->> 'mod' as mod
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur in ('fikir', 'oylama')
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'etkinlik_yok');
  end if;
  if r.bitti is not null or r.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;

  v_kisi := ozel.katki_kisi(p_session, p_cihaz);
  -- Aynı kişinin eşzamanlı istekleri sıraya girer (hak sınırı aşılmasın).
  perform pg_advisory_xact_lock(hashtext(v_kisi));

  -- Uydurma cihaz kimlikleriyle yığma yapılmasın diye adım başına üst sınır
  if (select count(*) from public.contributions k where k.session_id = p_session and k.step_id = r.aktif_adim) >= 2000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if r.tur = 'fikir' then
    v_en := case r.mod when 'acik' then 300 when 'firtina' then 120 else 40 end;
    v_hak := case r.mod when 'acik' then 1 else 3 end;
    if length(v_metin) < 2 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > v_en then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    select count(*) into v_sayi from public.contributions k
    where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi;
    if v_sayi >= v_hak then
      return jsonb_build_object('hata', 'sinir');
    end if;
    if exists (
      select 1 from public.contributions k
      where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi and lower(k.metin) = lower(v_metin)
    ) then
      return jsonb_build_object('hata', 'ayni');
    end if;
    insert into public.contributions (session_id, step_id, kisi, metin) values (p_session, r.aktif_adim, v_kisi, v_metin);
    return jsonb_build_object('durum', 'tamam', 'kalan', v_hak - 1 - v_sayi);
  end if;

  if p_taraf is null or p_taraf not in (0, 1) then
    return jsonb_build_object('hata', 'taraf_gecersiz');
  end if;
  if length(v_metin) > 200 then
    return jsonb_build_object('hata', 'metin_uzun');
  end if;
  insert into public.contributions as k (session_id, step_id, kisi, taraf, metin)
  values (p_session, r.aktif_adim, v_kisi, p_taraf, v_metin)
  on conflict (session_id, step_id, kisi) where taraf is not null
  do update set taraf = excluded.taraf,
                gizli = k.gizli and k.metin = excluded.metin,
                metin = excluded.metin,
                zaman = now();
  return jsonb_build_object('durum', 'tamam', 'kalan', 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Zombi Kaçışı (acildi: sonucu açılmış ya da geçilmiş ve en az bir cevap almış soru; oynanmamış sorular sayılmaz)
-- ---------------------------------------------------------------------------
create function public.zombi_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson uuid;
  v_aktif  uuid;
  v_durum  text;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum into v_lesson, v_aktif, v_durum from public.sessions s where s.id = p_session;
  return (
    with sorular as (
      select st.id,
             row_number() over (order by st.sira, st.id)::integer as n,
             ((st.id is distinct from v_aktif or v_durum = 'sonuc')
              and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = st.id)) as acildi
      from public.lesson_steps st
      where st.lesson_id = v_lesson and st.tur = 'soru'
    ),
    cihazlar as (
      select a.cihaz_id as cihaz from public.attendance a where a.session_id = p_session and a.cihaz_id is not null
      union
      select r.cihaz_id from public.responses r where r.session_id = p_session
    ),
    oyuncular as (
      select c.cihaz from cihazlar c order by c.cihaz limit 250
    )
    select jsonb_build_object(
      'sorular', coalesce((select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'acildi', x.acildi) order by x.n) from sorular x), '[]'::jsonb),
      'oyuncular', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ad', coalesce(ozel.oyuncu_adi(p_session, o.cihaz), 'Öğrenci'),
          'sonuc', (
            select jsonb_agg(
              case when not x.acildi then null
                   when r.dogru is null then -1
                   when r.dogru then 1
                   else 0 end
              order by x.n)
            from sorular x
            left join public.responses r on r.session_id = p_session and r.step_id = x.id and r.cihaz_id = o.cihaz
          )
        ))
        from oyuncular o
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.zombi_goster(uuid, text) from public;
grant execute on function public.zombi_goster(uuid, text) to anon, authenticated;
