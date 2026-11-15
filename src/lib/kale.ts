// Kale Kuşatması: her takımın bir kalesi vardır. Takım doğru cevap verdikçe ordusu bir sonraki takımın kalesine yürür,
// sonra kalenin etrafını sarar. Önce hedef kaleyi tamamen kuşatan takım kazanır.
// Saf kurallar. Girdi: takim_goster (takım başına üye ve doğru sayısı) ve oynanan soru sayısı; ilerleme Kule Yarışı gibi
// "üye başına doğru" üzerinden hesaplanır, böylece kalabalık takım avantajlı olmaz.

export interface KaleTakimi {
  takim: number
  uye: number
  dogru: number
}

export type KaleAsamasi = 'yuruyor' | 'kusatiyor' | 'kusatti'

export interface KaleSatiri {
  takim: number
  uye: number
  /** Üye başına doğru cevap */
  blok: number
  /** Hedefte kesilmiş ilerleme (0 ile hedef arası) */
  ilerleme: number
  /** Bu takımın saldırdığı kalenin takım numarası */
  hedefTakim: number
  asama: KaleAsamasi
  /** Yürüyüş yolunun ne kadarı alındı (0 ile 1) */
  yuruyusOrani: number
  /** Hedef kalenin etrafına dizilmiş asker sayısı (0 ile kuşatma arası) */
  kusatan: number
  sira: number
}

export interface KaleDurumu {
  /** Kuşatmayı tamamlamak için gereken toplam ilerleme (üye başına doğru) */
  hedef: number
  /** Ordunun hedef kaleye varması için gereken ilerleme */
  yuruyus: number
  /** Kalenin etrafını sarmak için gereken asker sayısı */
  kusatma: number
  satirlar: KaleSatiri[]
  oynanan: number
  toplamSoru: number
  bitti: boolean
  /** Kazanan takım (bitmeden null) */
  kazanan: number | null
  /** Etrafı tamamen sarılan (düşen) kalelerin takım numaraları */
  dusen: number[]
}

/** Toplam sorunun yaklaşık %60'ı kadar doğru gerekir (en az 6, en çok 14). */
export function kaleHedefi(toplamSoru: number): number {
  return Math.max(6, Math.min(14, Math.round(toplamSoru * 0.6) + 1))
}

export function kaleHesapla(takimlar: KaleTakimi[], oynanan: number, toplamSoru: number): KaleDurumu | null {
  if (toplamSoru <= 0 || takimlar.length < 2) return null
  const hedef = kaleHedefi(toplamSoru)
  const yuruyus = Math.max(2, Math.round(hedef * 0.4))
  const kusatma = hedef - yuruyus
  const numaralar = [...takimlar].map((t) => t.takim).sort((a, b) => a - b)
  const sonraki = (no: number) => numaralar[(numaralar.indexOf(no) + 1) % numaralar.length]
  const ham = takimlar.map((t) => ({ takim: t.takim, uye: t.uye, blok: t.uye > 0 ? t.dogru / t.uye : 0 }))
  const sirali = [...ham].sort((a, b) => b.blok - a.blok || a.takim - b.takim)
  const satirlar: KaleSatiri[] = ham.map((h) => {
    const ilerleme = Math.min(hedef, h.blok)
    const asama: KaleAsamasi = ilerleme >= hedef ? 'kusatti' : ilerleme > yuruyus ? 'kusatiyor' : 'yuruyor'
    return {
      ...h,
      ilerleme,
      hedefTakim: sonraki(h.takim),
      asama,
      yuruyusOrani: Math.min(1, ilerleme / yuruyus),
      kusatan: Math.min(kusatma, Math.floor(Math.max(0, ilerleme - yuruyus))),
      sira: sirali.findIndex((x) => x.takim === h.takim) + 1,
    }
  })
  const dusen = satirlar.filter((s) => s.asama === 'kusatti').map((s) => s.hedefTakim)
  const bitti = satirlar.some((s) => s.asama === 'kusatti') || (oynanan >= toplamSoru && oynanan > 0)
  return { hedef, yuruyus, kusatma, satirlar, oynanan, toplamSoru, bitti, kazanan: bitti ? sirali[0].takim : null, dusen }
}
