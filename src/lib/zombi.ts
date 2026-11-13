// Zombi Kaçışı: sınıf bir piramidin zirvesine çıkmaya çalışır, zombiler her soruda biraz yaklaşır.
// Saf kurallar (ekran ve veritabanı bilmez); zombi_goster (0023) sonuçlarından durum hesaplanır.

export interface ZombiSorusu {
  adim: string
  sira: number
  /** Sonucu açılmış ya da geçilmiş ve en az bir cevap almış soru */
  acildi: boolean
}

export interface ZombiOyuncusu {
  ad: string
  /** Soru sırasıyla: 1 doğru, 0 yanlış, -1 cevapsız; sonucu açılmamış soruda null */
  sonuc: (1 | 0 | -1 | null)[]
}

export type OyuncuDurumu = 'canli' | 'zirve' | 'yakalandi'

export interface ZombiOyuncuDurumu {
  ad: string
  /** 0 = zemin, zirve = piramidin tepesi */
  seviye: number
  durum: OyuncuDurumu
  /** Yakalandıysa hangi seviyede yakalandı */
  yakalandigiSeviye: number | null
}

export interface ZombiDurumu {
  /** Piramidin kat sayısı (zirve seviyesi) */
  zirve: number
  toplamSoru: number
  oynanan: number
  /** Zombi sürüsünün geldiği seviye */
  zombiSeviyesi: number
  oyuncular: ZombiOyuncuDurumu[]
  zirvede: number
  yakalanan: number
  /** Zirvedekilerin oyuncu sayısına oranı (0-1) */
  oran: number
  bitti: boolean
  kazandi: boolean
}

/** Sınıfın kurtulması için zirveye çıkması gereken oran. */
export const KURTULMA_ORANI = 0.7
/** Zombiler oyun sonunda zirvenin bu oranına kadar gelir; yani doğru bilen sürüden her zaman hızlıdır. */
export const ZOMBI_HIZI = 0.7

export function zirveSeviyesi(toplamSoru: number): number {
  return Math.max(5, Math.min(12, Math.round(toplamSoru * 0.5)))
}

/** k soru oynandığında zombi sürüsünün seviyesi. */
export function zombiSeviyesi(oynanan: number, toplamSoru: number, zirve: number): number {
  if (toplamSoru <= 0) return 0
  return Math.floor((oynanan * zirve * ZOMBI_HIZI) / toplamSoru)
}

export function zombiHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): ZombiDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0) return null
  const zirve = zirveSeviyesi(toplamSoru)
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const oynanan = acik.length
  const sonuclar: ZombiOyuncuDurumu[] = oyuncular.map((o) => {
    let seviye = 0
    let durum: OyuncuDurumu = 'canli'
    let yakalandigi: number | null = null
    acik.forEach((idx, k) => {
      if (durum !== 'canli') return
      if (o.sonuc[idx] === 1) seviye = Math.min(zirve, seviye + 1)
      if (seviye >= zirve) {
        durum = 'zirve'
        return
      }
      // Zombi sürüsü oyuncunun altından geçtiyse oyuncu yakalanır
      if (seviye < zombiSeviyesi(k + 1, toplamSoru, zirve)) {
        durum = 'yakalandi'
        yakalandigi = seviye
      }
    })
    return { ad: o.ad, seviye, durum, yakalandigiSeviye: yakalandigi }
  })
  const zirvede = sonuclar.filter((o) => o.durum === 'zirve').length
  const yakalanan = sonuclar.filter((o) => o.durum === 'yakalandi').length
  const oran = sonuclar.length > 0 ? zirvede / sonuclar.length : 0
  const bitti = oynanan >= toplamSoru
  return {
    zirve,
    toplamSoru,
    oynanan,
    zombiSeviyesi: zombiSeviyesi(oynanan, toplamSoru, zirve),
    oyuncular: sonuclar,
    zirvede,
    yakalanan,
    oran,
    bitti,
    kazandi: sonuclar.length > 0 && oran >= KURTULMA_ORANI && (bitti || zirvede === sonuclar.length),
  }
}
