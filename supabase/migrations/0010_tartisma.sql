-- 0010: Faz 4, tartışma araçları
--
-- Üç yeni adım türü (ayarları lesson_steps.ayar içinde durur):
-- * fikir  (beyin fırtınası): ayar.soru. Öğrenci en çok 3 kısa fikir yazar (2-40 harf); perdede kelime bulutu.
-- * oylama (şeytanın avukatı): ayar.soru (önerme), isteğe bağlı ayar.etiketler [sol, sağ]. Öğrenci bir taraf
--   seçer, isterse gerekçe yazar (en çok 200 harf); açıkken fikrini değiştirebilir.
-- * video: ayar.url (https), isteğe bağlı ayar.baslik. Perdede oynatılır.
--
-- Açık/kapalı durumu bilgi yarışmasıyla aynı alanı kullanır: sessions.soru_durum.
--   'acik'  = katkı alınıyor (oylamada sayılar gizli)
--   'sonuc' = katkı kapandı; oylamada sayılar ve gerekçeler açıklanır
--
-- KVKK: görüşler öğrencinin kimliğine bağlanmaz. Katkı satırı cihaz kimliğini değil, oturumun gizli
-- anahtarıyla karılmış bir özetini (kisi) taşır; bu özet yoklama kaydıyla Data API üzerinden eşlenemez.
-- Yalnızca "aynı kişi mi" sorusuna (3 fikir sınırı, tek oy) cevap verir.

-- ---------------------------------------------------------------------------
-- Adım türleri
-- ---------------------------------------------------------------------------
alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru', 'fikir', 'oylama', 'video')),
  add constraint lesson_steps_etkinlik_check check (
    case
      when tur in ('fikir', 'oylama') then length(btrim(coalesce(ayar ->> 'soru', ''))) between 1 and 300
      when tur = 'video' then coalesce(ayar ->> 'url', '') ~ '^https://[^\s]{4,255}$'
      else true
    end
  );

-- Perdeye soru, beyin fırtınası ya da oylama gelince katkı alma başlar.
create or replace function ozel.soru_durumu_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim then
    if exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.tur in ('soru', 'fikir', 'oylama')) then
      new.soru_durum := 'acik';
      new.soru_basladi := clock_timestamp();
    else
      new.soru_durum := null;
      new.soru_basladi := null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Katkılar
-- ---------------------------------------------------------------------------
create table public.contributions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  step_id     uuid not null references public.lesson_steps (id) on delete cascade,
  kisi        text not null check (length(kisi) = 32),
  -- Oylamada seçilen taraf (0 = sol, 1 = sağ); beyin fırtınasında boş
  taraf       smallint check (taraf in (0, 1)),
  -- Beyin fırtınasında fikir, oylamada gerekçe (boş olabilir)
  metin       text not null default '' check (length(metin) <= 200),
  -- Hoca uygunsuz bir katkıyı perdeden kaldırabilir
  gizli       boolean not null default false,
  zaman       timestamptz not null default now()
);
create index contributions_adim_idx on public.contributions (session_id, step_id);
-- Oylamada kişi başına tek oy
create unique index contributions_oy_tekil on public.contributions (session_id, step_id, kisi) where taraf is not null;
alter table public.contributions enable row level security;

create policy "hoca katkilari gorur" on public.contributions
  for select to authenticated
  using (public.oturum_benim(session_id));

create policy "hoca katkiyi gizler" on public.contributions
  for update to authenticated
  using (public.oturum_benim(session_id))
  with check (public.oturum_benim(session_id));

create policy "hoca katkiyi siler" on public.contributions
  for delete to authenticated
  using (public.oturum_benim(session_id));

create function ozel.katki_kisi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5('katki:' || g.anahtar || ':' || p_cihaz)
  from ozel.session_secrets g
  where g.session_id = p_session;
$$;

-- Bir tartışma ya da video adımının öğrenciye ve kumandaya giden özeti.
-- p_hepsi: oylamanın sayıları ve gerekçeleri sonuç açıklanmadan da verilir (yalnızca kumanda için).
create function ozel.etkinlik(p_session uuid, p_adim uuid, p_hepsi boolean default false)
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
            limit 60
          ) f
        ), '[]'::jsonb)
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

