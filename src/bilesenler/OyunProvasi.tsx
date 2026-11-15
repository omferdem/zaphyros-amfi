import { useEffect, useMemo, useState } from 'react'
import { zombiHesapla, type ZombiSorusu } from '../lib/zombi'
import { roketHesapla } from '../lib/roket'
import { ejderhaHesapla } from '../lib/ejderha'
import { arenaHesapla } from '../lib/arena'
import { kuleHesapla } from '../lib/kule'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { sahteOyuncular } from '../lib/oyunMotoru'
import { ZombiSahnesi } from './ZombiPaneli'
import { ArenaSahnesi, EjderhaSahnesi, KuleSahnesi, RoketSahnesi } from './GrafikOyunlari'

const TOPLAM = 20
const OYUNLAR_LISTESI: OyunAnahtari[] = ['zombi', 'roket', 'ejderha', 'arena', 'kule']
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
  const oyuncular = useMemo(() => sahteOyuncular(sayi, basari, TOPLAM), [sayi, basari])
  const sorular: ZombiSorusu[] = useMemo(() => Array.from({ length: TOPLAM }, (_, i) => ({ adim: `p${i}`, sira: i + 1, acildi: i < k })), [k])

  useEffect(() => {
    if (!oynuyor || k >= TOPLAM) return
    const t = setTimeout(() => setK((x) => Math.min(TOPLAM, x + 1)), 3500)
    return () => clearTimeout(t)
  }, [oynuyor, k])

  const sahne = useMemo(() => {
    if (oyun === 'zombi') {
      const d = zombiHesapla(sorular, oyuncular)
      return d ? <ZombiSahnesi d={d} kapat={kapat} /> : null
    }
    if (oyun === 'roket') {
      const d = roketHesapla(sorular, oyuncular)
      return d ? <RoketSahnesi d={d} kucult={kapat} /> : null
    }
    if (oyun === 'ejderha') {
      const d = ejderhaHesapla(sorular, oyuncular)
      return d ? <EjderhaSahnesi d={d} kucult={kapat} /> : null
    }
    if (oyun === 'arena') {
      const d = arenaHesapla(sorular, oyuncular)
      return d ? <ArenaSahnesi d={d} kucult={kapat} /> : null
    }
    // Kule: oyuncular 3 takıma bölünür; takımın doğruları oynanan sorulara kadar toplanır
    const takimlar = [1, 2, 3].map((t) => {
      const uyeler = oyuncular.filter((_, i) => (i % 3) + 1 === t)
      const dogru = uyeler.reduce((top, o) => top + o.sonuc.slice(0, k).filter((x) => x === 1).length, 0)
      return { takim: t, uye: uyeler.length, dogru }
    })
    const d = kuleHesapla(takimlar, k, TOPLAM)
    return d ? <KuleSahnesi d={d} kucult={kapat} /> : null
  }, [oyun, sorular, oyuncular, k, kapat])

  return (
    <>
      {sahne}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-3 z-[70] cam-panel rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2 text-sm shadow-2xl">
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
        <div className="flex gap-1" aria-label="Oyuncu sayısı">
          {OYUNCU_SAYILARI.map((n) => (
            <button key={n} onClick={() => setSayi(n)} className={`rounded-full px-2 py-1 text-xs border ${sayi === n ? 'border-emerald-300 bg-emerald-500/30 font-bold' : 'border-white/10 bg-white/5'}`}>
              {n} kişi
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
        <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={kapat}>
          Kapat
        </button>
      </div>
    </>
  )
}
