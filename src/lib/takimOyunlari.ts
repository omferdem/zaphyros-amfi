// Takım oyunlarının (halat çekme, kule) soru bazlı kuralları. Girdi: takim_soru_ozeti (0039) çıktısı. Saf fonksiyonlar, birim testli.
import type { KuleDurumu, KuleSatiri } from './kule'

export interface TakimSoruSayimi {
  dogru: number
  yanlis: number
}
export interface TakimOzeti {
  sayi: number
  sorular: { adim: string; sira: number; acildi: boolean }[]
  takimlar: { takim: number; uye: number; sorular: TakimSoruSayimi[] }[]
}

/** Halat çekmede bir sorunun etkisi: kaydırma katsayısı. */
export const HALAT_KATSAYISI = 35

/** Takım gücü G = (doğru − 0,5 × yanlış − 0,25 × cevapsız) / üye. Cevapsız = üye − doğru − yanlış. */
export function takimGucu(s: TakimSoruSayimi, uye: number): number {
  if (uye <= 0) return 0
  const bos = Math.max(0, uye - s.dogru - s.yanlis)
  return (s.dogru - 0.5 * s.yanlis - 0.25 * bos) / uye
}

export interface HalatSonucu {
  /** Halat konumu: -100 (1. takım kazandı) ile +100 (2. takım kazandı) */
  p: number
  /** -1 ile 1 arası (p / 100); mevcut halat çizimiyle uyumlu */
  konum: number
  kazanan: 1 | 2 | null
  /** Halatın kayma geçmişi (her açılan soru sonrası p) */
  gecmis: number[]
  oynanan: number
  bitti: boolean
}

const BOS: TakimSoruSayimi = { dogru: 0, yanlis: 0 }

/**
 * Halat: her açılan soruda ΔP = 35 × (G₂ − G₁). 1. takım öndeyse P negatiftir. |P| ≥ 100 olunca o takım kazanır;
 * sorular bitince halatı kendi tarafında tutan kazanır.
 */
export function halatTurHesapla(o: TakimOzeti): HalatSonucu | null {
  const bir = o.takimlar.find((t) => t.takim === 1)
  const iki = o.takimlar.find((t) => t.takim === 2)
  if (!bir || !iki || o.sorular.length === 0) return null
  let p = 0
  const gecmis: number[] = []
  let kazanan: 1 | 2 | null = null
  let oynanan = 0
  o.sorular.forEach((s, i) => {
    if (!s.acildi || kazanan) return
    oynanan++
    p += HALAT_KATSAYISI * (takimGucu(iki.sorular[i] ?? BOS, iki.uye) - takimGucu(bir.sorular[i] ?? BOS, bir.uye))
    p = Math.max(-100, Math.min(100, p))
    gecmis.push(p)
    if (p <= -100) kazanan = 1
    else if (p >= 100) kazanan = 2
  })
  const bitti = kazanan !== null || (oynanan >= o.sorular.length && oynanan > 0)
  if (!kazanan && bitti && p !== 0) kazanan = p < 0 ? 1 : 2
  return { p, konum: p / 100, kazanan, gecmis, oynanan, bitti }
}

/** Kule hedefi: soru sayısı × 1,5 blok (en az 4). */
export function kuleBlokHedefi(toplamSoru: number): number {
  return Math.max(4, Math.round(toplamSoru * 1.5))
}

/** Bir soruda takımın ekleyeceği blok: doğru oranı %0-24: 0, %25-49: 1, %50-74: 2, %75-100: 3. */
export function soruBlogu(dogru: number, uye: number): number {
  if (uye <= 0) return 0
  const oran = dogru / uye
  return oran >= 0.75 ? 3 : oran >= 0.5 ? 2 : oran >= 0.25 ? 1 : 0
}

/**
 * Kule: her soruda takım doğru oranına göre 0-3 blok ekler; takımın yarısından fazlası doğru bilmezse rüzgâr esip en üst blok düşer.
 * Hedefe ilk ulaşan kazanır; sorular biterse en yüksek kule kazanır. Çıktı mevcut kule sahnesinin beklediği biçimdedir.
 */
export function kuleTurHesapla(o: TakimOzeti): KuleDurumu | null {
  if (o.sorular.length === 0 || o.takimlar.length < 2) return null
  const hedef = kuleBlokHedefi(o.sorular.length)
  const yukseklik = new Map<number, number>(o.takimlar.map((t) => [t.takim, 0]))
  let kazanan: number | null = null
  let oynanan = 0
  o.sorular.forEach((s, i) => {
    if (!s.acildi || kazanan !== null) return
    oynanan++
    const ulasanlar: { takim: number; y: number }[] = []
    for (const t of o.takimlar) {
      const c = t.sorular[i] ?? BOS
      let y = (yukseklik.get(t.takim) ?? 0) + soruBlogu(c.dogru, t.uye)
      if (t.uye > 0 && t.uye - c.dogru > t.uye / 2) y = Math.max(0, y - 1)
      yukseklik.set(t.takim, Math.min(hedef, y))
      if (y >= hedef) ulasanlar.push({ takim: t.takim, y })
    }
    if (ulasanlar.length > 0) kazanan = ulasanlar.sort((a, b) => b.y - a.y || a.takim - b.takim)[0].takim
  })
  const sirali = [...o.takimlar].sort((a, b) => (yukseklik.get(b.takim) ?? 0) - (yukseklik.get(a.takim) ?? 0) || a.takim - b.takim)
  const satirlar: KuleSatiri[] = o.takimlar.map((t) => ({
    takim: t.takim,
    uye: t.uye,
    blok: yukseklik.get(t.takim) ?? 0,
    katlar: Math.min(hedef, yukseklik.get(t.takim) ?? 0),
    sira: sirali.findIndex((x) => x.takim === t.takim) + 1,
  }))
  const bitti = kazanan !== null || (oynanan >= o.sorular.length && oynanan > 0)
  return { hedef, satirlar, oynanan, toplamSoru: o.sorular.length, bitti, kazanan: bitti ? (kazanan ?? sirali[0].takim) : null }
}
