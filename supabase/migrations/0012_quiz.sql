-- 0012: Habersiz quiz
--
-- Kahoot tarzı canlı yarışmadan ayrı bir mod. Hoca (şube için) bir soru kümesinden quiz açar ve 6 haneli bir
-- kod alır. Öğrenci kodu ve öğrenci numarasını girer, soruları kendi hızında, kendi sırasıyla çözer. Sonuçlar
-- öğrenciye bağlı kaydedilir (gelişim raporuna girer); canlı sıralama yoktur.
--
-- * Numara şubenin listesinde olmalı (yoklamadaki kural). Bir numara tek cihazdan, bir cihaz tek numarayla girer.
-- * Soru sırası ve şıkların sırası her öğrenci için ayrıca karışır; doğru cevap öğrenciye hiç gönderilmez.
-- * Süre öğrenciye göre başladığı andan işler (sure_dk); süre dolunca ya da hoca kapatınca cevap alınmaz.
-- * Öğrenci kendi puanını yalnızca hoca "sonucu öğrenciye göster" dediyse görür.
-- * Hoca yalnızca kendi şubelerinin quizlerini okur; quiz oluşturma ve kapatma RPC ile yapılır.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses (id) on delete cascade,
  baslik           text not null check (length(btrim(baslik)) between 1 and 200),
  kod              text not null check (kod ~ '^[0-9]{6}$'),
  sure_dk          integer not null check (sure_dk between 1 and 240),
  sonuc_ogrenciye  boolean not null default false,
  durum            text not null default 'acik' check (durum in ('acik', 'kapali')),
  basladi          timestamptz not null default now(),
  kapandi          timestamptz
);
-- Açık quizler arasında kod tekil
create unique index quizzes_acik_kod on public.quizzes (kod) where durum = 'acik';
create index quizzes_course_idx on public.quizzes (course_id);
alter table public.quizzes enable row level security;

create table public.quiz_questions (
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  sira         integer not null,
  primary key (quiz_id, question_id)
);
alter table public.quiz_questions enable row level security;

create table public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  cihaz_id    text not null check (length(cihaz_id) between 8 and 64),
  basladi     timestamptz not null default now(),
  bitti       timestamptz,
  unique (quiz_id, student_id),
  unique (quiz_id, cihaz_id)
);
create index quiz_attempts_student_idx on public.quiz_attempts (student_id);
alter table public.quiz_attempts enable row level security;

create table public.quiz_answers (
  attempt_id   uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  -- Sorgu kolaylığı için denormalize: hangi quiz ve hangi öğrenci
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  secim        integer not null,
  dogru        boolean not null,
  zaman        timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index quiz_answers_quiz_idx on public.quiz_answers (quiz_id);
alter table public.quiz_answers enable row level security;

-- Hoca yalnızca kendi şubesinin quizlerini görür.
create function public.quiz_benim(p_quiz uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quizzes z
    join public.courses c on c.id = z.course_id
    where z.id = p_quiz and c.teacher_id = auth.uid()
  );
$$;

create policy "hoca quizlerini gorur" on public.quizzes
  for select to authenticated using (public.ders_benim(course_id));
create policy "hoca quizlerini siler" on public.quizzes
  for delete to authenticated using (public.ders_benim(course_id));
create policy "hoca quiz sorularini gorur" on public.quiz_questions
  for select to authenticated using (public.quiz_benim(quiz_id));
create policy "hoca denemeleri gorur" on public.quiz_attempts
  for select to authenticated using (public.quiz_benim(quiz_id));
-- Hoca bir öğrencinin denemesini silebilir (öğrenci quizi yeniden çözebilir).
create policy "hoca denemeyi siler" on public.quiz_attempts
  for delete to authenticated using (public.quiz_benim(quiz_id));
create policy "hoca quiz cevaplarini gorur" on public.quiz_answers
  for select to authenticated using (public.quiz_benim(quiz_id));

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
-- Şıklar: doğru + yanlışlar, denemeye ve soruya göre karıştırılmış sırayla (her öğrencide farklı)
create function ozel.quiz_secenekler(p_attempt uuid, p_soru uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(x order by md5(p_attempt::text || ':' || p_soru::text || ':' || x))
  from public.questions q, unnest(array[q.dogru] || q.yanlislar) as x
  where q.id = p_soru;
$$;

-- Öğrenciye giden quiz içeriği: sorular karışık sırada, doğru cevap yok
create function ozel.quiz_paket(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt', a.id,
    'baslik', z.baslik,
    'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''),
    'sure_dk', z.sure_dk,
    'kalan_ms', greatest(0, z.sure_dk * 60000 - floor(extract(epoch from (clock_timestamp() - a.basladi)) * 1000))::integer,
    'bitti', a.bitti is not null,
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'soru', q.soru,
        'secenekler', to_jsonb(ozel.quiz_secenekler(a.id, q.id)),
        'secim', ans.secim
      ) order by md5(a.id::text || q.id::text))
      from public.quiz_questions qq
      join public.questions q on q.id = qq.question_id
      left join public.quiz_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
      where qq.quiz_id = z.id
    ), '[]'::jsonb)
  )
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  join public.courses c on c.id = z.course_id
  where a.id = p_attempt;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hoca
