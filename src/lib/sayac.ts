// Ders sayacı: hoca süreyi (dakika ya da bitiş saati olarak) ayarlar, geri sayım sahnede görünür.
// Durum tarayıcıda saklanır; sayfa yenilense de sayaç kaldığı yerden devam eder.

export interface SayacDurumu {
  durum: 'hazir' | 'calisiyor' | 'durdu' | 'bitti'
  /** Ayarlanan toplam süre (ms), sıfırlamada buna dönülür */
  toplamMs: number
  /** Çalışırken bitiş anı (epoch ms) */
  bitis?: number
  /** Durdurulduğunda kalan süre (ms) */
  kalanMs?: number
}

export const SAYAC_BOS: SayacDurumu = { durum: 'hazir', toplamMs: 50 * 60_000 }

/** Şu an için kalan süre (ms); bitince 0. */
export function kalanSure(s: SayacDurumu, simdi: number): number {
  if (s.durum === 'calisiyor') return Math.max(0, (s.bitis ?? simdi) - simdi)
  if (s.durum === 'durdu') return Math.max(0, s.kalanMs ?? s.toplamMs)
  if (s.durum === 'bitti') return 0
  return s.toplamMs
}

export function sayaciBaslat(s: SayacDurumu, simdi: number): SayacDurumu {
  const kalan = s.durum === 'durdu' ? (s.kalanMs ?? s.toplamMs) : s.toplamMs
  if (kalan <= 0) return { ...s, durum: 'bitti' }
  return { durum: 'calisiyor', toplamMs: s.toplamMs, bitis: simdi + kalan }
}

export function sayaciDurdur(s: SayacDurumu, simdi: number): SayacDurumu {
  if (s.durum !== 'calisiyor') return s
  return { durum: 'durdu', toplamMs: s.toplamMs, kalanMs: kalanSure(s, simdi) }
}

export function sayaciSifirla(s: SayacDurumu): SayacDurumu {
  return { durum: 'hazir', toplamMs: s.toplamMs }
}

/** Çalışan ya da durmuş sayaca dakika ekler (süre bitmiş olsa da yeniden çalıştırır). */
export function sureEkle(s: SayacDurumu, dakika: number, simdi: number): SayacDurumu {
  const ek = dakika * 60_000
  if (s.durum === 'calisiyor') return { ...s, bitis: (s.bitis ?? simdi) + ek, toplamMs: s.toplamMs + ek }
  if (s.durum === 'bitti') return { durum: 'calisiyor', toplamMs: ek, bitis: simdi + ek }
  return { ...s, toplamMs: s.toplamMs + ek, kalanMs: s.durum === 'durdu' ? (s.kalanMs ?? 0) + ek : undefined }
}

/** Bitiş saatine ("10:40") kadar kalan süre (ms). Saat geçmişse ertesi güne değil, 0'a yakın hata sayılır: null döner. */
export function bitisSaatindenSure(hhmm: string, simdi: Date): number | null {
  const m = hhmm.trim().match(/^(\d{1,2})[:.](\d{2})$/)
  if (!m) return null
  const sa = Number(m[1])
  const dk = Number(m[2])
  if (sa > 23 || dk > 59) return null
  const hedef = new Date(simdi)
  hedef.setHours(sa, dk, 0, 0)
  const fark = hedef.getTime() - simdi.getTime()
  return fark > 0 ? fark : null
}

/** 3725000 -> "1:02:05", 125000 -> "02:05" */
export function sureMetni(ms: number): string {
  const toplamSn = Math.ceil(Math.max(0, ms) / 1000)
  const sa = Math.floor(toplamSn / 3600)
  const dk = Math.floor((toplamSn % 3600) / 60)
  const sn = toplamSn % 60
  const iki = (n: number) => String(n).padStart(2, '0')
  return sa > 0 ? `${sa}:${iki(dk)}:${iki(sn)}` : `${iki(dk)}:${iki(sn)}`
}
