import { useMemo, useState } from 'react'
import type { PaketGrubu } from '../lib/paket'

/**
 * Soruları bankadan tek tek seçtirir. `secim` null ise elle seçim kapalıdır (soru sayısı kadar paketten otomatik çekilir);
 * küme verilirse yalnızca işaretlenen sorular kullanılır.
 */
export default function SoruSecici({ gruplar, secim, degistir }: { gruplar: PaketGrubu[]; secim: Set<string> | null; degistir: (s: Set<string> | null) => void }) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const toplam = useMemo(() => gruplar.reduce((a, g) => a + g.sorular.length, 0), [gruplar])
  const say = secim ? gruplar.reduce((a, g) => a + g.sorular.filter((s) => secim.has(s.id)).length, 0) : 0
  const ara = arama.trim().toLocaleLowerCase('tr')

  function ac() {
    setAcik(true)
    if (!secim) degistir(new Set(gruplar.flatMap((g) => g.sorular.map((s) => s.id))))
  }
  function isaretle(idler: string[], ac: boolean) {
    const y = new Set(secim ?? [])
    for (const id of idler) {
      if (ac) y.add(id)
      else y.delete(id)
    }
    degistir(y)
  }

  if (!acik) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="ikincil-buton !py-1.5" onClick={ac} disabled={toplam === 0}>
          ✋ Soruları tek tek seç
        </button>
        {secim && <span className="text-xs text-emerald-300 font-bold">{say} soru elle seçili</span>}
        {secim && (
          <button type="button" className="text-xs underline text-slate-300" onClick={() => degistir(null)}>
            Elle seçimi kaldır (otomatik çek)
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-sm">
          Elle seçim: {say} / {toplam} soru
        </b>
        <input className="giris-kutusu !py-1 !text-xs flex-1 min-w-40" placeholder="Soruda ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
        <button type="button" className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => isaretle(gruplar.flatMap((g) => g.sorular.map((s) => s.id)), true)}>
          Hepsini seç
        </button>
        <button type="button" className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => isaretle(gruplar.flatMap((g) => g.sorular.map((s) => s.id)), false)}>
          Hiçbirini
        </button>
        <button type="button" className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => { setAcik(false); degistir(null) }} title="Elle seçimi bırakıp otomatik seçime dön">
          Kapat
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {gruplar.map((g) => {
          const gorunen = g.sorular.filter((s) => !ara || s.soru.toLocaleLowerCase('tr').includes(ara))
          if (gorunen.length === 0) return null
          const hepsi = gorunen.every((s) => secim?.has(s.id))
          return (
            <div key={g.ad || '__paketsiz'}>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer sticky top-0 bg-slate-900/90 py-1">
                <input type="checkbox" className="accent-emerald-400" checked={hepsi} onChange={(e) => isaretle(gorunen.map((s) => s.id), e.target.checked)} />
                {g.ad || 'Paketsiz sorular'} ({g.sorular.length})
              </label>
              <ul className="space-y-0.5">
                {gorunen.map((s, i) => (
                  <li key={s.id}>
                    <label className="flex items-start gap-2 text-xs cursor-pointer rounded-lg px-1.5 py-1 hover:bg-white/5">
                      <input type="checkbox" className="accent-emerald-400 mt-0.5" checked={!!secim?.has(s.id)} onChange={(e) => isaretle([s.id], e.target.checked)} />
                      <span className="text-slate-500 tabular-nums w-5 shrink-0">{i + 1}.</span>
                      <span className="flex-1">
                        {s.soru}
                        <span className="block text-emerald-300/80">✓ {s.dogru}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
