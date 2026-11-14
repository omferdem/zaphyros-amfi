// Şube yedeği: bir ya da birkaç şubenin sınıf listesi, oturumları ve yoklamaları taşınabilir bir JSON dosyasına yazılır
// ve aynı ya da başka bir kuruluma geri yüklenebilir. Silmeden önce otomatik indirilir; "silinen dersi geri al" bu dosyayla yapılır.
// Girmeyenler: ders içeriği (akış, sunum, soru; onun için .amfi paketi), quiz ve oyun puanları, misafir öğrenci bağları.
import { supabase } from './supabase'
import { oturumlariGetir, ogrencileriGetir, dersYoklamalari, dersGetir } from './veri'
import { YEDEK_SURUMU, YEDEK_TURU, type SubeYedegi, type YedekOzeti, type YedekSube } from './yedekBicimi'

export { yedegiIndir, yedegiOku, yedekOzeti } from './yedekBicimi'
export type { SubeYedegi, YedekOzeti, YedekSube, YedekOturum } from './yedekBicimi'

/** Verilen şubelerin yedeğini toplar. */
export async function subeleriYedekle(dersIdleri: string[]): Promise<SubeYedegi> {
  const subeler: YedekSube[] = []
  for (const id of dersIdleri) {
    const ders = await dersGetir(id)
    if (!ders) continue
    const [ogrenciler, oturumlar] = await Promise.all([ogrencileriGetir(id), oturumlariGetir(id)])
    const yoklamalar = await dersYoklamalari(oturumlar.map((o) => o.id))
    const no = new Map(ogrenciler.map((o) => [o.id, o.ogrenci_no]))
    subeler.push({
      ad: ders.ad,
      kod: ders.kod,
      sube: ders.sube,
      donem: ders.donem,
      yoklama_sayisi: ders.yoklama_sayisi ?? 15,
      yoklama_birimi: ders.yoklama_birimi ?? 'hafta',
      // Misafir satırlar (başka şubenin öğrencisi) yedeğe girmez; asıl şubesinde durur
      ogrenciler: ogrenciler.filter((o) => !o.asil_id).map((o) => ({ no: o.ogrenci_no, ad_soyad: o.ad_soyad })),
      oturumlar: oturumlar.map((o) => ({
        baslik: o.baslik,
        hafta_no: o.hafta_no ?? null,
        basladi: o.basladi,
        bitti: o.bitti,
        telefon_modu: o.telefon_modu,
        yoklamalar: yoklamalar
          .filter((y) => y.session_id === o.id && no.has(y.student_id))
          .map((y) => ({ no: no.get(y.student_id)!, yontem: y.yontem, zaman: y.zaman })),
      })),
    })
  }
  return { tur: YEDEK_TURU, surum: YEDEK_SURUMU, alindi: new Date().toISOString(), subeler }
}

function parcala<T>(l: T[], n: number): T[][] {
  const s: T[][] = []
  for (let i = 0; i < l.length; i += n) s.push(l.slice(i, i + n))
  return s
}

/**
 * Yedeği yeni şubeler olarak yükler (var olan hiçbir şeye dokunmaz). icerikId boşsa her ders için dersin adıyla yeni içerik açılır.
 * Yoklamalar "elle" yöntemiyle geri yazılır (QR bilgisi taşınmaz); zamanları korunur.
 */
export async function yedegiGeriYukle(yedek: SubeYedegi, donemId: string, icerikId: string | null): Promise<YedekOzeti> {
  let icerik = icerikId
  const ozet: YedekOzeti = { sube: 0, ogrenci: 0, oturum: 0, yoklama: 0 }
  for (const s of yedek.subeler) {
    const { data: ders, error } = await supabase
      .from('courses')
      .insert({
        ad: s.ad,
        kod: s.kod,
        sube: s.sube,
        term_id: donemId,
        subject_id: icerik,
        yoklama_sayisi: Math.min(60, Math.max(1, s.yoklama_sayisi || 15)),
        yoklama_birimi: s.yoklama_birimi === 'ders' ? 'ders' : 'hafta',
      })
      .select('id, subject_id')
      .single()
    if (error || !ders) throw error ?? new Error('ders')
    icerik = (ders as { subject_id: string }).subject_id
    const dersId = (ders as { id: string }).id
    ozet.sube++

    const ogrenciSatirlari = s.ogrenciler.map((o) => ({ course_id: dersId, ogrenci_no: o.no, ad_soyad: o.ad_soyad }))
    const idHaritasi = new Map<string, string>()
    for (const p of parcala(ogrenciSatirlari, 200)) {
      const { data, error: e } = await supabase.from('students').insert(p).select('id, ogrenci_no')
      if (e) throw e
      for (const r of data as { id: string; ogrenci_no: string }[]) idHaritasi.set(r.ogrenci_no, r.id)
    }
    ozet.ogrenci += ogrenciSatirlari.length

    for (const o of s.oturumlar) {
      const { data: oturum, error: e } = await supabase
        .from('sessions')
        .insert({
          course_id: dersId,
          baslik: o.baslik,
          hafta_no: o.hafta_no,
          basladi: o.basladi,
          bitti: o.bitti ?? o.basladi,
          yoklama_acik: false,
          telefon_modu: o.telefon_modu,
        })
        .select('id')
        .single()
      if (e || !oturum) throw e ?? new Error('oturum')
      ozet.oturum++
      const satirlar = o.yoklamalar.filter((y) => idHaritasi.has(y.no)).map((y) => ({ session_id: (oturum as { id: string }).id, student_id: idHaritasi.get(y.no)!, yontem: 'elle', zaman: y.zaman }))
      for (const p of parcala(satirlar, 300)) {
        const { error: e2 } = await supabase.from('attendance').insert(p)
        if (e2) throw e2
      }
      ozet.yoklama += satirlar.length
    }
  }
  return ozet
}
