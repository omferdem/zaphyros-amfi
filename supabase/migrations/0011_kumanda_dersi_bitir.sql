-- 0011: Kumandadan dersi bitirme ve yeniden açma
--
-- Hoca telefonundaki kumandadan dersi bitirebilir (ders_bitir) ve bitmiş dersi yeniden açabilir (ders_ac).
-- Bitirince yoklama kapanır ve öğrencilerin telefonunda "Ders bitti" görünür (sessions tetikleyicisi
-- bunu zaten yayınlar). Yalnızca kumanda_komut'a iki komut eklenir; geri kalanı 0010'daki gibidir.

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
  elsif p_komut = 'ders_bitir' then
    update public.sessions set yoklama_acik = false, bitti = coalesce(bitti, now()) where id = p_session;
  elsif p_komut = 'ders_ac' then
    update public.sessions set bitti = null where id = p_session;
  else
    return jsonb_build_object('hata', 'komut_gecersiz');
  end if;

  return jsonb_build_object('durum', 'tamam');
end;
$$;
