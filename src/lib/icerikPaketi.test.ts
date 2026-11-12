import { describe, expect, it } from 'vitest'
import { paketAkislari, paketiDogrula } from './icerikPaketi'
import type { Adim } from './tipler'

const adim = (o: Partial<Adim>): Adim => ({ id: 'x', lesson_id: 'l', sira: 1, tur: 'slayt', presentation_id: null, sayfa_no: null, question_id: null, ayar: {}, ...o })

describe('paketAkislari', () => {
  it('kimlikleri paket numaralarına çevirir, silinmiş bağları atlar', () => {
    const r = paketAkislari(
      [{ ad: '1. hafta', adimlar: [adim({ tur: 'yoklama' }), adim({ presentation_id: 'p1', sayfa_no: 3 }), adim({ tur: 'soru', question_id: 'q2' }), adim({ presentation_id: 'yok', sayfa_no: 1 }), adim({ tur: 'video', ayar: { url: 'https://y.be/a' } })] }],
      new Map([['p1', 1]]),
      new Map([['q2', 0]]),
    )
    expect(r[0].adimlar).toEqual([{ tur: 'yoklama' }, { tur: 'slayt', sunum: 1, sayfa_no: 3 }, { tur: 'soru', soru: 0 }, { tur: 'video', ayar: { url: 'https://y.be/a' } }])
  })
})

describe('paketiDogrula', () => {
  const temel = { tur: 'amfios-icerik', surum: 1, ad: 'x', tarih: '', sunumlar: [], sorular: [], akislar: [] }
  it('geçerli paketi kabul eder', () => expect(paketiDogrula(temel).ad).toBe('x'))
  it('yabancı dosyayı reddeder', () => expect(() => paketiDogrula({ a: 1 })).toThrow('değil'))
  it('yeni sürümü reddeder', () => expect(() => paketiDogrula({ ...temel, surum: 9 })).toThrow('güncelle'))
  it('olmayan soruya giden adımı reddeder', () =>
    expect(() => paketiDogrula({ ...temel, akislar: [{ ad: 'a', adimlar: [{ tur: 'soru', soru: 4 }] }] })).toThrow('bozuk'))
})
