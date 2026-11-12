-- 0017: Bilgi merdiveni
--
-- Sınıfın tek bir yarışmacı gibi basamak basamak çıktığı oyun. Her soruda sınıfın çoğunluğu (cevap verenlerin
-- en az yarısı) doğru bilirse sınıf bir basamak çıkar; bilemezse son güvenli basamağa iner. Joker ve güvenli
-- basamak kuralları tarayıcıda uygulanır; veritabanı yalnızca akıştaki soruların sonuç özetini verir.
-- Bu fonksiyon yalnızca okur: perdedeki hoca (anahtarsız) ya da kumanda (anahtarla) çağırır (ozel.sinif_yetki, 0014).
-- "acildi": sonucu açılmış ya da geçilmiş soru (çözülmekte olan soru merdiveni önceden belli etmesin).

create function public.merdiven_goster(p_session uuid, p_anahtar text default null)
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
begin
  if not ozel.sinif_yetki(p_session, p_anahtar) then
    return jsonb_build_object('hata', 'yetki_yok');
  end if;
  select s.lesson_id, s.aktif_adim, s.soru_durum into v_lesson, v_aktif, v_durum from public.sessions s where s.id = p_session;
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
        where st.lesson_id = v_lesson and st.tur = 'soru'
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.merdiven_goster(uuid, text) from public;
grant execute on function public.merdiven_goster(uuid, text) to anon, authenticated;
