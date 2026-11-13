import { describe, expect, it } from 'vitest'
import { roketHedefi, roketHesapla } from './roket'
import { ejderhaHesapla, KAHRAMAN_CANI } from './ejderha'
import type { ZombiSorusu } from './zombi'

function sorular(toplam: number, acilan: number): ZombiSorusu[] {
  return Array.from({ length: toplam }, (_, i) => ({ adim: `s${i}`, sira: i + 1, acildi: i < acilan }))
}
function sonuc(toplam: number, acilan: number, deger: (i: number) => 1 | 0 | -1): (1 | 0 | -1 | null)[] {
  return Array.from({ length: toplam }, (_, i) => (i < acilan ? deger(i) : null))
}

describe('roket yarışı', () => {
  it('hedef soru sayısına göre 5-15 arası', () => {
    expect(roketHedefi(20)).toBe(12)
    expect(roketHedefi(4)).toBe(5)
    expect(roketHedefi(60)).toBe(15)
  })
  it('ilk bitiren birinci olur, bitirmeyenler ilerlemeye göre sıralanır', () => {
    const d = roketHesapla(sorular(20, 20), [
      { ad: 'Yavaş', sonuc: sonuc(20, 20, (i) => (i % 2 === 0 ? 1 : 0)) },
      { ad: 'Hızlı', sonuc: sonuc(20, 20, () => 1) },
      { ad: 'Orta', sonuc: sonuc(20, 20, (i) => (i < 14 ? 1 : 0)) },
    ])!
    expect(d.siralama.map((o) => o.ad)).toEqual(['Hızlı', 'Orta', 'Yavaş'])
    expect(d.oyuncular[1].bitirdi).toBe(12)
    expect(d.bitirenler).toBe(2)
    expect(d.bitti).toBe(true)
  })
  it('soru yoksa durum yoktur; oynanmamış sorular sayılmaz', () => {
    expect(roketHesapla([], [])).toBeNull()
    const d = roketHesapla(sorular(20, 3), [{ ad: 'A', sonuc: sonuc(20, 3, () => 1) }])!
    expect(d.oyuncular[0].ilerleme).toBe(3)
    expect(d.bitti).toBe(false)
  })
})

describe('ejderha savaşı', () => {
  it('sınıf yeterince doğru bilirse ejderha yenilir', () => {
    const oy = Array.from({ length: 10 }, (_, i) => ({ ad: `K${i}`, sonuc: sonuc(20, 20, () => 1) }))
    const d = ejderhaHesapla(sorular(20, 20), oy)!
    expect(d.kazandi).toBe(true)
    expect(d.can).toBe(0)
    expect(d.bitti).toBe(true)
  })
  it('hiç bilmeyen kahramanlar üç yanlışta savaş dışı kalır', () => {
    const d = ejderhaHesapla(sorular(20, 5), [
      { ad: 'A', sonuc: sonuc(20, 5, () => 0) },
      { ad: 'B', sonuc: sonuc(20, 5, () => 1) },
    ])!
    expect(d.kahramanlar[0].dustu).toBe(KAHRAMAN_CANI)
    expect(d.kahramanlar[0].kalan).toBe(0)
    expect(d.kahramanlar[1].vurus).toBe(5)
    expect(d.ayakta).toBe(1)
    expect(d.kazandi).toBe(false)
    expect(d.bitti).toBe(false)
  })
  it('sınıf bilemezse oyun sonunda ejderha kazanır; oyuncu ya da soru yoksa durum yoktur', () => {
    const oy = Array.from({ length: 4 }, (_, i) => ({ ad: `K${i}`, sonuc: sonuc(20, 20, () => 0) }))
    const d = ejderhaHesapla(sorular(20, 20), oy)!
    expect(d.kazandi).toBe(false)
    expect(d.bitti).toBe(true)
    expect(d.ayakta).toBe(0)
    expect(ejderhaHesapla([], oy)).toBeNull()
    expect(ejderhaHesapla(sorular(5, 5), [])).toBeNull()
  })
})
