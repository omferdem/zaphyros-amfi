import { describe, expect, it } from 'vitest'
import { ormanHesapla, patikaUzunlugu } from './orman'

const sorular = (n: number, acilan = n) => Array.from({ length: n }, (_, i) => ({ adim: `s${i}`, sira: i + 1, acildi: i < acilan }))
const oyuncu = (ad: string, sonuc: (1 | 0 | -1)[]) => ({ ad, sonuc })

describe('orman', () => {
  it('patika soru sayısının %60\'ı kadardır', () => {
    expect(patikaUzunlugu(10)).toBe(6)
    expect(patikaUzunlugu(20)).toBe(12)
    expect(patikaUzunlugu(2)).toBe(3)
  })
  it('çoğunu bilen eve varır, bilmeyen kurda yakalanır', () => {
    const d = ormanHesapla(sorular(10), [oyuncu('Güçlü', Array(10).fill(1)), oyuncu('Zayıf', Array(10).fill(0))])!
    expect(d.oyuncular[0].durum).toBe('evde')
    expect(d.oyuncular[0].bittigiSoru).toBe(6)
    expect(d.oyuncular[1].durum).toBe('kapildi')
    expect(d.siralama[0].ad).toBe('Güçlü')
    expect(d.bitti).toBe(true)
  })
  it('üst üste 3 doğru kalp geri getirir, en çok 3 kalp', () => {
    const d = ormanHesapla(sorular(20, 4), [oyuncu('A', [0, 1, 1, 1, ...Array(16).fill(null)] as never)])!
    expect(d.oyuncular[0].fener).toBe(1)
    const t = ormanHesapla(sorular(20, 6), [oyuncu('B', [1, 1, 1, 1, 1, 1, ...Array(14).fill(null)] as never)])!
    expect(t.oyuncular[0].kalp).toBe(3)
  })
  it('kalbi 1\'e düşen olunca kurt gözleri belirir; gökyüzü kararır', () => {
    const d = ormanHesapla(sorular(10, 3), [oyuncu('A', [0, 0, 1, ...Array(7).fill(null)] as never)])!
    expect(d.oyuncular[0].kalp).toBe(1)
    expect(d.kurtGozu).toBe(true)
    expect(d.karanlik).toBeCloseTo(0.3)
  })
  it('soru ya da oyuncu yoksa durum yoktur', () => {
    expect(ormanHesapla([], [])).toBeNull()
  })
})
