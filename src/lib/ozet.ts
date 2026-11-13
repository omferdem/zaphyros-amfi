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
  const sirali = [...oturumlar].sort((a, b) => a.basladi.localeCompare(b.basladi))
  const katilim = new Map<string, Set<string>>()
  for (const y of yoklamalar) {
    if (!katilim.has(y.session_id)) katilim.set(y.session_id, new Set())
    katilim.get(y.session_id)!.add(y.student_id)
  }
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

