import { describe, expect, it } from 'vitest'
import { SAYAC_BOS, bitisSaatindenSure, kalanSure, sayaciBaslat, sayaciDurdur, sayaciSifirla, sureEkle, sureMetni } from './sayac'

describe('sayaç', () => {
  const t0 = 1_000_000
  it('başlatınca süre azalır, bitince sıfırdır', () => {
    const s = sayaciBaslat({ ...SAYAC_BOS, toplamMs: 60_000 }, t0)
    expect(kalanSure(s, t0 + 15_000)).toBe(45_000)
    expect(kalanSure(s, t0 + 90_000)).toBe(0)
  })
  it('durdurunca kalan korunur, yeniden başlatınca oradan sürer', () => {
    const s = sayaciDurdur(sayaciBaslat({ ...SAYAC_BOS, toplamMs: 60_000 }, t0), t0 + 20_000)
    expect(s.durum).toBe('durdu')
    expect(kalanSure(s, t0 + 999_999)).toBe(40_000)
    const d = sayaciBaslat(s, t0 + 100_000)
    expect(kalanSure(d, t0 + 110_000)).toBe(30_000)
  })
  it('sıfırlayınca toplam süreye döner', () => {
    expect(kalanSure(sayaciSifirla(sayaciBaslat({ ...SAYAC_BOS, toplamMs: 60_000 }, t0)), t0 + 5)).toBe(60_000)
  })
  it('süre eklenir; bitmişse yeniden çalışır', () => {
    const s = sureEkle(sayaciBaslat({ ...SAYAC_BOS, toplamMs: 60_000 }, t0), 5, t0 + 10_000)
    expect(kalanSure(s, t0 + 10_000)).toBe(50_000 + 300_000)
    const b = sureEkle({ durum: 'bitti', toplamMs: 60_000 }, 2, t0)
    expect(b.durum).toBe('calisiyor')
    expect(kalanSure(b, t0)).toBe(120_000)
  })
  it('bitiş saatinden süre hesaplar', () => {
    const simdi = new Date(2026, 10, 13, 9, 0, 0)
    expect(bitisSaatindenSure('9:50', simdi)).toBe(50 * 60_000)
    expect(bitisSaatindenSure('08:00', simdi)).toBeNull()
    expect(bitisSaatindenSure('25:00', simdi)).toBeNull()
    expect(bitisSaatindenSure('abc', simdi)).toBeNull()
  })
  it('süreyi okunur yazar', () => {
    expect(sureMetni(125_000)).toBe('02:05')
    expect(sureMetni(3_725_000)).toBe('1:02:05')
    expect(sureMetni(0)).toBe('00:00')
  })
})
