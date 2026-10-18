import { describe, expect, it } from 'vitest'
import { adDuzelt, metindenAyristir, satirlardanAyristir } from './sinifListesi'

// Testlerdeki bütün adlar ve numaralar uydurmadır.
describe('sınıf listesi ayrıştırma', () => {
  it('ayrı Adı / Soyadı sütunlarını ve Sıra No sütununu doğru tanır', () => {
    const sonuc = satirlardanAyristir([
      ['NEÜ İlahiyat Fakültesi Sınıf Listesi', null, null, null],
      ['Sıra No', 'Öğrenci No', 'Adı', 'Soyadı'],
      [1, 20260001, 'ALİ', 'YILMAZ'],
      [2, 20260002, 'Ayşe Nur', 'Kaya'],
      [3, '', 'Boş', 'Satır'],
    ])
    expect(sonuc.kayitlar).toEqual([
      { ogrenci_no: '20260001', ad_soyad: 'Ali Yılmaz' },
      { ogrenci_no: '20260002', ad_soyad: 'Ayşe Nur Kaya' },
    ])
    expect(sonuc.atlanan).toBe(1)
  })

  it('TC Kimlik No sütununu numara sanmaz', () => {
    const sonuc = satirlardanAyristir([
      ['TC Kimlik No', 'Ad Soyad', 'Öğrenci Numarası'],
      ['11111111111', 'Deniz Ak', '20260010'],
    ])
    expect(sonuc.kayitlar).toEqual([{ ogrenci_no: '20260010', ad_soyad: 'Deniz Ak' }])
  })

  it('başlıksız, Excel\'den yapıştırılmış metni okur', () => {
    const sonuc = metindenAyristir('1\t20260001\tALİ YILMAZ\n2\t20260002\tİREM ÇELİK\n\n')
    expect(sonuc.kayitlar).toEqual([
      { ogrenci_no: '20260001', ad_soyad: 'Ali Yılmaz' },
      { ogrenci_no: '20260002', ad_soyad: 'İrem Çelik' },
    ])
  })

  it('noktalı virgüllü CSV ve tekrar eden numarayı tekilleştirir', () => {
    const sonuc = metindenAyristir('Numara;Ad Soyad\n20260001;Ali Yılmaz\n20260001;Ali Yılmaz')
    expect(sonuc.kayitlar).toHaveLength(1)
  })

  it('boşlukla ayrılmış (PDF ya da web sayfasından kopyalanmış) 11 haneli numaraları okur', () => {
    const sonuc = metindenAyristir('1 22010101001 ALİ YILMAZ\n2 22010101002 Ayşe Nur Kaya Demir\n')
    expect(sonuc.kayitlar).toEqual([
      { ogrenci_no: '22010101001', ad_soyad: 'Ali Yılmaz' },
      { ogrenci_no: '22010101002', ad_soyad: 'Ayşe Nur Kaya Demir' },
    ])
    expect(sonuc.atlanan).toBe(0)
  })

  it('Excel\'in kısalttığı bilimsel gösterimli numarayı bildirir', () => {
    const sonuc = metindenAyristir('2,20101E+10\tALİ YILMAZ')
    expect(sonuc.kayitlar).toHaveLength(0)
    expect(sonuc.bilimsel).toBe(true)
  })

  it('karışık yazılmış adı olduğu gibi bırakır', () => {
    expect(adDuzelt('  Mehmet   Ali ')).toBe('Mehmet Ali')
    expect(adDuzelt('IŞIL ÖZTÜRK')).toBe('Işıl Öztürk')
  })
})
