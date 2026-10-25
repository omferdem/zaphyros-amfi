-- 0007: Dönemler, şubeler ve hafta planı
--
-- Kullanıcının düzeni (26 Ekim 2026): yılda 2 dönem, dönemde 3 4 ders, bazı derslerde 6 7 şube.
-- Her şubenin ayrı sınıf listesi ve ayrı yoklaması vardır; içerik (akışlar, sunumlar, sorular) her yıl
-- kullanılır ve geliştirilir; gelecek dönemler önceden planlanabilir.
--
-- * terms (dönem): "2026-2027 Güz" gibi; başlangıç tarihiyle sıralanır, önceden açılabilir.
-- * courses.term_id: dersin (şubenin) bağlı olduğu dönem. courses.sube: şube adı ("A", "1. Şube"...).
--   Bir dönemde aynı içeriğin aynı adlı iki şubesi olamaz. courses.donem metni dönem adından kendiliğinden doldurulur.
-- * lessons.sira: içerikteki akışların hafta sırası (1. akış = 1. hafta).
-- * RPC: hafta_plani (şube x hafta özeti), donemi_planla (önceki dönemin ders ve şube yapısını boş listelerle kopyalar),
--   akislari_sirala (hafta sırası).

-- ---------------------------------------------------------------------------
-- Dönemler
-- ---------------------------------------------------------------------------
create table public.terms (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ad           text not null check (length(btrim(ad)) between 1 and 40),
  baslangic    date not null default current_date,
  olusturuldu  timestamptz not null default now()
);
create unique index terms_ad_tekil on public.terms (teacher_id, lower(btrim(ad)));
alter table public.terms enable row level security;

create policy "hoca kendi donemlerini yonetir" on public.terms
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()) and (select public.hoca_mi()));

-- ---------------------------------------------------------------------------
-- Ders (şube) bir döneme bağlanır
-- ---------------------------------------------------------------------------
alter table public.courses
  add column term_id uuid references public.terms (id) on delete restrict,
  add column sube    text check (sube is null or length(btrim(sube)) between 1 and 40);

-- Var olan dersler: dönem metninden dönem kayıtları açılır (metni olmayanlar "Dönemsiz" olur)
insert into public.terms (teacher_id, ad, baslangic)
select c.teacher_id, left(btrim(c.donem), 40), min(c.olusturuldu)::date
from public.courses c
where c.donem is not null and btrim(c.donem) <> ''
group by c.teacher_id, left(btrim(c.donem), 40)
on conflict do nothing;

insert into public.terms (teacher_id, ad, baslangic)
select c.teacher_id, 'Dönemsiz', min(c.olusturuldu)::date
from public.courses c
where c.donem is null or btrim(c.donem) = ''
group by c.teacher_id
on conflict do nothing;

update public.courses c
   set term_id = (
     select t.id from public.terms t
     where t.teacher_id = c.teacher_id
       and lower(btrim(t.ad)) = lower(left(coalesce(nullif(btrim(c.donem), ''), 'Dönemsiz'), 40))
   );

-- Dönem verilmeden (eski istemci ya da dönem metniyle) açılan derse dönem bulunur ya da açılır;
-- başka hocanın dönemine bağlanamaz; donem metni dönem adıyla eşitlenir.
create function ozel.ders_donemi_ayarla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad text;
begin
  if new.term_id is null then
    v_ad := left(coalesce(nullif(btrim(coalesce(new.donem, '')), ''), 'Dönemsiz'), 40);
    select t.id into new.term_id
    from public.terms t
    where t.teacher_id = new.teacher_id and lower(btrim(t.ad)) = lower(v_ad);
    if new.term_id is null then
      insert into public.terms (teacher_id, ad) values (new.teacher_id, v_ad) returning id into new.term_id;
    end if;
  elsif not exists (select 1 from public.terms t where t.id = new.term_id and t.teacher_id = new.teacher_id) then
    raise exception 'donem bu hocaya ait degil' using errcode = '23514';
  end if;
  select t.ad into new.donem from public.terms t where t.id = new.term_id;
  return new;
end;
$$;

