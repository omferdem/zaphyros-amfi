// Sunumlar, ders akışları ve akış adımları için veri işlemleri (hoca tarafı).
import { supabase } from './supabase'
import type { Adim, Akis, Soru, Sunum } from './tipler'
import type { ZomrSorusu } from './zomr'
import type { PdfBelgesi } from './pdf'

const KOVA = 'sunumlar'
const GORSEL_KOVA = 'slayt-gorselleri'
const SUNUM_ALANLARI = 'id, subject_id, ad, kaynak, durum, sayfa_sayisi, metinler, gorseller_hazir, olusturuldu'
const ADIM_ALANLARI = 'id, lesson_id, sira, tur, presentation_id, sayfa_no, question_id'
const SORU_ALANLARI = 'id, subject_id, soru, dogru, yanlislar, sure_sn, ek, olusturuldu'

/** Telefon modunda öğrenciye giden sayfa görselinin yolu (veritabanı da aynı yolu üretir). */
export function gorselYolu(icerikId: string, sunumId: string, sayfaNo: number): string {
  return `${icerikId}/${sunumId}/${sayfaNo}`
}

/** Depodaki yol: ilk klasör ders içeriğinin kimliğidir (depo politikası buna bakar). */
export function sunumYolu(icerikId: string, sunumId: string): string {
  return `${icerikId}/${sunumId}.pdf`
}

export async function sunumlariGetir(icerikId: string): Promise<Sunum[]> {
  const { data, error } = await supabase
    .from('presentations')
    .select(SUNUM_ALANLARI)
    .eq('subject_id', icerikId)
    .order('olusturuldu', { ascending: false })
  if (error) throw error
  return data as Sunum[]
}

export async function sunumlariGetirIdIle(idler: string[]): Promise<Sunum[]> {
  if (idler.length === 0) return []
  const { data, error } = await supabase.from('presentations').select(SUNUM_ALANLARI).in('id', idler)
  if (error) throw error
  return data as Sunum[]
}

/** PDF'i görüntülemek için kısa süreli (6 saat) imzalı adres. */
export async function sunumAdresi(icerikId: string, sunumId: string): Promise<string> {
  const { data, error } = await supabase.storage.from(KOVA).createSignedUrl(sunumYolu(icerikId, sunumId), 6 * 3600)
  if (error || !data) throw error ?? new Error('adres alınamadı')
  return data.signedUrl
}

/**
 * PDF'i yükler: önce tarayıcıda açıp sayfa sayısını ve sayfa metinlerini çıkarır, dosyayı depoya,
 * kaydı tabloya yazar; sonra telefon modu için sayfa görsellerini hazırlar. Görseller hazırlanamazsa
 * sunum yine kullanılabilir (öğrenci metni görür); görseller sonra elle hazırlanabilir.
 */
