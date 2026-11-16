import { describe, expect, it } from 'vitest'
import { zombiSeviyesi } from './zombi'
import { arenaCani } from './arena'
import { patikaUzunlugu } from './orman'
import { roketHedefi } from './roket'
import { ejderhaHesapla } from './ejderha'
import { merdivenHesapla } from './merdiven'

describe('oyun zorluğu', () => {
  it('orta zorluk eski değerleri korur', () => {
    expect(zombiSeviyesi(6, 10)).toBe(zombiSeviyesi(6, 10, undefined, 'orta'))
    expect(roketHedefi(10)).toBe(7)
    expect(arenaCani(10)).toBe(4)
    expect(patikaUzunlugu(10)).toBe(6)
  })
  it('zorlaştıkça rakip güçlenir', () => {
    // zombiler daha sık yükselir
    expect(zombiSeviyesi(6, 10, undefined, 'zor')).toBeGreaterThan(zombiSeviyesi(6, 10, undefined, 'kolay'))
    // roket bitişi, arena yanlış hakkı ve patika
    expect(roketHedefi(20, 'zor')).toBeGreaterThan(roketHedefi(20, 'kolay'))
    expect(arenaCani(20, 'zor')).toBeLessThan(arenaCani(20, 'kolay'))
    expect(patikaUzunlugu(20, 'zor')).toBeGreaterThan(patikaUzunlugu(20, 'kolay'))
  })
  it('ejderha zorda daha çok canlıdır', () => {
    const sorular = Array.from({ length: 10 }, (_, i) => ({ adim: `a${i}`, sira: i + 1, acildi: false }))
    const oyuncular = Array.from({ length: 10 }, (_, i) => ({ ad: `O${i}`, sonuc: [] as (1 | 0 | -1)[] }))
    const kolay = ejderhaHesapla(sorular, oyuncular, 'kolay')!
    const zor = ejderhaHesapla(sorular, oyuncular, 'zor')!
    expect(zor.enCok).toBeGreaterThan(kolay.enCok)
  })
  it('merdiven eşiği zorluğa göre değişir', () => {
    const s = [{ adim: 'a', sira: 1, cevap: 10, oran: 65, acildi: true }]
    expect(merdivenHesapla(s, new Set(), 'kolay').basamak).toBe(1)
    expect(merdivenHesapla(s, new Set(), 'orta').basamak).toBe(1)
    expect(merdivenHesapla(s, new Set(), 'zor').basamak).toBe(0)
    expect(merdivenHesapla(s, new Set(), 'zor').esik).toBe(70)
  })
})
