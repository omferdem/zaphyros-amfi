import { describe, expect, it } from 'vitest'
import { KURTULMA_ORANI, zirveSeviyesi, zombiHesapla, zombiSeviyesi, type ZombiSorusu } from './zombi'

function sorular(toplam: number, acilan: number): ZombiSorusu[] {
  return Array.from({ length: toplam }, (_, i) => ({ adim: `s${i}`, sira: i + 1, acildi: i < acilan }))
}
function sonuc(toplam: number, acilan: number, deger: (i: number) => 1 | 0 | -1): (1 | 0 | -1 | null)[] {
  return Array.from({ length: toplam }, (_, i) => (i < acilan ? deger(i) : null))
}

/** Doğruları soru boyunca eşit yayılmış, verilen başarı oranında oyuncu. */
function oranli(toplam: number, oran: number) {
  return sonuc(toplam, toplam, (i) => (Math.floor((i + 1) * oran + 1e-9) > Math.floor(i * oran + 1e-9) ? 1 : 0))
}
const durumu = (toplam: number, oran: number) => zombiHesapla(sorular(toplam, toplam), [{ ad: 'X', sonuc: oranli(toplam, oran) }])!.oyuncular[0].durum

describe('zombi sayısal hedefleri', () => {
  it('15-30 soruda %40 bilen yakalanır, %60 bilen kurtulur, %80 bilen zirveye çıkar', () => {
    for (const n of [15, 20, 30]) {
      expect(durumu(n, 0.4)).toBe('yakalandi')
      expect(durumu(n, 0.6)).toBe('canli')
      expect(durumu(n, 0.8)).toBe('zirve')
    }
  })
  it('üst üste 3 yanlış bir kat aşağı kaydırır', () => {
    const d = zombiHesapla(sorular(20, 6), [{ ad: 'A', sonuc: [1, 1, 1, 1, 0, 0, ...Array(14).fill(null)] }])!
    // 4 doğru = 2 kat; 2 yanlış kaydırmaz
    expect(d.oyuncular[0].seviye).toBe(2)
    const e = zombiHesapla(sorular(20, 7), [{ ad: 'A', sonuc: [1, 1, 1, 1, 0, 0, 0, ...Array(13).fill(null)] }])!
    expect(e.oyuncular[0].seviye).toBe(1)
  })
})

describe('zombi kaçışı', () => {
  it('zirve soru sayısının yüzde kırkı, 3-12 arasında', () => {
    expect(zirveSeviyesi(20)).toBe(8)
    expect(zirveSeviyesi(10)).toBe(4)
    expect(zirveSeviyesi(4)).toBe(3)
    expect(zirveSeviyesi(40)).toBe(12)
  })
  it('zombi sürüsü yavaş yavaş yükselir ve zirveye ulaşmaz', () => {
    expect(zombiSeviyesi(0, 20)).toBe(-2)
    expect(zombiSeviyesi(6, 20)).toBe(0)
    expect(zombiSeviyesi(20, 20)).toBeLessThan(zirveSeviyesi(20))
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
    expect(d.oyuncular[0].seviye).toBe(2)
    expect(d.kazandi).toBe(false)
  })
  it('soru yoksa durum yoktur; cevapsız öğrenci zombiye yakalanır', () => {
    expect(zombiHesapla([], [])).toBeNull()
    const d = zombiHesapla(sorular(20, 10), [{ ad: 'Sessiz', sonuc: sonuc(20, 10, () => -1) }])!
    expect(d.oyuncular[0].durum).toBe('yakalandi')
  })
})
