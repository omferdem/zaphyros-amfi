import { describe, expect, it } from 'vitest'
import { soruDenetle } from '../bilesenler/SoruFormu'

const temel = { soru: 'Başkent neresi?', dogru: 'Ankara', yanlislar: ['Bodrum', 'Kars'], sure_sn: 20, paket: '' }

describe('soruDenetle', () => {
  it('geçerli soruyu kabul eder', () => expect(soruDenetle(temel)).toBeNull())
  it('boş metni ve doğru cevabı reddeder', () => {
    expect(soruDenetle({ ...temel, soru: ' ' })).toMatch(/Soru metni/)
    expect(soruDenetle({ ...temel, dogru: '' })).toMatch(/Doğru cevabı/)
  })
  it('yanlış şık sayısını denetler', () => {
    expect(soruDenetle({ ...temel, yanlislar: [] })).toMatch(/En az bir/)
    expect(soruDenetle({ ...temel, yanlislar: ['a', 'b', 'c', 'd', 'e', 'f'] })).toMatch(/En fazla 5/)
  })
  it('çift ve doğruyla aynı şıkkı reddeder', () => {
    expect(soruDenetle({ ...temel, yanlislar: ['Kars', 'kars'] })).toMatch(/iki kez/)
    expect(soruDenetle({ ...temel, yanlislar: ['ANKARA'] })).toMatch(/yanlışlar arasında/)
  })
  it('süre sınırını denetler', () => {
    expect(soruDenetle({ ...temel, sure_sn: 2 })).toMatch(/Süre/)
    expect(soruDenetle({ ...temel, sure_sn: 301 })).toMatch(/Süre/)
  })
})
