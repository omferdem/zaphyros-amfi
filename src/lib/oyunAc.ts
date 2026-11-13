import { supabase } from './supabase'
import { OYUN_OLAYI, type OyunAnahtari } from './oyun'

/**
 * Yarışma kipini açar (anahtar verilirse) ya da bireysele döner (null): takım/halat için takım sayısı, hocayla yarış için skor,
 * merdiven için panel olayı. Hata varsa false döner.
 */
export async function oyunuAc(oturumId: string, anahtar: OyunAnahtari | null): Promise<boolean> {
  let hata = false
  if (anahtar === null) {
    // Bireysele dönüş: takım ve hocayla yarış kapanır (hata önemsenmez, zaten kapalı olabilir)
    await supabase.rpc('takim_ayarla', { p_session: oturumId, p_anahtar: null, p_sayi: 0 })
    await supabase.rpc('hoca_yaris_ayarla', { p_session: oturumId, p_anahtar: null, p_acik: false })
    return true
  }
  if (anahtar === 'takim' || anahtar === 'halat') {
    const { data, error } = await supabase.rpc('takim_ayarla', { p_session: oturumId, p_anahtar: null, p_sayi: anahtar === 'halat' ? 2 : 3 })
    hata = !!error || !!(data as { hata?: string })?.hata
  } else if (anahtar === 'hoca') {
    const { data, error } = await supabase.rpc('hoca_yaris_ayarla', { p_session: oturumId, p_anahtar: null, p_acik: true })
    hata = !!error || !!(data as { hata?: string })?.hata
  }
  if (hata) return false
  window.dispatchEvent(new CustomEvent(OYUN_OLAYI, { detail: { oyun: anahtar } }))
  return true
}
