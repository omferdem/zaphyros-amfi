import { describe, expect, it } from 'vitest'
import { YEDEK_SURUMU, YEDEK_TURU, yedegiOku, yedekOzeti, type SubeYedegi } from './yedekBicimi'

const ornek: SubeYedegi = {
  tur: YEDEK_TURU,
  surum: YEDEK_SURUMU,
  alindi: '2026-11-14T10:00:00.000Z',
  subeler: [
    {
      ad: 'Din Felsefesi',
      kod: null,
      sube: 'A',
      donem: '2026-2027 Güz',
      yoklama_sayisi: 15,
      yoklama_birimi: 'hafta',
      ogrenciler: [
        { no: '1001', ad_soyad: 'Ayşe Örnek' },
        { no: '1002', ad_soyad: 'Mehmet Örnek' },
      ],
      oturumlar: [
        {
          baslik: '1. hafta',
          hafta_no: 1,
          basladi: '2026-10-05T08:00:00.000Z',
          bitti: '2026-10-05T10:00:00.000Z',
          telefon_modu: false,
          yoklamalar: [
            { no: '1001', yontem: 'qr', zaman: '2026-10-05T08:05:00.000Z' },
            { no: '1002', yontem: 'elle', zaman: '2026-10-05T08:07:00.000Z' },
          ],
        },
      ],
    },
  ],
}

describe('şube yedeği', () => {
  it('özeti doğru sayar', () => {
    expect(yedekOzeti(ornek)).toEqual({ sube: 1, ogrenci: 2, oturum: 1, yoklama: 2 })
  })

  it('geçerli dosyayı okur', async () => {
    const y = await yedegiOku(new File([JSON.stringify(ornek)], 'a.amfi-yedek'))
    expect(y.subeler[0].ogrenciler).toHaveLength(2)
  })

  it('başka türü ve bozuk dosyayı reddeder', async () => {
    await expect(yedegiOku(new File(['{"tur":"baska","subeler":[]}'], 'a.json'))).rejects.toThrow('şube yedeği değil')
    await expect(yedegiOku(new File(['bozuk'], 'a.json'))).rejects.toThrow('okunamadı')
    await expect(yedegiOku(new File([JSON.stringify({ ...ornek, surum: 99 })], 'a.json'))).rejects.toThrow('daha yeni')
    await expect(yedegiOku(new File([JSON.stringify({ tur: YEDEK_TURU, surum: 1, subeler: [{ ad: 5 }] })], 'a.json'))).rejects.toThrow('bozuk')
  })
})
