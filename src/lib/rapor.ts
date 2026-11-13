import type { Ders, Ogrenci, Oturum, PuanSatiri, Yoklama } from './tipler'
import { oturumAdi, tarih } from './bicim'
import { AZ_VERI, type GelisimSonucu } from './gelisim'
import type { MaddeAnalizi, Quiz, QuizSatiri } from './quizHesap'

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

export function dosyaAdi(s: string): string {
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

/** Öğrenci gelişim raporu: öğrenci özeti ve her konu için başarı yüzdesi (yetersiz veride boş). */
export async function gelisimiExceleAktar(ders: Ders, sonuc: GelisimSonucu, olcutAdi: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const kalin = { fontWeight: 'bold' as const }
  const konular = sonuc.konular.map((k) => k.konu)
  const sirali = [...sonuc.ogrenciler].sort((a, b) => a.ogrenci.ogrenci_no.localeCompare(b.ogrenci.ogrenci_no, 'tr', { numeric: true }))
  const veri = [
    [
      { value: 'Öğrenci No', ...kalin },
      { value: 'Ad Soyad', ...kalin },
      { value: 'Cevap', ...kalin },
      { value: 'Doğru', ...kalin },
      { value: 'Başarı (%)', ...kalin },
      { value: 'Eğilim (puan)', ...kalin },
      { value: 'Ort. süre (sn)', ...kalin },
      { value: 'Puan', ...kalin },
      ...konular.map((k) => ({ value: k, ...kalin })),
    ],
    ...sirali.map((g) => [
      { value: g.ogrenci.ogrenci_no, type: String },
      { value: g.ogrenci.ad_soyad, type: String },
      { value: g.cevap, type: Number },
      { value: g.dogru, type: Number },
      g.oran === null ? { value: '', type: String } : { value: Math.round(g.oran * 100), type: Number },
      g.egilim === null ? { value: '', type: String } : { value: g.egilim, type: Number },
      g.sureOrt === null ? { value: '', type: String } : { value: Math.round(g.sureOrt * 10) / 10, type: Number },
      { value: g.puan, type: Number },
      ...konular.map((k) => {
        const o = g.konular.get(k)
        return o && o.toplam >= AZ_VERI ? { value: Math.round((o.dogru / o.toplam) * 100), type: Number } : { value: '', type: String }
      }),
    ]),
  ]
  await writeXlsxFile(veri, {
    sheet: 'Gelişim',
    columns: [{ width: 14 }, { width: 28 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 12 }, { width: 13 }, { width: 9 }, ...konular.map(() => ({ width: 16 }))],
    stickyRowsCount: 1,
  }).toFile(dosyaAdi(`Gelisim ${dosyaEtiketi(ders)} (${olcutAdi}) ${tarih(new Date().toISOString())}.xlsx`))
}

/** Quiz sonuçları: öğrenci başına doğru, başarı, süre; ikinci sayfada soru bazında başarı. */
export async function quizSonucunuExceleAktar(ders: Ders, quiz: Quiz, satirlar: QuizSatiri[], madde: MaddeAnalizi[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const kalin = { fontWeight: 'bold' as const }
  const sirali = [...satirlar].sort((a, b) => a.ogrenci.ogrenci_no.localeCompare(b.ogrenci.ogrenci_no, 'tr', { numeric: true }))
  const veri = [
    [
      { value: 'Öğrenci No', ...kalin },
      { value: 'Ad Soyad', ...kalin },
      { value: 'Doğru', ...kalin },
      { value: 'Toplam soru', ...kalin },
      { value: 'Başarı (%)', ...kalin },
      { value: 'Süre (dk)', ...kalin },
      { value: 'Durum', ...kalin },
    ],
    ...sirali.map((s) => [
      { value: s.ogrenci.ogrenci_no, type: String },
      { value: s.ogrenci.ad_soyad, type: String },
      s.deneme ? { value: s.dogru, type: Number } : { value: '', type: String },
      { value: s.toplam, type: Number },
      s.oran === null ? { value: '', type: String } : { value: Math.round(s.oran * 100), type: Number },
      s.sureDk === null ? { value: '', type: String } : { value: s.sureDk, type: Number },
      { value: !s.deneme ? 'girmedi' : s.deneme.bitti ? 'bitirdi' : 'bitirmedi', type: String },
    ]),
  ]
  const maddeVeri = [
    [
      { value: 'Soru', ...kalin },
      { value: 'Cevaplayan', ...kalin },
      { value: 'Doğru oranı (%)', ...kalin },
    ],
    ...madde.map((m) => [
      { value: m.soru, type: String },
      { value: m.cevaplayan, type: Number },
      m.oran === null ? { value: '', type: String } : { value: Math.round(m.oran * 100), type: Number },
    ]),
  ]
  await writeXlsxFile(
    [
      { data: veri, sheet: 'Sonuçlar', columns: [{ width: 14 }, { width: 28 }, { width: 8 }, { width: 12 }, { width: 11 }, { width: 10 }, { width: 11 }], stickyRowsCount: 1 },
      { data: maddeVeri, sheet: 'Sorular', columns: [{ width: 70 }, { width: 12 }, { width: 16 }], stickyRowsCount: 1 },
    ],
    {},
  ).toFile(dosyaAdi(`Quiz ${dosyaEtiketi(ders)} ${quiz.baslik} ${tarih(quiz.basladi)}.xlsx`))
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

/** Misafir olarak başka şubede derse giren bir öğrencinin katılımı (asıl kaydın kimliğiyle). */
export interface MisafirKatilim {
  asil_id: string
  lesson_id: string | null
  zaman: string
}

/**
 * Bir öğrencinin başka şubede (misafir) katıldığı ders, kendi şubesinde aynı akışla yapılmış oturumun
 * yoklamasına yazılır: "Ahmet B'de dinlediyse A'daki aynı hafta oturumunda var sayılır".
 * Akışı olmayan oturumlar eşleşmez. Sonuç, gerçek yoklama kayıtlarının yanına eklenir.
 */
export function misafirYoklamalari(oturumlar: Pick<Oturum, 'id' | 'lesson_id'>[], katilimlar: MisafirKatilim[]): Yoklama[] {
  const sonuc: Yoklama[] = []
  for (const o of oturumlar) {
    if (!o.lesson_id) continue
    for (const k of katilimlar) {
      if (k.lesson_id === o.lesson_id) sonuc.push({ session_id: o.id, student_id: k.asil_id, yontem: 'elle', zaman: k.zaman, baska_sube: true })
    }
  }
  return sonuc
}
