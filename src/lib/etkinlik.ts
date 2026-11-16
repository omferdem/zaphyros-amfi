import { supabase } from './supabase'

/** Anasayfadaki üç etkinlik bölümü. Her birinin soru bankası gizli bir derse bağlıdır. */
export type EtkinlikBolumu = 'zapoot' | 'oyun' | 'quiz'

export const BOLUMLER: Record<EtkinlikBolumu, { ad: string; emoji: string; aciklama: string }> = {
  zapoot: { ad: 'Zapoot', emoji: '⚡', aciklama: 'Hızlı soru serileri: bireysel ya da önerilen oyun moduyla.' },
  oyun: { ad: 'Oyunlar', emoji: '🎮', aciklama: 'Ejderha, halat çekme, merdiven gibi sınıf oyunları.' },
  quiz: { ad: 'Quiz', emoji: '📝', aciklama: 'Süreli, ciddi quiz; öğrenci kodla girer, sonuç hocaya kalır.' },
}

/** Gizli etkinlik derslerinin dönem metni ve ders kodu öneki; Derslerim listelerinde gösterilmez. */
export const GIZLI_DONEM = '__etkinlik'
export const GIZLI_KOD_ONEKI = '__etkinlik_'

export interface EtkinlikSatiri {
  id: string
  course_id: string
  ad: string
  paket: string
  mod: string
  adet: number
  zorluk: 'kolay' | 'orta' | 'zor'
  sira: number
}

/** Gizli etkinlik dersi (ve onun soru bankası) kimlikleri; yoksa ilk kullanımda açılır. */
export async function etkinlikAlani(bolum: EtkinlikBolumu): Promise<{ courseId: string; icerikId: string }> {
  const kod = GIZLI_KOD_ONEKI + bolum
  const bul = await supabase.from('courses').select('id, subject_id').eq('kod', kod).limit(1)
  if (bul.error) throw bul.error
  const var_ = bul.data?.[0] as { id: string; subject_id: string } | undefined
  if (var_) return { courseId: var_.id, icerikId: var_.subject_id }
  const { data, error } = await supabase
    .from('courses')
    .insert({ ad: `Etkinlik: ${BOLUMLER[bolum].ad}`, kod, donem: GIZLI_DONEM })
    .select('id, subject_id')
    .single()
  if (error || !data) throw error ?? new Error('etkinlik dersi acilamadi')
  const d = data as { id: string; subject_id: string }
  return { courseId: d.id, icerikId: d.subject_id }
}

export async function etkinlikleriGetir(courseId: string): Promise<EtkinlikSatiri[]> {
  const { data, error } = await supabase
    .from('etkinlikler')
    .select('id, course_id, ad, paket, mod, adet, zorluk, sira')
    .eq('course_id', courseId)
    .order('sira')
    .order('olusturuldu')
  if (error) throw error
  return data as EtkinlikSatiri[]
}

export async function etkinlikEkle(courseId: string, alanlar: Omit<EtkinlikSatiri, 'id' | 'course_id' | 'sira'>, sira: number): Promise<void> {
  const { error } = await supabase.from('etkinlikler').insert({ course_id: courseId, ...alanlar, sira })
  if (error) throw error
}

export async function etkinlikGuncelle(id: string, alanlar: Partial<Omit<EtkinlikSatiri, 'id' | 'course_id'>>): Promise<void> {
  const { error } = await supabase.from('etkinlikler').update(alanlar).eq('id', id)
  if (error) throw error
}

export async function etkinlikSil(id: string): Promise<void> {
  const { error } = await supabase.from('etkinlikler').delete().eq('id', id)
  if (error) throw error
}
