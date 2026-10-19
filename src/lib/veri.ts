import { supabase } from './supabase'
import type { Ders, Ogrenci, Oturum, Yoklama } from './tipler'

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

export async function oturumYoklamalari(oturumId: string): Promise<Yoklama[]> {
  return dersYoklamalari([oturumId])
}

export async function dersGetir(id: string): Promise<Ders | null> {
  const { data, error } = await supabase.from('courses').select('id, ad, kod, donem, olusturuldu').eq('id', id).maybeSingle()
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
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim')
    .eq('course_id', dersId)
    .order('basladi', { ascending: false })
  if (error) throw error
  return data as Oturum[]
}

export async function oturumGetir(id: string): Promise<(Oturum & { courses: Ders }) | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, courses(id, ad, kod, donem, olusturuldu)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as (Oturum & { courses: Ders }) | null
}

/**
 * Yeni oturum açar; aynı dersin hâlâ açık kalmış eski oturumlarını kapatır.
 * Akış seçildiyse perdeye akışın ilk adımı gelir.
 */
export async function oturumBaslat(dersId: string, baslik: string, akisId: string | null = null): Promise<string> {
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
    .insert({ course_id: dersId, baslik: baslik.trim() || null, lesson_id: akisId, aktif_adim: ilkAdim })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
