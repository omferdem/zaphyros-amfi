import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TAKIM_SAYILARI, halatHesapla, takimBilgisi, type HalatTarafi, type TakimDurumu } from '../lib/takim'

/** Takım yarışması: hoca takım sayısını seçer, takımların üye başına ortalama puanı canlı görünür. */
export default function TakimPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  const [d, setD] = useState<TakimDurumu | null>(null)
  const [menu, setMenu] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  // Halat çekme (yalnızca 2 takımla): halat, soru açıkken kıpırdamasın diye son "kapalı" andaki değerlerle çizilir
  const [halat, setHalat] = useState(false)
  const [snap, setSnap] = useState<{ bir: HalatTarafi; iki: HalatTarafi } | null>(null)

  const yenile = useCallback(async () => {
    const [{ data }, { data: durum }] = await Promise.all([
      supabase.rpc('takim_goster', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('ders_durumu', { p_session: oturum }),
    ])
    if (data && !(data as { hata?: string }).hata) {
      const g = data as TakimDurumu
      setD(g)
      const soruAcik = (durum as { adim?: { tur?: string; soru_durum?: string | null } | null } | null)?.adim?.soru_durum === 'acik'
      const bir = g.takimlar.find((x) => x.takim === 1)
      const iki = g.takimlar.find((x) => x.takim === 2)
      if (!soruAcik && g.sayi === 2 && bir && iki) setSnap({ bir: { dogru: bir.dogru, uye: bir.uye }, iki: { dogru: iki.dogru, uye: iki.uye } })
    }
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

  const halatGorunumu = halat && acik && d.sayi === 2 && snap && <Halat bir={snap.bir} iki={snap.iki} kucuk={!perde} />

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
      {halatGorunumu}
      {puanTablosu}
      {secenekler}
      <div className="flex gap-2">
        {d.sayi === 2 && (
          <button className={halat ? 'parlak-buton rounded-xl px-3 py-1.5 text-sm font-bold' : 'ikincil-buton !py-1.5 text-sm'} onClick={() => setHalat((h) => !h)}>
            🪢 Halat çekme
          </button>
        )}
        <button className="ikincil-buton !py-1.5 text-sm" onClick={() => setMenu((m) => !m)}>
          👥 {acik ? `${d.sayi} takım` : 'Takım modu'}
        </button>
      </div>
    </div>
  )
}

/** İki takımın halat çekme görünümü: doğru cevaplar halatı kendi tarafına çeker; fark eşiği aşınca takım kazanır. */
function Halat({ bir, iki, kucuk }: { bir: HalatTarafi; iki: HalatTarafi; kucuk: boolean }) {
  const h = halatHesapla(bir, iki)
  const a = takimBilgisi(1)
  const b = takimBilgisi(2)
  // Düğüm: konum -1 (sol uç) ile +1 (sağ uç) arasında; kenarlara taşmasın diye %6 ile %94 arasına yerleşir
  const yuzde = 50 + h.konum * 44
  return (
    <div className={`cam-panel rounded-3xl p-4 space-y-2 ${kucuk ? 'w-full' : 'w-[min(52rem,92vw)] mb-2'}`}>
      <div className="flex items-center justify-between text-sm font-bold">
        <span>
          {a.emoji} {a.ad}
        </span>
        <span className="text-xs text-slate-400">🪢 Halat çekme</span>
        <span>
          {b.ad} {b.emoji}
        </span>
      </div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-500 via-slate-600 to-sky-500" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/30" title="Orta çizgi" />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-all duration-700 ease-out"
          style={{ left: `${yuzde}%` }}
          aria-hidden
        >
          🪢
        </div>
      </div>
      {h.kazanan && (
        <p className="text-center text-xl font-display font-extrabold pop pb-1">
          <span aria-hidden>{takimBilgisi(h.kazanan).emoji}</span> <span className="renkli-yazi">{takimBilgisi(h.kazanan).ad} takım halatı çekti!</span>
        </p>
      )}
    </div>
  )
}
