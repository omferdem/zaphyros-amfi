// Bilgi merdiveni: sınıf tek yarışmacı gibi basamak çıkar. Saf kurallar (ekran ve veritabanı bilmez).

export interface MerdivenSorusu {
  adim: string
  sira: number
  cevap: number
  /** Doğru cevap yüzdesi; cevap yoksa null */
  oran: number | null
  /** Sonucu açılmış ya da geçilmiş soru */
  acildi: boolean
}

export interface MerdivenGecmisi {
  adim: string
  sonuc: 'cikti' | 'dustu' | 'joker'
}

export interface MerdivenDurumu {
  basamak: number
  toplam: number
  /** Oynanmış soruların sırasıyla sonucu */
  gecmis: MerdivenGecmisi[]
  /** Son oynanan soru yanlışsa ve joker hakkı varsa jokerle kurtarılabilir: o sorunun adımı */
  jokerlenebilir: string | null
  jokerKalan: number
  kazandi: boolean
}

/** Her bu kadar basamakta bir güvenli basamak vardır; yanlışta en yakın alttaki güvenli basamağa inilir. */
export const GUVENLI_ARALIK = 5
export const JOKER_HAKKI = 2
/** Cevap verenlerin en az bu yüzdesi doğru bilirse sınıf soruyu bildi sayılır. */
export const GECME_ORANI = 50

export function merdivenHesapla(sorular: MerdivenSorusu[], jokerler: ReadonlySet<string>): MerdivenDurumu {
  const toplam = sorular.length
  let basamak = 0
  const gecmis: MerdivenGecmisi[] = []
  let sonYanlis: string | null = null
  let kullanilan = 0
  for (const s of sorular) {
    if (!s.acildi || s.cevap === 0 || s.oran === null) continue
    if (s.oran >= GECME_ORANI) {
      basamak = Math.min(toplam, basamak + 1)
      gecmis.push({ adim: s.adim, sonuc: 'cikti' })
      sonYanlis = null
    } else if (jokerler.has(s.adim)) {
      kullanilan++
      gecmis.push({ adim: s.adim, sonuc: 'joker' })
      sonYanlis = null
    } else {
      basamak = Math.floor(basamak / GUVENLI_ARALIK) * GUVENLI_ARALIK
      gecmis.push({ adim: s.adim, sonuc: 'dustu' })
      sonYanlis = s.adim
    }
  }
  const jokerKalan = Math.max(0, JOKER_HAKKI - kullanilan)
  return { basamak, toplam, gecmis, jokerlenebilir: jokerKalan > 0 ? sonYanlis : null, jokerKalan, kazandi: toplam > 0 && basamak >= toplam }
}
