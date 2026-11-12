// Öğrenci gelişimi: bilgi yarışması cevaplarından öğrenci x konu başarısı ve zaman içindeki eğilim.
// Bir cevap, o oturumda aynı cihazdan yoklama verilmiş öğrenciye bağlanır; takma adla oynayanlar
// (yoklaması olmayanlar) izlenemez ve ayrı sayılır.
import type { Ogrenci, Oturum, Soru } from './tipler'
import { paketAdi } from './paket'

export type Olcut = 'otomatik' | 'paket' | 'kazanim' | 'bloom'

/** Bir konuda başarı yorumlanabilsin diye gereken en az cevap sayısı */
export const AZ_VERI = 3
/** Bu oranın altı "zayıf" sayılır */
export const ZAYIF_ESIK = 0.5
/** Bu oranın üstü "güçlü" sayılır */
export const GUCLU_ESIK = 0.8

export interface CevapKaydi {
  session_id: string
  question_id: string
  cihaz_id: string
  dogru: boolean
  puan: number
  /** 0 ise süre bilinmiyor (quiz cevapları) ve ortalama süreye katılmaz */
  sure_ms: number
  /** Quiz cevapları öğrenciye doğrudan bağlıdır; yarışma cevapları yoklama üzerinden bağlanır */
  student_id?: string
  kaynak?: 'yarisma' | 'quiz'
}

export interface KatilimKaydi {
  session_id: string
  student_id: string
  /** Elle eklenen yoklamada cihaz yoktur; o oturumun cevapları bu öğrenciye bağlanamaz */
  cihaz_id: string | null
}

export interface Oran {
  dogru: number
  toplam: number
}

export interface OgrenciGelisim {
  ogrenci: Ogrenci
  cevap: number
  dogru: number
  /** 0-1; cevap yoksa null */
  oran: number | null
  /** Ortalama cevap süresi (saniye) */
  sureOrt: number | null
  puan: number
  konular: Map<string, Oran>
  /** Oturum oturum başarı (eskiden yeniye) */
  oturumlar: { oturum: string; oran: number; cevap: number }[]
  /** Son oturumların başarısı eksi ilk oturumların başarısı, yüzde puan; en az 2 oturum gerekir */
  egilim: number | null
}

export interface KonuOzeti {
  konu: string
  dogru: number
  toplam: number
  oran: number | null
  /** Bu konuda yorumlanabilir veriye (AZ_VERI cevap) sahip öğrenci sayısı */
  ogrenci: number
  /** Bunlardan başarısı ZAYIF_ESIK altında olanlar */
  zayif: number
}

export interface GelisimSonucu {
  ogrenciler: OgrenciGelisim[]
  /** En zayıf konu başta */
  konular: KonuOzeti[]
  toplamCevap: number
  izlenenCevap: number
  /** Takma adla verilmiş ya da öğrenciye bağlanamayan cevaplar */
  izlenemeyen: number
  oturumSayisi: number
}

/** Sorunun konusu: Otomatik'te kazanım (#OUTCOME), yoksa paket adı. */
export function konuAdi(s: Pick<Soru, 'ek'> | undefined, olcut: Olcut): string {
  const ek = s?.ek ?? {}
  const kazanim = (ek.outcome ?? '').trim()
  const bloom = (ek.bloom ?? '').trim()
  const paket = paketAdi({ ek })
  const ad = olcut === 'paket' ? paket : olcut === 'kazanim' ? kazanim : olcut === 'bloom' ? bloom : kazanim || paket
  return ad || 'Konusuz'
}

export function oranHesapla(o: Oran | undefined): number | null {
  return o && o.toplam > 0 ? o.dogru / o.toplam : null
}

function ortalama(l: number[]): number {
  return l.reduce((t, x) => t + x, 0) / l.length
}

/** İlk yarı ile son yarı oturum başarılarının farkı (yüzde puan). */
export function egilimHesapla(oranlar: number[]): number | null {
  if (oranlar.length < 2) return null
  const yarim = Math.floor(oranlar.length / 2)
  return Math.round((ortalama(oranlar.slice(-yarim)) - ortalama(oranlar.slice(0, yarim))) * 100)
}

