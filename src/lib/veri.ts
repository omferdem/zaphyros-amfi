import { supabase } from './supabase'
import type { Ders, Ogrenci, Oturum, Yoklama } from './tipler'
import type { CevapKaydi, KatilimKaydi } from './gelisim'

// PostgREST tek seferde en fazla 1000 satır döndürür. 14 hafta x 150 öğrenci bunu aşar,
// bu yüzden yoklama kayıtları sayfa sayfa çekilir.
const SAYFA = 1000

export async function dersYoklamalari(oturumIdleri: string[]): Promise<Yoklama[]> {
  if (oturumIdleri.length === 0) return []
  const sonuc: Yoklama[] = []
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await supabase
      .from('attendance')
      .select('session_id, student_id, yontem, zaman')
      .in('session_id', oturumIdleri)
      .order('zaman')
      .order('student_id')
      .range(bas, bas + SAYFA - 1)
    if (error) throw error
    sonuc.push(...(data as Yoklama[]))
    if (data.length < SAYFA) return sonuc
  }
}

/** Uzun kimlik listelerini adrese sığsın diye parçalayıp her parçayı sayfa sayfa çeker. */
async function parcaliCek<T>(
  idler: string[],
  cek: (parca: string[], bas: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const sonuc: T[] = []
  for (let i = 0; i < idler.length; i += 40) {
    const parca = idler.slice(i, i + 40)
    for (let bas = 0; ; bas += SAYFA) {
      const { data, error } = await cek(parca, bas)
      if (error) throw error
      sonuc.push(...(data ?? []))
      if ((data?.length ?? 0) < SAYFA) break
    }
  }
  return sonuc
}

/** Oturumların bilgi yarışması cevapları (gelişim raporu için). */
export function oturumCevaplari(oturumIdleri: string[]): Promise<CevapKaydi[]> {
  return parcaliCek<CevapKaydi>(oturumIdleri, (parca, bas) =>
    supabase
      .from('responses')
      .select('session_id, question_id, cihaz_id, dogru, puan, sure_ms')
      .in('session_id', parca)
      .order('session_id')
      .order('step_id')
      .order('cihaz_id')
      .range(bas, bas + SAYFA - 1),
  )
}

/** Yoklama kayıtları cihaz kimliğiyle: cevapları öğrenciye bağlamak için. */
export function oturumKatilimlari(oturumIdleri: string[]): Promise<KatilimKaydi[]> {
  return parcaliCek<KatilimKaydi>(oturumIdleri, (parca, bas) =>
    supabase
      .from('attendance')
      .select('session_id, student_id, cihaz_id')
      .in('session_id', parca)
      .order('session_id')
      .order('student_id')
      .range(bas, bas + SAYFA - 1),
  )
}

export async function oturumYoklamalari(oturumId: string): Promise<Yoklama[]> {
  return dersYoklamalari([oturumId])
}

export async function dersGetir(id: string): Promise<Ders | null> {
  const { data, error } = await supabase.from('courses').select('id, subject_id, term_id, ad, kod, donem, sube, olusturuldu').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Ders | null
}

export async function ogrencileriGetir(dersId: string): Promise<Ogrenci[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, course_id, ogrenci_no, ad_soyad')
    .eq('course_id', dersId)
    .order('ogrenci_no')
    .limit(SAYFA)
  if (error) throw error
  return data as Ogrenci[]
}

export async function oturumlariGetir(dersId: string): Promise<Oturum[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu')
    .eq('course_id', dersId)
    .order('basladi', { ascending: false })
  if (error) throw error
  return data as Oturum[]
}

export async function oturumGetir(id: string): Promise<(Oturum & { courses: Ders }) | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu, courses(id, subject_id, term_id, ad, kod, donem, sube, olusturuldu)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as (Oturum & { courses: Ders }) | null
}

const OTURUM_ALANLARI = 'id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu'

/** Dersi bitirir: yoklama kapanır, öğrencilerin telefonunda "Ders bitti" görünür. Silmez; yeniden açılabilir. */
export async function oturumuBitir(id: string): Promise<Oturum> {
  const { data, error } = await supabase
    .from('sessions')
    .update({ yoklama_acik: false, bitti: new Date().toISOString() })
    .eq('id', id)
    .select(OTURUM_ALANLARI)
    .single()
  if (error) throw error
  return data as Oturum
}

/** Bitmiş dersi yeniden açar (yoklama kapalı kalır; gerekirse dersin içinde açılır). */
export async function oturumuYenidenAc(id: string): Promise<Oturum> {
  const { data, error } = await supabase.from('sessions').update({ bitti: null }).eq('id', id).select(OTURUM_ALANLARI).single()
  if (error) throw error
  return data as Oturum
}

export const DERSI_BITIR_SORUSU =
  'Ders bitirilsin mi? Yoklama kapanır ve öğrencilerin telefonunda "Ders bitti" görünür. İstersen sonra yeniden açabilirsin.'

/**
 * Yeni oturum açar; aynı dersin hâlâ açık kalmış eski oturumlarını kapatır.
 * Akış seçildiyse perdeye akışın ilk adımı gelir. Yoklama alınmayacaksa oturum yoklaması kapalı açılır.
 */
export async function oturumBaslat(
  dersId: string,
  baslik: string,
  akisId: string | null = null,
  yoklamaAl = true,
  telefonModu = false,
): Promise<string> {
  await supabase
    .from('sessions')
    .update({ yoklama_acik: false, bitti: new Date().toISOString() })
    .eq('course_id', dersId)
    .is('bitti', null)
  let ilkAdim: string | null = null
  if (akisId) {
    const { data } = await supabase
      .from('lesson_steps')
      .select('id')
      .eq('lesson_id', akisId)
      .order('sira')
      .order('id')
      .limit(1)
    ilkAdim = (data?.[0]?.id as string | undefined) ?? null
  }
  const { data, error } = await supabase
    .from('sessions')
    .insert({ course_id: dersId, baslik: baslik.trim() || null, lesson_id: akisId, aktif_adim: ilkAdim, yoklama_acik: yoklamaAl, telefon_modu: telefonModu })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
