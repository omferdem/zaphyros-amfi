import { describe, expect, it } from 'vitest'
import { misafirYoklamalari } from './rapor'

describe('misafirYoklamalari', () => {
  const oturumlar = [
    { id: 'o1', lesson_id: 'hafta1' },
    { id: 'o2', lesson_id: 'hafta2' },
    { id: 'o3', lesson_id: null },
  ]
  it('aynı akışla yapılan oturuma asıl öğrenci için yoklama yazar', () => {
    const r = misafirYoklamalari(oturumlar, [{ asil_id: 'ahmet', lesson_id: 'hafta2', zaman: 'z' }])
    expect(r).toEqual([{ session_id: 'o2', student_id: 'ahmet', yontem: 'elle', zaman: 'z' }])
  })
  it('akışsız oturumla ve akışsız katılımla eşleşmez', () => {
    expect(misafirYoklamalari(oturumlar, [{ asil_id: 'ahmet', lesson_id: null, zaman: 'z' }])).toEqual([])
  })
})
