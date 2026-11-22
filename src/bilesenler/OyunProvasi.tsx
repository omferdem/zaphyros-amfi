import { useEffect, useMemo, useState } from 'react'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { sahteOyuncular } from '../lib/oyunMotoru'
import { oyunSahnesiUret } from './OyunOnizleme'
import { EnerjiSaglayici } from './KarakterEnerjisi'

const TOPLAM = 20
const OYUNLAR_LISTESI: OyunAnahtari[] = ['orman', 'zombi', 'roket', 'ejderha', 'arena', 'kule', 'kale', 'halat', 'merdiven', 'hoca']

const OYUNCU_SAYILARI = [5, 30, 80]
const BASARILAR = [0.3, 0.6, 0.9]

/**
 * Oyun provası: sahte öğrencilerle bir oyunu baştan sona, gerçek derste göreceğin perde görünümüyle izlersin.
 * Hiçbir şey kaydedilmez, öğrenciler etkilenmez. Her 3,5 saniyede bir soru oynanmış sayılır.
 */
export default function OyunProvasi({ kapat, baslangic = 'zombi' }: { kapat: () => void; baslangic?: OyunAnahtari }) {
  const [oyun, setOyun] = useState<OyunAnahtari>(OYUNLAR_LISTESI.includes(baslangic) ? baslangic : 'zombi')
  const [k, setK] = useState(3)
  const [oynuyor, setOynuyor] = useState(true)
  const [sayi, setSayi] = useState(20)
  const [basari, setBasari] = useState(0.6)
  // Telefonda çubuk kapalı başlar: sahne tam görünür, düğmeyle açılır
  const [acik, setAcik] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  // Her yeni soruda ilk 1,6 sn cevap bekleniyormuş gibi karakterler zorlanır
  const [cevapBekle, setCevapBekle] = useState(false)
  const oyuncular = useMemo(() => sahteOyuncular(sayi, basari, TOPLAM), [sayi, basari])

  // Çıkış: Esc ve tarayıcı geri tuşu da provayı kapatır (telefonda ekran dışında kalan düğmeye gerek kalmaz)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat()
    }
    const geri = () => kapat()
    window.history.pushState({ provaAcik: true }, '')
    window.addEventListener('keydown', esc)
    window.addEventListener('popstate', geri)
    return () => {
      window.removeEventListener('keydown', esc)
      window.removeEventListener('popstate', geri)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!oynuyor || k >= TOPLAM) return
    const t = setTimeout(() => setK((x) => Math.min(TOPLAM, x + 1)), 3500)
    return () => clearTimeout(t)
  }, [oynuyor, k])

  useEffect(() => {
    setCevapBekle(true)
    const t = setTimeout(() => setCevapBekle(false), 1600)
    return () => clearTimeout(t)
  }, [k, oyun])

  const sahne = useMemo(
    () => oyunSahnesiUret({ oyun, oyuncular, k, toplam: TOPLAM, kapat, basari, cevapBekle }),
    [oyun, oyuncular, k, kapat, basari, cevapBekle],
  )

  const enerjiVerisi = useMemo(() => oyuncular.map((o) => ({ ad: o.ad, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) })), [oyuncular, k])

  return (
    <>
      <EnerjiSaglayici oyuncular={enerjiVerisi}>{sahne}</EnerjiSaglayici>
      <button
        data-denetim="prova-kapat"
        className="fixed right-2 z-[80] w-11 h-11 rounded-full bg-slate-900/90 border border-white/30 text-white text-xl font-bold shadow-xl hover:bg-rose-600"
        style={{ top: 'calc(var(--perde-ust, 0px) + 8px)' }}
        onClick={kapat}
        aria-label="Provayı kapat"
        title="Provayı kapat (Esc)"
      >
        ✕
      </button>
      {!acik && (
        <button
          className="fixed right-2 bottom-2 z-[70] rounded-full bg-fuchsia-600/90 hover:bg-fuchsia-500 text-white text-xs font-bold px-3 py-1.5 shadow-lg"
          onClick={() => setAcik(true)}
          title="Prova denetimlerini aç"
        >
          🧪 Prova · soru {k}/{TOPLAM}
        </button>
      )}
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-3 z-[70] cam-panel rounded-2xl px-3 py-2 ${acik ? "flex" : "hidden"} flex-wrap items-center gap-2 text-sm shadow-2xl w-[calc(100vw-1rem)] md:w-auto max-h-[38vh] overflow-y-auto`}>
        <span className="font-bold text-fuchsia-300">🧪 Oyun provası</span>
        <span className="text-xs text-slate-400 hidden sm:inline">sahte öğrencilerle, hiçbir şey kaydedilmez</span>
        <div className="flex flex-wrap gap-1">
          {OYUNLAR_LISTESI.map((a) => (
            <button
              key={a}
              onClick={() => {
                setOyun(a)
                setK(3)
                setOynuyor(true)
              }}
              className={`rounded-full px-2.5 py-1 text-xs border ${oyun === a ? 'border-indigo-300 bg-indigo-500/30 font-bold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              {OYUNLAR[a].emoji} {OYUNLAR[a].ad}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1" aria-label="Sahte öğrenci sayısı" title="Yalnızca prova için sahte öğrenci sayısıdır. Gerçek derste derse katılan herkes oynar.">
          <span className="text-xs text-slate-400">Sahte öğrenci:</span>
          {OYUNCU_SAYILARI.map((n) => (
            <button key={n} onClick={() => setSayi(n)} className={`rounded-full px-2 py-1 text-xs border ${sayi === n ? 'border-emerald-300 bg-emerald-500/30 font-bold' : 'border-white/10 bg-white/5'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-1" aria-label="Başarı oranı">
          {BASARILAR.map((n) => (
            <button key={n} onClick={() => setBasari(n)} className={`rounded-full px-2 py-1 text-xs border ${basari === n ? 'border-amber-300 bg-amber-500/30 font-bold' : 'border-white/10 bg-white/5'}`}>
              %{Math.round(n * 100)}
            </button>
          ))}
        </div>
        <button className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => setOynuyor((o) => !o)}>
          {oynuyor ? '⏸ Duraklat' : '▶ Sürdür'}
        </button>
        <button className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => setK((x) => Math.min(TOPLAM, x + 1))}>
          ⏭ Sonraki soru
        </button>
        <button
          className="ikincil-buton !py-1 !px-2 text-xs"
          onClick={() => {
            setK(3)
            setOynuyor(true)
          }}
        >
          ↺ Baştan
        </button>
        <span className="text-xs tabular-nums text-slate-300">
          soru {k} / {TOPLAM}
        </span>
        <button className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => setAcik(false)} title="Çubuğu küçült, sahne tamamen görünsün">
          ▾ Küçült
        </button>
        <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={kapat}>
          Kapat
        </button>
      </div>
    </>
  )
}
