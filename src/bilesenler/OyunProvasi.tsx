import { useEffect, useMemo, useState } from 'react'
import { zombiHesapla, type ZombiSorusu } from '../lib/zombi'
import { roketHesapla } from '../lib/roket'
import { ormanHesapla } from '../lib/orman'
import { OrmanSahnesi } from './OrmanSahnesi'
import { ejderhaHesapla } from '../lib/ejderha'
import { arenaHesapla } from '../lib/arena'
import { kaleHaritasiHesapla } from '../lib/kaleHarita'
import { merdivenHesapla, type MerdivenSorusu } from '../lib/merdiven'
import { halatTurHesapla, kuleTurHesapla, type TakimOzeti } from '../lib/takimOyunlari'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { sahteOyuncular, tohumluRastgele } from '../lib/oyunMotoru'
import { ZombiSahnesi } from './ZombiPaneli'
import { ArenaSahnesi, EjderhaSahnesi, KuleSahnesi, RoketSahnesi } from './GrafikOyunlari'
import { KaleHaritaSahnesi } from './KaleHaritasi'
import { Merdiven } from './MerdivenPaneli'
import { HalatSahnesi } from './HalatSahnesi'
import { HocaYarisSahnesi } from './HocaYarisSahnesi'
import { EnerjiSaglayici } from './KarakterEnerjisi'

const TOPLAM = 20
const OYUNLAR_LISTESI: OyunAnahtari[] = ['orman', 'zombi', 'roket', 'ejderha', 'arena', 'kule', 'kale', 'halat', 'merdiven', 'hoca']

/** Prova oyuncularını takımlara böler ve takım_soru_ozeti çıktısının aynısını üretir. */
function takimOzeti(oyuncular: { sonuc: (1 | 0 | -1)[] }[], takimSayisi: number, k: number): TakimOzeti {
  return {
    sayi: takimSayisi,
    sorular: Array.from({ length: TOPLAM }, (_, i) => ({ adim: `p${i}`, sira: i + 1, acildi: i < k })),
    takimlar: Array.from({ length: takimSayisi }, (_, t) => {
      const uyeler = oyuncular.filter((_, i) => i % takimSayisi === t)
      return {
        takim: t + 1,
        uye: uyeler.length,
        sorular: Array.from({ length: TOPLAM }, (_, i) => ({
          dogru: uyeler.filter((o) => o.sonuc[i] === 1).length,
          yanlis: uyeler.filter((o) => o.sonuc[i] === 0).length,
        })),
      }
    }),
  }
}
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
  const sorular: ZombiSorusu[] = useMemo(() => Array.from({ length: TOPLAM }, (_, i) => ({ adim: `p${i}`, sira: i + 1, acildi: i < k })), [k])

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

  const sahne = useMemo(() => {
    if (oyun === 'zombi') {
      const d = zombiHesapla(sorular, oyuncular)
      return d ? <ZombiSahnesi d={d} kapat={kapat} /> : null
    }
    if (oyun === 'orman') {
      const d = ormanHesapla(sorular, oyuncular)
      return d ? <OrmanSahnesi d={d} kucult={kapat} /> : null
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
    if (oyun === 'kule') {
      const d = kuleTurHesapla(takimOzeti(oyuncular, 3, k))
      return d ? <KuleSahnesi d={d} kucult={kapat} /> : null
    }
    if (oyun === 'kale') {
      const kale = oyuncular.map((o, i) => ({ ad: o.ad, takim: (i % 3) + 1, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) }))
      const d = kaleHaritasiHesapla(kale, 3, TOPLAM)
      return d ? <KaleHaritaSahnesi h={d} takimSayisi={3} kucult={kapat} /> : null
    }
    if (oyun === 'halat') {
      const h = halatTurHesapla(takimOzeti(oyuncular, 2, k))
      const halatOyuncular = oyuncular.map((o, i) => ({ ad: o.ad, takim: (i % 2) + 1, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) }))
      return h ? <HalatSahnesi h={{ konum: h.konum, kazanan: h.kazanan, oynanan: h.oynanan }} oyuncular={halatOyuncular} zorlaniyor={cevapBekle && !h.kazanan} kucult={kapat} /> : null
    }
    if (oyun === 'merdiven') {
      const ms: MerdivenSorusu[] = sorular.map((s, i) => {
        const cevap = oyuncular.filter((o) => o.sonuc[i] !== null).length
        const dogru = oyuncular.filter((o) => o.sonuc[i] === 1).length
        return { adim: s.adim, sira: s.sira, cevap, oran: s.acildi && cevap > 0 ? Math.round((100 * dogru) / cevap) : null, acildi: s.acildi }
      })
      const d = merdivenHesapla(ms, new Set())
      return (
        <div className="fixed inset-0 z-40 bg-slate-950/95 flex items-center justify-center p-6">
          <Merdiven d={d} sonSonuc={d.gecmis[d.gecmis.length - 1]?.sonuc ?? null} kucuk={false} joker={() => {}} kapat={kapat} />
        </div>
      )
    }
    // Hocayla yarış: hoca her soruda aynı başarı oranıyla bilir; sınıf puanı için doğru oranı en az %60 olmalı
    const hocaR = tohumluRastgele(7)
    let hoca = 0
    let sinif = 0
    let son: { hoca_dogru: boolean; sinif_orani: number | null } | null = null
    for (let i = 0; i < k; i++) {
      const hocaDogru = hocaR() < basari
      if (hocaDogru) hoca++
      const oran = oyuncular.filter((o) => o.sonuc[i] === 1).length / Math.max(1, oyuncular.length)
      if (oran >= 0.6) sinif++
      son = { hoca_dogru: hocaDogru, sinif_orani: Math.round(oran * 100) }
    }
    const hocaVeri = oyuncular.map((o) => ({ ad: o.ad, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) }))
    return <HocaYarisSahnesi hoca={hoca} sinif={sinif} son={son} oynanan={k} toplam={TOPLAM} oyuncular={hocaVeri} bitti={k >= TOPLAM} kapat={kapat} />
  }, [oyun, sorular, oyuncular, k, kapat, basari, cevapBekle])

  const enerjiVerisi = useMemo(() => oyuncular.map((o) => ({ ad: o.ad, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) })), [oyuncular, k])

  return (
    <>
      <EnerjiSaglayici oyuncular={enerjiVerisi}>{sahne}</EnerjiSaglayici>
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
