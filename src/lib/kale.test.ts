import { describe, expect, it } from 'vitest'
import { kaleHedefi, kaleHesapla } from './kale'

describe('kale kuşatması', () => {
  it('hedefi soru sayısına göre sınırlar', () => {
    expect(kaleHedefi(5)).toBe(6)
    expect(kaleHedefi(20)).toBe(13)
    expect(kaleHedefi(100)).toBe(14)
  })

  it('takım yoksa ya da soru yoksa oyun kurulmaz', () => {
    expect(kaleHesapla([{ takim: 1, uye: 5, dogru: 0 }], 0, 20)).toBeNull()
    expect(kaleHesapla([{ takim: 1, uye: 5, dogru: 0 }, { takim: 2, uye: 5, dogru: 0 }], 0, 0)).toBeNull()
  })

  it('ordu yürür, sonra kuşatır; hedef bir sonraki takımdır', () => {
    const d = kaleHesapla(
      [
        { takim: 1, uye: 5, dogru: 30 }, // üye başına 6
        { takim: 2, uye: 5, dogru: 5 },
        { takim: 3, uye: 5, dogru: 0 },
      ],
      6,
      20,
    )!
    const bir = d.satirlar.find((s) => s.takim === 1)!
    expect(bir.hedefTakim).toBe(2)
    expect(d.satirlar.find((s) => s.takim === 3)!.hedefTakim).toBe(1)
    expect(bir.asama).toBe('kusatiyor')
    expect(bir.kusatan).toBe(6 - d.yuruyus)
    expect(d.satirlar.find((s) => s.takim === 2)!.asama).toBe('yuruyor')
    expect(d.satirlar.find((s) => s.takim === 3)!.yuruyusOrani).toBe(0)
    expect(d.bitti).toBe(false)
  })

  it('hedefe ulaşan takım hedef kaleyi düşürür ve kazanır', () => {
    const d = kaleHesapla(
      [
        { takim: 1, uye: 4, dogru: 4 * 14 },
        { takim: 2, uye: 4, dogru: 4 * 3 },
      ],
      10,
      20,
    )!
    expect(d.bitti).toBe(true)
    expect(d.kazanan).toBe(1)
    expect(d.dusen).toEqual([2])
    expect(d.satirlar.find((s) => s.takim === 1)!.kusatan).toBe(d.kusatma)
  })

  it('sorular bitince en çok ilerleyen kazanır; üye sayısı farkı adildir', () => {
    const d = kaleHesapla(
      [
        { takim: 1, uye: 10, dogru: 30 }, // 3 kişi başı
        { takim: 2, uye: 3, dogru: 12 }, // 4 kişi başı
      ],
      20,
      20,
    )!
    expect(d.bitti).toBe(true)
    expect(d.kazanan).toBe(2)
  })
})
