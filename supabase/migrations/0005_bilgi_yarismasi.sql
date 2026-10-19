-- 0005: Faz 3, soru bankası ve bilgi yarışması
--
-- Kullanıcı kararları (19 Ekim 2026):
-- * Sorular ders içeriğine bağlıdır (yıllarca kullanılır); ZOMR biçiminden içe aktarılır.
-- * Soru adımı akışta slaytların arasına eklenir; yalnızca sorulardan oluşan akış da olur.
-- * Puan Kahoot gibi hıza göre: doğru cevap 500 ile 1000 arası (erken cevap daha çok), yanlış 0.
-- * Yoklaması alınmış öğrenci adıyla ("Ali Y."), yoklamasız derste takma adla yarışır.
--
-- Tablolar: questions (soru bankası), session_players (takma adlar), responses (cevaplar)
-- sessions'a eklenenler: soru_durum ('acik' = cevap alınıyor, 'sonuc' = doğru cevap açıklandı), soru_basladi
-- RPC: cevap_ver, takma_ad_al, benim_sonucum (girişsiz); puan_tablosu (hoca)
--
-- Şıkların sırası her oturumda karışıktır ama herkes için aynıdır (oturum ve soru kimliğinden türetilir).
-- Öğrenci şıkkın sırasını gönderir; sunucu aynı sırayı yeniden hesaplayıp doğruyu kendisi denetler.

-- ---------------------------------------------------------------------------
-- Soru bankası
-- ---------------------------------------------------------------------------
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  soru         text not null check (length(btrim(soru)) between 1 and 1000),
  dogru        text not null check (length(btrim(dogru)) between 1 and 300),
  yanlislar    text[] not null check (cardinality(yanlislar) between 1 and 5),
  sure_sn      integer not null default 20 check (sure_sn between 5 and 300),
  -- ZOMR'daki #EASINESS, #BLOOM, #OUTCOME gibi ek bilgiler
  ek           jsonb not null default '{}' check (jsonb_typeof(ek) = 'object'),
  olusturuldu  timestamptz not null default now(),
  check (not (dogru = any (yanlislar)))
);
create index questions_subject_idx on public.questions (subject_id);
alter table public.questions enable row level security;

create policy "hoca kendi sorularini yonetir" on public.questions
  for all to authenticated
  using (public.icerik_benim(subject_id))
  with check (public.icerik_benim(subject_id));

-- ---------------------------------------------------------------------------
-- Akışta soru adımı
-- ---------------------------------------------------------------------------
alter table public.lesson_steps add column question_id uuid references public.questions (id) on delete cascade;
create index lesson_steps_question_idx on public.lesson_steps (question_id);

alter table public.lesson_steps drop constraint lesson_steps_tur_check;
alter table public.lesson_steps drop constraint lesson_steps_check;
alter table public.lesson_steps
  add constraint lesson_steps_tur_check check (tur in ('yoklama', 'slayt', 'soru')),
  add constraint lesson_steps_slayt_check check ((tur = 'slayt') = (presentation_id is not null and sayfa_no is not null)),
  add constraint lesson_steps_soru_check check ((tur = 'soru') = (question_id is not null));