-- 0008'deki ozel.durum: tartışma ve video adımlarının özeti eklendi
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'telefon_modu', s.telefon_modu,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end,
        'gorsel', case when s.telefon_modu and a.tur = 'slayt' and p.gorseller_hazir
          then p.subject_id::text || '/' || p.id::text || '/' || a.sayfa_no::text end
      ) || case when a.tur = 'soru' then (
        select jsonb_build_object(
          'soru', q.soru,
          'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),
          'sure_sn', q.sure_sn,
          'soru_durum', s.soru_durum,
          'kalan_ms', case when s.soru_durum = 'acik'
            then greatest(0, ceil(extract(epoch from (s.soru_basladi + make_interval(secs => q.sure_sn) - clock_timestamp())) * 1000))::integer
            end,
          'cevap_sayisi', (select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id),
          'dogru_index', case when s.soru_durum = 'sonuc' then array_position(ozel.secenekler(s.id, q.id), q.dogru) - 1 end,
          'dagilim', case when s.soru_durum = 'sonuc' then (
            select jsonb_agg((select count(*) from public.responses r where r.session_id = s.id and r.step_id = a.id and r.secim = i - 1) order by i)
            from generate_series(1, cardinality(ozel.secenekler(s.id, q.id))) as i
          ) end
        )
        from public.questions q where q.id = a.question_id
      )
      when a.tur in ('fikir', 'oylama', 'video') then ozel.etkinlik(s.id, a.id)
      else '{}'::jsonb end
      from (
        select st.*, row_number() over (order by st.sira, st.id) as no, count(*) over () as toplam
        from public.lesson_steps st
        where st.lesson_id = s.lesson_id
      ) a
      left join public.presentations p on p.id = a.presentation_id
      where a.id = s.aktif_adim
    )
  )
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where s.id = p_session;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Dönen değer: { durum: 'tamam', kalan } ya da { hata }. kalan: beyin fırtınasında yazabileceği fikir sayısı.
create function public.katki_gonder(p_session uuid, p_cihaz text, p_metin text, p_taraf integer default null)
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
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.bitti, st.tur
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
  -- Aynı kişinin eşzamanlı istekleri sıraya girer (3 fikir sınırı aşılmasın).
  perform pg_advisory_xact_lock(hashtext(v_kisi));

  -- Uydurma cihaz kimlikleriyle yığma yapılmasın diye adım başına üst sınır
  if (select count(*) from public.contributions k where k.session_id = p_session and k.step_id = r.aktif_adim) >= 2000 then
    return jsonb_build_object('hata', 'dolu');
  end if;

  if r.tur = 'fikir' then
    if length(v_metin) < 2 then
      return jsonb_build_object('hata', 'metin_kisa');
    end if;
    if length(v_metin) > 40 then
      return jsonb_build_object('hata', 'metin_uzun');
    end if;
    select count(*) into v_sayi from public.contributions k
    where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi;
    if v_sayi >= 3 then
      return jsonb_build_object('hata', 'sinir');
    end if;
    if exists (
      select 1 from public.contributions k
      where k.session_id = p_session and k.step_id = r.aktif_adim and k.kisi = v_kisi and lower(k.metin) = lower(v_metin)
    ) then
      return jsonb_build_object('hata', 'ayni');
    end if;
    insert into public.contributions (session_id, step_id, kisi, metin) values (p_session, r.aktif_adim, v_kisi, v_metin);
    return jsonb_build_object('durum', 'tamam', 'kalan', 2 - v_sayi);
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
                -- Gizlenen gerekçe aynı metinle yeniden gönderilirse gizli kalır
                gizli = k.gizli and k.metin = excluded.metin,
                metin = excluded.metin,
                zaman = now();
  return jsonb_build_object('durum', 'tamam', 'kalan', 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: kumanda
-- ---------------------------------------------------------------------------
-- 0005'teki kumanda_durumu: tartışma adımında sayılar ve gerekçeler hocaya her zaman görünür; adım
-- listesinde yeni türlerin özeti.
create or replace function public.kumanda_durumu(p_session uuid, p_anahtar text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_lesson uuid;
  v_adim   uuid;
  v_durum  jsonb;
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  select s.course_id, s.lesson_id, s.aktif_adim into v_course, v_lesson, v_adim from public.sessions s where s.id = p_session;

  v_durum := ozel.durum(p_session);
  if v_durum -> 'adim' ->> 'tur' in ('fikir', 'oylama') then
    v_durum := jsonb_set(v_durum, '{adim}', (v_durum -> 'adim') || ozel.etkinlik(p_session, v_adim, true));
  end if;

  return v_durum || jsonb_build_object(
    'katilan', (select count(*) from public.attendance a where a.session_id = p_session),
    'mevcut', (select count(*) from public.students st where st.course_id = v_course),
    'kod', ozel.kod_bilgisi(p_session),
    'puanlar', ozel.puanlar(p_session, 5),
    'adimlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'tur', st.tur,
        'sunum', p.ad,
        'sayfa_no', st.sayfa_no,
        'ozet', left(case
          when st.tur = 'slayt' then p.metinler ->> (st.sayfa_no - 1)
          when st.tur = 'soru' then q.soru
          when st.tur in ('fikir', 'oylama') then st.ayar ->> 'soru'
          when st.tur = 'video' then coalesce(nullif(st.ayar ->> 'baslik', ''), st.ayar ->> 'url')
        end, 140)
      ) order by st.sira, st.id)
      from public.lesson_steps st
      left join public.presentations p on p.id = st.presentation_id
      left join public.questions q on q.id = st.question_id
      where st.lesson_id = v_lesson
    ), '[]'::jsonb)
  );
