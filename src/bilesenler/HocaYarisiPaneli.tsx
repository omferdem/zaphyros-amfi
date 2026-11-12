import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Yaris {
  acik: boolean
  hoca: number
  sinif: number
  soru: number
  cevapladi: boolean
  son: { hoca_dogru: boolean; sinif_orani: number | null } | null
}

interface Soru {
  id: string
  secenekler: string[]
  acik: boolean
}

const HARFLER = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * Hocayla yarış: sınıf hocaya karşı oynar. Hoca soru açıkken kendi cevabını gizlice verir; sonuç açılınca
 * hocanın doğru bilip bilmediği ve sınıfın başarısı skora yazılır. Perdede şıklar yalnızca harfle gösterilir.
 */
export default function HocaYarisiPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  const [y, setY] = useState<Yaris | null>(null)
  const [soru, setSoru] = useState<Soru | null>(null)
  const [secilen, setSecilen] = useState<{ adim: string; metin: string } | null>(null)
  const [acikPicker, setAcikPicker] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const yenile = useCallback(async () => {
    const [{ data }, { data: durum }] = await Promise.all([
      supabase.rpc('hoca_yaris_goster', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('ders_durumu', { p_session: oturum }),
    ])
    if (data && !(data as { hata?: string }).hata) setY(data as Yaris)
    const adim = (durum as { adim?: { id: string; tur: string; secenekler?: string[]; soru_durum?: string | null } | null } | null)?.adim
    setSoru(adim && adim.tur === 'soru' && adim.secenekler ? { id: adim.id, secenekler: adim.secenekler, acik: adim.soru_durum === 'acik' } : null)
  }, [oturum, anahtar])

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 3000)
    return () => clearInterval(t)
  }, [yenile])

  async function ayarla(acik: boolean) {
    setHata(null)
    await supabase.rpc('hoca_yaris_ayarla', { p_session: oturum, p_anahtar: anahtar, p_acik: acik })
    await yenile()
  }

  async function cevapla(metin: string) {
    if (!soru) return
    setHata(null)
    const { data, error } = await supabase.rpc('hoca_cevapla', { p_session: oturum, p_anahtar: anahtar, p_adim: soru.id, p_secim: metin })
    if (error || (data as { hata?: string })?.hata) setHata('Cevap kaydedilemedi (soru kapanmış olabilir).')
    else setSecilen({ adim: soru.id, metin })
    setAcikPicker(false)
    await yenile()
  }

  if (!y) return null
  const perde = mod === 'perde'
  const benim = secilen && soru && secilen.adim === soru.id ? secilen.metin : null

  if (!y.acik) {
    return (
      <div className={perde ? 'fixed left-1/2 -translate-x-1/2 bottom-14 z-30' : ''}>
        <button className="ikincil-buton !py-1.5 text-sm" onClick={() => ayarla(true)}>
          🥊 Hocayla yarış
        </button>
      </div>
    )
  }

  return (
    <div className={perde ? 'fixed left-1/2 -translate-x-1/2 bottom-14 z-30 flex flex-col items-center gap-2 max-w-[22rem]' : 'cam-panel rounded-2xl p-4 space-y-3'}>
      <div className="cam-panel rounded-2xl px-4 py-2 flex items-center gap-3">
        <span aria-hidden className="text-xl">
          🥊
        </span>
        <span className="font-display font-extrabold tabular-nums text-lg">
          Hoca {y.hoca} <span className="text-slate-500">–</span> {y.sinif} Sınıf
        </span>
        <button className="text-xs text-slate-500 hover:text-white" onClick={() => ayarla(false)} title="Hocayla yarışı kapat">
          ✕
        </button>
      </div>

      {y.son && (
        <div className="cam-panel rounded-2xl px-4 py-2 text-sm pop">
          Hoca: <b className={y.son.hoca_dogru ? 'text-emerald-300' : 'text-rose-300'}>{y.son.hoca_dogru ? '✔ doğru bildi' : '✘ yanıldı'}</b>
          {y.son.sinif_orani !== null && (
            <>
              {' · '}Sınıf: <b>%{y.son.sinif_orani}</b>
            </>
          )}
        </div>
      )}

      {soru?.acik && !y.son && (
        <div className="cam-panel rounded-2xl px-4 py-2 space-y-2">
          {y.cevapladi && !acikPicker ? (
            <p className="text-sm text-emerald-300">
              ✓ Hoca cevabını verdi{benim && !perde ? `: ${benim}` : ''}{' '}
              <button className="text-xs text-slate-400 underline" onClick={() => setAcikPicker(true)}>
                değiştir
              </button>
            </p>
          ) : acikPicker || !y.cevapladi ? (
            <>
              <p className="text-xs text-slate-400">Hoca cevabını seç (gizli):</p>
              <div className={perde ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
                {soru.secenekler.map((s, i) =>
                  perde ? (
                    <button key={i} className="ikincil-buton !px-3 !py-1 font-bold" onClick={() => cevapla(s)}>
                      {HARFLER[i]}
                    </button>
                  ) : (
                    <button key={i} className="ikincil-buton w-full text-left !py-2" onClick={() => cevapla(s)}>
                      <b>{HARFLER[i]}</b> {s}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : null}
          {hata && <p className="text-xs text-rose-300">{hata}</p>}
        </div>
      )}
    </div>
  )
}
