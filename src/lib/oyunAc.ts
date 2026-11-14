import { supabase } from './supabase'
import { OYUN_OLAYI, type OyunAnahtari } from './oyun'

/** Takımla oynanabilen oyunlar ve seçilebilir grup sayıları (halat çekme her zaman 2 takımdır). */
export const GRUPLU_OYUNLAR: OyunAnahtari[] = ['takim', 'kule']
export const GRUP_SAYILARI = [2, 3, 4, 5, 6] as const

/**
 * Yarışma kipini açar (anahtar verilirse) ya da bireysele döner (null). Önce öteki oyunların panelleri, takım ve hocayla yarış
 * kapatılır: perdede yalnızca seçilen oyun kalır. Takımlı oyunlarda grup sayısı verilebilir (varsayılan 3; halat 2).
 * Hata varsa false döner.
 */
export async function oyunuAc(oturumId: string, anahtar: OyunAnahtari | null, grup: number | null = null): Promise<boolean> {
  const takimli = anahtar === 'takim' || anahtar === 'halat' || anahtar === 'kule'
  // Seçilmeyen kipler kapanır (hata önemsenmez, zaten kapalı olabilir)
  if (!takimli) await supabase.rpc('takim_ayarla', { p_session: oturumId, p_anahtar: null, p_sayi: 0 })
  if (anahtar !== 'hoca') await supabase.rpc('hoca_yaris_ayarla', { p_session: oturumId, p_anahtar: null, p_acik: false })
  if (anahtar === null) {
    window.dispatchEvent(new CustomEvent(OYUN_OLAYI, { detail: { oyun: '__kapat' } }))
    return true
  }
  let hata = false
  if (takimli) {
    const sayi = anahtar === 'halat' ? 2 : Math.min(6, Math.max(2, grup ?? 3))
    const { data, error } = await supabase.rpc('takim_ayarla', { p_session: oturumId, p_anahtar: null, p_sayi: sayi })
    hata = !!error || !!(data as { hata?: string })?.hata
  } else if (anahtar === 'hoca') {
    const { data, error } = await supabase.rpc('hoca_yaris_ayarla', { p_session: oturumId, p_anahtar: null, p_acik: true })
    hata = !!error || !!(data as { hata?: string })?.hata
  }
  if (hata) return false
  // Olay yalnızca seçilen oyunu açar; öteki paneller kendilerini kapatır
  window.dispatchEvent(new CustomEvent(OYUN_OLAYI, { detail: { oyun: anahtar } }))
  return true
}