export function gelisimHesapla(
  ogrenciler: Ogrenci[],
  cevaplar: CevapKaydi[],
  katilimlar: KatilimKaydi[],
  sorular: Soru[],
  oturumlar: Pick<Oturum, 'id' | 'basladi'>[],
  olcut: Olcut = 'otomatik',
): GelisimSonucu {
  const soruHaritasi = new Map(sorular.map((s) => [s.id, s]))
  const ogrenciHaritasi = new Map(ogrenciler.map((o) => [o.id, o]))
  const sira = new Map(oturumlar.map((o, i) => [o.id, { basladi: o.basladi, i }]))

  const eslesme = new Map<string, string>()
  for (const k of katilimlar) {
    if (k.cihaz_id && ogrenciHaritasi.has(k.student_id)) eslesme.set(`${k.session_id}|${k.cihaz_id}`, k.student_id)
  }

  interface Birikim {
    cevap: number
    dogru: number
    sure: number
    sureSayisi: number
    puan: number
    konular: Map<string, Oran>
    oturumlar: Map<string, Oran>
  }
  const birikim = new Map<string, Birikim>()
  let izlenemeyen = 0

  for (const c of cevaplar) {
    const ogrenciId = c.student_id && ogrenciHaritasi.has(c.student_id) ? c.student_id : eslesme.get(`${c.session_id}|${c.cihaz_id}`)
    if (!ogrenciId) {
      izlenemeyen++
      continue
    }
    let b = birikim.get(ogrenciId)
    if (!b) {
      b = { cevap: 0, dogru: 0, sure: 0, sureSayisi: 0, puan: 0, konular: new Map(), oturumlar: new Map() }
      birikim.set(ogrenciId, b)
    }
    const d = c.dogru ? 1 : 0
    b.cevap++
    b.dogru += d
    if (c.sure_ms > 0) {
      b.sure += c.sure_ms
      b.sureSayisi++
    }
    b.puan += c.puan
    const konu = konuAdi(soruHaritasi.get(c.question_id), olcut)
    const k = b.konular.get(konu) ?? { dogru: 0, toplam: 0 }
    k.dogru += d
    k.toplam++
    b.konular.set(konu, k)
    const o = b.oturumlar.get(c.session_id) ?? { dogru: 0, toplam: 0 }
    o.dogru += d
    o.toplam++
    b.oturumlar.set(c.session_id, o)
  }

  const liste: OgrenciGelisim[] = ogrenciler.map((ogrenci) => {
    const b = birikim.get(ogrenci.id)
    const oturumListesi = b
      ? [...b.oturumlar.entries()]
          .sort((x, y) => (sira.get(x[0])?.basladi ?? '').localeCompare(sira.get(y[0])?.basladi ?? ''))
          .map(([oturum, o]) => ({ oturum, oran: o.dogru / o.toplam, cevap: o.toplam }))
      : []
    return {
      ogrenci,
      cevap: b?.cevap ?? 0,
      dogru: b?.dogru ?? 0,
      oran: b && b.cevap > 0 ? b.dogru / b.cevap : null,
      sureOrt: b && b.sureSayisi > 0 ? b.sure / b.sureSayisi / 1000 : null,
      puan: b?.puan ?? 0,
      konular: b?.konular ?? new Map(),
      oturumlar: oturumListesi,
      egilim: egilimHesapla(oturumListesi.map((x) => x.oran)),
    }
  })

  const konuToplam = new Map<string, KonuOzeti>()
  for (const g of liste) {
    for (const [konu, o] of g.konular) {
      const k = konuToplam.get(konu) ?? { konu, dogru: 0, toplam: 0, oran: null, ogrenci: 0, zayif: 0 }
      k.dogru += o.dogru
      k.toplam += o.toplam
      if (o.toplam >= AZ_VERI) {
        k.ogrenci++
        if (o.dogru / o.toplam < ZAYIF_ESIK) k.zayif++
      }
      konuToplam.set(konu, k)
    }
  }
  const konular = [...konuToplam.values()]
    .map((k) => ({ ...k, oran: k.toplam > 0 ? k.dogru / k.toplam : null }))
    .sort((a, b) => (a.oran ?? 2) - (b.oran ?? 2) || b.toplam - a.toplam)

  return {
    ogrenciler: liste,
    konular,
    toplamCevap: cevaplar.length,
    izlenenCevap: cevaplar.length - izlenemeyen,
    izlenemeyen,
    oturumSayisi: new Set(cevaplar.map((c) => c.session_id)).size,
  }
}

/** Öğrencinin yeterli veriye sahip en güçlü ve en zayıf konusu. */
export function guclüVeZayif(g: OgrenciGelisim): { guclu: string | null; zayif: string | null } {
  const yorumlanabilir = [...g.konular.entries()].filter(([, o]) => o.toplam >= AZ_VERI).map(([k, o]) => ({ k, oran: o.dogru / o.toplam }))
  if (yorumlanabilir.length === 0) return { guclu: null, zayif: null }
  yorumlanabilir.sort((a, b) => a.oran - b.oran)
  const zayif = yorumlanabilir[0]
  const guclu = yorumlanabilir[yorumlanabilir.length - 1]
  return {
    zayif: zayif.oran < GUCLU_ESIK ? zayif.k : null,
    guclu: guclu.oran >= ZAYIF_ESIK && guclu.k !== zayif.k ? guclu.k : null,
  }
}
