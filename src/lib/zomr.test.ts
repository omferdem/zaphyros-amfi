import { describe, expect, it } from 'vitest'
import { zomrOku } from './zomr'

// Testlerdeki sorular uydurmadır.
describe('ZOMR okuma', () => {
  it('kullanıcının verdiği biçimi okur', () => {
    const { sorular, hatalar } = zomrOku(`#QUESTION:Sorunun tam metni buraya gelir?
#CORRECT:Doğru cevap metni
#WRONG:Yanlış cevap 1
#WRONG:Yanlış cevap 2
#WRONG:Yanlış cevap 3`)
    expect(hatalar).toEqual([])
    expect(sorular).toEqual([
      { soru: 'Sorunun tam metni buraya gelir?', dogru: 'Doğru cevap metni', yanlislar: ['Yanlış cevap 1', 'Yanlış cevap 2', 'Yanlış cevap 3'], ek: {} },
    ])
  })

  it('birden çok soruyu, ek etiketleri ve çok satırlı metni okur', () => {
    const { sorular } = zomrOku(`
#QUESTION: Ontolojik kanıtı
kim ortaya koymuştur?
#CORRECT: Anselmus
#WRONG: Hume
#WRONG: Paley
#EASINESS: 0.7
#BLOOM: Hatırlama

#QUESTION:Saat benzetmesi kimindir?
#CORRECT:Paley
#WRONG:Kant
#OUTCOME:ÖÇ2
`)
    expect(sorular).toHaveLength(2)
    expect(sorular[0].soru).toBe('Ontolojik kanıtı\nkim ortaya koymuştur?')
    expect(sorular[0].ek).toEqual({ easiness: '0.7', bloom: 'Hatırlama' })
    expect(sorular[1]).toMatchObject({ dogru: 'Paley', yanlislar: ['Kant'], ek: { outcome: 'ÖÇ2' } })
  })

  it('eksik ya da hatalı soruları bildirir, sağlamları alır', () => {
    const { sorular, hatalar } = zomrOku(`#QUESTION:Doğrusu yok?
#WRONG:A
#QUESTION:Sağlam soru?
#CORRECT:B
#WRONG:C
#QUESTION:Doğru yanlışlarda da var?
#CORRECT:D
#WRONG:D`)
    expect(sorular.map((s) => s.soru)).toEqual(['Sağlam soru?'])
    expect(hatalar).toEqual(['1. soru: doğru cevap (#CORRECT) yok', '3. soru: doğru cevap yanlışlar arasında da yazılmış'])
  })
})
