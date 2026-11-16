// Oyun zorluğu: hoca oyunu başlatırken seçer. Zorlaştıkça sınıf rakibe (ejderha, zombiler, yol, çığ) karşı zayıflar.
// Saf tablo + oturuma bağlı küçük saklama (oturum içinde kalır, veritabanına yazılmaz).
import type { OyunAnahtari } from './oyun'

export type Zorluk = 'kolay' | 'orta' | 'zor'

export const ZORLUKLAR: { anahtar: Zorluk; ad: string }[] = [
  { anahtar: 'kolay', ad: '🌱 Kolay' },
  { anahtar: 'orta', ad: '⚖ Orta' },
  { anahtar: 'zor', ad: '🔥 Zor' },
]

/** Zorluk seçilebilen oyunlar (rakibi ya da engeli olanlar). */
export const ZORLUK_OYUNLARI: OyunAnahtari[] = ['zombi', 'roket', 'arena', 'ejderha', 'orman', 'merdiven']

export const ZORLUK_ACIKLAMASI: Partial<Record<OyunAnahtari, Record<Zorluk, string>>> = {
  zombi: { kolay: 'Zombiler her 4 soruda bir kat çıkar', orta: 'Zombiler her 3 soruda bir kat çıkar', zor: 'Zombiler her 2 soruda bir kat çıkar' },
  roket: { kolay: "Bitiş çizgisi soruların %55'i kadar doğru", orta: "Bitiş çizgisi soruların %70'i kadar doğru", zor: "Bitiş çizgisi soruların %85'i kadar doğru" },
  arena: { kolay: "Yanlış hakkı soruların %50'si", orta: "Yanlış hakkı soruların %40'ı", zor: "Yanlış hakkı soruların %30'u" },
  ejderha: { kolay: 'Ejderha daha az canlı', orta: 'Ejderhanın canı orta', zor: 'Ejderha çok daha dayanıklı' },
  orman: { kolay: 'Kısa patika', orta: 'Orta patika', zor: 'Uzun patika' },
  merdiven: { kolay: 'Kamp çıkmak için %50 gerekir', orta: 'Kamp çıkmak için %60 gerekir', zor: 'Kamp çıkmak için %70 gerekir' },
}

export const ZORLUK = {
  /** Ejderhanın canı: oyuncu × soru × oran */
  ejderhaOrani: { kolay: 0.35, orta: 0.45, zor: 0.6 },
  /** Zombi sürüsü her bu kadar soruda bir kat çıkar */
  zombiAdimi: { kolay: 4, orta: 3, zor: 2 },
  /** Roket bitişi: soru sayısı × oran doğru */
  roketOrani: { kolay: 0.55, orta: 0.7, zor: 0.85 },
  /** Arena yanlış hakkı: soru sayısı × oran */
  arenaOrani: { kolay: 0.5, orta: 0.4, zor: 0.3 },
  /** Orman patikası: soru sayısı × oran */
  ormanOrani: { kolay: 0.5, orta: 0.6, zor: 0.75 },
  /** Merdiven: bir kamp için sınıfın doğru yüzdesi */
  merdivenEsigi: { kolay: 50, orta: 60, zor: 70 },
} as const

const anahtar = (oturum: string) => `amfi_zorluk_${oturum}`

export function zorlukOku(oturum: string): Zorluk {
  try {
    const v = localStorage.getItem(anahtar(oturum))
    return v === 'kolay' || v === 'zor' ? v : 'orta'
  } catch {
    return 'orta'
  }
}

export function zorlukYaz(oturum: string, z: Zorluk): void {
  try {
    if (z === 'orta') localStorage.removeItem(anahtar(oturum))
    else localStorage.setItem(anahtar(oturum), z)
  } catch {
    /* saklanamazsa orta kalır */
  }
}
