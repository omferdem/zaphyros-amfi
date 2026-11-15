import { useEffect, useMemo, useRef, useState } from 'react'
import { enerjiHesapla, gorunenAd, kalabalikAyari, type OyuncuSonucu } from '../lib/oyunMotoru'
import { supabase } from '../lib/supabase'

export interface SeritOyuncusu {
  ad: string
  sonuc: OyuncuSonucu[]
}

/** Oyun açıkken oyuncuların soru sonuçlarını periyodik çeker (zombi_goster aktif turu sayar). */
export function useOyuncuSonuclari(oturum: string, etkin: boolean): SeritOyuncusu[] {
  const [oyuncular, setOyuncular] = useState<SeritOyuncusu[]>([])
  useEffect(() => {
    if (!etkin) return
    let iptal = false
    const yenile = async () => {
      const { data } = await supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: null })
      const v = data as { oyuncular?: SeritOyuncusu[] } | null
      if (!iptal && v?.oyuncular) setOyuncular(v.oyuncular)
    }
    void yenile()
    const t = setInterval(yenile, 3500)
    return () => {
      iptal = true
      clearInterval(t)
    }
  }, [oturum, etkin])
  return oyuncular
}

/**
 * Ortak enerji şeridi: her oyuncunun 0-100 enerji barı. Düşük enerjili oyuncu soluk ve kırmızımsıdır; sonuç açılınca
 * oyuncunun üstünde "+1" ya da "−1" yükselir, seri yapanda 🔥 görünür. Kalabalıkta karakterler küçülür, adlar kısalır.
 */
export function EnerjiSeridi({ oyuncular, enAz = 1 }: { oyuncular: SeritOyuncusu[]; enAz?: number }) {
  const durumlar = useMemo(() => oyuncular.map((o) => ({ ...o, d: enerjiHesapla(o.sonuc), acilan: o.sonuc.filter((s) => s !== null).length })), [oyuncular])
  const ayar = kalabalikAyari(durumlar.length)
  const [isaret, setIsaret] = useState<Record<string, { tip: 'arti' | 'eksi' | 'bos'; seri: number }>>({})
  const onceki = useRef<Map<string, number>>(new Map())

  // Yeni açılan soru varsa işaretleri göster ve 2,5 saniye sonra kaldır
  useEffect(() => {
    const yeni: Record<string, { tip: 'arti' | 'eksi' | 'bos'; seri: number }> = {}
    for (const o of durumlar) {
      const eski = onceki.current.get(o.ad)
      if (eski !== undefined && o.acilan > eski && o.d.son) yeni[o.ad] = { tip: o.d.son, seri: o.d.seri }
      onceki.current.set(o.ad, o.acilan)
    }
    if (Object.keys(yeni).length === 0) return
    setIsaret(yeni)
    const t = setTimeout(() => setIsaret({}), 2500)
    return () => clearTimeout(t)
  }, [durumlar])

  if (durumlar.length < enAz) return null
  const sirali = [...durumlar].sort((a, b) => b.d.enerji - a.d.enerji)
  const lider = new Set([...sirali.slice(0, 3), ...sirali.slice(-3)].map((o) => o.ad))
  const boy = Math.round(44 * ayar.olcek)
  return (
    <div className="glass-panel p-2 max-w-full" aria-label="Oyuncu enerjileri">
      <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center">
        {sirali.map((o) => {
          const dusuk = o.d.enerji <= 25
          const isim = gorunenAd(o.ad, ayar, lider.has(o.ad))
          const is = isaret[o.ad]
          return (
            <div key={o.ad} className="relative flex flex-col items-center" style={{ width: boy + 14, opacity: dusuk ? 0.6 : 1 }}>
              {is && (
                <span className={`absolute -top-4 text-xs font-extrabold animate-pop ${is.tip === 'arti' ? 'text-ze-lime' : 'text-ze-danger'}`}>
                  {is.tip === 'arti' ? '+1' : '−1'}
                  {is.seri >= 3 && ' 🔥'}
                </span>
              )}
              <span
                className={`rounded-full flex items-center justify-center font-bold text-white ${dusuk ? 'bg-rose-700' : 'bg-linear-to-br from-ze-pink to-ze-purple'}`}
                style={{ width: boy, height: boy, fontSize: Math.round(18 * ayar.olcek) }}
              >
                {(o.ad.trim()[0] ?? '?').toLocaleUpperCase('tr')}
              </span>
              <span className="block w-full h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden" role="meter" aria-valuenow={o.d.enerji} aria-valuemin={0} aria-valuemax={100}>
                <span className={`block h-full ${dusuk ? 'bg-rose-500' : 'bg-ze-lime'}`} style={{ width: `${o.d.enerji}%` }} />
              </span>
              {isim && <span className="text-[10px] truncate w-full text-center text-slate-200">{isim}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
