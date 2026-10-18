// Sınıf listesini Excel, CSV ya da Excel'den kopyalanıp yapıştırılmış metinden okur.
// Başlık satırı varsa sütunları adından tanır ("Öğrenci No", "Adı", "Soyadı", "Ad Soyad"...).
// Başlık yoksa her satırda en uzun rakam dizisini numara, harf içeren hücreleri ad soyad sayar.

export interface OgrenciKaydi {
  ogrenci_no: string
  ad_soyad: string
}

export interface AyristirmaSonucu {
  kayitlar: OgrenciKaydi[]
  atlanan: number
  /** Numaralar Excel'den "2,2E+10" gibi bilimsel gösterimle kopyalanmış. */
  bilimsel?: boolean
}

type Hucre = string | number | boolean | Date | null | undefined

const NUMARA_DESENI = /^[0-9A-Za-z]{1,20}$/

function metin(h: Hucre): string {
  if (h === null || h === undefined) return ''
  if (typeof h === 'number') return Number.isInteger(h) ? String(h) : String(h).replace(/\.0+$/, '')
  return String(h).replace(/\s+/g, ' ').trim()
}

function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tamamı büyük harfle yazılmış adları "Ali Veli" biçimine çevirir; karışık yazılmışsa dokunmaz. */
export function adDuzelt(ad: string): string {
  const temiz = ad.replace(/\s+/g, ' ').trim()
  if (temiz !== temiz.toLocaleUpperCase('tr')) return temiz
  return temiz
    .toLocaleLowerCase('tr')
    .split(' ')
    .map((k) => (k ? k[0].toLocaleUpperCase('tr') + k.slice(1) : k))
    .join(' ')
}

interface Sutunlar {
  no: number
  adSoyad?: number
  ad?: number
  soyad?: number
}

function basliktanSutunlar(satir: string[]): Sutunlar | null {
  const s = satir.map(sadelestir)
  // "Sıra No", "TC Kimlik No", "Telefon No" numara sütunu değildir.
  const adaylar = s
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /(^| )(no|numara|numarasi)$/.test(h) && !/sira|kimlik|tc|tel|cep/.test(h))
  if (adaylar.length === 0) return null
  const no = (adaylar.find(({ h }) => /ogr|okul/.test(h)) ?? adaylar[0]).i
  const adSoyad = s.findIndex((h) => /^(ad ?soyad|adi ?soyadi|isim|isim soyisim|ogrenci adi soyadi|ad soyadi)$/.test(h))
  const ad = s.findIndex((h) => /^(ad|adi|isim|ogrenci adi)$/.test(h))
  const soyad = s.findIndex((h) => /^(soyad|soyadi|soyisim)$/.test(h))
  if (adSoyad >= 0) return { no, adSoyad }
  if (ad >= 0 && soyad >= 0) return { no, ad, soyad }
  if (ad >= 0) return { no, adSoyad: ad }
  return null
}

export function satirlardanAyristir(satirlar: Hucre[][]): AyristirmaSonucu {
  const metinSatirlar = satirlar.map((r) => r.map(metin)).filter((r) => r.some((h) => h !== ''))

  let sutunlar: Sutunlar | null = null
  let baslangic = 0
  for (let i = 0; i < Math.min(10, metinSatirlar.length); i++) {
    sutunlar = basliktanSutunlar(metinSatirlar[i])
    if (sutunlar) {
      baslangic = i + 1
      break
    }
  }

  const kayitlar = new Map<string, OgrenciKaydi>()
  let atlanan = 0

  for (const satir of metinSatirlar.slice(baslangic)) {
    let no = ''
    let ad = ''
    if (sutunlar) {
      no = (satir[sutunlar.no] ?? '').replace(/\s/g, '')
      ad =
        sutunlar.adSoyad !== undefined
          ? satir[sutunlar.adSoyad] ?? ''
          : `${satir[sutunlar.ad!] ?? ''} ${satir[sutunlar.soyad!] ?? ''}`
    } else {
      const rakamlar = satir
        .map((h, i) => ({ h: h.replace(/\s/g, ''), i }))
        .filter(({ h }) => /^[0-9]{3,20}$/.test(h))
        .sort((a, b) => b.h.length - a.h.length)
      if (rakamlar.length === 0) {
        atlanan++
        continue
      }
      no = rakamlar[0].h
      ad = satir
        .filter((h, i) => i !== rakamlar[0].i && /\p{L}/u.test(h))
        .slice(0, 3)
        .join(' ')
    }
    ad = adDuzelt(ad)
    if (!NUMARA_DESENI.test(no) || !ad || ad.length > 120) {
      atlanan++
      continue
    }
    kayitlar.set(no.toUpperCase(), { ogrenci_no: no.toUpperCase(), ad_soyad: ad })
  }

  return { kayitlar: [...kayitlar.values()], atlanan }
}

/**
 * Ayırıcısız satırı (PDF, Word ya da web sayfasından kopyalanmış "22010101001 Ali Yılmaz") hücrelere böler:
 * her rakam dizisi ayrı hücre olur, aradaki kelimeler tek hücrede birleşir.
 */
function bosluklaBol(satir: string): string[] {
  const hucreler: string[] = []
  let kelimeler: string[] = []
  for (const parca of satir.trim().split(/\s+/)) {
    if (/^[0-9]+$/.test(parca)) {
      if (kelimeler.length) hucreler.push(kelimeler.join(' '))
      kelimeler = []
      hucreler.push(parca)
    } else {
      kelimeler.push(parca)
    }
  }
  if (kelimeler.length) hucreler.push(kelimeler.join(' '))
  return hucreler
}

/** Excel'den kopyalanan (sekmeyle ayrılmış), CSV ya da boşlukla ayrılmış metni satırlara böler. */
export function metniSatirlaraBol(metinIcerik: string): string[][] {
  const satirlar = metinIcerik.replace(/\r\n?/g, '\n').split('\n')
  const sekmeli = satirlar.some((s) => s.includes('\t'))
  const ayirici = sekmeli ? '\t' : satirlar.some((s) => s.includes(';')) ? ';' : ','
  return satirlar.map((s) => {
    const hucreler = s.split(ayirici).map((h) => h.replace(/^"(.*)"$/, '$1'))
    return hucreler.length === 1 && /\s/.test(s.trim()) ? bosluklaBol(s) : hucreler
  })
}

// Excel dar sütundaki uzun numarayı "2,20101E+10" diye kopyalar; bu durumda numara geri getirilemez.
const BILIMSEL_GOSTERIM = /(^|[\t;\s])[0-9]+([.,][0-9]+)?E\+[0-9]+($|[\t;\s])/im

export function metindenAyristir(metinIcerik: string): AyristirmaSonucu {
  const sonuc = satirlardanAyristir(metniSatirlaraBol(metinIcerik))
  return BILIMSEL_GOSTERIM.test(metinIcerik) ? { ...sonuc, bilimsel: true } : sonuc
}

export async function dosyadanAyristir(dosya: File): Promise<AyristirmaSonucu> {
  if (/\.(csv|txt)$/i.test(dosya.name)) {
    return metindenAyristir(await dosya.text())
  }
  const { readSheet } = await import('read-excel-file/browser')
  const satirlar = await readSheet(dosya)
  return satirlardanAyristir(satirlar as Hucre[][])
}
