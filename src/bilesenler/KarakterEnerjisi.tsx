import { createContext, useContext, useMemo } from 'react'
import { enerjiHesapla, type EnerjiDurumu } from '../lib/oyunMotoru'
import type { SeritOyuncusu } from './EnerjiSeridi'

interface Baglam {
  harita: Map<string, EnerjiDurumu & { acilan: number }>
  /** Oyuncu sayısı: kalabalıkta bar incelir ama kaybolmaz */
  sayi: number
}

const EnerjiBaglami = createContext<Baglam | null>(null)

/** Sahnedeki karakterlerin enerjisini ad üzerinden verir; sahne bunu sarmazsa KarakterEnerjisi hiçbir şey çizmez. */
export function EnerjiSaglayici({ oyuncular, children }: { oyuncular: SeritOyuncusu[] | undefined; children: React.ReactNode }) {
  const deger = useMemo<Baglam | null>(() => {
    if (!oyuncular || oyuncular.length === 0 || oyuncular[0]?.sonuc === undefined) return null
    return {
      harita: new Map(oyuncular.map((o) => [o.ad, { ...enerjiHesapla(o.sonuc, o.hizli), acilan: o.sonuc.filter((s) => s !== null).length }])),
      sayi: oyuncular.length,
    }
  }, [oyuncular])
  return <EnerjiBaglami.Provider value={deger}>{children}</EnerjiBaglami.Provider>
}

const STIL = `
@keyframes karakter-yuk { 0% { opacity: 0; transform: translate(-50%, 4px) scale(.7) } 20% { opacity: 1; transform: translate(-50%, -3px) scale(1.15) } 75% { opacity: 1; transform: translate(-50%, -14px) scale(1) } 100% { opacity: 0; transform: translate(-50%, -22px) } }
`

/**
 * Karakterin tepesindeki enerji barı (0-100). Sonuç açılınca barın üstünden "+1" ya da "−1" yükselir, doğru serisinde 🔥 çıkar.
 * Konumu üst kutudan verilir (varsayılan: üst kutu `relative` ise karakterin üstünde ortalı). 40+ oyuncuda bar incelir.
 */
export function KarakterEnerjisi({ ad, className = 'absolute -top-2.5 left-1/2 -translate-x-1/2 w-12' }: { ad: string; className?: string }) {
  const b = useContext(EnerjiBaglami)
  const e = b?.harita.get(ad)
  if (!b || !e) return null
  const ince = b.sayi >= 40
  const renk = e.enerji >= 60 ? 'bg-emerald-400' : e.enerji >= 30 ? 'bg-amber-400' : 'bg-rose-500'
  const isaret = e.son === 'arti' ? '+1' : e.son === 'eksi' ? '−1' : null
  return (
    <span className={`${className} pointer-events-none z-20`} title={`${ad}: enerji ${e.enerji}`}>
      <style>{STIL}</style>
      {isaret && e.acilan > 0 && (
        <span
          key={`yuk-${e.acilan}`}
          className={`absolute left-1/2 bottom-full font-display font-extrabold drop-shadow whitespace-nowrap ${e.son === 'arti' ? 'text-emerald-300' : 'text-rose-300'} ${ince ? 'text-[10px]' : 'text-xs'}`}
          style={{ animation: 'karakter-yuk 1.8s ease-out forwards' }}
        >
          {isaret}
          {e.son === 'arti' && e.seri > 0 && e.seri % 3 === 0 ? '🔥' : ''}
        </span>
      )}
      <span className={`block w-full rounded-full bg-black/60 overflow-hidden ring-1 ring-black/30 ${ince ? 'h-[3px]' : 'h-1.5'}`}>
        <span className={`block h-full ${renk} transition-all duration-700`} style={{ width: `${e.enerji}%` }} />
      </span>
    </span>
  )
}
