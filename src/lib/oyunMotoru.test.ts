import { describe, expect, it } from 'vitest'
import { enerjiHesapla, gorunenAd, kalabalikAyari, sahteOyuncular } from './oyunMotoru'

describe('enerjiHesapla', () => {
  it('başlangıç 50, açılmamış sorular sayılmaz', () => {
    expect(enerjiHesapla([]).enerji).toBe(50)
    expect(enerjiHesapla([null, null]).enerji).toBe(50)
  })
  it('doğru +15, yanlış −15, cevapsız −10', () => {
    expect(enerjiHesapla([1]).enerji).toBe(65)
    expect(enerjiHesapla([0]).enerji).toBe(35)
    expect(enerjiHesapla([-1]).enerji).toBe(40)
  })
  it('üçüncü ardışık doğruda +10 ek', () => {
    const d = enerjiHesapla([1, 1, 1])
    expect(d.enerji).toBe(100)
    expect(d.seri).toBe(3)
    expect(d.sonDegisim).toBe(25)
  })
  it('0 ile 100 arasında kalır', () => {
    expect(enerjiHesapla([0, 0, 0, 0, 0]).enerji).toBe(0)
    expect(enerjiHesapla([1, 1, 1, 1, 1, 1]).enerji).toBe(100)
  })
  it('yanlış seriyi bozar, en uzun seri tutulur', () => {
    const d = enerjiHesapla([1, 1, 1, 0, 1])
    expect(d.seri).toBe(1)
    expect(d.enSeri).toBe(3)
    expect(d.son).toBe('arti')
  })
})

describe('kalabalık', () => {
  it('80 oyuncuya kadar ölçek küçülür, 40 üstünde adlar yalnızca özel oyuncularda', () => {
    expect(kalabalikAyari(10).isim).toBe('tam')
    expect(kalabalikAyari(30).isim).toBe('ilk-ad')
    expect(kalabalikAyari(80)).toEqual({ olcek: 0.5, isim: 'yalniz-uclar' })
    expect(gorunenAd('Ayşe Yılmaz', kalabalikAyari(30), false)).toBe('Ayşe')
    expect(gorunenAd('Ayşe Yılmaz', kalabalikAyari(80), false)).toBe('')
    expect(gorunenAd('Ayşe Yılmaz', kalabalikAyari(80), true)).toBe('Ayşe')
  })
})

describe('sahte oyuncular', () => {
  it('istenen sayıda ve başarı düzeyinde üretir', () => {
    for (const basari of [0.3, 0.6, 0.9]) {
      const o = sahteOyuncular(80, basari, 20)
      expect(o).toHaveLength(80)
      const dogru = o.flatMap((x) => x.sonuc).filter((s) => s === 1).length / (80 * 20)
      expect(Math.abs(dogru - basari)).toBeLessThan(0.08)
    }
  })
})
