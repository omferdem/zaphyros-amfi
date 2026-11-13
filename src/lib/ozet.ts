// Dönem sonu özeti: bir şubenin hafta hafta katılımı, öğrenci bazında devamı ve quiz sonuçları (Supabase'e bağımlı değil).
import type { Ogrenci, Oturum, Yoklama } from './tipler'
import { quizSonuclari, type Quiz, type QuizCevap, type QuizDeneme, type QuizSoruBagi } from './quizHesap'

/** Devam oranı bunun altındaysa öğrenci "risk altında" sayılır. */
export const RISK_ESIGI = 0.5

export interface HaftaOzeti {
  oturum: Oturum
  katilan: number
  mevcut: number
  oran: number
}

export interface OgrenciOzeti {
  ogrenci: Ogrenci
  katildigi: number
  /** Ders sayısına göre devam oranı (0-1) */
  oran: number
  risk: boolean
  /** Son iki oturumun ikisine de gelmediyse true (yeni devamsızlık uyarısı) */
  sonDevamsiz: boolean
}

export interface QuizOzeti {
  quiz: Quiz
  katilan: number
  bitiren: number
  /** Sınıf ortalaması 0-1; katılan yoksa null */
  ortalama: number | null
}

export interface DonemOzeti {
  haftalar: HaftaOzeti[]
  ogrenciler: OgrenciOzeti[]
  quizler: QuizOzeti[]
  ortalamaKatilim: number
  riskli: number
}

export function ozetHesapla(
  ogrenciler: Ogrenci[],
  oturumlar: Oturum[],
  yoklamalar: Yoklama[],
  quizler: Quiz[] = [],
  denemeler: QuizDeneme[] = [],
  cevaplar: QuizCevap[] = [],
  baglar: QuizSoruBagi[] = [],
): DonemOzeti {
  // Gerçek yoklama kaydı olmayan (başka şubeden varsayılan) satırlar da sayılır: öğrenci derse katılmış demektir.
  const katilim = new Map<string, Set<string>>()
  for (const y of yoklamalar) {
    if (!katilim.has(y.session_id)) katilim.set(y.session_id, new Set())
    katilim.get(y.session_id)!.add(y.student_id)
  }
  // Kimsenin katılmadığı oturum (deneme, yanlışlıkla açılmış) yapılmış ders sayılmaz; yoksa katılım oranını ve riski bozar.
  const sirali = [...oturumlar].filter((o) => (katilim.get(o.id)?.size ?? 0) > 0).sort((a, b) => a.basladi.localeCompare(b.basladi))
  const mevcut = ogrenciler.length
  const haftalar: HaftaOzeti[] = sirali.map((oturum) => {
    const katilan = ogrenciler.filter((o) => katilim.get(oturum.id)?.has(o.id)).length
    return { oturum, katilan, mevcut, oran: mevcut ? katilan / mevcut : 0 }
  })
  const son2 = sirali.slice(-2)
  const ogr: OgrenciOzeti[] = ogrenciler.map((ogrenci) => {
    const katildigi = sirali.filter((o) => katilim.get(o.id)?.has(ogrenci.id)).length
    const oran = sirali.length ? katildigi / sirali.length : 0
    return {
      ogrenci,
      katildigi,
      oran,
      risk: sirali.length >= 2 && oran < RISK_ESIGI,
      sonDevamsiz: son2.length === 2 && son2.every((o) => !katilim.get(o.id)?.has(ogrenci.id)),
    }
  })
  const quizOzetleri: QuizOzeti[] = quizler.map((quiz) => {
    const soruSayisi = baglar.filter((b) => b.quiz_id === quiz.id).length
    const d = denemeler.filter((x) => x.quiz_id === quiz.id)
    const c = cevaplar.filter((x) => x.quiz_id === quiz.id)
    const satirlar = quizSonuclari(ogrenciler, d, c, soruSayisi).filter((s) => s.deneme)
    const oranlar = satirlar.map((s) => s.oran ?? 0)
    return {
      quiz,
      katilan: d.length,
      bitiren: d.filter((x) => x.bitti).length,
      ortalama: oranlar.length ? oranlar.reduce((a, b) => a + b, 0) / oranlar.length : null,
    }
  })
  return {
    haftalar,
    ogrenciler: ogr,
    quizler: quizOzetleri,
    ortalamaKatilim: haftalar.length ? haftalar.reduce((t, h) => t + h.oran, 0) / haftalar.length : 0,
    riskli: ogr.filter((o) => o.risk).length,
  }
}


export interface SampiyonSatiri {
  ogrenci: Ogrenci
  puan: number
  dogru: number
  /** Kaç derste yarışmaya katıldı */
  ders: number
}

export interface HaftaBirincisi {
  oturum: Oturum
  ogrenci: Ogrenci
  puan: number
}

export interface Sampiyonlar {
  /** Dönem boyunca toplam puana göre sıralı (puanı olmayanlar yok) */
  siralama: SampiyonSatiri[]
  haftalar: HaftaBirincisi[]
}

/**
 * Dönemin şampiyonları: yarışma puanları (responses) yoklamadaki cihaz eşleşmesiyle öğrencilere bağlanır ve toplanır.
 * Elle eklenen yoklamada cihaz yoktur; o öğrencinin cevapları bağlanamaz (puan alamaz).
 */
export function sampiyonlariHesapla(
  ogrenciler: Ogrenci[],
  oturumlar: Oturum[],
  cevaplar: { session_id: string; cihaz_id: string; dogru: boolean; puan: number }[],
  katilimlar: { session_id: string; student_id: string; cihaz_id: string | null }[],
): Sampiyonlar {
  const ogrenci = new Map(ogrenciler.map((o) => [o.id, o]))
  const cihazOgrenci = new Map<string, string>()
  for (const k of katilimlar) if (k.cihaz_id && ogrenci.has(k.student_id)) cihazOgrenci.set(`${k.session_id}|${k.cihaz_id}`, k.student_id)
  const toplam = new Map<string, { puan: number; dogru: number; dersler: Set<string> }>()
  const oturumPuan = new Map<string, Map<string, number>>()
  for (const c of cevaplar) {
    const sid = cihazOgrenci.get(`${c.session_id}|${c.cihaz_id}`)
    if (!sid) continue
    const t = toplam.get(sid) ?? { puan: 0, dogru: 0, dersler: new Set<string>() }
    t.puan += c.puan
    if (c.dogru) t.dogru++
    t.dersler.add(c.session_id)
    toplam.set(sid, t)
    const m = oturumPuan.get(c.session_id) ?? new Map<string, number>()
    m.set(sid, (m.get(sid) ?? 0) + c.puan)
    oturumPuan.set(c.session_id, m)
  }
  const siralama: SampiyonSatiri[] = [...toplam.entries()]
    .filter(([, t]) => t.puan > 0)
    .map(([sid, t]) => ({ ogrenci: ogrenci.get(sid)!, puan: t.puan, dogru: t.dogru, ders: t.dersler.size }))
    .sort((a, b) => b.puan - a.puan || b.dogru - a.dogru)
  const haftalar: HaftaBirincisi[] = []
  for (const o of [...oturumlar].sort((a, b) => a.basladi.localeCompare(b.basladi))) {
    const m = oturumPuan.get(o.id)
    if (!m) continue
    const [sid, puan] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    if (puan > 0) haftalar.push({ oturum: o, ogrenci: ogrenci.get(sid)!, puan })
  }
  return { siralama, haftalar }
}
