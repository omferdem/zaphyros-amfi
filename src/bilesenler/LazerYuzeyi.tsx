import { useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { lazerKanali } from './Cizim'

/** En sık gönderim aralığı: saniyede en çok 20 mesaj. */
const ARALIK_MS = 50

/**
 * Telefon kumandasında dokunmatik yüzey: parmağın hareketi perdedeki lazeri oynatır, basılı tutunca perdede çizer.
 * Mesajlar Broadcast ile HTTP üzerinden gider (abone olunmaz); veritabanına bir şey yazılmaz.
 */
export default function LazerYuzeyi({ oturum }: { oturum: string }) {
  const kanal = useMemo(() => supabase.channel(lazerKanali(oturum), { config: { broadcast: { self: false } } }), [oturum])
  const son = useRef(0)
  const basili = useRef(false)

  function gonder(e: React.PointerEvent, d: boolean, zorla = false) {
    const simdi = Date.now()
    if (!zorla && simdi - son.current < ARALIK_MS) return
    son.current = simdi
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    void kanal.httpSend('lazer', { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, d }).catch(() => {})
  }

  return (
    <section className="cam-panel rounded-2xl p-4 space-y-2">
      <h3 className="text-xs font-bold text-slate-300">🔴 Lazer: parmağını kaydır, basılı tutunca perdede çizer</h3>
      <div
        className="h-56 rounded-2xl border border-white/15 bg-slate-950/60 touch-none select-none flex items-center justify-center text-slate-500 text-xs"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          basili.current = true
          gonder(e, true, true)
        }}
        onPointerMove={(e) => gonder(e, basili.current)}
        onPointerUp={(e) => {
          basili.current = false
          gonder(e, false, true)
        }}
        onPointerCancel={(e) => {
          basili.current = false
          gonder(e, false, true)
        }}
      >
        Dokunmatik yüzey
      </div>
    </section>
  )
}
