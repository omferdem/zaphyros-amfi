// Son Kalan Arenası: bireysel eleme oyunu. Her oyuncunun 2 canı var; yanlış ya da cevapsız bir can götürür, canı biten arenadan düşer.
// Saf kurallar (ekran ve veritabanı bilmez); zombi_goster (0023) sonuçlarından hesaplanır.
import type { ZombiOyuncusu, ZombiSorusu } from './zombi'

/** En az can (yanlış hakkı). Gerçek sayı soru sayısına bağlıdır: arenaCani. */
export const ARENA_CANI = 2
/** Kazanan sayılmak için gereken en düşük doğru oranı. */
export const KAZANMA_ORANI = 0.5

/** Yanlış hakkı: soru sayısının %40'ı (en az 2). 10 soruda 4 yanlışla elenilir, yani 7 doğru gerekir. */
export function arenaCani(toplamSoru: number): number {
  return Math.max(ARENA_CANI, Math.floor(toplamSoru * 0.4))
}

export interface ArenaOyuncusu {
  ad: string
  kalan: number
  /** Arenadan düştüğü soru sırası (1'den); hâlâ ayaktaysa null */
  elendi: number | null
  dogru: number
  /** Son oynanan sorudaki sonucu (1 doğru, 0 yanlış, -1 cevapsız); animasyonlar için */
  son: 1 | 0 | -1 | null
}

export interface ArenaDurumu {
  oyuncular: ArenaOyuncusu[]
  ayakta: number
  oynanan: number
  toplamSoru: number
  /** Sıralama: ayakta olanlar (doğru sayısına göre), sonra geç elenenler */
  siralama: ArenaOyuncusu[]
  bitti: boolean
  /** Herkes aynı soruda elendi: kimse diriltilmez ve kazanan ilan edilmez */
  kimseKalmadi: boolean
  /** Herkesin düştüğü soruda en çok doğrusu olan (son düşen); yalnızca kimse kalmadıysa */
  sonDusen: ArenaOyuncusu | null
  /** Podyumda kazanan sayılabilecekler: ayakta ve doğru oranı en az %50 */
  kazananlar: ArenaOyuncusu[]
  /** Oyuncu başına can */
  can: number
}

export function arenaHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): ArenaDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0 || oyuncular.length === 0) return null
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const sonIdx = acik[acik.length - 1]
  const can = arenaCani(toplamSoru)
  const liste: ArenaOyuncusu[] = oyuncular.map((o) => ({ ad: o.ad, kalan: can, elendi: null, dogru: 0, son: sonIdx === undefined ? null : (o.sonuc[sonIdx] ?? null) }))
  let bittigi = false
  let kimseKalmadi = false
  let sonDusen: ArenaOyuncusu | null = null
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
    // Herkes aynı soruda elenirse kimse diriltilmez: o soruda en çok doğrusu olan "son düşen" sayılır, kazanan ilan edilmez
    if (ayakta === 0 && oncekiAyakta > 0) {
      sonDusen = [...yeniElenenler].sort((a, b) => b.dogru - a.dogru)[0] ?? null
      kimseKalmadi = true
      bittigi = true
    } else if (ayakta <= 1 && oyuncular.length > 1) bittigi = true
  })
  const ayakta = liste.filter((p) => p.elendi === null).length
  const siralama = [...liste].sort((a, b) => {
    if ((a.elendi === null) !== (b.elendi === null)) return a.elendi === null ? -1 : 1
    if (a.elendi === null) return b.dogru - a.dogru
    return (b.elendi ?? 0) - (a.elendi ?? 0) || b.dogru - a.dogru
  })
  const oynanan = acik.length
  const kazananlar = siralama.filter((p) => p.elendi === null && oynanan > 0 && p.dogru / oynanan >= KAZANMA_ORANI)
  if (sonDusen) {
    const i = siralama.indexOf(sonDusen)
    if (i > 0) siralama.unshift(...siralama.splice(i, 1))
  }
  return { oyuncular: liste, ayakta, oynanan, toplamSoru, siralama, bitti: bittigi || oynanan >= toplamSoru, kimseKalmadi, sonDusen, kazananlar, can }
}
