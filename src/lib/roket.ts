// Roket Yarışı: her öğrenci bir roket; doğru cevap roketi ileri iter, ilk varan podyuma çıkar.
// Saf kurallar (ekran ve veritabanı bilmez); zombi_goster (0023) sonuçlarından hesaplanır.
import type { ZombiOyuncusu, ZombiSorusu } from './zombi'

export interface RoketOyuncusu {
  ad: string
  /** Doğru cevap sayısı (bitiş çizgisinde durur) */
  ilerleme: number
  /** Bitiş çizgisine ulaştığı soru sırası (1'den); ulaşmadıysa null */
  bitirdi: number | null
}

export interface RoketDurumu {
  /** Bitiş çizgisi: gereken doğru cevap sayısı */
  hedef: number
  toplamSoru: number
  oynanan: number
  oyuncular: RoketOyuncusu[]
  /** Sıralı podyum (önce bitirenler, sonra ilerlemeye göre) */
  siralama: RoketOyuncusu[]
  bitirenler: number
  bitti: boolean
}

export function roketHedefi(toplamSoru: number): number {
  return Math.max(5, Math.min(15, Math.round(toplamSoru * 0.6)))
}

export function roketHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): RoketDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0) return null
  const hedef = roketHedefi(toplamSoru)
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const liste: RoketOyuncusu[] = oyuncular.map((o) => {
    let ilerleme = 0
    let bitirdi: number | null = null
    acik.forEach((idx, k) => {
      if (bitirdi !== null) return
      if (o.sonuc[idx] === 1) ilerleme++
      if (ilerleme >= hedef) bitirdi = k + 1
    })
    return { ad: o.ad, ilerleme, bitirdi }
  })
  const siralama = [...liste].sort((a, b) => {
    if (a.bitirdi !== null || b.bitirdi !== null) {
      if (a.bitirdi === null) return 1
      if (b.bitirdi === null) return -1
      return a.bitirdi - b.bitirdi
    }
    return b.ilerleme - a.ilerleme
  })
  return {
    hedef,
    toplamSoru,
    oynanan: acik.length,
    oyuncular: liste,
    siralama,
    bitirenler: liste.filter((o) => o.bitirdi !== null).length,
    bitti: acik.length >= toplamSoru,
  }
}
