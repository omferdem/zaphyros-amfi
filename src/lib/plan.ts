// Dönemler, şubeler ve hafta planı için veri işlemleri (hoca tarafı).
import { supabase } from './supabase'
import type { Ders, Donem, PlanSatiri } from './tipler'

const DERS_ALANLARI = 'id, subject_id, term_id, ad, kod, donem, sube, olusturuldu'

export type DersSatiri = Ders & { students: { count: number }[] }

/** Dönemler yeniden eskiye (başlangıç tarihine göre). Gelecek dönemler en üstte görünür. */
export async function donemleriGetir(): Promise<Donem[]> {
  const { data, error } = await supabase.from('terms').select('id, ad, baslangic').order('baslangic', { ascending: false })
  if (error) throw error
  return data as Donem[]
}

export async function donemDersleri(donemId: string): Promise<DersSatiri[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(`${DERS_ALANLARI}, students(count)`)
    .eq('term_id', donemId)
    .order('ad')
    .order('sube', { nullsFirst: true })
  if (error) throw error
  return data as unknown as DersSatiri[]
}

/** Aynı içeriğin (dersin) bir dönemdeki şubeleri. */
export async function subeleriGetir(donemId: string, icerikId: string): Promise<DersSatiri[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(`${DERS_ALANLARI}, students(count)`)
    .eq('term_id', donemId)
    .eq('subject_id', icerikId)
    .order('sube', { nullsFirst: true })
  if (error) throw error
  return data as unknown as DersSatiri[]
}

/** Yeni dönem açar. Kaynak dönem verilirse ders ve şube yapısı kopyalanır; sınıf listeleri boş başlar. */
export async function donemiPlanla(ad: string, baslangic: string, kaynakId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('donemi_planla', { p_ad: ad, p_baslangic: baslangic, p_kaynak: kaynakId })
  if (error) throw error
  return data as string
}

export async function donemAdiniDegistir(donemId: string, ad: string): Promise<void> {
  const { error } = await supabase.from('terms').update({ ad: ad.trim() }).eq('id', donemId)
  if (error) throw error
}

export async function bosDonemiSil(donemId: string): Promise<void> {
  const { error } = await supabase.from('terms').delete().eq('id', donemId)
  if (error) throw error
}

/**
 * Bir dersin şubelerini açar. Şube adları verilmezse şubesiz tek ders açılır. İçerik verilmezse
 * dersin adıyla yeni içerik açılır (veritabanı yapar).
 */
export async function subeleriAc(args: {
  donemId: string
  ad: string
  kod: string | null
  icerikId: string | null
  subeler: string[]
}): Promise<void> {
  const { donemId, ad, kod, icerikId, subeler } = args
  const adlar = subeler.length ? subeler : [null]
  // İlk ders içeriği kendisi açabilir; sonraki şubeler aynı içeriğe bağlanır.
  let icerik = icerikId
  for (const sube of adlar) {
    const { data, error } = await supabase
      .from('courses')
      .insert({ ad: ad.trim(), kod: kod?.trim() || null, term_id: donemId, sube, subject_id: icerik })
      .select('subject_id')
      .single()
    if (error) throw error
    icerik = (data as { subject_id: string }).subject_id
  }
}

export async function dersiDuzenle(dersId: string, alanlar: { ad: string; kod: string | null; sube: string | null }): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ ad: alanlar.ad.trim(), kod: alanlar.kod?.trim() || null, sube: alanlar.sube?.trim() || null })
    .eq('id', dersId)
  if (error) throw error
}

/** Dönemdeki bir içeriğin şubelerinde akışla başlatılmış oturumlar (şube x hafta özeti). */
export async function haftaPlaniGetir(donemId: string, icerikId: string): Promise<PlanSatiri[]> {
  const { data, error } = await supabase.rpc('hafta_plani', { p_term: donemId, p_subject: icerikId })
  if (error) throw error
  return (data as { course_id: string; lesson_id: string; oturum_id: string; basladi: string; katilan: number; mevcut: number }[]).map((r) => ({
    ...r,
    katilan: Number(r.katilan),
    mevcut: Number(r.mevcut),
  }))
}

export async function akislariSirala(icerikId: string, idler: string[]): Promise<void> {
  const { error } = await supabase.rpc('akislari_sirala', { p_subject: icerikId, p_akislar: idler })
  if (error) throw error
}

/** Şube adı yoksa: tek şubeli derste "Tek şube", çok şubeli derste "Adsız şube". */
export function subeEtiketi(sube: string | null, toplam: number): string {
  return sube?.trim() || (toplam > 1 ? 'Adsız şube' : 'Tek şube')
}

/** Şubenin görünen adı: "Mantık (A şubesi)" ya da yalnızca "Mantık". */
export function subeAdi(d: { ad: string; sube: string | null }): string {
  return d.sube?.trim() ? `${d.ad} · ${d.sube.trim()}` : d.ad
}
