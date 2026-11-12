-- 0016: Hocayla yarış
--
-- Bilgi yarışmasında sınıf hocaya karşı oynar. Hoca her soruda kendi cevabını gizlice verir (sahnede harf
-- düğmeleriyle ya da kumandadan); soru sonucu açılınca hocanın doğru bilip bilmediği ve sınıfın başarısı
-- skora yazılır:
-- * Hoca soruyu doğru bilirse hoca 1 puan alır.
-- * Sınıfta cevap verenlerin en az yarısı doğru bilirse sınıf 1 puan alır.
-- (İkisi birden puan alabilir.) Hocanın cevabı metin olarak saklanır; şık sırası oturuma göre karıştığı için
-- sıra numarası yerine metin kullanılır. Skor yalnızca sonucu açılmış ya da geçilmiş soruları sayar, böylece
-- perdedeki skor hocanın gizli cevabını önceden belli etmez.
-- Hoca yetkisi (ozel.sinif_yetki, 0014): sahne giriş yapmış hoca olarak anahtarsız, kumanda anahtarla çağırır.

create table public.hoca_yaris (
  session_id  uuid primary key references public.sessions (id) on delete cascade,
  acik        boolean not null default false
);
alter table public.hoca_yaris enable row level security;
create policy "hoca yaris ayarini gorur" on public.hoca_yaris
  for select to authenticated
  using (public.oturum_benim(session_id));

create table public.hoca_cevaplari (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  step_id     uuid not null references public.lesson_steps (id) on delete cascade,
  secim       text not null check (length(secim) between 1 and 300),
  primary key (session_id, step_id)
);
alter table public.hoca_cevaplari enable row level security;
create policy "hoca kendi cevaplarini gorur" on public.hoca_cevaplari
  for select to authenticated
  using (public.oturum_benim(session_id));

create function public.hoca_yaris_ayarla(p_session uuid, p_anahtar text, p_acik boolean)
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
  insert into public.hoca_yaris (session_id, acik) values (p_session, coalesce(p_acik, false))
  on conflict (session_id) do update set acik = excluded.acik;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Perdedeki soru için hocanın cevabı. Sonuç açıldıktan sonra değiştirilemez.
create function public.hoca_cevapla(p_session uuid, p_anahtar text, p_adim uuid, p_secim text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s record;
  v_q record;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.aktif_adim, s.soru_durum into v_s from public.sessions s where s.id = p_session;
  if not found or v_s.aktif_adim is distinct from p_adim then
    return jsonb_build_object('hata', 'adim_aktif_degil');
  end if;
  if v_s.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'kapali');
  end if;
  select q.dogru, q.yanlislar into v_q
  from public.lesson_steps st join public.questions q on q.id = st.question_id
  where st.id = p_adim and st.tur = 'soru';
  if not found then
    return jsonb_build_object('hata', 'soru_yok');
  end if;
  if p_secim is null or not (p_secim = v_q.dogru or p_secim = any (v_q.yanlislar)) then
    return jsonb_build_object('hata', 'secim_gecersiz');
  end if;
  insert into public.hoca_cevaplari (session_id, step_id, secim) values (p_session, p_adim, p_secim)
  on conflict (session_id, step_id) do update set secim = excluded.secim;
  return jsonb_build_object('durum', 'tamam');
end;
$$;

-- Skor ve perdedeki soru için hocanın cevap verip vermediği (cevabın kendisi sonuç açılana kadar dönmez).
create function public.hoca_yaris_goster(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aktif uuid;
  v_durum text;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.aktif_adim, s.soru_durum into v_aktif, v_durum from public.sessions s where s.id = p_session;
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
        -- Yalnızca sonucu açılmış ya da geçilmiş sorular; en az bir sınıf cevabı olmalı
        and (c.step_id is distinct from v_aktif or v_durum = 'sonuc')
        and exists (select 1 from public.responses r where r.session_id = p_session and r.step_id = c.step_id)
    ) t
  );
end;
$$;

grant select on public.hoca_yaris to authenticated;
grant select on public.hoca_cevaplari to authenticated;

revoke all on function public.hoca_yaris_ayarla(uuid, text, boolean)  from public;
revoke all on function public.hoca_cevapla(uuid, text, uuid, text)    from public;
revoke all on function public.hoca_yaris_goster(uuid, text)           from public;

grant execute on function public.hoca_yaris_ayarla(uuid, text, boolean) to anon, authenticated;
grant execute on function public.hoca_cevapla(uuid, text, uuid, text)   to anon, authenticated;
grant execute on function public.hoca_yaris_goster(uuid, text)          to anon, authenticated;
