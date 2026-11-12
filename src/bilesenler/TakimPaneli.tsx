import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TAKIM_SAYILARI, takimBilgisi, type TakimDurumu } from '../lib/takim'

/** Takım yarışması: hoca takım sayısını seçer, takımların üye başına ortalama puanı canlı görünür. */
export default function TakimPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  const [d, setD] = useState<TakimDurumu | null>(null)
  const [menu, setMenu] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const yenile = useCallback(async () => {
    const { data } = await supabase.rpc('takim_goster', { p_session: oturum, p_anahtar: anahtar })
    if (data && !(data as { hata?: string }).hata) setD(data as TakimDurumu)
  }, [oturum, anahtar])

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 5000)
    return () => clearInterval(t)
  }, [yenile])

  async function ayarla(sayi: number) {
    setHata(null)
    const { data, error } = await supabase.rpc('takim_ayarla', { p_session: oturum, p_anahtar: anahtar, p_sayi: sayi })
    if (error || (data as { hata?: string })?.hata) setHata('Ayar yapılamadı.')
    setMenu(false)
    await yenile()
  }

  if (!d) return null
  const acik = d.sayi > 0
  const perde = mod === 'perde'

  const secenekler = menu && (
    <div className="cam-panel rounded-2xl p-3 space-y-2 pop">
      <p className="text-xs text-slate-300">Kaç takım olsun? Öğrenciler telefonlarından takımını seçer.</p>
      <div className="flex flex-wrap gap-2">
        {TAKIM_SAYILARI.map((n) => (
          <button key={n} className={n === d.sayi ? 'parlak-buton rounded-xl px-3 py-1.5 text-sm font-bold' : 'ikincil-buton !py-1.5'} onClick={() => ayarla(n)}>
            {n === 0 ? 'Kapat' : n}
          </button>
        ))}
      </div>
      {hata && <p className="text-xs text-rose-300">{hata}</p>}
    </div>
  )

  const puanTablosu = acik && (
    <ul className="cam-panel rounded-2xl p-3 space-y-1.5 min-w-52">
      {d.takimlar.map((t) => {
        const b = takimBilgisi(t.takim)
        return (
          <li key={t.takim} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs text-slate-400 w-4">{t.sira}</span>
            <span aria-hidden>{b.emoji}</span>
            <span className="font-bold flex-1">{b.ad}</span>
            <span className="tabular-nums font-extrabold">{t.ortalama}</span>
            <span className="text-[11px] text-slate-400 tabular-nums" title="Toplam puan · üye sayısı">
              ({t.puan} · {t.uye} kişi)
            </span>
          </li>
        )
      })}
      <li className="text-[10px] text-slate-500">Sıralama üye başına ortalama puana göredir.</li>
    </ul>
  )

  return (
    <div className={perde ? 'fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2' : 'space-y-2'}>
      {puanTablosu}
      {secenekler}
      <button className="ikincil-buton !py-1.5 text-sm" onClick={() => setMenu((m) => !m)}>
        👥 {acik ? `${d.sayi} takım` : 'Takım modu'}
      </button>
    </div>
  )
}