create trigger courses_donem
  before insert or update of term_id, donem on public.courses
  for each row execute function ozel.ders_donemi_ayarla();

-- Dönem adı değişince dersler de değişir.
create function ozel.donem_adi_esitle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.courses set donem = new.ad where term_id = new.id;
  return new;
end;
$$;

create trigger terms_ad_degisti
  after update of ad on public.terms
  for each row execute function ozel.donem_adi_esitle();

alter table public.courses alter column term_id set not null;
create index courses_term_idx on public.courses (term_id);

-- Bir dönemde aynı içeriğin aynı adlı iki şubesi olamaz.
create unique index courses_sube_tekil on public.courses (term_id, subject_id, lower(btrim(coalesce(sube, ''))));

-- ---------------------------------------------------------------------------
-- Akışların hafta sırası
-- ---------------------------------------------------------------------------
alter table public.lessons add column sira integer not null default 0;

update public.lessons l
   set sira = r.n
  from (select id, row_number() over (partition by subject_id order by olusturuldu, id)::integer as n from public.lessons) r
 where r.id = l.id;

create function ozel.akis_sirasi_ver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sira = 0 then
    select coalesce(max(l.sira), 0) + 1 into new.sira from public.lessons l where l.subject_id = new.subject_id;
  end if;
  return new;
end;
$$;

create trigger lessons_sira
  before insert on public.lessons
  for each row execute function ozel.akis_sirasi_ver();

-- Akışların yeni hafta sırası tek seferde yazılır (RLS geçerli: yalnızca kendi içeriği).
create function public.akislari_sirala(p_subject uuid, p_akislar uuid[])
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.lessons l
     set sira = u.n
    from unnest(p_akislar) with ordinality as u(id, n)
   where l.id = u.id and l.subject_id = p_subject;
$$;

-- ---------------------------------------------------------------------------
-- RPC: hafta planı özeti ve dönem planlama (RLS geçerli: yalnızca kendi verisi)
-- ---------------------------------------------------------------------------
-- Dönemdeki bir içeriğin şubelerinde akışla başlatılmış oturumlar; yoklamaya katılan ve sınıf mevcudu sayılarıyla.
create function public.hafta_plani(p_term uuid, p_subject uuid)
returns table (course_id uuid, lesson_id uuid, oturum_id uuid, basladi timestamptz, katilan bigint, mevcut bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.course_id,
         s.lesson_id,
         s.id,
         s.basladi,
         (select count(*) from public.attendance a where a.session_id = s.id),
         (select count(*) from public.students st where st.course_id = s.course_id)
  from public.sessions s
  join public.courses c on c.id = s.course_id
  where c.term_id = p_term and c.subject_id = p_subject and s.lesson_id is not null
  order by s.basladi desc;
$$;

-- Yeni dönem açar. Kaynak dönem verilirse onun ders ve şube yapısı kopyalanır; sınıf listeleri,
-- oturumlar ve yoklamalar kopyalanmaz (içerik zaten ortaktır).
create function public.donemi_planla(p_ad text, p_baslangic date, p_kaynak uuid default null)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.terms (ad, baslangic)
  values (btrim(p_ad), coalesce(p_baslangic, current_date))
  returning id into v_id;

  if p_kaynak is not null then
    insert into public.courses (ad, kod, subject_id, sube, term_id)
    select c.ad, c.kod, c.subject_id, c.sube, v_id
    from public.courses c
    where c.term_id = p_kaynak;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.terms to authenticated;

revoke all on function public.akislari_sirala(uuid, uuid[])          from public;
revoke all on function public.hafta_plani(uuid, uuid)                from public;
revoke all on function public.donemi_planla(text, date, uuid)        from public;
revoke all on function ozel.ders_donemi_ayarla()                     from public;
revoke all on function ozel.donem_adi_esitle()                       from public;
revoke all on function ozel.akis_sirasi_ver()                        from public;

grant execute on function public.akislari_sirala(uuid, uuid[])       to authenticated;
grant execute on function public.hafta_plani(uuid, uuid)             to authenticated;
grant execute on function public.donemi_planla(text, date, uuid)     to authenticated;
