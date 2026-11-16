import { describe, expect, it } from 'vitest'
import { dengeliSec, elleSecilenler, havuzSirasinaDiz, paketPaylari } from './soruSec'

const paket = (ad: string, n: number) => ({
  ad,
  sorular: Array.from({ length: n }, (_, i) => `${ad}${i + 1}`),
})

describe('paketPaylari', () => {
  it('toplam her zaman istenen sayıdır ve paket boyutunu aşmaz', () => {
    expect(paketPaylari([10, 10], 10)).toEqual([5, 5])
    expect(paketPaylari([20, 10], 9).reduce((a, b) => a + b, 0)).toBe(9)
    expect(paketPaylari([3, 3], 10)).toEqual([3, 3])
    expect(paketPaylari([0, 4], 2)).toEqual([0, 2])
  })
  it('orantılı dağıtır', () => {
    expect(paketPaylari([30, 10], 8)).toEqual([6, 2])
  })
})

describe('havuzSirasinaDiz', () => {
  it('seçilenleri havuzdaki sıraya dizer', () => {
    expect(havuzSirasinaDiz(['c', 'a', 'd'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'c', 'd'])
  })
})

describe('dengeliSec', () => {
  it('her paketten orantılı çeker, tekrar etmez', () => {
    const s = dengeliSec([paket('A', 10), paket('B', 10)], 8, (x) => x)
    expect(s).toHaveLength(8)
    expect(new Set(s).size).toBe(8)
    expect(s.filter((x) => x.startsWith('A'))).toHaveLength(4)
  })
  it('aynı soru iki pakette olsa da bir kez gelir', () => {
    const s = dengeliSec(
      [
        { ad: 'A', sorular: ['x', 'y'] },
        { ad: 'B', sorular: ['x', 'z'] },
      ],
      4,
      (x) => x,
    )
    expect(new Set(s).size).toBe(s.length)
  })
  it('son turlarda sorulmamış sorular öncelikli', () => {
    const son = new Set(['A1', 'A2', 'A3', 'A4', 'A5'])
    const s = dengeliSec([paket('A', 10)], 5, (x) => x, son)
    expect(s.every((x) => !son.has(x))).toBe(true)
  })
  it('yeterli yeni soru yoksa eskilerle tamamlar', () => {
    const son = new Set(['A1', 'A2', 'A3'])
    const s = dengeliSec([paket('A', 4)], 4, (x) => x, son)
    expect(s).toHaveLength(4)
  })
  it('istek paket toplamını aşarsa hepsini verir', () => {
    expect(dengeliSec([paket('A', 3)], 99, (x) => x)).toHaveLength(3)
  })
})

describe('elleSecilenler', () => {
  it('seçilenleri paket sırasıyla ve bir kez döndürür, bilinmeyen kimliği yok sayar', () => {
    const p = [{ sorular: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { sorular: [{ id: 'c' }, { id: 'd' }] }]
    expect(elleSecilenler(p, new Set(['d', 'a', 'c', 'x'])).map((s) => s.id)).toEqual(['a', 'c', 'd'])
    expect(elleSecilenler(p, new Set())).toEqual([])
  })
})
