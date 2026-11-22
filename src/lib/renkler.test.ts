import { describe, expect, it } from 'vitest'
import { SIK_RENKLERI } from './renkler'
import { SIKLAR, ZE_SIKLAR } from './yarisma'
import { TAKIMLAR } from './takim'

describe('renkler tek kaynak', () => {
  it('telefon şıkları perde şıklarıyla aynı sırada ve harfte', () => {
    expect(ZE_SIKLAR).toBe(SIK_RENKLERI)
    SIK_RENKLERI.forEach((s, i) => {
      expect(SIKLAR[i].harf).toBe(s.harf)
      expect(SIKLAR[i].sekil).toBe(s.sekil)
    })
  })
  it('perdedeki şık renk ailesi telefondaki hex ile uyuşur', () => {
    const aile = ['rose', 'sky', 'amber', 'emerald', 'violet', 'cyan']
    aile.forEach((a, i) => expect(SIKLAR[i].renk).toContain(a))
  })
  it('her takımın bir hex rengi var', () => {
    expect(TAKIMLAR).toHaveLength(10)
    TAKIMLAR.forEach((t) => expect(t.hex).toMatch(/^#[0-9a-f]{6}$/))
  })
})
