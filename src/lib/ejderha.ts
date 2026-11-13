// Ejderha Savaşı: bütün sınıf birlikte bir ejderhaya karşı savaşır. Doğru cevap ejderhaya vurur; yanlış ya da cevapsız
// kalan kahraman bir can kaybeder, canı bitenler savaş dışı kalır. Saf kurallar (ekran ve veritabanı bilmez).
import type { ZombiOyuncusu, ZombiSorusu } from './zombi'

export const KAHRAMAN_CANI = 3
/** Ejderhanın canı: oyuncu sayısı × soru sayısı × bu oran. Yani sınıf ortalamada yarıdan azını bilse bile kazanabilir. */
export const EJDERHA_ORANI = 0.45

export interface Kahraman {
  ad: string
  kalan: number
  /** Savaş dışı kaldığı soru sırası (1'den); hâlâ ayaktaysa null */
  dustu: number | null
  vurus: number
}

export interface EjderhaDurumu {
  enCok: number
  can: number
  /** Her oynanan soruda ejderhaya vurulan toplam hasar */
  hasarlar: number[]
  kahramanlar: Kahraman[]
  ayakta: number
  oynanan: number
  toplamSoru: number
  bitti: boolean
  kazandi: boolean
}

export function ejderhaHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): EjderhaDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0 || oyuncular.length === 0) return null
  const enCok = Math.max(1, Math.ceil(oyuncular.length * toplamSoru * EJDERHA_ORANI))
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const kahramanlar: Kahraman[] = oyuncular.map((o) => ({ ad: o.ad, kalan: KAHRAMAN_CANI, dustu: null, vurus: 0 }))
  const hasarlar: number[] = []
  let toplamHasar = 0
  let bittigiSoru: number | null = null
  acik.forEach((idx, k) => {
    if (bittigiSoru !== null) return
    let hasar = 0
    oyuncular.forEach((o, j) => {
      const h = kahramanlar[j]
      if (h.dustu !== null) return
      if (o.sonuc[idx] === 1) {
        hasar++
        h.vurus++
      } else {
        h.kalan--
        if (h.kalan <= 0) h.dustu = k + 1
      }
    })
    toplamHasar += hasar
    hasarlar.push(hasar)
    if (toplamHasar >= enCok) bittigiSoru = k + 1
  })
  const can = Math.max(0, enCok - toplamHasar)
  const kazandi = can === 0
  return {
    enCok,
    can,
    hasarlar,
    kahramanlar,
    ayakta: kahramanlar.filter((h) => h.dustu === null).length,
    oynanan: acik.length,
    toplamSoru,
    bitti: kazandi || acik.length >= toplamSoru,
    kazandi,
  }
}
