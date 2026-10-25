// Telefon modunda perdedeki slaytın görselini depodan indirir (öğrenci telefonu ve hoca kumandası).
// Erişim kuralı veritabanındadır: yalnızca telefon modundaki açık dersin perdedeki slaytı okunabilir.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const KOVA = 'slayt-gorselleri'
const SINIR = 24
const onbellek = new Map<string, string>()

async function bekle(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

/** Görseli indirip geçici bir adrese çevirir; aynı görsel tekrar istenirse yeniden indirilmez. */
async function gorseliGetir(yol: string): Promise<string> {
  const kayitli = onbellek.get(yol)
  if (kayitli) return kayitli
  let sonHata: unknown = null
  // Slayt değişir değişmez istek gelebilir; kısa aralıkla birkaç kez denenir.
  for (let deneme = 0; deneme < 3; deneme++) {
    const { data, error } = await supabase.storage.from(KOVA).download(yol)
    if (data) {
      const adres = URL.createObjectURL(data)
      onbellek.set(yol, adres)
      while (onbellek.size > SINIR) {
        const eski = onbellek.keys().next().value as string
        URL.revokeObjectURL(onbellek.get(eski)!)
        onbellek.delete(eski)
      }
      return adres
    }
    sonHata = error
    await bekle(700 * (deneme + 1))
  }
  throw sonHata ?? new Error('görsel indirilemedi')
}

/**
 * Verilen yoldaki slayt görselini döndürür. Yeni görsel gelene kadar bir önceki görünür kalır
 * (`gecis` true iken); yol boşsa görsel de yoktur.
 */
export function useSlaytGorseli(yol: string | null | undefined): { url: string | null; gecis: boolean; hata: boolean } {
  const [url, setUrl] = useState<string | null>(null)
  const [hata, setHata] = useState(false)
  const [yuklenen, setYuklenen] = useState<string | null>(null)

  useEffect(() => {
    if (!yol) {
      setUrl(null)
      setYuklenen(null)
      setHata(false)
      return
    }
    let iptal = false
    setHata(false)
    gorseliGetir(yol)
      .then((a) => {
        if (iptal) return
        setUrl(a)
        setYuklenen(yol)
      })
      .catch(() => {
        if (!iptal) setHata(true)
      })
    return () => {
      iptal = true
    }
  }, [yol])

  return { url, gecis: !!yol && yuklenen !== yol && !hata, hata }
}
