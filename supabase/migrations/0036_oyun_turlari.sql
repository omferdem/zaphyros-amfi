-- Oyun turu: Zapoot oyunu her başlatıldığında yeni bir tur açılır; tur kendi adım satırlarını taşır.
-- Böylece "ikinci oyun" önceki turun cevaplarını, takım puanlarını ve zombi sonuçlarını devralmaz.
-- Eski kayıtlar etkilenmez: tur_id boş olan adımlar "tursuz" sayılır ve aktif_tur boşken geçerlidir.

create table public.oyun_turlari (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete set null,
  paket       text check (paket is null or length(paket) <= 200),
  mod         text check (mod is null or length(mod) <= 40),
  grup        integer check (grup is null or grup between 2 and 6),
  baslangic   timestamptz not null default now(),
  bitis       timestamptz,
  sonuc       jsonb
);
create index oyun_turlari_oturum_idx on public.oyun_turlari (session_id, baslangic);
alter table public.oyun_turlari enable row level security;

create policy "hoca turlari gorur" on public.oyun_turlari
  for select to authenticated using (public.oturum_benim(session_id));
create policy "hoca tur acar" on public.oyun_turlari
  for insert to authenticated with check (public.oturum_benim(session_id));
create policy "hoca tur gunceller" on public.oyun_turlari
  for update to authenticated using (public.oturum_benim(session_id)) with check (public.oturum_benim(session_id));
create policy "hoca tur siler" on public.oyun_turlari
  for delete to authenticated using (public.oturum_benim(session_id));
grant select, insert, update, delete on public.oyun_turlari to authenticated;

alter table public.lesson_steps
  add column tur_id uuid references public.oyun_turlari (id) on delete cascade;
create index lesson_steps_tur_idx on public.lesson_steps (tur_id) where tur_id is not null;

alter table public.sessions
  add column aktif_tur uuid references public.oyun_turlari (id) on delete set null;

-- Takım sıralaması: yalnızca perdedeki turun adımlarının cevapları sayılır.
create or replace function public.takim_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sayi   integer;
  v_lesson uuid;
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select coalesce((select a.sayi from public.takim_ayar a where a.session_id = p_session), 0) into v_sayi;
  select s.lesson_id, s.aktif_tur into v_lesson, v_tur from public.sessions s where s.id = p_session;
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
            and exists (select 1 from public.lesson_steps st
                        where st.id = r.step_id and st.lesson_id = v_lesson and st.tur_id is not distinct from v_tur)
          group by g.takim
        ) t
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

-- Zombi Kaçışı: yalnızca perdedeki turun soruları ve o turun oyuncuları.
create or replace function public.zombi_goster(p_session uuid, p_anahtar text default null)
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
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum, s.aktif_tur into v_lesson, v_aktif, v_durum, v_tur from public.sessions s where s.id = p_session;
  return (
    with sorular as (
      select st.id,
             row_number() over (order by st.sira, st.id)::integer as n,
             ((st.id is distinct from v_aktif or v_durum = 'sonuc')
              and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = st.id)) as acildi
      from public.lesson_steps st
      where st.lesson_id = v_lesson and st.tur = 'soru' and st.tur_id is not distinct from v_tur
    ),
    cihazlar as (
      select a.cihaz_id as cihaz from public.attendance a where a.session_id = p_session and a.cihaz_id is not null
      union
      select r.cihaz_id from public.responses r where r.session_id = p_session and r.step_id in (select x.id from sorular x)
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

-- Hocayla yarış: yalnızca perdedeki turun soruları sayılır.
create or replace function public.hoca_yaris_goster(p_session uuid, p_anahtar text default null)
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
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum, s.aktif_tur into v_lesson, v_aktif, v_durum, v_tur from public.sessions s where s.id = p_session;
  return (
    select jsonb_build_object(
      'acik', coalesce((select y.acik from public.hoca_yaris y where y.session_id = p_session), false),
      'hoca', coalesce(sum(case when t.hoca_dogru then 1 else 0 end), 0),
      'sinif', coalesce(sum(case when t.sinif_orani >= 50 then 1 else 0 end), 0),
      'soru', count(*),
      'cevapladi', exists (select 1 from public.hoca_cevaplari c where c.session_id = p_session and c.step_id = v_aktif),
      'son', (
        select jsonb_build_object('hoca_dogru', x.hoca_dogru, 'sinif_orani', x.sinif_orani)
        from (
          select (c.secim = q.dogru) as hoca_dogru,
                 (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                    from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
          from public.hoca_cevaplari c
          join public.lesson_steps st on st.id = c.step_id
          join public.questions q on q.id = st.question_id
          where c.session_id = p_session and c.step_id = v_aktif and v_durum = 'sonuc'
        ) x
      )
    )
    from (
      select (c.secim = q.dogru) as hoca_dogru,
             (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                from public.responses r where r.session_id = p_session and r.step_id = c.step_id) as sinif_orani
      from public.hoca_cevaplari c
      join public.lesson_steps st on st.id = c.step_id
      join public.questions q on q.id = st.question_id
      where c.session_id = p_session
        and st.lesson_id = v_lesson and st.tur_id is not distinct from v_tur
        and (c.step_id is distinct from v_aktif or v_durum = 'sonuc')
        and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = c.step_id)
    ) t
  );
end;
$$;

-- Bilgi merdiveni: yalnızca perdedeki turun soruları.
create or replace function public.merdiven_goster(p_session uuid, p_anahtar text default null)
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
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum, s.aktif_tur into v_lesson, v_aktif, v_durum, v_tur from public.sessions s where s.id = p_session;
  return jsonb_build_object(
    'sorular', coalesce((
      select jsonb_agg(jsonb_build_object('adim', x.id, 'sira', x.n, 'cevap', x.cevap, 'oran', x.oran, 'acildi', x.acildi) order by x.n)
      from (
        select st.id,
               row_number() over (order by st.sira, st.id)::integer as n,
               (select count(*) from public.responses r where r.session_id = p_session and r.step_id = st.id)::integer as cevap,
               (select round(100.0 * count(*) filter (where r.dogru) / nullif(count(*), 0))::integer
                  from public.responses r where r.session_id = p_session and r.step_id = st.id) as oran,
               (st.id is distinct from v_aktif or v_durum = 'sonuc') as acildi
        from public.lesson_steps st
        where st.lesson_id = v_lesson and st.tur = 'soru' and st.tur_id is not distinct from v_tur
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