end;
$$;

-- Yeni komut: 'yeniden_ac' (kapatılan beyin fırtınası ya da oylama yeniden katkı alır)
create or replace function public.kumanda_komut(p_session uuid, p_anahtar text, p_komut text, p_adim uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;

  if p_komut = 'git' then
    if not exists (
      select 1 from public.lesson_steps st
      join public.sessions s on s.lesson_id = st.lesson_id
      where s.id = p_session and st.id = p_adim
    ) then
      return jsonb_build_object('hata', 'adim_yok');
    end if;
    update public.sessions set aktif_adim = p_adim where id = p_session;
  elsif p_komut = 'yoklama_ac' then
    update public.sessions set yoklama_acik = true, bitti = null where id = p_session;
  elsif p_komut = 'yoklama_kapat' then
    update public.sessions set yoklama_acik = false where id = p_session;
  elsif p_komut = 'sonuc_goster' then
    update public.sessions set soru_durum = 'sonuc' where id = p_session and soru_durum = 'acik';
  elsif p_komut = 'yeniden_ac' then
    update public.sessions s set soru_durum = 'acik'
    where s.id = p_session and s.soru_durum = 'sonuc'
      and exists (select 1 from public.lesson_steps st where st.id = s.aktif_adim and st.tur in ('fikir', 'oylama'));
  elsif p_komut = 'telefon_ac' then
    update public.sessions set telefon_modu = true where id = p_session;
  elsif p_komut = 'telefon_kapat' then
    update public.sessions set telefon_modu = false where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Kumandadan uygunsuz katkıyı kaldırma (projeksiyonsuz derste sahne yoktur): perdedeki adımda bu metni
-- taşıyan bütün katkılar gizlenir ya da geri açılır.
create function public.kumanda_gizle(p_session uuid, p_anahtar text, p_metin text, p_gizli boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  update public.contributions k set gizli = coalesce(p_gizli, true)
  from public.sessions s
  where s.id = p_session and k.session_id = s.id and k.step_id = s.aktif_adim
    and lower(k.metin) = lower(btrim(coalesce(p_metin, ''))) and k.metin <> '';
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select, delete on public.contributions to authenticated;
grant update (gizli) on public.contributions to authenticated;

revoke all on function ozel.katki_kisi(uuid, text)                         from public;
revoke all on function ozel.etkinlik(uuid, uuid, boolean)                  from public;
revoke all on function public.katki_gonder(uuid, text, text, integer)      from public;
revoke all on function public.kumanda_gizle(uuid, text, text, boolean)     from public;

grant execute on function public.katki_gonder(uuid, text, text, integer)   to anon, authenticated;
grant execute on function public.kumanda_gizle(uuid, text, text, boolean)  to anon, authenticated;

-- Sahne gelen katkıları canlı izler.
alter publication supabase_realtime add table public.contributions;

-- Supabase'in "Automatic RLS" özelliğinin olay tetikleyicisi fonksiyonu Data API'den çağrılabilir
-- görünüyordu (güvenlik danışmanı uyarısı). Çağrılınca zaten hata verir; yetkisi yine de kaldırılır.
-- Yalnızca bu fonksiyonun bulunduğu kurulumlarda çalışır.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
