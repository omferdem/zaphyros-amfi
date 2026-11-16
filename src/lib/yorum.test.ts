import { describe, expect, it } from 'vitest'
import { oyuncuYorumlari, seri, sinifYorumlari, yorumSec } from './yorum'

describe('yorumcu', () => {
  it('doğru serisini sondan sayar', () => {
    expect(seri([0, 1, 1, 1], 4)).toBe(3)
    expect(seri([1, 1, 0, 1], 4)).toBe(1)
    expect(seri([1, 1, 1, null], 3)).toBe(3)
  })
  it('tek seri lideri adıyla anılır, üç soru dolmadan yorum yoktur', () => {
    const o = [
      { ad: 'Mehmet', sonuc: [1, 1, 1] as (1 | 0)[] },
      { ad: 'Ayşe', sonuc: [1, 0, 1] as (1 | 0)[] },
    ]
    expect(oyuncuYorumlari(o, 3)[0].metin).toContain('Mehmet 3 sorudur')
    expect(oyuncuYorumlari(o, 2)).toEqual([])
  })
  it('birden çok lider sayı olarak anılır', () => {
    const o = [
      { ad: 'A', sonuc: [1, 1, 1] as 1[] },
      { ad: 'B', sonuc: [1, 1, 1] as 1[] },
    ]
    expect(oyuncuYorumlari(o, 3)[0].anahtar).toBe('seri-cok')
  })
  it('sınıf oranına göre yorum seçer ve son soruyu duyurur', () => {
    expect(sinifYorumlari(95, 2, 10, [95])[0].anahtar).toBe('cok-kolay')
    expect(sinifYorumlari(10, 2, 10, [10])[0].anahtar).toBe('cok-zor')
    expect(sinifYorumlari(50, 9, 10, [50])[0].anahtar).toBe('son-soru')
    expect(sinifYorumlari(70, 5, 10, [65, 70, 80])[0].anahtar).toBe('sinif-seri')
  })
  it('aynı türü üst üste göstermez', () => {
    const a = sinifYorumlari(80, 4, 10, [80])
    const b = { anahtar: 'x', metin: 'başka' }
    expect(yorumSec([...a, b], ['kolay', 'kolay'])?.anahtar).toBe('x')
    expect(yorumSec(a, ['kolay'])?.anahtar).toBe('kolay')
    expect(yorumSec([], [])).toBeNull()
  })
})
