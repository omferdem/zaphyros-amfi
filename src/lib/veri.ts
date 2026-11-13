import { supabase } from './supabase'
import type { Ders, Ogrenci, Oturum, Yoklama } from './tipler'
import type { CevapKaydi, KatilimKaydi } from './gelisim'
import type { MisafirKatilim } from './rapor'

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
export async function parcaliCek<T>(
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
  const { data, error } = await supabase.from('courses').select('id, subject_id, term_id, ad, kod, donem, sube, yoklama_sayisi, yoklama_birimi, olusturuldu').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Ders | null
}

export async function ogrencileriGetir(dersId: string): Promise<Ogrenci[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, course_id, ogrenci_no, ad_soyad, asil_id')
    .eq('course_id', dersId)
    .order('ogrenci_no')
    .limit(SAYFA)
  if (error) throw error
  return data as Ogrenci[]
}

export async function oturumlariGetir(dersId: string): Promise<Oturum[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu, hafta_no')
    .eq('course_id', dersId)
    .order('basladi', { ascending: false })
  if (error) throw error
  return data as Oturum[]
}

export async function oturumGetir(id: string): Promise<(Oturum & { courses: Ders }) | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu, hafta_no, courses(id, subject_id, term_id, ad, kod, donem, sube, yoklama_sayisi, yoklama_birimi, olusturuldu)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as (Oturum & { courses: Ders }) | null
}

const OTURUM_ALANLARI = 'id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum, telefon_modu, hafta_no'

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
/**
 * Bu şubede aynı akışla yapılmış son oturumun kaldığı adım (varsa). Böylece hoca bir sonraki hafta
 * "nerede kalmıştık" diye aramadan, akışı kaldığı yerden sürdürür. Kahoot geçişlerinin gizli (⚡) akışları sayılmaz.
 */
export async function kalinanAdim(dersId: string, akisId: string): Promise<{ adimId: string; sira: number; toplam: number } | null> {
  const { data } = await supabase
    .from('sessions')
    .select('aktif_adim')
    .eq('course_id', dersId)
    .eq('lesson_id', akisId)
    .not('aktif_adim', 'is', null)
    .order('basladi', { ascending: false })
    .limit(1)
  const adimId = data?.[0]?.aktif_adim as string | undefined
  if (!adimId) return null
  const { data: adimlar } = await supabase.from('lesson_steps').select('id').eq('lesson_id', akisId).order('sira').order('id')
  const idler = (adimlar ?? []).map((a) => a.id as string)
  const i = idler.indexOf(adimId)
  // İlk adımda kalınmışsa ya da adım silinmişse devam edilecek bir şey yoktur
  return i > 0 ? { adimId, sira: i + 1, toplam: idler.length } : null
}

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
    // Aynı akışın önceki oturumu yarım kaldıysa kaldığı adımdan başlanır
    const kalinan = await kalinanAdim(dersId, akisId).catch(() => null)
    if (kalinan) ilkAdim = kalinan.adimId
  }
  const { data, error } = await supabase
    .from('sessions')
    .insert({ course_id: dersId, baslik: baslik.trim() || null, lesson_id: akisId, aktif_adim: ilkAdim, yoklama_acik: yoklamaAl, telefon_modu: telefonModu })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/** Öğrencilerin misafir olarak başka şubelerde katıldığı oturumlar (asıl şubenin yoklamasına yazılmak üzere). */
export async function misafirKatilimlari(ogrenciler: Ogrenci[]): Promise<MisafirKatilim[]> {
  const evler = ogrenciler.filter((o) => !o.asil_id).map((o) => o.id)
  if (evler.length === 0) return []
  const misafirler = await parcaliCek<{ id: string; asil_id: string }>(evler, (parca, bas) =>
    supabase.from('students').select('id, asil_id').in('asil_id', parca).order('id').range(bas, bas + SAYFA - 1),
  )
  if (misafirler.length === 0) return []
  const asil = new Map(misafirler.map((m) => [m.id, m.asil_id]))
  const katilimlar = await parcaliCek<{ session_id: string; student_id: string; zaman: string }>(misafirler.map((m) => m.id), (parca, bas) =>
    supabase.from('attendance').select('session_id, student_id, zaman').in('student_id', parca).order('session_id').order('student_id').range(bas, bas + SAYFA - 1),
  )
  if (katilimlar.length === 0) return []
  const oturumlar = await parcaliCek<{ id: string; lesson_id: string | null }>([...new Set(katilimlar.map((k) => k.session_id))], (parca, bas) =>
    supabase.from('sessions').select('id, lesson_id').in('id', parca).order('id').range(bas, bas + SAYFA - 1),
  )
  const akis = new Map(oturumlar.map((o) => [o.id, o.lesson_id]))
  return katilimlar.map((k) => ({ asil_id: asil.get(k.student_id)!, lesson_id: akis.get(k.session_id) ?? null, zaman: k.zaman }))
}

/**
 * Şubenin bir yoklama haftasını açar ve oturumun kimliğini döndürür. O haftanın oturumu varsa (aynı gün yeniden açma dahil)
 * o kullanılır: yoklama yeniden açılır ve yeni gelenler aynı yoklamaya yazılır. Yoksa akışsız yeni bir oturum açılır; hoca
 * akışı sahneden seçer. Şubenin öbür açık oturumları kapanır.
 */
export async function haftaYoklamasiAc(dersId: string, haftaNo: number, birim: 'hafta' | 'ders' = 'hafta', telefonModu = false): Promise<string> {
  const { data: mevcut, error: e1 } = await supabase.from('sessions').select('id').eq('course_id', dersId).eq('hafta_no', haftaNo).maybeSingle()
  if (e1) throw e1
  let kapat = supabase.from('sessions').update({ yoklama_acik: false, bitti: new Date().toISOString() }).eq('course_id', dersId).is('bitti', null)
  if (mevcut) kapat = kapat.neq('id', mevcut.id as string)
  await kapat
  if (mevcut) {
    const { error } = await supabase.from('sessions').update({ yoklama_acik: true, bitti: null, telefon_modu: telefonModu }).eq('id', mevcut.id as string)
    if (error) throw error
    return mevcut.id as string
  }
  const { data, error } = await supabase
    .from('sessions')
    .insert({ course_id: dersId, hafta_no: haftaNo, baslik: `${haftaNo}. ${birim}`, yoklama_acik: true, telefon_modu: telefonModu })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