-- Akışa eklenen soru, akışla aynı içerikten olmalı.
create function public.soru_akisla_uyumlu(p_lesson uuid, p_soru uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_soru is null or exists (
    select 1 from public.lessons l
    join public.questions q on q.subject_id = l.subject_id
    where l.id = p_lesson and q.id = p_soru
  );
$$;

drop policy "hoca kendi akis adimlarini yonetir" on public.lesson_steps;
create policy "hoca kendi akis adimlarini yonetir" on public.lesson_steps
  for all to authenticated
  using (public.akis_benim(lesson_id))
  with check (
    public.akis_benim(lesson_id)
    and public.sunum_akisla_uyumlu(lesson_id, presentation_id)
    and public.soru_akisla_uyumlu(lesson_id, question_id)
  );

-- ---------------------------------------------------------------------------
-- Oturumda sorunun durumu
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column soru_durum   text check (soru_durum in ('acik', 'sonuc')),
  add column soru_basladi timestamptz;

-- Perdeye soru adımı gelince cevap alma başlar (sahneden de kumandadan da aynı kural).
create function ozel.soru_durumu_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.aktif_adim is distinct from old.aktif_adim then
    if exists (select 1 from public.lesson_steps st where st.id = new.aktif_adim and st.tur = 'soru') then
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

create trigger sessions_soru_durumu
  before insert or update on public.sessions
  for each row execute function ozel.soru_durumu_ayarla();

-- Şıklar: doğru + yanlışlar, oturuma ve soruya göre karıştırılmış sırayla
create function ozel.secenekler(p_session uuid, p_soru uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(x order by md5(p_session::text || ':' || p_soru::text || ':' || x))
  from public.questions q, unnest(array[q.dogru] || q.yanlislar) as x
  where q.id = p_soru;
$$;

-- ---------------------------------------------------------------------------
-- Takma adlar ve cevaplar
-- ---------------------------------------------------------------------------
create table public.session_players (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  takma_ad    text not null check (length(btrim(takma_ad)) between 1 and 24),
  primary key (session_id, cihaz_id)
);
create unique index session_players_ad_tekil on public.session_players (session_id, lower(takma_ad));
alter table public.session_players enable row level security;

create policy "hoca takma adlari gorur" on public.session_players
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.responses (
  session_id   uuid not null references public.sessions (id) on delete cascade,
  step_id      uuid not null references public.lesson_steps (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  cihaz_id     text not null check (length(cihaz_id) between 8 and 64),
  secim        integer not null,
  dogru        boolean not null,
  puan         integer not null check (puan between 0 and 1000),
  sure_ms      integer not null,
  zaman        timestamptz not null default now(),
  primary key (session_id, step_id, cihaz_id)
);
create index responses_session_idx on public.responses (session_id, cihaz_id);
alter table public.responses enable row level security;

create policy "hoca cevaplari gorur" on public.responses
  for select to authenticated
  using (public.oturum_benim(session_id));

create policy "hoca cevaplari siler" on public.responses
  for delete to authenticated
  using (public.oturum_benim(session_id));

-- "Ali Veli Yılmaz" -> "Ali Y."
create function ozel.kisa_ad(p_ad text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(p_ad) ~ '\s'
      then split_part(btrim(p_ad), ' ', 1) || ' ' || left(regexp_replace(btrim(p_ad), '^.*\s', ''), 1) || '.'
    else btrim(p_ad)
  end;
$$;

-- Yarışmada görünen ad: yoklaması alındıysa listedeki adı, değilse takma adı
create function ozel.oyuncu_adi(p_session uuid, p_cihaz text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ozel.kisa_ad(st.ad_soyad) from public.attendance a
       join public.students st on st.id = a.student_id
      where a.session_id = p_session and a.cihaz_id = p_cihaz),
    (select p.takma_ad from public.session_players p where p.session_id = p_session and p.cihaz_id = p_cihaz)
  );
$$;

-- Puan tablosu: her oyuncunun toplamı, doğru sayısı ve sırası
create function ozel.puanlar(p_session uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ad', t.ad, 'puan', t.puan, 'dogru', t.dogru, 'sira', t.sira) order by t.sira, t.ad), '[]'::jsonb)
  from (
    select coalesce(ozel.oyuncu_adi(p_session, r.cihaz_id), 'İsimsiz') as ad,
           sum(r.puan)::integer as puan,
           count(*) filter (where r.dogru)::integer as dogru,
           rank() over (order by sum(r.puan) desc)::integer as sira
    from public.responses r
    where r.session_id = p_session
    group by r.cihaz_id
    order by sum(r.puan) desc
    limit greatest(1, least(p_limit, 1000))
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- Ders durumu: soru adımında soru, şıklar, kalan süre; sonuçta doğru şık ve dağılım
-- ---------------------------------------------------------------------------
create or replace function ozel.durum(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ders', c.ad,
    'baslik', s.baslik,
    'bitti', s.bitti is not null,
    'yoklama_acik', s.yoklama_acik and s.bitti is null,
    'adim', (
      select jsonb_build_object(
        'id', a.id,
        'tur', a.tur,
        'sira', a.no,
        'toplam', a.toplam,
        'sunum', p.ad,
        'sayfa_no', a.sayfa_no,
        'sayfa_sayisi', p.sayfa_sayisi,
        'metin', case when a.tur = 'slayt' then p.metinler ->> (a.sayfa_no - 1) end
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
      ) else '{}'::jsonb end
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

-- Soru açılınca ya da sonuç açıklanınca da öğrencilere yayınlanır.
create or replace function ozel.durum_yayinla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.aktif_adim is distinct from old.aktif_adim
     or new.lesson_id is distinct from old.lesson_id
     or new.yoklama_acik is distinct from old.yoklama_acik
     or new.bitti is distinct from old.bitti
     or new.soru_durum is distinct from old.soru_durum then
    begin
      perform realtime.send(ozel.durum(new.id), 'durum', 'oturum:' || new.id::text, false);
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Yoklamasız derste yarışmak için takma ad. Dönen değer: { durum: 'tamam', ad } ya da { hata }
create function public.takma_ad_al(p_session uuid, p_cihaz text, p_ad text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ad text := left(regexp_replace(btrim(coalesce(p_ad, '')), '\s+', ' ', 'g'), 24);
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if length(v_ad) < 2 then
    return jsonb_build_object('hata', 'ad_kisa');
  end if;
  if not exists (select 1 from public.sessions s where s.id = p_session and s.bitti is null) then
    return jsonb_build_object('hata', 'oturum_yok');
  end if;
  begin
    insert into public.session_players (session_id, cihaz_id, takma_ad) values (p_session, p_cihaz, v_ad)
    on conflict (session_id, cihaz_id) do update set takma_ad = excluded.takma_ad;
  exception when unique_violation then
    return jsonb_build_object('hata', 'ad_kullaniliyor');
  end;
  return jsonb_build_object('durum', 'tamam', 'ad', v_ad);
end;
$$;

-- Dönen değer: { durum: 'tamam' } ya da { hata }. Doğru mu, sonuç açıklanınca benim_sonucum() söyler.
create function public.cevap_ver(p_session uuid, p_cihaz text, p_secim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r          record;
  v_ms       integer;
  v_secenek  text[];
  v_dogru    boolean;
  v_puan     integer;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;

  select s.aktif_adim, s.soru_durum, s.soru_basladi, s.bitti, q.id as soru, q.dogru, q.sure_sn
    into r
  from public.sessions s
  join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'soru'
  join public.questions q on q.id = st.question_id
  where s.id = p_session;

  if not found then
    return jsonb_build_object('hata', 'soru_yok');
  end if;
  v_ms := floor(extract(epoch from (clock_timestamp() - r.soru_basladi)) * 1000)::integer;
  -- Ağ gecikmesi için 1,5 saniye pay
  if r.bitti is not null or r.soru_durum is distinct from 'acik' or v_ms > r.sure_sn * 1000 + 1500 then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;
  if ozel.oyuncu_adi(p_session, p_cihaz) is null then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;

  v_secenek := ozel.secenekler(p_session, r.soru);
  if p_secim is null or p_secim < 0 or p_secim >= cardinality(v_secenek) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;

  v_dogru := v_secenek[p_secim + 1] = r.dogru;
  v_puan := case when v_dogru
    then 1000 - round(500.0 * least(greatest(v_ms, 0), r.sure_sn * 1000) / (r.sure_sn * 1000))::integer
    else 0 end;

  insert into public.responses (session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms)
  values (p_session, r.aktif_adim, r.soru, p_cihaz, p_secim, v_dogru, v_puan, greatest(v_ms, 0))
  on conflict do nothing;
  if not found then
    return jsonb_build_object('hata', 'zaten_cevapladin');
  end if;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Öğrencinin kendi durumu: bu sorudaki cevabı (sonuç açıklandıysa doğru mu, kaç puan), toplamı ve sırası
create function public.benim_sonucum(p_session uuid, p_cihaz text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ad', ozel.oyuncu_adi(p_session, p_cihaz),
    'cevapladi', r.cihaz_id is not null,
    'secim', r.secim,
    'dogru', case when s.soru_durum = 'sonuc' then r.dogru end,
    'puan', case when s.soru_durum = 'sonuc' then r.puan end,
    'toplam', (select coalesce(sum(x.puan), 0) from public.responses x where x.session_id = p_session and x.cihaz_id = p_cihaz),
    'sira', (
      select t.sira from (
        select x.cihaz_id, rank() over (order by sum(x.puan) desc) as sira
        from public.responses x where x.session_id = p_session group by x.cihaz_id
      ) t where t.cihaz_id = p_cihaz
    ),
    'oyuncu', (select count(distinct x.cihaz_id) from public.responses x where x.session_id = p_session)
  )
  from public.sessions s
  left join public.responses r on r.session_id = s.id and r.step_id = s.aktif_adim and r.cihaz_id = p_cihaz
  where s.id = p_session;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca ve kumanda
-- ---------------------------------------------------------------------------
create function public.puan_tablosu(p_session uuid, p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.oturum_benim(p_session) then
    raise exception 'oturum bulunamadi' using errcode = 'P0002';
  end if;
  return ozel.puanlar(p_session, p_limit);
end;
$$;

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
begin
  if not ozel.kumanda_dogru(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'anahtar_gecersiz');
  end if;
  select s.course_id, s.lesson_id into v_course, v_lesson from public.sessions s where s.id = p_session;

  return ozel.durum(p_session) || jsonb_build_object(
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

-- Yeni komut: 'sonuc_goster' (sorunun doğru cevabını açıklar)
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
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler ve Realtime
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.questions to authenticated;
grant select                         on public.session_players to authenticated;
grant select, delete                 on public.responses to authenticated;

revoke all on function public.soru_akisla_uyumlu(uuid, uuid)        from public;
revoke all on function public.takma_ad_al(uuid, text, text)         from public;
revoke all on function public.cevap_ver(uuid, text, integer)        from public;
revoke all on function public.benim_sonucum(uuid, text)             from public;
revoke all on function public.puan_tablosu(uuid, integer)           from public;
revoke all on function ozel.soru_durumu_ayarla()                    from public;
revoke all on function ozel.secenekler(uuid, uuid)                  from public;
revoke all on function ozel.kisa_ad(text)                           from public;
revoke all on function ozel.oyuncu_adi(uuid, text)                  from public;
revoke all on function ozel.puanlar(uuid, integer)                  from public;

grant execute on function public.soru_akisla_uyumlu(uuid, uuid)  to authenticated;
grant execute on function public.puan_tablosu(uuid, integer)     to authenticated;
grant execute on function public.takma_ad_al(uuid, text, text)   to anon, authenticated;
grant execute on function public.cevap_ver(uuid, text, integer)  to anon, authenticated;
grant execute on function public.benim_sonucum(uuid, text)       to anon, authenticated;

-- Sahne gelen cevap sayısını canlı izler.
alter publication supabase_realtime add table public.responses;
