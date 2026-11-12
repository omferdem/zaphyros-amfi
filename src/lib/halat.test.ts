import { describe, expect, it } from 'vitest'
import { halatHesapla } from './takim'

describe('halatHesapla', () => {
  it('eşitlikte ortada durur', () => {
    expect(halatHesapla({ dogru: 4, uye: 2 }, { dogru: 4, uye: 2 })).toEqual({ konum: 0, kazanan: null })
  })
  it('doğru cevabı çok olan takım halatı kendine çeker', () => {
    const r = halatHesapla({ dogru: 6, uye: 2 }, { dogru: 4, uye: 2 })
    expect(r.konum).toBeLessThan(0)
    expect(r.kazanan).toBeNull()
  })
  it('üye sayısını hesaba katar', () => {
    // 1. takımda 6 doğru 3 kişi (2), 2. takımda 4 doğru 1 kişi (4): 2. takım önde
    expect(halatHesapla({ dogru: 6, uye: 3 }, { dogru: 4, uye: 1 }).konum).toBeGreaterThan(0)
  })
  it('eşiği aşan takım kazanır ve konum sınırlı kalır', () => {
    expect(halatHesapla({ dogru: 20, uye: 2 }, { dogru: 2, uye: 2 })).toEqual({ konum: -1, kazanan: 1 })
    expect(halatHesapla({ dogru: 0, uye: 2 }, { dogru: 10, uye: 2 })).toEqual({ konum: 1, kazanan: 2 })
  })
  it('üyesiz takım 0 sayılır', () => {
    expect(halatHesapla({ dogru: 0, uye: 0 }, { dogru: 3, uye: 1 }).kazanan).toBe(2)
  })
})
