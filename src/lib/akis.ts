// Sunumlar, ders akışları ve akış adımları için veri işlemleri (hoca tarafı).
import { supabase } from './supabase'
import type { Adim, Akis, Sunum } from './tipler'

const KOVA = 'sunumlar'
const SUNUM_ALANLARI = 'id, subject_id, ad, kaynak, durum, sayfa_sayisi, metinler, olusturuldu'
const ADIM_ALANLARI = 'id, lesson_id, sira, tur, presentation_id, sayfa_no'

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
 * PDF'i yükler: önce tarayıcıda açıp sayfa sayısını ve sayfa metinlerini çıkarır,
 * sonra dosyayı depoya, kaydı tabloya yazar.
 */
export async function sunumYukle(icerikId: string, dosya: File, ad: string, durumBildir: (metin: string) => void): Promise<Sunum> {
  const { pdfAc, sayfaMetinleri } = await import('./pdf')
  durumBildir('Dosya okunuyor…')
  const veri = await dosya.arrayBuffer()
  // pdf.js veriyi işçiye aktarırken boşaltabilir; yükleme için ayrı bir kopya tutulur.
  const belge = await pdfAc(veri.slice(0))
  durumBildir(`${belge.numPages} sayfanın metni çıkarılıyor…`)
  const metinler = await sayfaMetinleri(belge)
  const sayfaSayisi = belge.numPages
  await belge.loadingTask.destroy()

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
  return data as Sunum
}

/** Sunumu ve onu kullanan bütün akış adımlarını siler. */
export async function sunumSil(sunum: Sunum): Promise<void> {
  const { error } = await supabase.from('presentations').delete().eq('id', sunum.id)
  if (error) throw error
  await supabase.storage.from(KOVA).remove([sunumYolu(sunum.subject_id, sunum.id)])
}

/**
 * Hiçbir döneme bağlı olmayan ders içeriğini siler: önce sunum dosyaları depodan, sonra kayıtlar
 * (akışlar ve sunumlar içerikle birlikte silinir). Dersi olan içerik veritabanınca korunur.
 */
export async function icerikSil(icerikId: string): Promise<void> {
  const sunumlar = await sunumlariGetir(icerikId)
  if (sunumlar.length) await supabase.storage.from(KOVA).remove(sunumlar.map((s) => sunumYolu(icerikId, s.id)))
  const { error } = await supabase.from('subjects').delete().eq('id', icerikId)
  if (error) throw error
}

export async function akislariGetir(icerikId: string): Promise<Akis[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, subject_id, ad, olusturuldu')
    .eq('subject_id', icerikId)
    .order('olusturuldu')
  if (error) throw error
  return data as Akis[]
}

export async function akisGetir(id: string): Promise<Akis | null> {
  const { data, error } = await supabase.from('lessons').select('id, subject_id, ad, olusturuldu').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Akis | null
}

export async function akisOlustur(icerikId: string, ad: string): Promise<Akis> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ subject_id: icerikId, ad: ad.trim().slice(0, 200) })
    .select('id, subject_id, ad, olusturuldu')
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
  yeni: { tur: Adim['tur']; presentation_id?: string; sayfa_no?: number }[],
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
