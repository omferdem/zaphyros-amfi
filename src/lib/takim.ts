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
  { ad: 'Kırmızı', emoji: '🔴', renk: 'from-rose-500 to-red-600' },
  { ad: 'Mavi', emoji: '🔵', renk: 'from-sky-500 to-blue-600' },
  { ad: 'Yeşil', emoji: '🟢', renk: 'from-emerald-500 to-green-600' },
  { ad: 'Sarı', emoji: '🟡', renk: 'from-amber-400 to-yellow-500' },
  { ad: 'Mor', emoji: '🟣', renk: 'from-violet-500 to-purple-600' },
  { ad: 'Turuncu', emoji: '🟠', renk: 'from-orange-500 to-amber-600' },
] as const

/** 1'den başlayan takım numarasının adı ve simgesi */
export function takimBilgisi(no: number) {
  return TAKIMLAR[Math.max(0, Math.min(TAKIMLAR.length - 1, no - 1))]
}

/** Takım sayısını seçerken sunulan seçenekler (0: kapalı) */
export const TAKIM_SAYILARI = [0, 2, 3, 4, 5, 6] as const
