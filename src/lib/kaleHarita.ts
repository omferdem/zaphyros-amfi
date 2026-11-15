// Kale kuşatması (hücre haritası): ortada hedef kale, etrafında halkalar halinde toprak hücreleri.
// Her öğrenci her 2 doğrusunda 1 hücre alır; önce boş hücreler (dıştan içe, kendi takımının toprağına komşu olanlar),
// boş komşu kalmazsa rakibin komşu hücresi ele geçirilir (sahibi o soruda doğru bildiyse alınamaz). Saf kurallar, birim testli.

export const HALKA_SAYISI = 3
export const HUCRE_SAYISI = 12
/** Öğrencinin bir hücre kazanması için gereken doğru sayısı. */
export const DOGRU_BASINA_HUCRE = 2

export interface KaleOyuncusu {
  ad: string
  /** 1'den başlar */
  takim: number
  /** 1 doğru, 0 yanlış, -1 cevapsız, null açılmamış */
  sonuc: (1 | 0 | -1 | null)[]
}

export interface Hucre {
  halka: number
  dilim: number
  /** Sahibi takım (boşsa null) */
  takim: number | null
  /** Hücreyi alan oyuncunun adı */
  sahip: string | null
  /** Hücrenin alındığı ya da ele geçirildiği soru (1'den) */
  soru: number | null
}

export interface KaleHaritasi {
  hucreler: Hucre[]
  /** Takım başına toplam ve iç halkadaki hücre sayısı */
  takimlar: { takim: number; toplam: number; ic: number; alinan: Record<string, number>; geriAlinan: number }[]
  /** İç halkayı tamamen tutan takım (yoksa null) */
  kusatan: number | null
  oynanan: number
  bitti: boolean
  /** Kazanan takım: kuşatan, yoksa soruların bitiminde iç halkada en çok hücresi olan (eşitlikte toplamı çok olan) */
  kazanan: number | null
}

const anahtar = (h: number, d: number) => `${h}:${d}`

/** Takımın başlangıç dilimi: takımlar çemberin dilimlerine eşit dağıtılır. */
export function evDilimi(takim: number, takimSayisi: number): number {
  return Math.floor(((takim - 1) * HUCRE_SAYISI) / takimSayisi)
}

function dilimMesafesi(a: number, b: number): number {
  const f = Math.abs(a - b) % HUCRE_SAYISI
  return Math.min(f, HUCRE_SAYISI - f)
}

export function kaleHaritasiHesapla(oyuncular: KaleOyuncusu[], takimSayisi: number, toplamSoru: number): KaleHaritasi | null {
  if (takimSayisi < 2 || toplamSoru <= 0) return null
  const hucreler: Hucre[] = []
  for (let h = 0; h < HALKA_SAYISI; h++) for (let d = 0; d < HUCRE_SAYISI; d++) hucreler.push({ halka: h, dilim: d, takim: null, sahip: null, soru: null })
  const al = (h: number, d: number) => hucreler[h * HUCRE_SAYISI + ((d + HUCRE_SAYISI) % HUCRE_SAYISI)]
  const dogru = new Map<number, number>()
  const alinan = new Map<number, Record<string, number>>()
  const geriAlinan = new Map<number, number>()
  const soruSayisi = oyuncular.reduce((m, o) => Math.max(m, o.sonuc.filter((s) => s !== null).length), 0)
  const kaynaklar = Array.from({ length: takimSayisi }, (_, i) => i + 1)

  for (let q = 0; q < toplamSoru; q++) {
    // Bu soruda sonucu açılmış kimse yoksa durulur
    if (!oyuncular.some((o) => o.sonuc[q] !== null && o.sonuc[q] !== undefined)) break
    oyuncular.forEach((o, oi) => {
      if (o.sonuc[q] !== 1) return
      const say = (dogru.get(oi) ?? 0) + 1
      dogru.set(oi, say)
      if (say % DOGRU_BASINA_HUCRE !== 0) return
      const t = o.takim
      const ev = evDilimi(t, takimSayisi)
      const kendi = (h: Hucre) => h.takim === t
      const ilk = !hucreler.some(kendi)
      // Aday hücreler: takımın toprağına komşu (ya da ilk hücre için evin dış halkadaki dilimi)
      const komsuMu = (h: Hucre) =>
        [al(h.halka, h.dilim - 1), al(h.halka, h.dilim + 1), ...(h.halka > 0 ? [al(h.halka - 1, h.dilim)] : []), ...(h.halka < HALKA_SAYISI - 1 ? [al(h.halka + 1, h.dilim)] : [])].some(kendi)
      const adaylar = hucreler.filter((h) => (ilk ? h.halka === 0 && h.dilim === ev : komsuMu(h)))
      const sirala = (a: Hucre, b: Hucre) => a.halka - b.halka || dilimMesafesi(a.dilim, ev) - dilimMesafesi(b.dilim, ev) || a.dilim - b.dilim
      const bos = adaylar.filter((h) => h.takim === null).sort(sirala)
      let secilen: Hucre | undefined = bos[0]
      let geriAlma = false
      if (!secilen) {
        // Rakip hücresi: sahibi bu soruda doğru bilmediyse ele geçirilir (savunma)
        const rakip = adaylar
          .filter((h) => h.takim !== null && h.takim !== t)
          .filter((h) => {
            const sahibi = oyuncular.find((x) => x.ad === h.sahip && x.takim === h.takim)
            return !(sahibi && sahibi.sonuc[q] === 1)
          })
          .sort(sirala)
        secilen = rakip[0]
        geriAlma = !!secilen
      }
      if (!secilen) return
      secilen.takim = t
      secilen.sahip = o.ad
      secilen.soru = q + 1
      const kayit = alinan.get(t) ?? {}
      kayit[o.ad] = (kayit[o.ad] ?? 0) + 1
      alinan.set(t, kayit)
      if (geriAlma) geriAlinan.set(t, (geriAlinan.get(t) ?? 0) + 1)
    })
  }
  void kaynaklar
  const takimlar = Array.from({ length: takimSayisi }, (_, i) => {
    const t = i + 1
    const sahip = hucreler.filter((h) => h.takim === t)
    return { takim: t, toplam: sahip.length, ic: sahip.filter((h) => h.halka === HALKA_SAYISI - 1).length, alinan: alinan.get(t) ?? {}, geriAlinan: geriAlinan.get(t) ?? 0 }
  })
  const kusatan = takimlar.find((x) => x.ic === HUCRE_SAYISI)?.takim ?? null
  const bitti = kusatan !== null || (soruSayisi >= toplamSoru && soruSayisi > 0)
  let kazanan = kusatan
  if (kazanan === null && bitti) {
    const s = [...takimlar].sort((a, b) => b.ic - a.ic || b.toplam - a.toplam || a.takim - b.takim)
    kazanan = s[0].ic > 0 || s[0].toplam > 0 ? s[0].takim : null
  }
  void anahtar
  return { hucreler, takimlar, kusatan, oynanan: soruSayisi, bitti, kazanan }
}
