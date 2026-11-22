// Takım yarışması için saf tipler ve sabitler.

export interface TakimSatiri {
  takim: number
  uye: number
  puan: number
  dogru: number
  /** Üye başına ortalama puan; sıralama buna göredir */
  ortalama: number
  sira: number
}

export interface TakimDurumu {
  sayi: number
  takimlar: TakimSatiri[]
}

export const TAKIMLAR = [
  { ad: 'Kırmızı', emoji: '🔴', renk: 'from-rose-500 to-red-600', hex: '#f43f5e', yazi: 'text-rose-400' },
  { ad: 'Mavi', emoji: '🔵', renk: 'from-sky-500 to-blue-600', hex: '#38bdf8', yazi: 'text-sky-400' },
  { ad: 'Yeşil', emoji: '🟢', renk: 'from-emerald-500 to-green-600', hex: '#10b981', yazi: 'text-emerald-400' },
  { ad: 'Sarı', emoji: '🟡', renk: 'from-amber-400 to-yellow-500', hex: '#fbbf24', yazi: 'text-amber-300' },
  { ad: 'Mor', emoji: '🟣', renk: 'from-violet-500 to-purple-600', hex: '#8b5cf6', yazi: 'text-violet-400' },
  { ad: 'Turuncu', emoji: '🟠', renk: 'from-orange-500 to-amber-600', hex: '#f97316', yazi: 'text-orange-400' },
  { ad: 'Pembe', emoji: '💗', renk: 'from-pink-400 to-pink-600', hex: '#f472b6', yazi: 'text-pink-400' },
  { ad: 'Turkuaz', emoji: '🔷', renk: 'from-cyan-400 to-teal-600', hex: '#22d3ee', yazi: 'text-cyan-300' },
  { ad: 'Kahverengi', emoji: '🟤', renk: 'from-amber-700 to-stone-700', hex: '#a16207', yazi: 'text-amber-600' },
  { ad: 'Gri', emoji: '⚪', renk: 'from-slate-400 to-slate-600', hex: '#94a3b8', yazi: 'text-slate-300' },
] as const

/** 1'den başlayan takım numarasının adı ve simgesi */
export function takimBilgisi(no: number) {
  return TAKIMLAR[Math.max(0, Math.min(TAKIMLAR.length - 1, no - 1))]
}

/** Takım sayısını seçerken sunulan seçenekler (0: kapalı) */
export const TAKIM_SAYILARI = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** Halat çekmede bir takımın üye başına doğru sayısı fark ederse halat o yöne kayar; bu fark kazanmak için yeter. */
export const HALAT_ESIGI = 3

export interface HalatTarafi {
  dogru: number
  uye: number
}

export interface HalatDurumu {
  /** -1 (1. takım tarafı kazandı) ile +1 (2. takım) arası; 0 ortada */
  konum: number
  /** Kazanan takım numarası (1 ya da 2), yoksa null */
  kazanan: 1 | 2 | null
}

/**
 * İki takımın üye başına doğru cevap farkından halatın konumunu hesaplar. Bir takımın cevapları o takıma
 * doğru çeker; üye sayısı eşit olmadığı için doğru sayısı üyeye bölünür. Konum -1 ile 1 arasında sınırlıdır.
 */
export function halatHesapla(bir: HalatTarafi, iki: HalatTarafi): HalatDurumu {
  const ort = (t: HalatTarafi) => (t.uye > 0 ? t.dogru / t.uye : 0)
  const fark = ort(iki) - ort(bir)
  // 1. takım öndeyse fark negatif olur ve halat sola (negatif yöne) gider
  const konum = Math.max(-1, Math.min(1, fark / HALAT_ESIGI)) || 0
  return { konum, kazanan: konum <= -1 ? 1 : konum >= 1 ? 2 : null }
}
