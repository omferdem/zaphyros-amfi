import { describe, expect, it } from 'vitest'
import { egilimHesapla, gelisimHesapla, guclüVeZayif, konuAdi, type CevapKaydi } from './gelisim'
import type { Ogrenci, Soru } from './tipler'

const ogrenci = (id: string, no: string): Ogrenci => ({ id, course_id: 'c', ogrenci_no: no, ad_soyad: `Öğrenci ${no}` })
const soru = (id: string, ek: Record<string, string>): Soru => ({
  id,
  subject_id: 's',
  soru: id,
  dogru: 'a',
  yanlislar: ['b'],
  sure_sn: 20,
  ek,
  olusturuldu: '',
})
const cevap = (session: string, q: string, cihaz: string, dogru: boolean, ms = 4000): CevapKaydi => ({
  session_id: session,
  question_id: q,
  cihaz_id: cihaz,
  dogru,
  puan: dogru ? 800 : 0,
  sure_ms: ms,
})

describe('quiz cevapları', () => {
  const ogrenciler = [ogrenci('1', '1001')]
  const sorular = [soru('q1', { outcome: 'Kötülük' })]
  it('öğrenciye doğrudan bağlanır, ortalama süreyi bozmaz', () => {
    const cevaplar: CevapKaydi[] = [
      cevap('o1', 'q1', 'cihaz-1', true, 6000),
      { session_id: 'quiz1', question_id: 'q1', cihaz_id: '', student_id: '1', dogru: false, puan: 0, sure_ms: 0, kaynak: 'quiz' },
    ]
    const s = gelisimHesapla(ogrenciler, cevaplar, [{ session_id: 'o1', student_id: '1', cihaz_id: 'cihaz-1' }], sorular, [
      { id: 'o1', basladi: '2026-10-01' },
      { id: 'quiz1', basladi: '2026-10-08' },
    ])
    expect(s.izlenemeyen).toBe(0)
    expect(s.ogrenciler[0].cevap).toBe(2)
    expect(s.ogrenciler[0].dogru).toBe(1)
    expect(s.ogrenciler[0].sureOrt).toBeCloseTo(6)
    expect(s.ogrenciler[0].oturumlar.map((o) => o.oturum)).toEqual(['o1', 'quiz1'])
  })
  it('listede olmayan öğrencinin quiz cevabını izlenemeyen sayar', () => {
    const s = gelisimHesapla(
      ogrenciler,
      [{ session_id: 'quiz1', question_id: 'q1', cihaz_id: '', student_id: 'yok', dogru: true, puan: 0, sure_ms: 0, kaynak: 'quiz' }],
      [],
      sorular,
      [],
    )
    expect(s.izlenemeyen).toBe(1)
  })
})

describe('konuAdi', () => {
  it('ölçüte göre konu seçer', () => {
    const s = soru('q', { outcome: 'LO2', bloom: 'Analiz', paket: 'Hafta 3' })
    expect(konuAdi(s, 'otomatik')).toBe('LO2')
    expect(konuAdi(s, 'paket')).toBe('Hafta 3')
    expect(konuAdi(s, 'kazanim')).toBe('LO2')
    expect(konuAdi(s, 'bloom')).toBe('Analiz')
  })
  it('kazanım yoksa otomatik olarak paketi kullanır, hiçbiri yoksa Konusuz der', () => {
    expect(konuAdi(soru('q', { paket: 'Hafta 3' }), 'otomatik')).toBe('Hafta 3')
    expect(konuAdi(soru('q', {}), 'otomatik')).toBe('Konusuz')
    expect(konuAdi(undefined, 'paket')).toBe('Konusuz')
  })
})

describe('egilimHesapla', () => {
  it('ilk ve son yarı ortalamasının farkını yüzde puan verir', () => {
    expect(egilimHesapla([0.4, 0.6])).toBe(20)
    expect(egilimHesapla([0.8, 0.6, 0.4, 0.2])).toBe(-40)
    expect(egilimHesapla([0.5])).toBeNull()
  })
})

