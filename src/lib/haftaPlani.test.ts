import { describe, expect, it } from 'vitest'
import { haftaSatirlari } from './haftaPlani'

describe('haftaSatirlari', () => {
  it('her dolu satırı bir hafta yapar, boşları atar', () => {
    expect(haftaSatirlari("Giriş\n\nTanrı'nın varlığı\n  \nKötülük problemi", 1)).toEqual(['1. hafta: Giriş', "2. hafta: Tanrı'nın varlığı", '3. hafta: Kötülük problemi'])
  })
  it('satır başındaki numarayı atar', () => {
    expect(haftaSatirlari('1. Giriş\n2) Akıl\nHafta 3: İman\n4. hafta - Vahiy\n5\tMucize', 1)).toEqual([
      '1. hafta: Giriş',
      '2. hafta: Akıl',
      '3. hafta: İman',
      '4. hafta: Vahiy',
      '5. hafta: Mucize',
    ])
  })
  it('numara başlangıcını kaydırır ve yalnız numaralı satırı konusuz bırakır', () => {
    expect(haftaSatirlari('7', 4)).toEqual(['4. hafta'])
  })
  it('nokta ile biten ilk sayıyı hafta numarası sayar', () => {
    expect(haftaSatirlari('19. yüzyıl felsefesi', 1)).toEqual(['1. hafta: yüzyıl felsefesi'])
  })
})
