import { supabase } from './supabase'

const KOVA = 'etkinlik-fotograflari'

/** Adres bir fotoğrafa mı çıkıyor (etkinlik fotoğrafı deposu ya da görsel uzantısı)? */
export function gorselMi(adres: string): boolean {
  return adres.includes(`/storage/v1/object/public/${KOVA}/`) || /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(adres)
}

/** Fotoğrafı en uzun kenarı 1600 pikselde JPEG'e küçültür (depo sınırı 1 MB; telefonda hızlı açılsın). */
async function kucult(dosya: File): Promise<Blob> {
  const bmp = await createImageBitmap(dosya)
  const oran = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const tuval = document.createElement('canvas')
  tuval.width = Math.max(1, Math.round(bmp.width * oran))
  tuval.height = Math.max(1, Math.round(bmp.height * oran))
  const c = tuval.getContext('2d')
  if (!c) throw new Error('tuval')
  c.fillStyle = '#ffffff'
  c.fillRect(0, 0, tuval.width, tuval.height)
  c.drawImage(bmp, 0, 0, tuval.width, tuval.height)
  for (const kalite of [0.85, 0.7, 0.55]) {
    const b = await new Promise<Blob | null>((r) => tuval.toBlob(r, 'image/jpeg', kalite))
    if (b && b.size <= 900 * 1024) return b
  }
  throw new Error('buyuk')
}

/** Fotoğrafı içeriğin deposuna yükler ve herkese açık adresini döndürür. */
export async function fotoYukle(icerikId: string, dosya: File): Promise<string> {
  if (!dosya.type.startsWith('image/')) throw new Error('tur')
  const govde = await kucult(dosya)
  const yol = `${icerikId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(KOVA).upload(yol, govde, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from(KOVA).getPublicUrl(yol).data.publicUrl
}
