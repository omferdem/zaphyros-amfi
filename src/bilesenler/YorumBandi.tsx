import { useEffect, useState } from 'react'
import { yorumSec, type Yorum } from '../lib/yorum'

const OLAY = 'amfi-yorum'
const sonAnahtarlar: string[] = []

/** Adaylardan tekrar etmeyen birini seçip perdedeki yorumcu bandına yollar. */
export function yorumYayinla(adaylar: Yorum[]): void {
  const y = yorumSec(adaylar, sonAnahtarlar)
  if (!y) return
  sonAnahtarlar.push(y.anahtar)
  if (sonAnahtarlar.length > 6) sonAnahtarlar.shift()
  window.dispatchEvent(new CustomEvent<Yorum>(OLAY, { detail: y }))
}

/** Perdenin üstünde tek satırlık yorumcu bandı; her yorum 6 saniye kalır. */
export default function YorumBandi() {
  const [yorum, setYorum] = useState<{ metin: string; id: number } | null>(null)

  useEffect(() => {
    let sayac = 0
    let zaman: ReturnType<typeof setTimeout> | undefined
    function dinle(e: Event) {
      const y = (e as CustomEvent<Yorum>).detail
      if (!y?.metin) return
      setYorum({ metin: y.metin, id: ++sayac })
      clearTimeout(zaman)
      zaman = setTimeout(() => setYorum(null), 6000)
    }
    window.addEventListener(OLAY, dinle)
    return () => {
      window.removeEventListener(OLAY, dinle)
      clearTimeout(zaman)
    }
  }, [])

  if (!yorum) return null
  return (
    <div key={yorum.id} className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-[58] max-w-[92vw] pop" role="status">
      <p className="cam-panel rounded-full px-6 py-2 text-lg sm:text-xl font-display font-extrabold text-center shadow-2xl">{yorum.metin}</p>
    </div>
  )
}
