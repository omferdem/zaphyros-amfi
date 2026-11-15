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
  /** Son oynanan sorudaki sonucu (1 doğru, 0 yanlış, -1 cevapsız); animasyonlar için */
  son: 1 | 0 | -1 | null
  /** Hangi soruda yakalandı ya da zirveye çıktı (1'den); henüz olmadıysa null */
  bittigiSoru: number | null
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
/** Zombiler zemin seviyesinin bu kadar altından başlar (oyuncuya toleranslı başlangıç). */
export const ZOMBI_BASLANGIC = -2
/** Zombi sürüsü her bu kadar soruda bir kat çıkar. Hız oyuncuların %40'ı bilirse yakalanacak, %60'ı bilirse kurtulacak biçimde ayarlandı (zombi.test.ts). */
export const ZOMBI_ADIMI = 3
/** Öğrenci her bu kadar doğruda bir kat çıkar. */
export const DOGRU_BASINA_KAT = 2
/** Üst üste bu kadar yanlışta öğrenci bir kat kayar. */
export const KAYMA_YANLISI = 3

/** Zirve kat sayısı: soru sayısının %40'ı (en az 3, en çok 12). */
export function zirveSeviyesi(toplamSoru: number): number {
  return Math.max(3, Math.min(12, Math.round(toplamSoru * 0.4)))
}

/** k soru oynandığında zombi sürüsünün ham seviyesi (zeminin altında başlar, negatif olabilir). */
export function zombiSeviyesi(oynanan: number, toplamSoru: number, _zirve?: number): number {
  if (toplamSoru <= 0) return ZOMBI_BASLANGIC
  return ZOMBI_BASLANGIC + Math.floor(oynanan / ZOMBI_ADIMI)
}

export function zombiHesapla(sorular: ZombiSorusu[], oyuncular: ZombiOyuncusu[]): ZombiDurumu | null {
  const toplamSoru = sorular.length
  if (toplamSoru === 0) return null
  const zirve = zirveSeviyesi(toplamSoru)
  const acik = sorular.map((s, i) => (s.acildi ? i : -1)).filter((i) => i >= 0)
  const oynanan = acik.length
  const sonuclar: ZombiOyuncuDurumu[] = oyuncular.map((o) => {
    let seviye = 0
    let dogru = 0
    let kayma = 0
    let ardisikYanlis = 0
    let durum: OyuncuDurumu = 'canli'
    let yakalandigi: number | null = null
    let bittigiSoru: number | null = null
    acik.forEach((idx, k) => {
      if (durum !== 'canli') return
      if (o.sonuc[idx] === 1) {
        dogru++
        ardisikYanlis = 0
      } else if (++ardisikYanlis >= KAYMA_YANLISI) {
        kayma++
        ardisikYanlis = 0
      }
      seviye = Math.max(0, Math.min(zirve, Math.floor(dogru / DOGRU_BASINA_KAT) - kayma))
      if (seviye >= zirve) {
        durum = 'zirve'
        bittigiSoru = k + 1
        return
      }
      // Zombi sürüsü oyuncunun katına geldiyse oyuncu yakalanır
      if (zombiSeviyesi(k + 1, toplamSoru, zirve) >= seviye) {
        durum = 'yakalandi'
        yakalandigi = seviye
        bittigiSoru = k + 1
      }
    })
    const sonIdx = acik[acik.length - 1]
    return { ad: o.ad, seviye, durum, yakalandigiSeviye: yakalandigi, son: sonIdx === undefined ? null : (o.sonuc[sonIdx] ?? null), bittigiSoru }
  })
  const zirvede = sonuclar.filter((o) => o.durum === 'zirve').length
  const yakalanan = sonuclar.filter((o) => o.durum === 'yakalandi').length
  const oran = sonuclar.length > 0 ? zirvede / sonuclar.length : 0
  const bitti = oynanan >= toplamSoru
  return {
    zirve,
    toplamSoru,
    oynanan,
    zombiSeviyesi: Math.max(0, zombiSeviyesi(oynanan, toplamSoru, zirve)),
    oyuncular: sonuclar,
    zirvede,
    yakalanan,
    oran,
    bitti,
    kazandi: sonuclar.length > 0 && oran >= KURTULMA_ORANI && (bitti || zirvede === sonuclar.length),
  }
}
