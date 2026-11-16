import { useEffect, useRef, useState } from 'react'

/** Yumuşak başlayıp yumuşak biten geçiş eğrisi (0-1). */
export function yumusat(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Sayıların hedef değerlere "tak tak" sıçramadan, akarak ulaşmasını sağlar: hedef değişince her değer, o an görünen
 * değerden yeni hedefe `sure` ms içinde yumuşak biçimde kayar. Dönen harita her karede güncellenir.
 */
export function useAkiskanSayilar(hedef: Map<string, number>, sure = 2800): { deger: Map<string, number>; akiyor: boolean } {
  const [deger, setDeger] = useState<Map<string, number>>(hedef)
  const [akiyor, setAkiyor] = useState(false)
  const gorunen = useRef<Map<string, number>>(hedef)
  const anahtar = [...hedef].map(([k, v]) => `${k}:${v}`).join('|')

  useEffect(() => {
    const bas = new Map(gorunen.current)
    const t0 = performance.now()
    let kare = 0
    const adim = (simdi: number) => {
      const t = Math.min(1, (simdi - t0) / sure)
      const e = yumusat(t)
      const m = new Map<string, number>()
      for (const [k, v] of hedef) {
        const b = bas.get(k) ?? v
        m.set(k, b + (v - b) * e)
      }
      gorunen.current = m
      setDeger(m)
      setAkiyor(t < 1)
      if (t < 1) kare = requestAnimationFrame(adim)
    }
    kare = requestAnimationFrame(adim)
    return () => cancelAnimationFrame(kare)
    // hedef haritası her render'da yeni nesnedir; içeriği anahtardan izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, sure])

  return { deger, akiyor }
}