describe('gelisimHesapla', () => {
  const ogrenciler = [ogrenci('1', '1001'), ogrenci('2', '1002'), ogrenci('3', '1003')]
  const sorular = [soru('q1', { outcome: 'Kötülük' }), soru('q2', { outcome: 'Kötülük' }), soru('q3', { paket: 'Bilgi' })]
  const oturumlar = [
    { id: 'o1', basladi: '2026-10-01' },
    { id: 'o2', basladi: '2026-10-08' },
  ]
  const katilimlar = [
    { session_id: 'o1', student_id: '1', cihaz_id: 'cihaz-1' },
    { session_id: 'o2', student_id: '1', cihaz_id: 'cihaz-1' },
    { session_id: 'o1', student_id: '2', cihaz_id: 'cihaz-2' },
    { session_id: 'o1', student_id: '3', cihaz_id: null },
  ]
  const cevaplar = [
    // Öğrenci 1: ilk oturumda zayıf, ikincide iyi
    cevap('o1', 'q1', 'cihaz-1', false),
    cevap('o1', 'q2', 'cihaz-1', false),
    cevap('o1', 'q3', 'cihaz-1', true),
    cevap('o2', 'q1', 'cihaz-1', true),
    cevap('o2', 'q2', 'cihaz-1', true),
    cevap('o2', 'q3', 'cihaz-1', true),
    // Öğrenci 2
    cevap('o1', 'q1', 'cihaz-2', true),
    // Takma adlı oyuncu (yoklaması yok)
    cevap('o1', 'q1', 'cihaz-yabanci', true),
  ]
  const s = gelisimHesapla(ogrenciler, cevaplar, katilimlar, sorular, oturumlar)

  it('cevapları yoklamadaki cihaz üzerinden öğrenciye bağlar, takma adlıları ayrı sayar', () => {
    expect(s.toplamCevap).toBe(8)
    expect(s.izlenenCevap).toBe(7)
    expect(s.izlenemeyen).toBe(1)
    expect(s.oturumSayisi).toBe(2)
    const o1 = s.ogrenciler[0]
    expect(o1.cevap).toBe(6)
    expect(o1.dogru).toBe(4)
    expect(o1.oran).toBeCloseTo(4 / 6)
  })

  it('katılmayan ve cihazsız (elle yoklanan) öğrenciyi boş gösterir', () => {
    expect(s.ogrenciler[2].cevap).toBe(0)
    expect(s.ogrenciler[2].oran).toBeNull()
    expect(s.ogrenciler[2].egilim).toBeNull()
  })

  it('öğrenci x konu ve eğilimi hesaplar', () => {
    const o1 = s.ogrenciler[0]
    expect(o1.konular.get('Kötülük')).toEqual({ dogru: 2, toplam: 4 })
    expect(o1.konular.get('Bilgi')).toEqual({ dogru: 2, toplam: 2 })
    // 1. oturum 1/3, 2. oturum 3/3: yaklaşık +67 puan
    expect(o1.egilim).toBe(67)
    expect(o1.sureOrt).toBeCloseTo(4)
  })

  it('sınıf konularını en zayıf başta sıralar', () => {
    expect(s.konular.map((k) => k.konu)).toEqual(['Kötülük', 'Bilgi'])
    expect(s.konular[0].dogru).toBe(3)
    expect(s.konular[0].toplam).toBe(5)
  })

  it('güçlü ve zayıf konuyu yalnızca yeterli veride söyler', () => {
    // Öğrenci 1'de Kötülük 4 cevap (%50), Bilgi 2 cevap (yetersiz): zayıf Kötülük, güçlü yok
    expect(guclüVeZayif(s.ogrenciler[0])).toEqual({ guclu: null, zayif: 'Kötülük' })
    expect(guclüVeZayif(s.ogrenciler[2])).toEqual({ guclu: null, zayif: null })
  })
})