export async function sunumYukle(icerikId: string, dosya: File, ad: string, durumBildir: (metin: string) => void): Promise<Sunum> {
  const { pdfAc, sayfaMetinleri } = await import('./pdf')
  durumBildir('Dosya okunuyor…')
  const veri = await dosya.arrayBuffer()
  // pdf.js veriyi işçiye aktarırken boşaltabilir; yükleme için ayrı bir kopya tutulur.
  const belge = await pdfAc(veri.slice(0))
  try {
    durumBildir(`${belge.numPages} sayfanın metni çıkarılıyor…`)
    const metinler = await sayfaMetinleri(belge)
    const sayfaSayisi = belge.numPages

    const id = crypto.randomUUID()
    durumBildir('Yükleniyor…')
    const { error: yuklemeHatasi } = await supabase.storage
      .from(KOVA)
      .upload(sunumYolu(icerikId, id), new Blob([veri], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
    if (yuklemeHatasi) throw yuklemeHatasi

    const { data, error } = await supabase
      .from('presentations')
      .insert({ id, subject_id: icerikId, ad: ad.trim().slice(0, 200) || 'Sunum', sayfa_sayisi: sayfaSayisi, metinler })
      .select(SUNUM_ALANLARI)
      .single()
    if (error) {
      await supabase.storage.from(KOVA).remove([sunumYolu(icerikId, id)])
      throw error
    }
    try {
      return await gorselleriHazirla(data as Sunum, durumBildir, belge)
    } catch {
      return data as Sunum
    }
  } finally {
    await belge.loadingTask.destroy()
  }
}

/**
 * Sunumun sayfa görsellerini üretip depoya yükler (telefon modu için). Açık bir belge verilmezse
 * PDF depodan açılır. Daha önce yüklenmiş görseller üzerine yazılır.
 */
export async function gorselleriHazirla(sunum: Sunum, durumBildir: (metin: string) => void, acikBelge?: PdfBelgesi): Promise<Sunum> {
  const { pdfAc, sayfaGorseliUret } = await import('./pdf')
  const belge = acikBelge ?? (await pdfAc(await sunumAdresi(sunum.subject_id, sunum.id)))
  try {
    for (let no = 1; no <= belge.numPages; no++) {
      durumBildir(`Telefon görselleri hazırlanıyor… ${no} / ${belge.numPages}`)
      const blob = await sayfaGorseliUret(belge, no)
      const { error } = await supabase.storage
        .from(GORSEL_KOVA)
        .upload(gorselYolu(sunum.subject_id, sunum.id, no), blob, { contentType: blob.type, cacheControl: '3600', upsert: true })
      if (error) throw error
    }
    const { data, error } = await supabase
      .from('presentations')
      .update({ gorseller_hazir: true })
      .eq('id', sunum.id)
      .select(SUNUM_ALANLARI)
      .single()
    if (error) throw error
    return data as Sunum
  } finally {
    if (!acikBelge) await belge.loadingTask.destroy()
  }
}

async function gorselleriSil(icerikId: string, sunumId: string): Promise<void> {
  const klasor = `${icerikId}/${sunumId}`
  const { data } = await supabase.storage.from(GORSEL_KOVA).list(klasor, { limit: 1000 })
  if (data?.length) await supabase.storage.from(GORSEL_KOVA).remove(data.map((f) => `${klasor}/${f.name}`))
}

/** Sunumu ve onu kullanan bütün akış adımlarını siler (PDF ve sayfa görselleri de depodan kalkar). */
export async function sunumSil(sunum: Sunum): Promise<void> {
  const { error } = await supabase.from('presentations').delete().eq('id', sunum.id)
  if (error) throw error
  await supabase.storage.from(KOVA).remove([sunumYolu(sunum.subject_id, sunum.id)])
  await gorselleriSil(sunum.subject_id, sunum.id)
}

/**
 * Hiçbir döneme bağlı olmayan ders içeriğini siler: önce sunum dosyaları ve görselleri depodan, sonra
 * kayıtlar (akışlar ve sunumlar içerikle birlikte silinir). Dersi olan içerik veritabanınca korunur.
 */
export async function icerikSil(icerikId: string): Promise<void> {
  const sunumlar = await sunumlariGetir(icerikId)
  if (sunumlar.length) await supabase.storage.from(KOVA).remove(sunumlar.map((s) => sunumYolu(icerikId, s.id)))
  for (const s of sunumlar) await gorselleriSil(icerikId, s.id)
  const { error } = await supabase.from('subjects').delete().eq('id', icerikId)
  if (error) throw error
}

export async function akislariGetir(icerikId: string): Promise<Akis[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, subject_id, ad, sira, olusturuldu')
    .eq('subject_id', icerikId)
    .order('sira')
    .order('olusturuldu')
  if (error) throw error
  return data as Akis[]
}

export async function akisGetir(id: string): Promise<Akis | null> {
  const { data, error } = await supabase.from('lessons').select('id, subject_id, ad, sira, olusturuldu').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Akis | null
}

export async function akisOlustur(icerikId: string, ad: string): Promise<Akis> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ subject_id: icerikId, ad: ad.trim().slice(0, 200) })
    .select('id, subject_id, ad, sira, olusturuldu')
    .single()
  if (error) throw error
  return data as Akis
}

export async function adimlariGetir(akisId: string): Promise<Adim[]> {
  const { data, error } = await supabase
    .from('lesson_steps')
    .select(ADIM_ALANLARI)
    .eq('lesson_id', akisId)
    .order('sira')
    .order('id')
  if (error) throw error
  return data as Adim[]
}

/** Adımları akışın sonuna ekler. */
export async function adimlarEkle(
  akisId: string,
  mevcutSayi: number,
  yeni: { tur: Adim['tur']; presentation_id?: string; sayfa_no?: number; question_id?: string }[],
): Promise<void> {
  if (yeni.length === 0) return
  const { error } = await supabase
    .from('lesson_steps')
    .insert(yeni.map((a, i) => ({ lesson_id: akisId, sira: mevcutSayi + i + 1, ...a })))
  if (error) throw error
}

export async function akisSirala(akisId: string, idler: string[]): Promise<void> {
  const { error } = await supabase.rpc('akis_sirala', { p_lesson: akisId, p_adimlar: idler })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Soru bankası (ders içeriğine bağlı)

export async function sorulariGetir(icerikId: string): Promise<Soru[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(SORU_ALANLARI)
    .eq('subject_id', icerikId)
    .order('olusturuldu')
    .order('id')
  if (error) throw error
  return data as Soru[]
}

export async function sorulariGetirIdIle(idler: string[]): Promise<Soru[]> {
  if (idler.length === 0) return []
  const { data, error } = await supabase.from('questions').select(SORU_ALANLARI).in('id', idler)
  if (error) throw error
  return data as Soru[]
}

export async function sorulariEkle(icerikId: string, sorular: ZomrSorusu[], sureSn: number): Promise<void> {
  if (sorular.length === 0) return
  // Aynı anda eklenen sorular dosyadaki sırasını korusun diye her birine bir milisaniye ileri zaman verilir.
  const simdi = Date.now()
  const { error } = await supabase.from('questions').insert(
    sorular.map((s, i) => ({
      subject_id: icerikId,
      soru: s.soru,
      dogru: s.dogru,
      yanlislar: s.yanlislar,
      ek: s.ek,
      sure_sn: sureSn,
      olusturuldu: new Date(simdi + i).toISOString(),
    })),
  )
  if (error) throw error
}
