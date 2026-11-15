import { useEffect, useState } from 'react'
import { TEPKILER, TEPKI_ARALIGI, tepkiGonder } from '../lib/tepki'

/** Öğrenci telefonunda küçük emoji şeridi: hoca perdede görür. 3 saniyede en çok 1 emoji. */
export default function TepkiSeridi({ oturum }: { oturum: string }) {
  const [bekle, setBekle] = useState(false)
  const [son, setSon] = useState<string | null>(null)
  useEffect(() => {
    if (!bekle) return
    const t = setTimeout(() => setBekle(false), TEPKI_ARALIGI)
    return () => clearTimeout(t)
  }, [bekle])
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none pb-10">
      <div className="glass-panel pointer-events-auto flex gap-1 px-2 py-1.5 rounded-full" role="group" aria-label="Tepki gönder">
        {TEPKILER.map((e) => (
          <button
            key={e}
            disabled={bekle}
            aria-label={`Tepki: ${e}`}
            onClick={() => {
              if (tepkiGonder(oturum, e)) {
                setBekle(true)
                setSon(e)
              }
            }}
            className={`text-2xl w-11 h-11 rounded-full transition ${bekle ? 'opacity-40' : 'active:scale-90 hover:bg-white/10'} ${son === e && bekle ? 'bg-white/10' : ''}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
