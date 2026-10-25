-- 0006: Faz 2b, yalnız telefon modu
--
-- Kullanıcı kararı (19 Ekim 2026): bilgisayar ya da projeksiyon yoksa hoca dersi telefonundan yönetir;
-- perdede görünecek ekran öğrencilerin telefonunda görünür.
--
-- * sessions.telefon_modu: oturum projeksiyonsuz yürütülür.
-- * presentations.gorseller_hazir: sunumun sayfa görselleri yüklendi (tarayıcıda küçültülüp yüklenir).
-- * Depo: "slayt-gorselleri" kovası (özel). Dosya yolu: <içerik id>/<sunum id>/<sayfa no>
-- * Öğrenci (girişsiz) bir görseli yalnızca telefon modundaki açık bir dersin PERDEDEKİ slaytı için okuyabilir.
--   Sonraki slaytları önceden indiremez; ders bitince hiçbir görsele erişemez.
-- * Telefon modunda öğrenci telefonuna: slayt görseli (ders_durumu), soru sonucunda ilk 5 (benim_sonucum).
-- * Kumandadan telefon modu açılıp kapatılabilir.

-- ---------------------------------------------------------------------------
-- Sütunlar
-- ---------------------------------------------------------------------------
alter table public.sessions      add column telefon_modu boolean not null default false;
alter table public.presentations add column gorseller_hazir boolean not null default false;

-- ---------------------------------------------------------------------------
-- Depo: slayt görselleri
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slayt-gorselleri', 'slayt-gorselleri', false, 614400, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Perdedeki slaytın görseli: telefon modundaki açık bir oturumda, o an aktif adımın sunumu ve sayfası
create function public.gorsel_gorunur(p_yol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions s
    join public.lesson_steps st on st.id = s.aktif_adim and st.tur = 'slayt'
    join public.presentations p on p.id = st.presentation_id
    where s.telefon_modu
      and s.bitti is null
      and p.gorseller_hazir
      and split_part(p_yol, '/', 1) = p.subject_id::text
      and split_part(p_yol, '/', 2) = p.id::text
      and split_part(p_yol, '/', 3) = st.sayfa_no::text
  );
$$;

create policy "hoca kendi slayt gorsellerini okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini yukler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini gunceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name))
  with check (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "hoca kendi slayt gorsellerini siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'slayt-gorselleri' and public.depo_dersi_benim(name));

create policy "ogrenci perdedeki slaytin gorselini okur" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'slayt-gorselleri' and public.gorsel_gorunur(name));

-- ---------------------------------------------------------------------------
-- Ders durumu: telefon modu ve slayt görselinin yolu
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

-- Telefon modu değişince de öğrencilere yayınlanır.
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
     or new.soru_durum is distinct from old.soru_durum
     or new.telefon_modu is distinct from old.telefon_modu then
    begin
      perform realtime.send(ozel.durum(new.id), 'durum', 'oturum:' || new.id::text, false);
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- Telefon modunda soru sonucunda öğrencinin telefonuna ilk 5 de gelir (perde yok).
create or replace function public.benim_sonucum(p_session uuid, p_cihaz text)
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
    'oyuncu', (select count(distinct x.cihaz_id) from public.responses x where x.session_id = p_session),
    'puanlar', case when s.telefon_modu and s.soru_durum = 'sonuc' then ozel.puanlar(p_session, 5) end
  )
  from public.sessions s
  left join public.responses r on r.session_id = s.id and r.step_id = s.aktif_adim and r.cihaz_id = p_cihaz
  where s.id = p_session;
$$;

-- Yeni komutlar: 'telefon_ac', 'telefon_kapat'
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

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke all on function public.gorsel_gorunur(text) from public;
grant execute on function public.gorsel_gorunur(text) to anon, authenticated;
