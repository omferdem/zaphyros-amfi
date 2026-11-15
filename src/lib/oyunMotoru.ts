// Ortak oyun motoru: bütün oyunların kullandığı enerji, seri ve kalabalık kuralları (saf fonksiyonlar, birim testli).
// Oyuncu sonucu: 1 doğru, 0 yanlış, -1 cevapsız, null henüz açılmamış soru.
export type OyuncuSonucu = 1 | 0 | -1 | null

export const ENERJI_BASLANGIC = 50
export const ENERJI_DOGRU = 15
export const ENERJI_YANLIS = -15
export const ENERJI_CEVAPSIZ = -10
export const ENERJI_SERI = 10
export const SERI_UZUNLUGU = 3

export interface EnerjiDurumu {
  /** 0 ile 100 arası */
  enerji: number
  /** Şu an süren doğru serisi */
  seri: number
  /** Şimdiye kadarki en uzun doğru serisi */
  enSeri: number
  /** En son açılan sorunun etkisi */
  son: 'arti' | 'eksi' | 'bos' | null
  /** En son sorudan gelen enerji değişimi (seri bonusu dahil) */
  sonDegisim: number
}

const sinirla = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Oyuncunun enerjisi: başlangıç 50; doğru +15, yanlış −15, cevapsız −10, her 3'lü doğru seride ek +10.
 * Açılmamış sorular (null) sayılmaz.
 */
export function enerjiHesapla(sonuclar: OyuncuSonucu[]): EnerjiDurumu {
  let enerji = ENERJI_BASLANGIC
  let seri = 0
  let enSeri = 0
  let son: EnerjiDurumu['son'] = null
  let sonDegisim = 0
  for (const s of sonuclar) {
    if (s === null) continue
    let d = 0
    if (s === 1) {
      d = ENERJI_DOGRU
      seri += 1
      if (seri % SERI_UZUNLUGU === 0) d += ENERJI_SERI
      son = 'arti'
    } else {
      d = s === 0 ? ENERJI_YANLIS : ENERJI_CEVAPSIZ
      seri = 0
      son = s === 0 ? 'eksi' : 'bos'
    }
    enSeri = Math.max(enSeri, seri)
    enerji = sinirla(enerji + d)
    sonDegisim = d
  }
  return { enerji, seri, enSeri, son, sonDegisim }
}

export type IsimModu = 'tam' | 'ilk-ad' | 'yalniz-uclar'
export interface KalabalikAyari {
  /** Karakter ölçeği: 1 normal, küçüldükçe sığar */
  olcek: number
  isim: IsimModu
}

/** 80 oyuncuya kadar perdede okunur kalması için karakter ölçeği ve isim gösterimi. */
export function kalabalikAyari(oyuncu: number): KalabalikAyari {
  if (oyuncu <= 20) return { olcek: 1, isim: 'tam' }
  if (oyuncu <= 40) return { olcek: 0.75, isim: 'ilk-ad' }
  if (oyuncu <= 60) return { olcek: 0.6, isim: 'yalniz-uclar' }
  return { olcek: 0.5, isim: 'yalniz-uclar' }
}

export function ilkAd(ad: string): string {
  return ad.trim().split(/\s+/)[0] ?? ad
}

/** Perdede gösterilecek ad: kalabalıkta yalnızca ilk ad; 40'ın üstünde yalnızca lider ve son durumdakiler adla görünür. */
export function gorunenAd(ad: string, ayar: KalabalikAyari, ozel: boolean): string {
  if (ayar.isim === 'tam') return ad
  if (ayar.isim === 'ilk-ad') return ilkAd(ad)
  return ozel ? ilkAd(ad) : ''
}

/** Prova için tekrarlanabilir sahte rastgelelik. */
export function tohumluRastgele(n: number): () => number {
  let s = n >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Prova oyuncuları: verilen sayıda öğrenci, verilen ortalama başarı (0-1) çevresinde; her oyuncunun başarısı biraz farklıdır. */
export function sahteOyuncular(sayi: number, basari: number, soru: number, tohum = 42): { ad: string; sonuc: (1 | 0 | -1)[] }[] {
  const r = tohumluRastgele(tohum)
  const isimler = ['Ayşe', 'Mehmet', 'Zeynep', 'Ali', 'Elif', 'Can', 'Selin', 'Burak', 'Deniz', 'Ece', 'Emre', 'Hira', 'Kaan', 'Mina', 'Ozan', 'Pınar', 'Yusuf', 'Rabia', 'Tuğba', 'Eren']
  return Array.from({ length: sayi }, (_, i) => {
    const kisi = Math.min(0.98, Math.max(0.05, basari + (r() - 0.5) * 0.3))
    return {
      ad: `${isimler[i % isimler.length]}${i >= isimler.length ? ` ${Math.floor(i / isimler.length) + 1}` : ''}`,
      sonuc: Array.from({ length: soru }, () => {
        const x = r()
        return x < kisi ? 1 : x < kisi + (1 - kisi) * 0.7 ? 0 : -1
      }) as (1 | 0 | -1)[],
    }
  })
}
