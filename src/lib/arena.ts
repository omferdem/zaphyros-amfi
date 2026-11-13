// Son Kalan Arenası: bireysel eleme oyunu. Her oyuncunun 2 canı var; yanlış ya da cevapsız bir can götürür, canı biten arenadan düşer.
// Saf kurallar (ekran ve veritabanı bilmez); zombi_goster (0023) sonuçlarından hesaplanır.
import type { ZombiOyuncusu, ZombiSorusu } from './zombi'

export const ARENA_CANI = 2

export interface ArenaOyuncusu {
  ad: string
  kalan: number
  /** Arenadan düştüğü soru sırası (1'den); hâlâ ayaktaysa null */
  elendi: number | null
  dogru: number
}

export interface ArenaDurumu {
  oyuncular: ArenaOyuncusu[]
  ayakta: number
  oynanan: number
  toplamSoru: number
  /** Sıralama: ayakta olanlar (doğru sayısına göre), sonra geç elenenler */
  siralama: ArenaOyuncusu[]
  bitti: boolean
}

export function arenaHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): ArenaDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0 || oyuncular.length === 0) return null
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const liste: ArenaOyuncusu[] = oyuncular.map((o) => ({ ad: o.ad, kalan: ARENA_CANI, elendi: null, dogru: 0 }))
  let bittigi = false
  acik.forEach((idx, k) => {
    if (bittigi) return
    const oncekiAyakta = liste.filter((p) => p.elendi === null).length
    const yeniElenenler: ArenaOyuncusu[] = []
    oyuncular.forEach((o, j) => {
      const p = liste[j]
      if (p.elendi !== null) return
      if (o.sonuc[idx] === 1) p.dogru++
      else {
        p.kalan--
        if (p.kalan <= 0) {
          p.elendi = k + 1
          yeniElenenler.push(p)
        }
      }
    })
    const ayakta = liste.filter((p) => p.elendi === null).length
    // Herkes aynı soruda elenirse kimse eksilmesin: o soruda elenenler canlı kalır, oyun bitmiş sayılır
    if (ayakta === 0 && oncekiAyakta > 0) {
      yeniElenenler.forEach((p) => {
        p.elendi = null
        p.kalan = 1
      })
      bittigi = true
    } else if (ayakta <= 1 && oyuncular.length > 1) bittigi = true
  })
  const ayakta = liste.filter((p) => p.elendi === null).length
  const siralama = [...liste].sort((a, b) => {
    if ((a.elendi === null) !== (b.elendi === null)) return a.elendi === null ? -1 : 1
    if (a.elendi === null) return b.dogru - a.dogru
    return (b.elendi ?? 0) - (a.elendi ?? 0) || b.dogru - a.dogru
  })
  return { oyuncular: liste, ayakta, oynanan: acik.length, toplamSoru, siralama, bitti: bittigi || acik.length >= toplamSoru }
}
