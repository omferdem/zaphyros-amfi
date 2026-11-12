import { describe, expect, it } from 'vitest'
import { sikildiUyarisi, type SinifDurumu } from './sinif'

const durum = (sikilan: number, katilan: number, mola = false): SinifDurumu => ({
  olaylar: Array.from({ length: sikilan }, (_, i) => ({ id: String(i), tur: 'sikildim' as const, ad: 'A', metin: '', durum: 'bekliyor' as const, zaman: '' })),
  mola,
  cekilis: 0,
  katilan,
})

describe('sikildiUyarisi', () => {
  it('yüzde 25 ve üstünde uyarır', () => {
    expect(sikildiUyarisi(durum(10, 40))).toBe(true)
    expect(sikildiUyarisi(durum(9, 40))).toBe(false)
  })
  it('küçük sınıfta en az 2 kişi ister', () => {
    expect(sikildiUyarisi(durum(1, 3))).toBe(false)
    expect(sikildiUyarisi(durum(2, 3))).toBe(true)
  })
  it('molada uyarmaz', () => {
    expect(sikildiUyarisi(durum(20, 40, true))).toBe(false)
  })
})
