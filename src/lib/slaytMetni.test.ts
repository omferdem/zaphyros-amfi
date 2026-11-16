import { describe, expect, it } from 'vitest'
import { gorselSatiriMi, slaytBasligi, slaytMetniniTemizle } from './slaytMetni'

describe('görsel adı satırları', () => {
  it('dosya adı ve alt metin kalıplarını tanır', () => {
    for (const s of ['preencoded.png', 'image1.png', 'Resim 3', 'Picture 12', 'IMG_2043.JPG', 'şekil 4', 'foto (2).jpeg', 'preencoded']) {
      expect(gorselSatiriMi(s)).toBe(true)
    }
  })
  it('gerçek metni bozmaz', () => {
    for (const s of ['Din Felsefesi ve İlgili Alanlar', 'Resim sanatı ve din', 'Şekil ve madde', 'Platon (MÖ 427-347)', 'Bkz. şekil 3\'teki ilişki', 'a.png ile ilgili not yazısı burada']) {
      expect(gorselSatiriMi(s)).toBe(false)
    }
  })
})

describe('slayt metni ve başlığı', () => {
  it('görsel satırlarını ayıklar, kalanı korur', () => {
    expect(slaytMetniniTemizle('preencoded.png\nDin Felsefesi\nTanım\nimage2.png')).toBe('Din Felsefesi\nTanım')
  })
  it('başlık temizlenmiş metnin ilk anlamlı satırıdır', () => {
    expect(slaytBasligi('preencoded.png\nTarihsel Gelişim\nHegel', 4)).toBe('Tarihsel Gelişim')
  })
  it('yalnızca görsel adı varsa "Slayt N" olur', () => {
    expect(slaytBasligi('preencoded.png', 12)).toBe('Slayt 12')
    expect(slaytBasligi('', 3)).toBe('Slayt 3')
    expect(slaytBasligi(null, 7)).toBe('Slayt 7')
  })
})
