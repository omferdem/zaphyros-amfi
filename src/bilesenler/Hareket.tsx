import { useEffect, useRef, useState } from 'react'

/**
 * Yeni bir soru oynandığında (sonucu açıldığında) "raund" sayacı artar ve birkaç saniye "aktif" kalır; sahneler bu sürede
 * hareket ve efekt çalar. Sahne ilk açıldığında (eski sorular) hareket başlatılmaz.
 */
export function useRaund(oynanan: number): { raund: number; aktif: boolean } {
  const onceki = useRef(oynanan)
  const [raund, setRaund] = useState(0)
  const [aktif, setAktif] = useState(false)
  useEffect(() => {
    if (oynanan > onceki.current) {
      onceki.current = oynanan
      setRaund((r) => r + 1)
      setAktif(true)
      const t = setTimeout(() => setAktif(false), 3600)
      return () => clearTimeout(t)
    }
    onceki.current = oynanan
  }, [oynanan])
  return { raund, aktif }
}

/** Kahramanın elindeki silah (ad'dan sabit seçilir). */
export const SILAHLAR = ['🗡️', '🏹', '🔱', '🪄', '🪓', '🔨', '⚔️', '🛡️']
