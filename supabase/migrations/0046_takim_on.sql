-- 0046: Takım sayısı en çok 10
--
-- Takım yarışması ve takımlı oyunlar (halat hariç, o hep 2 takım) 2 ile 10 arası takımla oynanabilir.
-- Kısıtlar ve takim_ayarla genişletildi; öğrenci tarafı (takim_sec) takım numarasını ayarlanan sayıya göre denetler.

alter table public.takim_ayar drop constraint if exists takim_ayar_sayi_check;
alter table public.takim_ayar add constraint takim_ayar_sayi_check check (sayi = 0 or sayi between 2 and 10);
alter table public.takim_uyeleri drop constraint if exists takim_uyeleri_takim_check;
alter table public.takim_uyeleri add constraint takim_uyeleri_takim_check check (takim between 1 and 10);
alter table public.oyun_turlari drop constraint if exists oyun_turlari_grup_check;
alter table public.oyun_turlari add constraint oyun_turlari_grup_check check (grup is null or grup between 2 and 10);

create or replace function public.takim_ayarla(p_session uuid, p_anahtar text, p_sayi integer)
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
  if p_sayi is null or not (p_sayi = 0 or p_sayi between 2 and 10) then
    return jsonb_build_object('hata', 'sayi_gecersiz');
  end if;
  insert into public.takim_ayar (session_id, sayi) values (p_session, p_sayi)
  on conflict (session_id) do update set sayi = excluded.sayi;
  delete from public.takim_uyeleri where session_id = p_session and (p_sayi = 0 or takim > p_sayi);
  return jsonb_build_object('durum', 'tamam');
end;
$$;
