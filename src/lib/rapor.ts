import type { Ders, Ogrenci, Oturum, PuanSatiri, Yoklama } from './tipler'
import { oturumAdi, tarih } from './bicim'

export interface RaporSatiri {
  ogrenci: Ogrenci
  katildigi: Set<string>
  sayi: number
  oran: number
}

/** Öğrenci x oturum yoklama tablosu. Oturumlar eskiden yeniye sıralanır. */
export function raporHesapla(ogrenciler: Ogrenci[], oturumlar: Oturum[], yoklamalar: Yoklama[]): RaporSatiri[] {
  const ogrenciyeGore = new Map<string, Set<string>>()
  for (const y of yoklamalar) {
    if (!ogrenciyeGore.has(y.student_id)) ogrenciyeGore.set(y.student_id, new Set())
    ogrenciyeGore.get(y.student_id)!.add(y.session_id)
  }
  return ogrenciler.map((ogrenci) => {
    const katildigi = ogrenciyeGore.get(ogrenci.id) ?? new Set<string>()
    const sayi = oturumlar.filter((o) => katildigi.has(o.id)).length
    return { ogrenci, katildigi, sayi, oran: oturumlar.length ? sayi / oturumlar.length : 0 }
  })
}

// Bazı tarayıcılar ASCII dışı karakter içeren indirme adlarını yok sayıp dosyayı "download" diye kaydeder.
const ASCII: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' }

/** Dosya adında dersi, şubeyi ve dönemi ayırt eden etiket: yedi şubenin çıktısı karışmasın. */
function dosyaEtiketi(d: Ders): string {
  return [d.kod || d.ad, d.sube, d.donem].filter(Boolean).join(' ')
}

function dosyaAdi(s: string): string {
  return s
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (h) => ASCII[h])
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function raporuExceleAktar(ders: Ders, ogrenciler: Ogrenci[], oturumlar: Oturum[], yoklamalar: Yoklama[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const sirali = [...oturumlar].sort((a, b) => a.basladi.localeCompare(b.basladi))
  const satirlar = raporHesapla(ogrenciler, sirali, yoklamalar)

  const kalin = { fontWeight: 'bold' as const }
  const baslik = [
    { value: 'Öğrenci No', ...kalin },
    { value: 'Ad Soyad', ...kalin },
    ...sirali.map((o) => ({
      value: o.baslik?.trim() ? `${tarih(o.basladi)} ${o.baslik.trim()}` : tarih(o.basladi),
      ...kalin,
    })),
    { value: 'Katıldığı', ...kalin },
    { value: 'Oran (%)', ...kalin },
  ]

  const veri = [
    baslik,
    ...satirlar.map((r) => [
      { value: r.ogrenci.ogrenci_no, type: String },
      { value: r.ogrenci.ad_soyad, type: String },
      ...sirali.map((o) => ({ value: r.katildigi.has(o.id) ? 'Var' : 'Yok', type: String })),
      { value: r.sayi, type: Number },
      { value: Math.round(r.oran * 100), type: Number },
    ]),
  ]

  await writeXlsxFile(veri, {
    sheet: 'Yoklama',
    columns: [{ width: 14 }, { width: 28 }, ...sirali.map(() => ({ width: 14 })), { width: 10 }, { width: 10 }],
    stickyRowsCount: 1,
  }).toFile(dosyaAdi(`Yoklama ${dosyaEtiketi(ders)} ${tarih(new Date().toISOString())}.xlsx`))
}

export async function oturumuExceleAktar(ders: Ders, oturum: Oturum, ogrenciler: Ogrenci[], yoklamalar: Yoklama[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const kayit = new Map(yoklamalar.map((y) => [y.student_id, y]))
  const kalin = { fontWeight: 'bold' as const }
  const veri = [
    [
      { value: 'Öğrenci No', ...kalin },
      { value: 'Ad Soyad', ...kalin },
      { value: 'Durum', ...kalin },
      { value: 'Saat', ...kalin },
      { value: 'Yöntem', ...kalin },
    ],
    ...ogrenciler.map((o) => {
      const y = kayit.get(o.id)
      return [
        { value: o.ogrenci_no, type: String },
        { value: o.ad_soyad, type: String },
        { value: y ? 'Var' : 'Yok', type: String },
        { value: y ? new Date(y.zaman).toLocaleTimeString('tr-TR') : '', type: String },
        { value: y ? (y.yontem === 'qr' ? 'QR' : 'Elle') : '', type: String },
      ]
    }),
  ]
  await writeXlsxFile(veri, {
    sheet: 'Yoklama',
    columns: [{ width: 14 }, { width: 28 }, { width: 8 }, { width: 10 }, { width: 8 }],
    stickyRowsCount: 1,
  }).toFile(dosyaAdi(`Yoklama ${dosyaEtiketi(ders)} ${oturumAdi(oturum)}.xlsx`))
}

/** Oturumun bilgi yarışması sonuçları: sıra, ad (yoklamadaki ad ya da takma ad), puan, doğru sayısı. */
export async function yarismayiExceleAktar(ders: Ders, oturum: Oturum, puanlar: PuanSatiri[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const kalin = { fontWeight: 'bold' as const }
  const veri = [
    [
      { value: 'Sıra', ...kalin },
      { value: 'Ad', ...kalin },
      { value: 'Puan', ...kalin },
      { value: 'Doğru', ...kalin },
    ],
    ...puanlar.map((p) => [
      { value: p.sira, type: Number },
      { value: p.ad, type: String },
      { value: p.puan, type: Number },
      { value: p.dogru, type: Number },
    ]),
  ]
  await writeXlsxFile(veri, {
    sheet: 'Yarışma',
    columns: [{ width: 6 }, { width: 28 }, { width: 8 }, { width: 8 }],
    stickyRowsCount: 1,
  }).toFile(dosyaAdi(`Yarisma ${dosyaEtiketi(ders)} ${oturumAdi(oturum)}.xlsx`))
}
