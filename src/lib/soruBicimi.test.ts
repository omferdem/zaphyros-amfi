import { describe, expect, it } from 'vitest'
import { bicimiTani, soruMetniOku } from './soruBicimi'

describe('soruMetniOku', () => {
  it('sekmeli satırı okur, doğru ikinci sütundur', () => {
    const r = soruMetniOku('GPS ne?\tUydu\tRadyo\tBluetooth\nİkinci?\tA\tB\tC', 'otomatik')
    expect(r.sorular).toHaveLength(2)
    expect(r.sorular[0]).toMatchObject({ soru: 'GPS ne?', dogru: 'Uydu', yanlislar: ['Radyo', 'Bluetooth'] })
  })
  it('sekmelide eksik sütunu hata sayar', () => {
    const r = soruMetniOku('Yalnız soru\tdoğru', 'sekmeli')
    expect(r.sorular).toHaveLength(0)
    expect(r.hatalar).toHaveLength(1)
  })
  it('şıklı metni okur ve numarayı atar', () => {
    const r = soruMetniOku('1. Başkent?\nA) Ankara\nB) İzmir\nC) Bursa\nCevap: A\n\n2. Renk?\nA) Mavi\nB) Kırmızı\nCevap: B', 'otomatik')
    expect(r.sorular).toHaveLength(2)
    expect(r.sorular[0]).toMatchObject({ soru: 'Başkent?', dogru: 'Ankara', yanlislar: ['İzmir', 'Bursa'] })
    expect(r.sorular[1].dogru).toBe('Kırmızı')
  })
  it('biçimi tanır', () => {
    expect(bicimiTani('#QUESTION:x')).toBe('zomr')
    expect(bicimiTani('a\tb\tc')).toBe('sekmeli')
    expect(bicimiTani('Soru?\nA) x\nB) y\nCevap: A')).toBe('siklar')
  })
  it('ZOMR yine çalışır', () => {
    expect(soruMetniOku('#QUESTION:S?\n#CORRECT:D\n#WRONG:Y').sorular).toHaveLength(1)
  })
})
