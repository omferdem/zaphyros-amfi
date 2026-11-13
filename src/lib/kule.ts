// Kule Yarışı: takımlar blok blok kule yapar; her doğru cevap takımın üye başına ortalamasını yükseltir, en yüksek kule kazanır.
// Saf kurallar. Girdi: takim_goster (takım başına üye ve doğru sayısı) ve oynanan soru sayısı.

export interface KuleTakimi {
  takim: number
  uye: number
  dogru: number
}

export interface KuleSatiri {
  takim: number
  uye: number
  /** Kule yüksekliği: üye başına doğru cevap (takımlar eşit üyeli olmasa da adil) */
  blok: number
  /** Çizilecek tam blok sayısı (hedefte kesilir) */
  katlar: number
  sira: number
}

export interface KuleDurumu {
  hedef: number
  satirlar: KuleSatiri[]
  oynanan: number
  toplamSoru: number
  bitti: boolean
  /** Kazanan takım (bitmeden null) */
  kazanan: number | null
}

export function kuleHedefi(toplamSoru: number): number {
  return Math.max(5, Math.min(14, Math.round(toplamSoru * 0.6)))
}

export function kuleHesapla(takimlar: KuleTakimi[], oynanan: number, toplamSoru: number): KuleDurumu | null {
  if (toplamSoru <= 0 || takimlar.length < 2) return null
  const hedef = kuleHedefi(toplamSoru)
  const ham = takimlar.map((t) => ({ takim: t.takim, uye: t.uye, blok: t.uye > 0 ? t.dogru / t.uye : 0 }))
  const sirali = [...ham].sort((a, b) => b.blok - a.blok || a.takim - b.takim)
  const satirlar: KuleSatiri[] = ham.map((h) => ({
    ...h,
    katlar: Math.min(hedef, Math.floor(h.blok)),
    sira: sirali.findIndex((x) => x.takim === h.takim) + 1,
  }))
  const hedefeUlasan = sirali.find((x) => x.blok >= hedef)
  const bitti = !!hedefeUlasan || (oynanan >= toplamSoru && oynanan > 0)
  return { hedef, satirlar, oynanan, toplamSoru, bitti, kazanan: bitti ? sirali[0].takim : null }
}
