import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { lazerKanali } from './Cizim'

/**
 * Telefon kumandasında ses ayarı: perdedeki ses düzeyini, efektleri ve müziği uzaktan ayarlar.
 * Komutlar lazer kanalından (Broadcast, HTTP) perdeye gider; veritabanına bir şey yazılmaz.
 */
export default function KumandaSes({ oturum }: { oturum: string }) {
  const kanal = useMemo(() => supabase.channel(lazerKanali(oturum), { config: { broadcast: { self: false } } }), [oturum])
  const [duzey, setDuzey] = useState(80)
  const son = useRef(0)

  function gonder(k: string, r?: number) {
    void kanal.httpSend('komut', { k, r }).catch(() => {})
  }

  function duzeyDegisti(v: number) {
    setDuzey(v)
    const simdi = Date.now()
    if (simdi - son.current < 150) return
    son.current = simdi
    gonder('ses_duzey', v)
  }

  return (
    <section className="cam-panel rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-300">🔊 Ses (perde)</h3>
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          🔈
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={duzey}
          onChange={(e) => duzeyDegisti(Number(e.target.value))}
          onPointerUp={() => gonder('ses_duzey', duzey)}
          onKeyUp={() => gonder('ses_duzey', duzey)}
          className="flex-1 accent-fuchsia-500"
          aria-label="Ses düzeyi"
        />
        <span className="w-10 text-right text-sm tabular-nums">{duzey}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="ikincil-buton !py-2 text-sm" onClick={() => gonder('ses', 0)}>
          🔇 Efektler kapalı
        </button>
        <button className="ikincil-buton !py-2 text-sm" onClick={() => gonder('ses', 1)}>
          🔊 Efektler açık
        </button>
        <button className="ikincil-buton !py-2 text-sm" onClick={() => gonder('muzik', 0)}>
          🎵 Müzik kapalı
        </button>
        <button className="ikincil-buton !py-2 text-sm" onClick={() => gonder('muzik', 1)}>
          🎵 Müzik açık
        </button>
      </div>
      <p className="text-xs text-slate-400">Tarayıcılar sesi, perde sayfasına en az bir kez tıklanmadan başlatmayabilir.</p>
    </section>
  )
}