-- ---------------------------------------------------------------------------
-- Dönen değer: { id, kod }
create function public.quiz_olustur(p_course uuid, p_baslik text, p_sure_dk integer, p_sorular uuid[], p_sonuc_ogrenciye boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sorular uuid[] := array(select distinct x from unnest(coalesce(p_sorular, '{}')) as x);
  v_say     integer;
  v_kod     text;
  v_id      uuid;
begin
  if not public.ders_benim(p_course) then
    raise exception 'ders bulunamadi' using errcode = 'P0002';
  end if;
  if cardinality(v_sorular) = 0 or cardinality(v_sorular) > 100 then
    raise exception 'soru sayisi 1 ile 100 arasinda olmali' using errcode = '22023';
  end if;
  -- Sorular dersin içeriğine ait olmalı
  select count(*) into v_say
  from public.questions q
  join public.courses c on c.subject_id = q.subject_id
  where c.id = p_course and q.id = any (v_sorular);
  if v_say <> cardinality(v_sorular) then
    raise exception 'sorular bu dersin icerigine ait degil' using errcode = '22023';
  end if;

  for i in 1..30 loop
    v_kod := lpad((floor(random() * 900000) + 100000)::integer::text, 6, '0');
    exit when not exists (select 1 from public.quizzes z where z.kod = v_kod and z.durum = 'acik');
    v_kod := null;
  end loop;
  if v_kod is null then
    raise exception 'kod uretilemedi' using errcode = '55000';
  end if;

  insert into public.quizzes (course_id, baslik, kod, sure_dk, sonuc_ogrenciye)
  values (p_course, btrim(p_baslik), v_kod, p_sure_dk, coalesce(p_sonuc_ogrenciye, false))
  returning id into v_id;

  insert into public.quiz_questions (quiz_id, question_id, sira)
  select v_id, x, o from unnest(p_sorular) with ordinality as t(x, o)
  where x = any (v_sorular)
  on conflict do nothing;

  return jsonb_build_object('id', v_id, 'kod', v_kod);
end;
$$;

-- Quizi kapatır; bitirmemiş öğrencilerin denemeleri de o ana kadarki cevaplarla biter.
create function public.quiz_kapat(p_quiz uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.quiz_benim(p_quiz) then
    raise exception 'quiz bulunamadi' using errcode = 'P0002';
  end if;
  update public.quizzes set durum = 'kapali', kapandi = coalesce(kapandi, now()) where id = p_quiz;
  update public.quiz_attempts set bitti = coalesce(bitti, now()) where quiz_id = p_quiz;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: öğrenci (girişsiz)
-- ---------------------------------------------------------------------------
-- Kod bir quize ait mi? { baslik, ders } ya da { hata: 'kod_yanlis' }
create function public.quiz_bul(p_kod text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('baslik', z.baslik, 'ders', c.ad || coalesce(' · ' || nullif(btrim(c.sube), ''), ''))
     from public.quizzes z join public.courses c on c.id = z.course_id
     where z.kod = regexp_replace(coalesce(p_kod, ''), '\D', '', 'g') and z.durum = 'acik'),
    jsonb_build_object('hata', 'kod_yanlis')
  );
$$;

-- Quize başlar ya da yarıda kalan denemeye devam eder. Dönen değer: quiz içeriği ya da { hata }
create function public.quiz_baslat(p_kod text, p_ogrenci_no text, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  z         record;
  a         record;
  v_no      text := upper(regexp_replace(coalesce(p_ogrenci_no, ''), '\s', '', 'g'));
  v_student uuid;
  v_id      uuid;
begin
  if p_cihaz is null or p_cihaz !~ '^[0-9A-Za-z-]{8,64}$' then
    return jsonb_build_object('hata', 'cihaz_gecersiz');
  end if;
  if v_no !~ '^[0-9A-Z]{1,20}$' then
    return jsonb_build_object('hata', 'numara_gecersiz');
  end if;

  select id, course_id into z
  from public.quizzes
  where kod = regexp_replace(coalesce(p_kod, ''), '\D', '', 'g') and durum = 'acik';
  if not found then
    return jsonb_build_object('hata', 'kod_yanlis');
  end if;

  select st.id into v_student
  from public.students st
  where st.course_id = z.course_id and upper(st.ogrenci_no) = v_no;
  if v_student is null then
    return jsonb_build_object('hata', 'liste_disi');
  end if;

  select id, cihaz_id, bitti into a from public.quiz_attempts where quiz_id = z.id and student_id = v_student;
  if found then
    if a.cihaz_id <> p_cihaz then
      return jsonb_build_object('hata', 'numara_kullanildi');
    end if;
    if a.bitti is not null then
      return jsonb_build_object('hata', 'zaten_bitti');
    end if;
    return ozel.quiz_paket(a.id);
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = z.id and cihaz_id = p_cihaz) then
    return jsonb_build_object('hata', 'cihaz_kullanildi');
  end if;

  begin
    insert into public.quiz_attempts (quiz_id, student_id, cihaz_id) values (z.id, v_student, p_cihaz) returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('hata', 'tekrar_dene');
  end;
  return ozel.quiz_paket(v_id);
end;
$$;

-- Bir soruya cevap yazar (süre içinde değiştirilebilir). Dönen değer: { durum: 'tamam' } ya da { hata }
create function public.quiz_cevapla(p_attempt uuid, p_cihaz text, p_soru uuid, p_secim integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r         record;
  v_secenek text[];
  v_dogru   text;
begin
  select a.id, a.cihaz_id, a.bitti, a.basladi, a.student_id, z.id as quiz_id, z.durum, z.sure_dk
    into r
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;

  if not found or p_cihaz is null or r.cihaz_id <> p_cihaz then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;
  if r.bitti is not null then
    return jsonb_build_object('hata', 'bitti');
  end if;
  if r.durum <> 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  -- Ağ gecikmesi için 10 saniye pay
  if extract(epoch from (clock_timestamp() - r.basladi)) > r.sure_dk * 60 + 10 then
    return jsonb_build_object('hata', 'sure_bitti');
  end if;
  if not exists (select 1 from public.quiz_questions where quiz_id = r.quiz_id and question_id = p_soru) then
    return jsonb_build_object('hata', 'soru_yok');
  end if;

  v_secenek := ozel.quiz_secenekler(p_attempt, p_soru);
  if p_secim is null or p_secim < 0 or p_secim >= cardinality(v_secenek) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;
  select q.dogru into v_dogru from public.questions q where q.id = p_soru;

  insert into public.quiz_answers (attempt_id, question_id, quiz_id, student_id, secim, dogru)
  values (p_attempt, p_soru, r.quiz_id, r.student_id, p_secim, v_secenek[p_secim + 1] = v_dogru)
  on conflict (attempt_id, question_id)
  do update set secim = excluded.secim, dogru = excluded.dogru, zaman = now();

  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Denemeyi bitirir. Hoca izin verdiyse { dogru, toplam } da döner.
create function public.quiz_bitir(p_attempt uuid, p_cihaz text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  select a.id, a.cihaz_id, z.id as quiz_id, z.sonuc_ogrenciye
    into r
  from public.quiz_attempts a
  join public.quizzes z on z.id = a.quiz_id
  where a.id = p_attempt;

  if not found or p_cihaz is null or r.cihaz_id <> p_cihaz then
    return jsonb_build_object('hata', 'kimlik_yok');
  end if;

  update public.quiz_attempts set bitti = coalesce(bitti, now()) where id = p_attempt;

  return jsonb_build_object('durum', 'tamam') || case when r.sonuc_ogrenciye then jsonb_build_object(
    'dogru', (select count(*) from public.quiz_answers x where x.attempt_id = p_attempt and x.dogru),
    'toplam', (select count(*) from public.quiz_questions x where x.quiz_id = r.quiz_id)
  ) else '{}'::jsonb end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, delete on public.quizzes       to authenticated;
grant select         on public.quiz_questions to authenticated;
grant select, delete on public.quiz_attempts to authenticated;
grant select         on public.quiz_answers  to authenticated;

revoke all on function public.quiz_benim(uuid)                              from public;
revoke all on function ozel.quiz_secenekler(uuid, uuid)                     from public;
revoke all on function ozel.quiz_paket(uuid)                                from public;
revoke all on function public.quiz_olustur(uuid, text, integer, uuid[], boolean) from public;
revoke all on function public.quiz_kapat(uuid)                              from public;
revoke all on function public.quiz_bul(text)                                from public;
revoke all on function public.quiz_baslat(text, text, text)                 from public;
revoke all on function public.quiz_cevapla(uuid, text, uuid, integer)       from public;
revoke all on function public.quiz_bitir(uuid, text)                        from public;

grant execute on function public.quiz_benim(uuid)                           to authenticated;
grant execute on function public.quiz_olustur(uuid, text, integer, uuid[], boolean) to authenticated;
grant execute on function public.quiz_kapat(uuid)                           to authenticated;
grant execute on function public.quiz_bul(text)                             to anon, authenticated;
grant execute on function public.quiz_baslat(text, text, text)              to anon, authenticated;
grant execute on function public.quiz_cevapla(uuid, text, uuid, integer)    to anon, authenticated;
grant execute on function public.quiz_bitir(uuid, text)                     to anon, authenticated;
