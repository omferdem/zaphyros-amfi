// Ders içeriğinin (akışlar, sunumlar, soru bankası) taşınabilir pakete dönüştürülmesi.
// Paket bir ZIP dosyasıdır (.amfi): icerik.json + sunumlar/<no>.pdf. Öğrenci verisi, şube ve yoklama pakete girmez.
import type { Adim, AdimAyari } from './tipler'

export const PAKET_SURUMU = 1
export const PAKET_TURU = 'amfios-icerik'

export interface PaketSunum {
  no: number
  ad: string
  sayfa_sayisi: number
  /** ZIP içindeki PDF yolu; sunum dosyası yoksa boş */
  dosya: string | null
}

export interface PaketSoru {
  soru: string
  dogru: string
  yanlislar: string[]
  sure_sn: number
  ek: Record<string, string>
}

export interface PaketAdim {
  tur: Adim['tur']
  /** Slayt adımında paketteki sunumun numarası */
  sunum?: number
  sayfa_no?: number
  /** Soru adımında paketteki sorunun sırası (0'dan) */
  soru?: number
  ayar?: AdimAyari
}

export interface PaketAkis {
  ad: string
  adimlar: PaketAdim[]
}

export interface IcerikPaketi {
  tur: typeof PAKET_TURU
  surum: number
  ad: string
  tarih: string
  sunumlar: PaketSunum[]
  sorular: PaketSoru[]
  akislar: PaketAkis[]
}

/** Paket içindeki JSON'u doğrular; geçersizse nedenini söyleyen bir hata fırlatır. */
export function paketiDogrula(ham: unknown): IcerikPaketi {
  const p = ham as Partial<IcerikPaketi> | null
  if (!p || typeof p !== 'object' || p.tur !== PAKET_TURU) throw new Error('Bu dosya bir ZAPEDU ders içeriği paketi değil.')
  if (typeof p.surum !== 'number' || p.surum > PAKET_SURUMU) throw new Error('Paket daha yeni bir sürümle hazırlanmış. Programı güncelle.')
  if (!Array.isArray(p.sunumlar) || !Array.isArray(p.sorular) || !Array.isArray(p.akislar)) throw new Error('Paket bozuk: bölümler eksik.')
  for (const a of p.akislar) {
    if (typeof a.ad !== 'string' || !Array.isArray(a.adimlar)) throw new Error('Paket bozuk: akış okunamadı.')
    for (const ad of a.adimlar) {
      if (ad.sunum !== undefined && !p.sunumlar.some((s) => s.no === ad.sunum)) throw new Error('Paket bozuk: akış olmayan bir sunumu gösteriyor.')
      if (ad.soru !== undefined && !p.sorular[ad.soru]) throw new Error('Paket bozuk: akış olmayan bir soruyu gösteriyor.')
    }
  }
  return p as IcerikPaketi
}

/** Slayt ve soru kimliklerini paket içi numaralara çevirir. */
export function paketAkislari(
  akislar: { ad: string; adimlar: Adim[] }[],
  sunumNo: Map<string, number>,
  soruSirasi: Map<string, number>,
): PaketAkis[] {
  return akislar.map((a) => ({
    ad: a.ad,
    adimlar: a.adimlar.flatMap((s): PaketAdim[] => {
      if (s.tur === 'slayt') {
        const no = s.presentation_id ? sunumNo.get(s.presentation_id) : undefined
        return no === undefined ? [] : [{ tur: 'slayt', sunum: no, sayfa_no: s.sayfa_no ?? 1 }]
      }
      if (s.tur === 'soru') {
        const sira = s.question_id ? soruSirasi.get(s.question_id) : undefined
        return sira === undefined ? [] : [{ tur: 'soru', soru: sira }]
      }
      return [Object.keys(s.ayar ?? {}).length ? { tur: s.tur, ayar: s.ayar } : { tur: s.tur }]
    }),
  }))
}

/** "5. hafta: Konu" gibi bir akış adının hafta numarası; yoksa null. */
export function haftaNo(ad: string): number | null {
  const m = ad.trim().match(/^(\d{1,2})\s*\.\s*hafta\b/i)
  return m ? Number(m[1]) : null
}
