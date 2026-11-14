// Şube yedeği biçimi: türler, dosyaya yazma, okuma ve doğrulama (Supabase'e bağlı değildir).

export const YEDEK_TURU = 'amfios-sube-yedegi'
export const YEDEK_SURUMU = 1

export interface YedekOturum {
  baslik: string | null
  hafta_no: number | null
  basladi: string
  bitti: string | null
  telefon_modu: boolean
  yoklamalar: { no: string; yontem: 'qr' | 'elle'; zaman: string }[]
}

export interface YedekSube {
  ad: string
  kod: string | null
  sube: string | null
  donem: string | null
  yoklama_sayisi: number
  yoklama_birimi: 'hafta' | 'ders'
  ogrenciler: { no: string; ad_soyad: string }[]
  oturumlar: YedekOturum[]
}

export interface SubeYedegi {
  tur: typeof YEDEK_TURU
  surum: number
  alindi: string
  subeler: YedekSube[]
}

/** Yedeği tarayıcıdan dosya olarak indirir. */
export function yedegiIndir(yedek: SubeYedegi, dosyaAdi: string): void {
  const guvenli = dosyaAdi.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim().slice(0, 80) || 'sube'
  const blob = new Blob([JSON.stringify(yedek)], { type: 'application/json' })
  const adres = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = adres
  a.download = `${guvenli}-yedek-${yedek.alindi.slice(0, 10)}.amfi-yedek`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(adres), 5000)
}

/** Dosyayı okur ve yedek biçimini doğrular; geçersizse anlaşılır bir hata fırlatır. */
export async function yedegiOku(dosya: File): Promise<SubeYedegi> {
  if (dosya.size > 30 * 1024 * 1024) throw new Error('Dosya çok büyük (en fazla 30 MB).')
  let j: unknown
  try {
    j = JSON.parse(await dosya.text())
  } catch {
    throw new Error('Dosya okunamadı; bir şube yedeği (.amfi-yedek) olmalı.')
  }
  const y = j as Partial<SubeYedegi>
  if (y?.tur !== YEDEK_TURU || !Array.isArray(y.subeler)) throw new Error('Bu dosya bir şube yedeği değil.')
  if ((y.surum ?? 0) > YEDEK_SURUMU) throw new Error('Yedek daha yeni bir sürümle alınmış; siteyi yenileyip tekrar dene.')
  for (const s of y.subeler) {
    if (typeof s?.ad !== 'string' || !Array.isArray(s.ogrenciler) || !Array.isArray(s.oturumlar)) throw new Error('Yedek dosyası bozuk görünüyor.')
  }
  return y as SubeYedegi
}

export interface YedekOzeti {
  sube: number
  ogrenci: number
  oturum: number
  yoklama: number
}

export function yedekOzeti(y: SubeYedegi): YedekOzeti {
  return {
    sube: y.subeler.length,
    ogrenci: y.subeler.reduce((t, s) => t + s.ogrenciler.length, 0),
    oturum: y.subeler.reduce((t, s) => t + s.oturumlar.length, 0),
    yoklama: y.subeler.reduce((t, s) => t + s.oturumlar.reduce((u, o) => u + o.yoklamalar.length, 0), 0),
  }
}

