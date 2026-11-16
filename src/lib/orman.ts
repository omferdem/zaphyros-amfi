// Orman'dan eve dönüş: öğrenciler ormanda kaybolmuştur, patikada adım adım eve yürürler.
// Saf kurallar (ekran ve veritabanı bilmez); zombi_goster (0023) sonuçlarından hesaplanır. Sahne henüz yok.
import type { ZombiOyuncusu, ZombiSorusu } from './zombi'
import { ZORLUK, type Zorluk } from './zorluk'

export const ORMAN_KALBI = 3
export const FENER_SERISI = 3

/** Patikanın adım sayısı: soru sayısının %60'ı (en az 3). */
export function patikaUzunlugu(toplamSoru: number, zorluk: Zorluk = 'orta'): number {
  return Math.max(3, Math.round(toplamSoru * ZORLUK.ormanOrani[zorluk]))
}

export type OrmanDurumu = 'yolda' | 'evde' | 'kapildi'

export interface OrmanOyuncusu {
  ad: string
  adim: number
  kalp: number
  durum: OrmanDurumu
  /** Eve vardığı ya da kurda yakalandığı soru (1'den) */
  bittigiSoru: number | null
  /** Fener bulup kalp kazandığı sayı */
  fener: number
}

export interface OrmanSonucu {
  patika: number
  oynanan: number
  toplamSoru: number
  oyuncular: OrmanOyuncusu[]
  /** Varış sırası (önce erken varan, sonra çok adım atan) */
  siralama: OrmanOyuncusu[]
  /** Gökyüzü karanlığı 0-1: sorular ilerledikçe kararır */
  karanlik: number
  /** Kalbi 1'e düşen oyuncu var: kurt gözleri ve uluma */
  kurtGozu: boolean
  bitti: boolean
}

/** Her doğru 1 adım; yanlış ya da cevapsız 1 kalp götürür; 3 kalbi biten kurda yakalanır; üst üste 3 doğru fener bulur (+1 kalp, en çok 3). */
export function ormanHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[], zorluk: Zorluk = 'orta'): OrmanSonucu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0 || oyuncular.length === 0) return null
  const patika = patikaUzunlugu(toplamSoru, zorluk)
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const liste: OrmanOyuncusu[] = oyuncular.map((o) => {
    let adim = 0
    let kalp = ORMAN_KALBI
    let seri = 0
    let fener = 0
    let durum: OrmanDurumu = 'yolda'
    let bittigiSoru: number | null = null
    acik.forEach((idx, k) => {
      if (durum !== 'yolda') return
      if (o.sonuc[idx] === 1) {
        adim++
        seri++
        if (seri % FENER_SERISI === 0 && kalp < ORMAN_KALBI) {
          kalp++
          fener++
        }
        if (adim >= patika) {
          durum = 'evde'
          bittigiSoru = k + 1
        }
      } else {
        seri = 0
        kalp--
        if (kalp <= 0) {
          durum = 'kapildi'
          bittigiSoru = k + 1
        }
      }
    })
    return { ad: o.ad, adim, kalp, durum, bittigiSoru, fener }
  })
  const siralama = [...liste].sort((a, b) => {
    if ((a.durum === 'evde') !== (b.durum === 'evde')) return a.durum === 'evde' ? -1 : 1
    if (a.durum === 'evde') return (a.bittigiSoru ?? 0) - (b.bittigiSoru ?? 0) || a.adim - b.adim
    return b.adim - a.adim
  })
  const oynanan = acik.length
  return {
    patika,
    oynanan,
    toplamSoru,
    oyuncular: liste,
    siralama,
    karanlik: Math.min(1, oynanan / toplamSoru),
    kurtGozu: liste.some((o) => o.durum === 'yolda' && o.kalp === 1),
    bitti: oynanan >= toplamSoru || liste.every((o) => o.durum !== 'yolda'),
  }
}
