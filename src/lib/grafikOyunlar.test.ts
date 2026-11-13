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

import { arenaHesapla, ARENA_CANI } from './arena'
import { kuleHedefi, kuleHesapla } from './kule'

describe('son kalan arenası', () => {
  it('iki yanlışta oyuncu düşer, hep doğru bilen ayakta kalır', () => {
    const d = arenaHesapla(sorular(10, 10), [
      { ad: 'Güçlü', sonuc: sonuc(10, 10, () => 1) },
      { ad: 'Zayıf', sonuc: sonuc(10, 10, () => 0) },
      { ad: 'Orta', sonuc: sonuc(10, 10, (i) => (i % 2 === 0 ? 1 : 0)) },
    ])!
    expect(d.oyuncular[1].elendi).toBe(ARENA_CANI)
    expect(d.oyuncular[2].elendi).toBe(4)
    expect(d.ayakta).toBe(1)
    expect(d.siralama[0].ad).toBe('Güçlü')
    expect(d.bitti).toBe(true)
  })
  it('herkes aynı soruda elenirse kimse eksilmez; oyuncu ya da soru yoksa durum yok', () => {
    const d = arenaHesapla(sorular(10, 10), [
      { ad: 'A', sonuc: sonuc(10, 10, () => 0) },
      { ad: 'B', sonuc: sonuc(10, 10, () => 0) },
    ])!
    expect(d.ayakta).toBe(2)
    expect(d.bitti).toBe(true)
    expect(arenaHesapla([], [])).toBeNull()
  })
})

describe('kule yarışı', () => {
  it('hedef 5-14 arası ve üye başına doğruya göre sıralanır', () => {
    expect(kuleHedefi(20)).toBe(12)
    const d = kuleHesapla(
      [
        { takim: 1, uye: 10, dogru: 60 },
        { takim: 2, uye: 5, dogru: 40 },
        { takim: 3, uye: 8, dogru: 16 },
      ],
      6,
      20,
    )!
    expect(d.satirlar.find((s) => s.takim === 2)!.blok).toBe(8)
    expect(d.satirlar.find((s) => s.takim === 2)!.sira).toBe(1)
    expect(d.bitti).toBe(false)
    expect(d.kazanan).toBeNull()
  })
  it('hedefe ulaşan ya da sorular bitince kazanan belli olur; tek takımda oyun yok', () => {
    const d = kuleHesapla([{ takim: 1, uye: 2, dogru: 30 }, { takim: 2, uye: 2, dogru: 4 }], 12, 20)!
    expect(d.bitti).toBe(true)
    expect(d.kazanan).toBe(1)
    expect(kuleHesapla([{ takim: 1, uye: 2, dogru: 3 }], 3, 20)).toBeNull()
  })
})
