"""0042_soru_jokerleri.sql dosyasını üretir: ozel.durum (0033) ve cevap_ver (0005) mevcut hâllerinden alınıp yama yapılır."""
import os
import re

KOK = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'migrations')


def oku(ad):
    return open(os.path.join(KOK, ad), encoding='utf8').read()


def fonksiyon(metin, baslangic):
    i = metin.index(baslangic)
    j = metin.index('\n$$;', i) + 4
    return metin[i:j]


durum = fonksiyon(oku('0033_slayt_gorseli_telefon_modu.sql'), 'create or replace function ozel.durum(p_session uuid)')
assert "make_interval(secs => q.sure_sn)" in durum and "'secenekler', to_jsonb(ozel.secenekler(s.id, q.id))," in durum
durum = durum.replace(
    "'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),",
    "'secenekler', to_jsonb(ozel.secenekler(s.id, q.id)),\n          'elenen', (select j.veri -> 'elenen' from public.soru_jokerleri j where j.session_id = s.id and j.step_id = a.id and j.tur = 'yarim'),",
    1,
)

BASLIK = """-- 0042: Bilgi merdiveni jokerleri (yarı yarıya, seyirci, +15 saniye)
--
-- Hoca, açık soruda joker kullanır (perdeden ya da kumandadan):
-- * yarim: telefonlarda 2 yanlış şık silinir (ders_durumu 'elenen' alanı);
-- * sure: sorunun süresi 15 saniye uzar (soru_basladi 15 sn ileri alınır; telefon, perde ve cevap_ver aynı başlangıcı kullanır);
-- * seyirci: o ana kadar ilk 10 saniyede gelen cevapların şık dağılımı perdede gösterilir.
-- Her joker, bir oyun turunda (aktif_tur ya da akış) en çok bir kez kullanılır.

create table public.soru_jokerleri (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  step_id     uuid not null references public.lesson_steps (id) on delete cascade,
  tur         text not null check (tur in ('yarim', 'sure', 'seyirci')),
  veri        jsonb not null default '{}'::jsonb,
  zaman       timestamptz not null default now(),
  primary key (session_id, step_id, tur)
);
alter table public.soru_jokerleri enable row level security;
create policy "hoca jokerleri gorur" on public.soru_jokerleri
  for select to authenticated using (public.oturum_benim(session_id));
grant select on public.soru_jokerleri to authenticated;


"""

RPC = """

-- Jokerin kullanımı: hoca (perde anahtarsız) ya da kumanda (anahtarla). Yalnızca cevap alınan soruda, tur başına bir kez.
create function public.joker_kullan(p_session uuid, p_anahtar text, p_tur text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s        record;
  v_secenek text[];
  v_dogru  integer;
  v_veri   jsonb := '{}'::jsonb;
  v_ilk    integer[];
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  if p_tur is null or p_tur not in ('yarim', 'sure', 'seyirci') then
    return jsonb_build_object('hata', 'joker_gecersiz');
  end if;
  select se.aktif_adim, se.soru_durum, se.soru_basladi, se.lesson_id, se.aktif_tur, se.bitti, q.id as soru, q.dogru
    into s
  from public.sessions se
  join public.lesson_steps st on st.id = se.aktif_adim and st.tur = 'soru'
  join public.questions q on q.id = st.question_id
  where se.id = p_session;
  if not found or s.bitti is not null or s.soru_durum is distinct from 'acik' then
    return jsonb_build_object('hata', 'soru_acik_degil');
  end if;
  -- Aynı turda aynı joker ikinci kez kullanılamaz
  if exists (
    select 1 from public.soru_jokerleri j
    join public.lesson_steps st on st.id = j.step_id
    where j.session_id = p_session and j.tur = p_tur and st.lesson_id = s.lesson_id and st.tur_id is not distinct from s.aktif_tur
  ) then
    return jsonb_build_object('hata', 'kullanildi');
  end if;

  v_secenek := ozel.secenekler(p_session, s.soru);
  if p_tur = 'yarim' then
    v_dogru := array_position(v_secenek, s.dogru);
    select array_agg(i - 1 order by i) into v_ilk
    from (select i from generate_series(1, cardinality(v_secenek)) i where i <> v_dogru order by md5(p_session::text || s.aktif_adim::text || i::text) limit 2) x;
    v_veri := jsonb_build_object('elenen', to_jsonb(coalesce(v_ilk, '{}'::integer[])));
  elsif p_tur = 'sure' then
    update public.sessions set soru_basladi = soru_basladi + interval '15 seconds' where id = p_session;
    v_veri := jsonb_build_object('saniye', 15);
  else
    v_veri := jsonb_build_object('dagilim', (
      select jsonb_agg((select count(*) from public.responses r
                        where r.session_id = p_session and r.step_id = s.aktif_adim and r.secim = i - 1
                          and r.zaman <= s.soru_basladi + interval '10 seconds') order by i)
      from generate_series(1, cardinality(v_secenek)) as i));
  end if;

  insert into public.soru_jokerleri (session_id, step_id, tur, veri) values (p_session, s.aktif_adim, p_tur, v_veri);
  -- Telefonlar yeni durumu hemen alsın (ozel.durum_yayinla yalnızca adım değişiminde çalışır)
  begin
    perform realtime.send(ozel.durum(p_session), 'durum', 'oturum:' || p_session::text, false);
  exception when others then
    null;
  end;
  return jsonb_build_object('durum', 'tamam', 'tur', p_tur, 'veri', v_veri);
end;
$$;

-- Perde ve kumanda için: bu turda kullanılan jokerler ve şu anki sorudaki etkileri
create function public.joker_durumu(p_session uuid, p_anahtar text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_adim   uuid;
  v_lesson uuid;
  v_tur    uuid;
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.aktif_adim, s.lesson_id, s.aktif_tur into v_adim, v_lesson, v_tur from public.sessions s where s.id = p_session;
  return jsonb_build_object(
    'kullanilan', coalesce((
      select jsonb_agg(distinct j.tur)
      from public.soru_jokerleri j join public.lesson_steps st on st.id = j.step_id
      where j.session_id = p_session and st.lesson_id = v_lesson and st.tur_id is not distinct from v_tur), '[]'::jsonb),
    'bu_soru', coalesce((
      select jsonb_object_agg(j.tur, j.veri)
      from public.soru_jokerleri j where j.session_id = p_session and j.step_id = v_adim), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.joker_kullan(uuid, text, text) from public;
revoke all on function public.joker_durumu(uuid, text) from public;
grant execute on function public.joker_kullan(uuid, text, text) to anon, authenticated;
grant execute on function public.joker_durumu(uuid, text) to anon, authenticated;
"""

cikti = BASLIK + '-- ozel.durum: elenen alanı yarı yarıya jokerini içerir (0033 sürümünden türetilmiştir)' + chr(10) + durum + RPC
open(os.path.join(KOK, '0042_soru_jokerleri.sql'), 'w', encoding='utf8', newline='\n').write(cikti)
print('yazıldı', len(cikti))
