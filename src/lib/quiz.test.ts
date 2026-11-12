import { describe, expect, it } from 'vitest'
import { maddeAnalizi, quizSonuclari, type QuizCevap, type QuizDeneme } from './quizHesap'
import type { Ogrenci } from './tipler'

const ogr = (id: string, no: string): Ogrenci => ({ id, course_id: 'c', ogrenci_no: no, ad_soyad: `Öğrenci ${no}` })
const deneme = (student: string, basladi: string, bitti: string | null): QuizDeneme => ({ id: `d-${student}`, quiz_id: 'z', student_id: student, basladi, bitti })
const cevap = (student: string, soru: string, dogru: boolean): QuizCevap => ({ quiz_id: 'z', student_id: student, question_id: soru, dogru })

describe('quizSonuclari', () => {
  const ogrenciler = [ogr('1', '1001'), ogr('2', '1002'), ogr('3', '1003')]
  const denemeler = [deneme('1', '2026-10-01T10:00:00Z', '2026-10-01T10:06:00Z'), deneme('2', '2026-10-01T10:00:00Z', null)]
  const cevaplar = [cevap('1', 'a', true), cevap('1', 'b', true), cevap('1', 'c', false), cevap('2', 'a', true)]
  const s = quizSonuclari(ogrenciler, denemeler, cevaplar, 4)

  it('doğru sayısını soru sayısına böler, cevaplanmayan soruyu yanlış sayar', () => {
    expect(s[0].dogru).toBe(2)
    expect(s[0].cevaplanan).toBe(3)
    expect(s[0].oran).toBe(0.5)
    expect(s[1].oran).toBe(0.25)
  })
  it('girmeyen öğrenciyi boş bırakır', () => {
    expect(s[2].deneme).toBeNull()
    expect(s[2].oran).toBeNull()
    expect(s[2].sureDk).toBeNull()
  })
  it('çözme süresini dakika olarak verir, bitmeyenler için boş bırakır', () => {
    expect(s[0].sureDk).toBe(6)
    expect(s[1].sureDk).toBeNull()
  })
})

describe('maddeAnalizi', () => {
  it('en zor soru başta olacak biçimde soru bazında başarıyı verir', () => {
    const m = maddeAnalizi(
      [cevap('1', 'a', true), cevap('2', 'a', true), cevap('1', 'b', false), cevap('2', 'b', true)],
      [
        { id: 'a', soru: 'Kolay' },
        { id: 'b', soru: 'Zor' },
        { id: 'c', soru: 'Cevapsız' },
      ],
    )
    expect(m.map((x) => x.soru)).toEqual(['Zor', 'Kolay', 'Cevapsız'])
    expect(m[0].oran).toBe(0.5)
    expect(m[2].oran).toBeNull()
  })
})
