import { describe, expect, it } from 'vitest'
import { adimSirasi, karistir, konumuCoz, paketAdi, paketleriGrupla } from './paket'
import type { Soru } from './tipler'

function soru(id: string, paket?: string): Soru {
  return {
    id,
    subject_id: 's',
    soru: id,
    dogru: 'a',
    yanlislar: ['b'],
    sure_sn: 20,
    ek: paket === undefined ? {} : { paket },
    olusturuldu: '',
  }
}

describe('paketleriGrupla', () => {
  it('paketleri ilk görülme sırasıyla, paketsizleri sonda toplar', () => {
    const g = paketleriGrupla([soru('1'), soru('2', 'Hafta 1'), soru('3', 'Hafta 2'), soru('4', 'Hafta 1'), soru('5', '  ')])
    expect(g.map((x) => x.ad)).toEqual(['Hafta 1', 'Hafta 2', ''])
    expect(g[0].sorular.map((s) => s.id)).toEqual(['2', '4'])
    expect(g[2].sorular.map((s) => s.id)).toEqual(['1', '5'])
  })
  it('paket adındaki boşlukları yok sayar', () => {
    expect(paketAdi(soru('1', '  Tekrar '))).toBe('Tekrar')
  })
})

describe('adimSirasi', () => {
  const mevcut = ['a', 'b', 'c']
  it('sona, başa ve bir adımın arkasına ekler', () => {
    expect(adimSirasi(mevcut, ['x', 'y'], { tur: 'son' })).toEqual(['a', 'b', 'c', 'x', 'y'])
    expect(adimSirasi(mevcut, ['x', 'y'], { tur: 'bas' })).toEqual(['x', 'y', 'a', 'b', 'c'])
    expect(adimSirasi(mevcut, ['x', 'y'], { tur: 'sonra', adim: 'b' })).toEqual(['a', 'b', 'x', 'y', 'c'])
    expect(adimSirasi(mevcut, ['x'], { tur: 'sonra', adim: 'c' })).toEqual(['a', 'b', 'c', 'x'])
  })
  it('olmayan adımdan sonra denirse sona ekler', () => {
    expect(adimSirasi(mevcut, ['x'], { tur: 'sonra', adim: 'yok' })).toEqual(['a', 'b', 'c', 'x'])
  })
  it('boş akışa ekler', () => {
    expect(adimSirasi([], ['x'], { tur: 'bas' })).toEqual(['x'])
  })
})

describe('konumuCoz', () => {
  it('seçim değerini konuma çevirir', () => {
    expect(konumuCoz('son')).toEqual({ tur: 'son' })
    expect(konumuCoz('bas')).toEqual({ tur: 'bas' })
    expect(konumuCoz('sonra:abc-1')).toEqual({ tur: 'sonra', adim: 'abc-1' })
    expect(konumuCoz('garip')).toEqual({ tur: 'son' })
  })
})

describe('karistir', () => {
  it('elemanları korur, diziyi değiştirmez ve rastgeleye göre sıralar', () => {
    const d = [1, 2, 3, 4, 5]
    const k = karistir(d, () => 0)
    expect([...k].sort()).toEqual([1, 2, 3, 4, 5])
    expect(d).toEqual([1, 2, 3, 4, 5])
    expect(k).not.toEqual(d)
  })
})

import { otomatikSure } from './paket'

describe('otomatikSure', () => {
  it('kısa soruya kısa, uzun paragraflı soruya uzun süre verir', () => {
    expect(otomatikSure({ soru: 'Başkent?', dogru: 'Ankara', yanlislar: ['Bodrum', 'Kars'] })).toBe(15)
    expect(otomatikSure({ soru: 'a'.repeat(300), dogru: 'b'.repeat(40), yanlislar: ['c'.repeat(40), 'd'.repeat(40), 'e'.repeat(40)] })).toBe(30)
    expect(otomatikSure({ soru: 'a'.repeat(900), dogru: 'b', yanlislar: ['c'] })).toBe(60)
  })
})
