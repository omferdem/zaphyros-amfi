import { describe, expect, it } from 'vitest'
import { halatTurHesapla, kuleBlokHedefi, kuleTurHesapla, soruBlogu, takimGucu, type TakimOzeti } from './takimOyunlari'

/** İki takım; her soruda takım 1 `o1`, takım 2 `o2` oranında doğru bilir (yanlışlar kalan). */
function ozet(soru: number, acilan: number, o1: number, o2: number, uye = 10): TakimOzeti {
  const say = (o: number) => ({ dogru: Math.round(uye * o), yanlis: uye - Math.round(uye * o) })
  return {
    sayi: 2,
    sorular: Array.from({ length: soru }, (_, i) => ({ adim: `s${i}`, sira: i + 1, acildi: i < acilan })),
    takimlar: [
      { takim: 1, uye, sorular: Array.from({ length: soru }, () => say(o1)) },
      { takim: 2, uye, sorular: Array.from({ length: soru }, () => say(o2)) },
    ],
  }
}

describe('halat', () => {
  it('takım gücü doğru, yanlış ve cevapsızı ağırlıklar', () => {
    expect(takimGucu({ dogru: 10, yanlis: 0 }, 10)).toBe(1)
    expect(takimGucu({ dogru: 0, yanlis: 10 }, 10)).toBe(-0.5)
    expect(takimGucu({ dogru: 0, yanlis: 0 }, 10)).toBe(-0.25)
    expect(takimGucu({ dogru: 1, yanlis: 1 }, 0)).toBe(0)
  })
  it('yüzde 80 bilen takım yüzde 50 bilen takıma karşı 6-7 soruda kazanır', () => {
    for (let soru = 1; soru <= 12; soru++) {
      const h = halatTurHesapla(ozet(12, soru, 0.8, 0.5))!
      if (h.kazanan) {
        expect(h.kazanan).toBe(1)
        expect(soru).toBeGreaterThanOrEqual(6)
        expect(soru).toBeLessThanOrEqual(7)
        return
      }
    }
    throw new Error('kazanan çıkmadı')
  })
  it('eşit takımlarda halat ortada kalır, sorular bitince kimse kazanmaz', () => {
    const h = halatTurHesapla(ozet(10, 10, 0.6, 0.6))!
    expect(h.p).toBe(0)
    expect(h.kazanan).toBeNull()
    expect(h.bitti).toBe(true)
  })
  it('sorular bitince halatı kendi tarafında tutan kazanır; açılmamış sorular sayılmaz', () => {
    const h = halatTurHesapla(ozet(20, 3, 0.5, 0.6))!
    expect(h.oynanan).toBe(3)
    expect(h.bitti).toBe(false)
    expect(h.p).toBeGreaterThan(0)
    const son = halatTurHesapla(ozet(3, 3, 0.5, 0.6))!
    expect(son.kazanan).toBe(2)
    expect(halatTurHesapla({ sayi: 2, sorular: [], takimlar: [] })).toBeNull()
  })
})

describe('kule', () => {
  it('doğru oranına göre 0-3 blok', () => {
    expect([0.1, 0.3, 0.6, 0.9].map((o) => soruBlogu(Math.round(o * 10), 10))).toEqual([0, 1, 2, 3])
    expect(kuleBlokHedefi(10)).toBe(15)
  })
  it('güçlü takımın kulesi hızlı yükselir, hedefte kesilir ve kazanır', () => {
    const d = kuleTurHesapla(ozet(10, 10, 0.9, 0.3))!
    expect(d.kazanan).toBe(1)
    expect(d.satirlar[0].katlar).toBeLessThanOrEqual(d.hedef)
    expect(d.satirlar[0].sira).toBe(1)
  })
  it('takımın yarısından fazlası bilmezse rüzgâr en üst bloğu düşürür', () => {
    // takım 2 her soruda yüzde 30 bilir: +1 blok, rüzgâr -1 blok, kule yükselmez
    const d = kuleTurHesapla(ozet(10, 4, 0.9, 0.3))!
    expect(d.satirlar[1].blok).toBe(0)
    expect(d.satirlar[0].blok).toBe(12)
  })
  it('1 ve 80 kişilik takımla bozulmaz', () => {
    const tek = kuleTurHesapla(ozet(10, 5, 1, 0, 1))!
    expect(tek.satirlar[0].blok).toBe(15)
    const buyuk = kuleTurHesapla(ozet(10, 5, 0.8, 0.6, 80))!
    expect(buyuk.satirlar.every((s) => Number.isFinite(s.blok))).toBe(true)
  })
})
