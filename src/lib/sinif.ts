// Sınıf etkileşimi (parmak kaldır, soru sor, sıkıldım) için saf tipler ve kurallar.

export interface SinifOlayi {
  id: string
  tur: 'el' | 'soru' | 'sikildim'
  ad: string
  metin: string
  durum: 'bekliyor' | 'cekildi' | 'tamam'
  zaman: string
}

export interface SinifDurumu {
  olaylar: SinifOlayi[]
  mola: boolean
  cekilis: number
  katilan: number
}

export type SinifKomutu = 'soru_tamam' | 'el_indir' | 'eller_indir' | 'mola_ac' | 'cekilis' | 'cekilis_anlatti' | 'derse_don'

/** Sınıfın bu oranı sıkıldım derse perdede uyarı çıkar (en az 2 kişi). */
export const SIKILDI_ORANI = 0.25

export function sikildiSayisi(d: SinifDurumu): number {
  return d.olaylar.filter((o) => o.tur === 'sikildim').length
}

/** Mola sırasında uyarı çıkmaz; sıkıldım diyenler, katılanların yüzde 25'ine (en az 2 kişiye) ulaşınca çıkar. */
export function sikildiUyarisi(d: SinifDurumu): boolean {
  return !d.mola && sikildiSayisi(d) >= Math.max(2, Math.ceil(SIKILDI_ORANI * d.katilan))
}
