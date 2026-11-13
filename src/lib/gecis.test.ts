import { describe, expect, it } from 'vitest'
import { adaGoreHafta, kahootAkisAdi, kahootAkisiMi, onerilenQuizSuresi, paketleriSirala, paketTuru } from './gecis'
import type { PaketGrubu } from './paket'

const g = (ad: string): PaketGrubu => ({ ad, sorular: [] })

describe('geçiş yardımcıları', () => {
  it('hafta numarası adın başından okunur', () => {
    expect(adaGoreHafta('3. hafta: Hızlı Kahoot (20 kısa soru)')).toBe(3)
    expect(adaGoreHafta('12. Hafta: Ciddi Quiz')).toBe(12)
    expect(adaGoreHafta('Karışık Depo')).toBeNull()
    expect(adaGoreHafta(null)).toBeNull()
  })
  it('paket türü addan çıkar', () => {
    expect(paketTuru('4. hafta: Ciddi Quiz (15 soru)')).toBe('quiz')
    expect(paketTuru('4. hafta: Hızlı Kahoot (20 kısa soru)')).toBe('kahoot')
  })
  it('gizli akış adı işaretle başlar', () => {
    expect(kahootAkisiMi(kahootAkisAdi('3. hafta: Hızlı Kahoot'))).toBe(true)
    expect(kahootAkisiMi('3. hafta: Din ve felsefe')).toBe(false)
  })
  it('seçici: o haftanın paketi başta, Kahoot listesinde quiz yok', () => {
    const l = [g('1. hafta: Hızlı Kahoot'), g('1. hafta: Ciddi Quiz'), g('2. hafta: Hızlı Kahoot'), g('2. hafta: Ciddi Quiz'), g('')]
    const kahoot = paketleriSirala(l, 'kahoot', 2)
    expect(kahoot.map((x) => x.ad)).toEqual(['2. hafta: Hızlı Kahoot', '1. hafta: Hızlı Kahoot'])
    expect(kahoot[0].onerilen).toBe(true)
    const quiz = paketleriSirala(l, 'quiz', 2)
    expect(quiz[0].ad).toBe('2. hafta: Ciddi Quiz')
    expect(quiz).toHaveLength(4)
  })
  it('quiz süresi önerisi', () => {
    expect(onerilenQuizSuresi(15)).toBe(15)
    expect(onerilenQuizSuresi(4)).toBe(5)
    expect(onerilenQuizSuresi(1)).toBe(5)
  })
})
