import { describe, expect, it } from 'vitest'
import { KURTULMA_ORANI, zirveSeviyesi, zombiHesapla, zombiSeviyesi, type ZombiSorusu } from './zombi'

function sorular(toplam: number, acilan: number): ZombiSorusu[] {
  return Array.from({ length: toplam }, (_, i) => ({ adim: `s${i}`, sira: i + 1, acildi: i < acilan }))
}
function sonuc(toplam: number, acilan: number, deger: (i: number) => 1 | 0 | -1): (1 | 0 | -1 | null)[] {
  return Array.from({ length: toplam }, (_, i) => (i < acilan ? deger(i) : null))
}

describe('zombi kaçışı', () => {
  it('zirve soru sayısına göre 5-12 arasında', () => {
    expect(zirveSeviyesi(20)).toBe(10)
    expect(zirveSeviyesi(4)).toBe(5)
    expect(zirveSeviyesi(40)).toBe(12)
  })
  it('zombi sürüsü yavaş yavaş yükselir ve zirveye ulaşmaz', () => {
    expect(zombiSeviyesi(0, 20, 10)).toBe(0)
    expect(zombiSeviyesi(10, 20, 10)).toBe(3)
    expect(zombiSeviyesi(20, 20, 10)).toBeLessThan(10)
  })
  it('hep doğru bilen zirveye çıkar, hiç bilmeyen yakalanır', () => {
    const d = zombiHesapla(sorular(20, 20), [
      { ad: 'Ayşe', sonuc: sonuc(20, 20, () => 1) },
      { ad: 'Mehmet', sonuc: sonuc(20, 20, () => 0) },
    ])!
    expect(d.oyuncular[0].durum).toBe('zirve')
    expect(d.oyuncular[1].durum).toBe('yakalandi')
    expect(d.zirvede).toBe(1)
    expect(d.yakalanan).toBe(1)
    expect(d.bitti).toBe(true)
    expect(d.kazandi).toBe(false)
  })
  it('sınıfın %70\'i zirveye çıkınca kazanılır', () => {
    const oy = Array.from({ length: 10 }, (_, i) => ({ ad: `Ö${i}`, sonuc: sonuc(20, 20, () => (i < 7 ? 1 : 0)) }))
    const d = zombiHesapla(sorular(20, 20), oy)!
    expect(d.oran).toBeCloseTo(KURTULMA_ORANI)
    expect(d.kazandi).toBe(true)
    const az = zombiHesapla(sorular(20, 20), oy.map((o, i) => ({ ...o, sonuc: sonuc(20, 20, () => (i < 6 ? 1 : 0)) })))!
    expect(az.kazandi).toBe(false)
  })
  it('oyun bitmeden zirvedekiler yetmediği sürece kazanıldı denmez; oynanmamış sorular sayılmaz', () => {
    const d = zombiHesapla(sorular(20, 5), [{ ad: 'A', sonuc: sonuc(20, 5, () => 1) }])!
    expect(d.oynanan).toBe(5)
    expect(d.bitti).toBe(false)
    expect(d.oyuncular[0].seviye).toBe(5)
    expect(d.kazandi).toBe(false)
  })
  it('soru yoksa durum yoktur; cevapsız öğrenci zombiye yakalanır', () => {
    expect(zombiHesapla([], [])).toBeNull()
    const d = zombiHesapla(sorular(20, 10), [{ ad: 'Sessiz', sonuc: sonuc(20, 10, () => -1) }])!
    expect(d.oyuncular[0].durum).toBe('yakalandi')
  })
})
