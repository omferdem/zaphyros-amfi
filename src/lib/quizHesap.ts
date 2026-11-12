// Habersiz quiz: tipler ve sonuc hesabi (Supabase'e bagimli degil, birim testlenir).
import type { Ogrenci } from './tipler'

export interface Quiz {
  id: string
  course_id: string
  baslik: string
  kod: string
  sure_dk: number
  sonuc_ogrenciye: boolean
  durum: 'acik' | 'kapali'
  basladi: string
  kapandi: string | null
}

export interface QuizDeneme {
  id: string
  quiz_id: string
  student_id: string
  basladi: string
  bitti: string | null
}

export interface QuizCevap {
  quiz_id: string
  student_id: string
  question_id: string
  dogru: boolean
}

export interface QuizSoruBagi {
  quiz_id: string
  question_id: string
}

export interface QuizSatiri {
  ogrenci: Ogrenci
  deneme: QuizDeneme | null
  cevaplanan: number
  dogru: number
  toplam: number
  /** 0-1; deneme yoksa null (cevaplanmayan sorular yanlış sayılır) */
  oran: number | null
  /** Çözme süresi (dakika); deneme bitmediyse null */
  sureDk: number | null
}

export interface MaddeAnalizi {
  soru: string
  /** Doğru cevaplayan / cevaplayan, 0-1 */
  oran: number | null
  cevaplayan: number
}

/** Bir quizin öğrenci sonuçları. Cevaplanmayan soru yanlış sayılır; hiç girmeyen öğrenci satırı boştur. */
export function quizSonuclari(ogrenciler: Ogrenci[], denemeler: QuizDeneme[], cevaplar: QuizCevap[], toplamSoru: number): QuizSatiri[] {
  const denemeHaritasi = new Map(denemeler.map((d) => [d.student_id, d]))
  const cevapSayilari = new Map<string, { cevaplanan: number; dogru: number }>()
  for (const c of cevaplar) {
    const s = cevapSayilari.get(c.student_id) ?? { cevaplanan: 0, dogru: 0 }
    s.cevaplanan++
    if (c.dogru) s.dogru++
    cevapSayilari.set(c.student_id, s)
  }
  return ogrenciler.map((ogrenci) => {
    const deneme = denemeHaritasi.get(ogrenci.id) ?? null
    const s = cevapSayilari.get(ogrenci.id) ?? { cevaplanan: 0, dogru: 0 }
    return {
      ogrenci,
      deneme,
      cevaplanan: s.cevaplanan,
      dogru: s.dogru,
      toplam: toplamSoru,
      oran: deneme && toplamSoru > 0 ? s.dogru / toplamSoru : null,
      sureDk: deneme?.bitti ? Math.round(((new Date(deneme.bitti).getTime() - new Date(deneme.basladi).getTime()) / 60000) * 10) / 10 : null,
    }
  })
}

/** Soru bazında başarı: hangi soru ne kadar zor çıktı. */
export function maddeAnalizi(cevaplar: QuizCevap[], sorular: { id: string; soru: string }[]): MaddeAnalizi[] {
  return sorular
    .map((s) => {
      const l = cevaplar.filter((c) => c.question_id === s.id)
      return { soru: s.soru, cevaplayan: l.length, oran: l.length ? l.filter((c) => c.dogru).length / l.length : null }
    })
    .sort((a, b) => (a.oran ?? 2) - (b.oran ?? 2))
}
