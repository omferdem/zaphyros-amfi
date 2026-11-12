-- 0013: Misafir öğrenci (başka şubede derse giren öğrenci)
--
-- Ahmet A şubesinde kayıtlıdır ama B şubesinde derse girer. Hoca Ahmet'i B'nin listesine misafir olarak ekler;
-- misafir satır asıl öğrenciye (A'daki kayıt) bağlanır. Böylece Ahmet B'de yoklamaya ve etkinliklere katılır,
-- B'nin listesinde görünür; A'nın yoklama raporu ise onun B'deki katılımını kendi listesine yazar.
-- * students.asil_id: misafir satırın asıl kaydı (başka şubede, aynı hocanın, kendisi misafir olmayan bir öğrenci).
-- * Asıl öğrenci silinirse misafir satırlar da silinir.

alter table public.students add column asil_id uuid references public.students (id) on delete cascade;
create index students_asil_idx on public.students (asil_id) where asil_id is not null;

create function ozel.misafir_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asil public.students;
begin
  if new.asil_id is null then
    return new;
  end if;
  select * into v_asil from public.students where id = new.asil_id;
  if not found then
    raise exception 'asil ogrenci bulunamadi' using errcode = '23514';
  end if;
  if v_asil.course_id = new.course_id then
    raise exception 'asil ogrenci baska subede olmali' using errcode = '23514';
  end if;
  if v_asil.asil_id is not null then
    raise exception 'asil ogrenci kendisi misafir olamaz' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.courses a join public.courses b on b.teacher_id = a.teacher_id
    where a.id = v_asil.course_id and b.id = new.course_id
  ) then
    raise exception 'sube baska hocaya ait' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_misafir
  before insert or update of asil_id, course_id on public.students
  for each row execute function ozel.misafir_denetle();

-- Misafirleri olan bir kayıt misafir yapılamaz (zincir oluşmasın).
create function ozel.misafirli_kayit_misafir_olmasin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asil_id is not null and exists (select 1 from public.students m where m.asil_id = new.id) then
    raise exception 'misafirleri olan kayit misafir olamaz' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger students_misafirli_kayit
  before update of asil_id on public.students
  for each row execute function ozel.misafirli_kayit_misafir_olmasin();
