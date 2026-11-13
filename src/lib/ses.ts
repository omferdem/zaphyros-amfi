// Oyunlar için küçük ses efektleri. Dosya gerekmez: Web Audio ile üretilir. Hoca "Diğer" menüsünden kapatabilir.
import { useEffect, useRef, useState } from 'react'

export type Ses = 'tik' | 'dogru' | 'yanlis' | 'zafer' | 'yenilgi'

const ANAHTAR = 'amfi_ses'
let baglam: AudioContext | null = null

export function sesAcikMi(): boolean {
  try {
    return localStorage.getItem(ANAHTAR) !== '0'
  } catch {
    return true
  }
}

export function sesAyarla(acik: boolean): void {
  try {
    localStorage.setItem(ANAHTAR, acik ? '1' : '0')
  } catch {
    // Depolama kapalıysa ayar yalnızca bu açılışta geçerli olmaz; ses açık kalır
  }
  window.dispatchEvent(new Event('amfi-ses-ayari'))
}

function nota(frekans: number, baslangic: number, sure: number, tur: OscillatorType = 'sine', seviye = 0.1): void {
  if (!baglam) return
  const o = baglam.createOscillator()
  const g = baglam.createGain()
  const t0 = baglam.currentTime + baslangic
  o.type = tur
  o.frequency.setValueAtTime(frekans, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(seviye, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure)
  o.connect(g).connect(baglam.destination)
  o.start(t0)
  o.stop(t0 + sure + 0.05)
}

const DIZILER: Record<Ses, [number, number, number, OscillatorType?][]> = {
  tik: [[660, 0, 0.09]],
  dogru: [[523, 0, 0.12], [784, 0.1, 0.18]],
  yanlis: [[196, 0, 0.25, 'sawtooth']],
  zafer: [[523, 0, 0.15], [659, 0.14, 0.15], [784, 0.28, 0.15], [1047, 0.42, 0.45]],
  yenilgi: [[392, 0, 0.22, 'triangle'], [330, 0.2, 0.22, 'triangle'], [262, 0.4, 0.5, 'triangle']],
}

/** Efekti çalar; ses kapalıysa ya da tarayıcı izin vermiyorsa sessizce geçer. */
export function sesCal(ad: Ses): void {
  if (!sesAcikMi()) return
  try {
    baglam ??= new AudioContext()
    if (baglam.state === 'suspended') void baglam.resume()
    for (const [f, b, s, t] of DIZILER[ad]) nota(f, b, s, t ?? 'sine', ad === 'tik' ? 0.05 : 0.1)
  } catch {
    // Ses desteklenmiyorsa oyun yine çalışır
  }
}

/** Ses ayarını izleyen kanca (menüdeki düğme için). */
export function useSesAyari(): [boolean, (a: boolean) => void] {
  const [acik, setAcik] = useState(sesAcikMi)
  useEffect(() => {
    const g = () => setAcik(sesAcikMi())
    window.addEventListener('amfi-ses-ayari', g)
    return () => window.removeEventListener('amfi-ses-ayari', g)
  }, [])
  return [acik, sesAyarla]
}

/** Oyun sahnesinde: yeni soru oynanınca tık, oyun bitince zafer ya da yenilgi sesi. */
export function useOyunSesi(oynanan: number, bitti: boolean, kazandi: boolean): void {
  const onceki = useRef({ oynanan, bitti })
  useEffect(() => {
    const o = onceki.current
    if (bitti && !o.bitti) sesCal(kazandi ? 'zafer' : 'yenilgi')
    else if (oynanan > o.oynanan && !bitti) sesCal('tik')
    onceki.current = { oynanan, bitti }
  }, [oynanan, bitti, kazandi])
}

/** İnternet bağlantısı var mı (tarayıcının çevrimiçi/çevrimdışı olayları). */
export function useCevrimici(): boolean {
  const [acik, setAcik] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const a = () => setAcik(true)
    const k = () => setAcik(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', k)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', k)
    }
  }, [])
  return acik
}
