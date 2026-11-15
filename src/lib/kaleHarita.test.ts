import { describe, expect, it } from 'vitest'
import { HUCRE_SAYISI, evDilimi, kaleHaritasiHesapla, type KaleOyuncusu } from './kaleHarita'

const oy = (ad: string, takim: number, sonuc: (1 | 0 | -1 | null)[]): KaleOyuncusu => ({ ad, takim, sonuc })
const hep = (n: number, d: 1 | 0) => Array.from({ length: n }, () => d)

describe('kale haritası', () => {
  it('ev dilimleri takımlara eşit dağıtılır', () => {
    expect([1, 2, 3].map((t) => evDilimi(t, 3))).toEqual([0, 4, 8])
  })
  it('her 2 doğruda 1 hücre alınır; açılmamış sorular sayılmaz', () => {
    const h = kaleHaritasiHesapla([oy('A', 1, [1, 1, 1, 1, null, null]), oy('B', 2, [0, 0, 0, 0, null, null])], 2, 6)!
    expect(h.takimlar[0].toplam).toBe(2)
    expect(h.takimlar[1].toplam).toBe(0)
    expect(h.oynanan).toBe(4)
    expect(h.bitti).toBe(false)
  })
  it('önce boş hücreler dıştan içe alınır', () => {
    const h = kaleHaritasiHesapla([oy('A', 1, hep(12, 1))], 2, 12)!
    const alinanlar = h.hucreler.filter((x) => x.takim === 1)
    expect(alinanlar).toHaveLength(6)
    expect(alinanlar.some((x) => x.halka === 0)).toBe(true)
    // ilk hücre evin dış halkadaki dilimidir
    expect(h.hucreler.find((x) => x.soru === 2)).toMatchObject({ halka: 0, dilim: 0 })
  })
  it('çok bilen takım iç halkayı tamamen tutunca kaleyi kuşatır ve kazanır', () => {
    const guclu = Array.from({ length: 12 }, (_, i) => oy(`G${i}`, 1, hep(40, 1)))
    const zayif = [oy('Z', 2, hep(40, 0))]
    const h = kaleHaritasiHesapla([...guclu, ...zayif], 2, 40)!
    expect(h.kusatan).toBe(1)
    expect(h.kazanan).toBe(1)
    expect(h.takimlar[0].ic).toBe(HUCRE_SAYISI)
  })
  it('boş komşu kalmayınca rakip hücresi ele geçirilir; sahibi doğru bildiyse alınamaz (savunma)', () => {
    // 2 takım; 1. takım tüm haritayı doldurur, sonra 2. takım ele geçirmeye çalışır
    const bir = Array.from({ length: 12 }, (_, i) => oy(`B${i}`, 1, [...hep(6, 1), ...hep(6, 0)]))
    const iki = Array.from({ length: 12 }, (_, i) => oy(`I${i}`, 2, [...hep(6, 0), ...hep(6, 1)]))
    const h = kaleHaritasiHesapla([...bir, ...iki], 2, 12)!
    expect(h.takimlar[1].geriAlinan).toBeGreaterThan(0)
    expect(h.takimlar[0].toplam + h.takimlar[1].toplam).toBeLessThanOrEqual(36)
  })
  it('soru bitince iç halkada çok hücresi olan kazanır; kimse bilmezse kazanan yok', () => {
    const h = kaleHaritasiHesapla([oy('A', 1, [0, 0]), oy('B', 2, [0, 0])], 2, 2)!
    expect(h.bitti).toBe(true)
    expect(h.kazanan).toBeNull()
    expect(kaleHaritasiHesapla([], 1, 5)).toBeNull()
  })
})
