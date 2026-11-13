import { describe, expect, it } from 'vitest'
import { ozetHesapla, RISK_ESIGI } from './ozet'
import type { Ogrenci, Oturum, Yoklama } from './tipler'

const ogr = (id: string): Ogrenci => ({ id, course_id: 'c', ogrenci_no: id, ad_soyad: `Öğrenci ${id}` }) as Ogrenci
const otr = (id: string, gun: number): Oturum => ({ id, course_id: 'c', basladi: `2026-11-${String(gun).padStart(2, '0')}T10:00:00Z` }) as Oturum
const yok = (s: string, o: string): Yoklama => ({ session_id: s, student_id: o, yontem: 'qr', zaman: '2026-11-01T10:00:00Z' })

describe('dönem özeti', () => {
  const ogrenciler = [ogr('1'), ogr('2'), ogr('3')]
  const oturumlar = [otr('a', 1), otr('b', 8), otr('c', 15), otr('d', 22)]
  const yoklamalar = [
    yok('a', '1'), yok('a', '2'), yok('a', '3'),
    yok('b', '1'), yok('b', '2'),
    yok('c', '1'),
    yok('d', '1'),
  ]
  const d = ozetHesapla(ogrenciler, oturumlar, yoklamalar)

  it('haftalık katılım ve ortalama', () => {
    expect(d.haftalar.map((h) => h.katilan)).toEqual([3, 2, 1, 1])
    expect(d.haftalar[0].oran).toBe(1)
    expect(d.ortalamaKatilim).toBeCloseTo((1 + 2 / 3 + 1 / 3 + 1 / 3) / 4)
  })
  it('öğrenci devamı, risk ve son iki derse gelmeyen', () => {
    const o = (id: string) => d.ogrenciler.find((x) => x.ogrenci.id === id)!
    expect(o('1').oran).toBe(1)
    expect(o('1').risk).toBe(false)
    expect(o('3').oran).toBe(0.25)
    expect(o('3').risk).toBe(true)
    expect(o('3').sonDevamsiz).toBe(true)
    expect(o('2').sonDevamsiz).toBe(true)
    expect(o('2').oran).toBe(0.5)
    expect(o('2').risk).toBe(false)
    expect(RISK_ESIGI).toBe(0.5)
    expect(d.riskli).toBe(1)
  })
  it('kimsenin katılmadığı oturum yapılmış ders sayılmaz', () => {
    const b = ozetHesapla(ogrenciler, [...oturumlar, otr('bos', 29)], yoklamalar)
    expect(b.haftalar).toHaveLength(4)
    expect(b.ortalamaKatilim).toBeCloseTo(d.ortalamaKatilim)
  })
  it('oturum yoksa boş ve güvenli döner', () => {
    const b = ozetHesapla(ogrenciler, [], [])
    expect(b.ortalamaKatilim).toBe(0)
    expect(b.ogrenciler.every((x) => !x.risk)).toBe(true)
  })
})
