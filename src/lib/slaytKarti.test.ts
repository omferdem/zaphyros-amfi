import { describe, expect, it } from 'vitest'
import { kelimeSar } from './slaytKarti'

// Her karakter 10 piksel
const olc = (s: string) => s.length * 10

describe('kelimeSar', () => {
  it('kelimeleri genişliğe göre satırlara böler, hiçbir satır taşmaz', () => {
    const s = kelimeSar('bir iki üç dört beş altı yedi sekiz dokuz', 100, olc)
    expect(s.every((x) => olc(x) <= 100)).toBe(true)
    expect(s.join(' ')).toBe('bir iki üç dört beş altı yedi sekiz dokuz')
  })
  it('paragrafları ve boş satırları korur', () => {
    expect(kelimeSar('a\n\nb', 100, olc)).toEqual(['a', '', 'b'])
  })
  it('çok uzun kelimeyi harf harf böler, hiçbir şey kaybolmaz', () => {
    const s = kelimeSar('abcdefghijklmnopqrstuvwxyz', 100, olc)
    expect(s.every((x) => olc(x) <= 100)).toBe(true)
    expect(s.join('')).toBe('abcdefghijklmnopqrstuvwxyz')
  })
  it('uzun metin aşağı doğru uzar: satır sayısı metinle artar', () => {
    const kisa = kelimeSar('kelime '.repeat(5), 100, olc).length
    const uzun = kelimeSar('kelime '.repeat(50), 100, olc).length
    expect(uzun).toBeGreaterThan(kisa)
  })
})
