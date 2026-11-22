import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { KALEM_RENKLERI, lazerKanali } from './Cizim'

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
  const [kalem, setKalem] = useState(false)

  function gonder(e: React.PointerEvent, d: boolean, zorla = false) {
    const simdi = Date.now()
    if (!zorla && simdi - son.current < ARALIK_MS) return
    son.current = simdi
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    void kanal.httpSend('lazer', { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, d }).catch(() => {})
  }

  function komut(k: string, r?: number) {
    void kanal.httpSend('komut', { k, r }).catch(() => {})
  }
  function kalemDegistir() {
    const yeni = !kalem
    setKalem(yeni)
    komut('mod', yeni ? 1 : 0)
  }

  return (
    <section className="cam-panel rounded-2xl p-4 space-y-2">
      <h3 className="text-xs font-bold text-slate-300">{kalem ? '✏️ Kalem: basılı tutunca perdede çizer' : '🔴 Lazer: parmağını kaydır, yalnızca işaret eder'}</h3>
      <div
        className="h-56 rounded-2xl border border-white/15 bg-slate-950/60 touch-none select-none flex items-center justify-center text-slate-500 text-xs"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          basili.current = true
          gonder(e, kalem, true)
        }}
        onPointerMove={(e) => gonder(e, basili.current && kalem)}
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
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={kalem ? 'parlak-buton rounded-xl px-3 py-1.5 text-xs font-bold' : 'ikincil-buton !py-1.5 !px-2.5 text-xs'} onClick={kalemDegistir} aria-pressed={kalem}>
          ✏️ Kalem: {kalem ? 'açık' : 'kapalı'}
        </button>
        {KALEM_RENKLERI.map((r, i) => (
          <button key={r.renk} aria-label={r.ad} onClick={() => komut('renk', i)} className="w-8 h-8 rounded-full border-2 border-white/40" style={{ background: r.renk }} />
        ))}
        <button className="ikincil-buton !py-1.5 !px-2.5 text-xs" onClick={() => komut('silgi')}>
          🧽 Silgi
        </button>
        <button className="ikincil-buton !py-1.5 !px-2.5 text-xs" onClick={() => komut('geri')}>
          ↶ Geri al
        </button>
        <button className="ikincil-buton !py-1.5 !px-2.5 text-xs" onClick={() => komut('temizle')}>
          🗑 Temizle
        </button>
        <button className="ikincil-buton !py-1.5 !px-2.5 text-xs" onClick={() => komut('kod')}>
          🔳 Karekodu gizle / göster
        </button>
        <button className="tehlike-buton !py-1.5 !px-2.5 text-xs" onClick={() => komut('kapat')}>
          Lazeri kapat
        </button>
      </div>
    </section>
  )
}
