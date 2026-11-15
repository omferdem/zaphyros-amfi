import { useEffect, useState } from 'react'
import { cihazKimligi } from '../lib/cihaz'
import { supabase } from '../lib/supabase'

interface Sonuc {
  sira: number | null
  toplam: number
  oyuncu: number
  dogru_say: number
  seri: number
}

export const finalKanali = (oturum: string) => `final:${oturum}`

/** Perdede final açılınca telefonda kendi sırasını, puanını, doğru sayısını ve en iyi serisini gösterir (kanal herkese açık, veri RPC'den gelir). */
export default function TelefonFinali({ oturum }: { oturum: string }) {
  const [sonuc, setSonuc] = useState<Sonuc | null>(null)
  useEffect(() => {
    const kanal = supabase.channel(finalKanali(oturum), { config: { broadcast: { self: false } } })
    kanal.on('broadcast', { event: 'final' }, async () => {
      const { data } = await supabase.rpc('benim_sonucum', { p_session: oturum, p_cihaz: cihazKimligi() })
      const d = data as Partial<Sonuc> | null
      if (d && typeof d.toplam === 'number') setSonuc({ sira: d.sira ?? null, toplam: d.toplam, oyuncu: d.oyuncu ?? 0, dogru_say: d.dogru_say ?? 0, seri: d.seri ?? 0 })
    })
    kanal.on('broadcast', { event: 'kapat' }, () => setSonuc(null))
    kanal.subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [oturum])
  if (!sonuc) return null
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-6" role="dialog" aria-label="Yarışma sonucun">
      <div className="glass-panel rounded-3xl p-6 text-center space-y-3 max-w-sm w-full animate-pop">
        <p className="text-5xl">{sonuc.sira === 1 ? '🥇' : sonuc.sira === 2 ? '🥈' : sonuc.sira === 3 ? '🥉' : '🏁'}</p>
        <h2 className="font-display font-extrabold text-2xl">Yarışma bitti</h2>
        {sonuc.sira ? (
          <p className="text-lg">
            {sonuc.oyuncu} kişi arasında <b className="text-ze-cyan">{sonuc.sira}. oldun</b>
          </p>
        ) : (
          <p className="text-slate-300">Bu turda cevap vermedin.</p>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 p-2">
            <p className="font-mono font-extrabold text-xl text-ze-lime">{sonuc.toplam}</p>
            <p className="text-[11px] text-slate-400">puan</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <p className="font-mono font-extrabold text-xl">{sonuc.dogru_say}</p>
            <p className="text-[11px] text-slate-400">doğru</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <p className="font-mono font-extrabold text-xl text-ze-yellow">{sonuc.seri >= 3 ? `🔥${sonuc.seri}` : sonuc.seri}</p>
            <p className="text-[11px] text-slate-400">en iyi seri</p>
          </div>
        </div>
        <button className="btn-primary w-full py-3 rounded-2xl font-display font-bold" onClick={() => setSonuc(null)}>
          Tamam
        </button>
      </div>
    </div>
  )
}
