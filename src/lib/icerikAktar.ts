// Ders içeriğini .amfi paketi olarak dışa ve içe aktarır (hoca tarafı).
import { supabase } from './supabase'
import { adimlarEkle, adimlariGetir, akisOlustur, akislariGetir, sorulariGetir, sunumAdresi, sunumYukle, sunumlariGetir } from './akis'
import { PAKET_SURUMU, PAKET_TURU, paketAkislari, paketiDogrula, type IcerikPaketi } from './icerikPaketi'
import { dosyaAdi } from './rapor'

/** Dersin içeriğini (sunum PDF'leri dahil) tek bir .amfi dosyası olarak indirir. */
export async function icerigiDisaAktar(icerikId: string, ad: string, durumBildir: (m: string) => void): Promise<void> {
  const { zipSync, strToU8 } = await import('fflate')
  durumBildir('İçerik okunuyor…')
  const [sunumlar, sorular, akislar] = await Promise.all([sunumlariGetir(icerikId), sorulariGetir(icerikId), akislariGetir(icerikId)])
  const adimlar = await Promise.all(akislar.map((a) => adimlariGetir(a.id)))

  const dosyalar: Record<string, Uint8Array> = {}
  const sunumNo = new Map<string, number>()
  const paketSunumlari: IcerikPaketi['sunumlar'] = []
  // Eskiden yeniye: paket içi numara yükleme sırasıdır.
  for (const [i, s] of [...sunumlar].reverse().entries()) {
    durumBildir(`Sunum alınıyor: ${s.ad} (${i + 1} / ${sunumlar.length})`)
    const yanit = await fetch(await sunumAdresi(icerikId, s.id))
    if (!yanit.ok) throw new Error(`"${s.ad}" sunumunun dosyası indirilemedi.`)
    const no = i + 1
    dosyalar[`sunumlar/${no}.pdf`] = new Uint8Array(await yanit.arrayBuffer())
    sunumNo.set(s.id, no)
    paketSunumlari.push({ no, ad: s.ad, sayfa_sayisi: s.sayfa_sayisi, dosya: `sunumlar/${no}.pdf` })
  }
  const soruSirasi = new Map(sorular.map((s, i) => [s.id, i]))
  const paket: IcerikPaketi = {
    tur: PAKET_TURU,
    surum: PAKET_SURUMU,
    ad,
    tarih: new Date().toISOString(),
    sunumlar: paketSunumlari,
    sorular: sorular.map((s) => ({ soru: s.soru, dogru: s.dogru, yanlislar: s.yanlislar, sure_sn: s.sure_sn, ek: s.ek })),
    akislar: paketAkislari(akislar.map((a, i) => ({ ad: a.ad, adimlar: adimlar[i] })), sunumNo, soruSirasi),
  }
  dosyalar['icerik.json'] = strToU8(JSON.stringify(paket))
  durumBildir('Paket hazırlanıyor…')
  // PDF zaten sıkıştırılmış olduğundan düşük sıkıştırma yeter.
  const zip = zipSync(dosyalar, { level: 1 })
  const adres = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = adres
  a.download = `${dosyaAdi(ad) || 'ders'} icerik.amfi`
  a.click()
  setTimeout(() => URL.revokeObjectURL(adres), 10_000)
}

export interface AktarmaOzeti {
  sunum: number
  soru: number
  akis: number
}

/** Paket dosyasını okur ve doğrular; içe aktarmadan önce içeriğini göstermek için. */
export async function paketiOku(dosya: File): Promise<{ paket: IcerikPaketi; dosyalar: Record<string, Uint8Array> }> {
  const { unzipSync, strFromU8 } = await import('fflate')
  let dosyalar: Record<string, Uint8Array>
  try {
    dosyalar = unzipSync(new Uint8Array(await dosya.arrayBuffer()))
  } catch {
    throw new Error('Dosya açılamadı. Bir .amfi paketi seçtiğinden emin ol.')
  }
  if (!dosyalar['icerik.json']) throw new Error('Bu dosya bir AmfiOS ders içeriği paketi değil.')
  let ham: unknown
  try {
    ham = JSON.parse(strFromU8(dosyalar['icerik.json']))
  } catch {
    throw new Error('Paket bozuk: icerik.json okunamadı.')
  }
  return { paket: paketiDogrula(ham), dosyalar }
}

/**
 * Paketin içeriğini mevcut ders içeriğine ekler (var olanlar silinmez, aynı adlı akışlar yinelenir).
 * Sunumlar yeniden yüklenir: sayfa metinleri ve telefon görselleri bu hocanın kurulumunda üretilir.
 */
export async function icerigiIceAktar(
  icerikId: string,
  paket: IcerikPaketi,
  dosyalar: Record<string, Uint8Array>,
  durumBildir: (m: string) => void,
): Promise<AktarmaOzeti> {
  // 1) Sorular
  const soruIdleri: string[] = []
  const simdi = Date.now()
  for (let i = 0; i < paket.sorular.length; i += 100) {
    durumBildir(`Sorular ekleniyor… ${Math.min(i + 100, paket.sorular.length)} / ${paket.sorular.length}`)
    const parca = paket.sorular.slice(i, i + 100)
    const { data, error } = await supabase
      .from('questions')
      .insert(parca.map((s, j) => ({ subject_id: icerikId, ...s, olusturuldu: new Date(simdi + i + j).toISOString() })))
      .select('id, olusturuldu')
    if (error) throw error
    const sirali = ((data ?? []) as { id: string; olusturuldu: string }[]).sort((a, b) => a.olusturuldu.localeCompare(b.olusturuldu))
    soruIdleri.push(...sirali.map((r) => r.id))
  }

  // 2) Sunumlar
  const sunumIdleri = new Map<number, string>()
  for (const [i, s] of paket.sunumlar.entries()) {
    const bayt = s.dosya ? dosyalar[s.dosya] : undefined
    if (!bayt) continue
    durumBildir(`Sunum yükleniyor: ${s.ad} (${i + 1} / ${paket.sunumlar.length})`)
    const yuklenen = await sunumYukle(icerikId, new File([bayt as BlobPart], `${s.ad}.pdf`, { type: 'application/pdf' }), s.ad, durumBildir)
    sunumIdleri.set(s.no, yuklenen.id)
  }

  // 3) Akışlar
  for (const [i, a] of paket.akislar.entries()) {
    durumBildir(`Akışlar ekleniyor… ${i + 1} / ${paket.akislar.length}`)
    const akis = await akisOlustur(icerikId, a.ad)
    const yeni = a.adimlar.flatMap((s): Parameters<typeof adimlarEkle>[2] => {
      if (s.tur === 'slayt') {
        const sunum = s.sunum !== undefined ? sunumIdleri.get(s.sunum) : undefined
        return sunum ? [{ tur: 'slayt' as const, presentation_id: sunum, sayfa_no: s.sayfa_no ?? 1 }] : []
      }
      if (s.tur === 'soru') {
        const soru = s.soru !== undefined ? soruIdleri[s.soru] : undefined
        return soru ? [{ tur: 'soru' as const, question_id: soru }] : []
      }
      return [{ tur: s.tur, ayar: s.ayar }]
    })
    await adimlarEkle(akis.id, 0, yeni)
  }
  return { sunum: sunumIdleri.size, soru: soruIdleri.length, akis: paket.akislar.length }
}
