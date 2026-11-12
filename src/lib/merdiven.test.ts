import { describe, expect, it } from 'vitest'
import { merdivenHesapla, type MerdivenSorusu } from './merdiven'

const soru = (n: number, oran: number | null, acildi = true, cevap = 10): MerdivenSorusu => ({ adim: `a${n}`, sira: n, cevap: oran === null ? 0 : cevap, oran, acildi })
const hepsi = (oranlar: (number | null)[]) => oranlar.map((o, i) => soru(i + 1, o))

describe('merdivenHesapla', () => {
  it('doğru bilinen her soruda bir basamak çıkar', () => {
    const d = merdivenHesapla(hepsi([80, 60, 50]), new Set())
    expect(d.basamak).toBe(3)
    expect(d.gecmis.map((g) => g.sonuc)).toEqual(['cikti', 'cikti', 'cikti'])
  })
  it('yanlışta son güvenli basamağa iner (5\'in katı)', () => {
    const oranlar = [90, 90, 90, 90, 90, 90, 90, 20, 90, 90, 90, 90, 90, 90, 90]
    // 7 basamak, yanlış -> 5, sonra 7 doğru daha -> ama 15 soru toplam: 7 doğru önce, yanlış, 7 doğru sonra
    const d = merdivenHesapla(hepsi(oranlar), new Set())
    expect(d.basamak).toBe(5 + 7)
  })
  it('güvenli basamağa ulaşılmadan düşerse sıfıra iner', () => {
    expect(merdivenHesapla(hepsi([90, 90, 10]), new Set()).basamak).toBe(0)
  })
  it('joker yanlışı yok sayar ve basamak korunur', () => {
    const d = merdivenHesapla(hepsi([90, 90, 10, 90]), new Set(['a3']))
    expect(d.basamak).toBe(3)
    expect(d.gecmis[2].sonuc).toBe('joker')
    expect(d.jokerKalan).toBe(1)
  })
  it('açılmamış ve cevapsız sorular sayılmaz', () => {
    const d = merdivenHesapla([soru(1, 90), soru(2, 90, false), soru(3, null)], new Set())
    expect(d.basamak).toBe(1)
    expect(d.gecmis).toHaveLength(1)
  })
  it('son soru yanlışsa jokerlenebilir; sonra doğru gelirse artık değil', () => {
    expect(merdivenHesapla(hepsi([90, 10]), new Set()).jokerlenebilir).toBe('a2')
    expect(merdivenHesapla(hepsi([90, 10, 90]), new Set()).jokerlenebilir).toBeNull()
  })
  it('joker hakkı biter', () => {
    const d = merdivenHesapla(hepsi([10, 10, 10]), new Set(['a1', 'a2']))
    expect(d.jokerKalan).toBe(0)
    expect(d.jokerlenebilir).toBeNull()
    expect(d.gecmis.map((g) => g.sonuc)).toEqual(['joker', 'joker', 'dustu'])
  })
  it('bütün basamaklar çıkılınca kazanılır', () => {
    expect(merdivenHesapla(hepsi([60, 60]), new Set()).kazandi).toBe(true)
    expect(merdivenHesapla([], new Set()).kazandi).toBe(false)
  })
})
