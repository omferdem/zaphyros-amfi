// Soru paketleri: sorular ders içeriğinin soru bankasında durur; hangi pakete ait oldukları her sorunun
// ek bilgisinde (ek.paket) yazar. ZOMR dosyasına #PAKET:ad satırı yazılırsa o da paket adı olur.
import type { Soru } from './tipler'

export function paketAdi(s: Pick<Soru, 'ek'>): string {
  return (s.ek?.paket ?? '').trim()
}

export interface PaketGrubu {
  /** Paket adı; boşsa paketsiz sorular */
  ad: string
  sorular: Soru[]
}

/** Soruları pakete göre gruplar: paketler ilk görüldükleri sırayla, paketsiz sorular en sonda. */
export function paketleriGrupla(sorular: Soru[]): PaketGrubu[] {
  const harita = new Map<string, Soru[]>()
  for (const s of sorular) {
    const ad = paketAdi(s)
    harita.set(ad, [...(harita.get(ad) ?? []), s])
  }
  const gruplar = [...harita.entries()].map(([ad, l]) => ({ ad, sorular: l }))
  return [...gruplar.filter((g) => g.ad), ...gruplar.filter((g) => !g.ad)]
}

/** Yeni adımların akışta nereye gireceği: sona, başa ya da bir adımın hemen arkasına. */
export type Konum = { tur: 'son' } | { tur: 'bas' } | { tur: 'sonra'; adim: string }

/** Seçim kutusundaki değer ("son", "bas" ya da "sonra:<adım id>") bir konuma çevrilir. */
export function konumuCoz(deger: string): Konum {
  if (deger === 'bas') return { tur: 'bas' }
  if (deger.startsWith('sonra:')) return { tur: 'sonra', adim: deger.slice(6) }
  return { tur: 'son' }
}

/** Mevcut adımların sırasına yeni adımları istenen yere sokar; bulunamayan adımda sona ekler. */
export function adimSirasi(mevcut: string[], yeni: string[], konum: Konum): string[] {
  if (konum.tur === 'bas') return [...yeni, ...mevcut]
  if (konum.tur === 'sonra') {
    const i = mevcut.indexOf(konum.adim)
    if (i >= 0) return [...mevcut.slice(0, i + 1), ...yeni, ...mevcut.slice(i + 1)]
  }
  return [...mevcut, ...yeni]
}

/** Fisher-Yates karıştırma; verilen diziyi değiştirmez. */
export function karistir<T>(dizi: T[], rastgele: () => number = Math.random): T[] {
  const k = [...dizi]
  for (let i = k.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1))
    ;[k[i], k[j]] = [k[j], k[i]]
  }
  return k
}
