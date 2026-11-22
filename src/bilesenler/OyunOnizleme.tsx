import { useEffect, useMemo, useState } from 'react'
import { zombiHesapla, type ZombiSorusu } from '../lib/zombi'
import { roketHesapla } from '../lib/roket'
import { ormanHesapla } from '../lib/orman'
import { ejderhaHesapla } from '../lib/ejderha'
import { arenaHesapla } from '../lib/arena'
import { kaleHaritasiHesapla } from '../lib/kaleHarita'
import { merdivenHesapla, type MerdivenSorusu } from '../lib/merdiven'
import { halatTurHesapla, kuleTurHesapla, type TakimOzeti } from '../lib/takimOyunlari'
import type { OyunAnahtari } from '../lib/oyun'
import { sahteOyuncular, tohumluRastgele } from '../lib/oyunMotoru'
import { ZombiSahnesi } from './ZombiPaneli'
import { OrmanSahnesi } from './OrmanSahnesi'
import { ArenaSahnesi, EjderhaSahnesi, KuleSahnesi, RoketSahnesi } from './GrafikOyunlari'
import { KaleHaritaSahnesi } from './KaleHaritasi'
import { Merdiven } from './MerdivenPaneli'
import { HalatSahnesi } from './HalatSahnesi'
import { HocaYarisSahnesi } from './HocaYarisSahnesi'
import { EnerjiSaglayici } from './KarakterEnerjisi'

export type SonucDizisi = (1 | 0 | -1 | null)[]
export interface SahneOyuncusu {
  ad: string
  sonuc: SonucDizisi
}

/** Oyuncuları takımlara böler ve takim_soru_ozeti çıktısının aynısını üretir. */
export function takimOzetiUret(oyuncular: SahneOyuncusu[], takimSayisi: number, toplam: number, k: number): TakimOzeti {
  return {
    sayi: takimSayisi,
    sorular: Array.from({ length: toplam }, (_, i) => ({ adim: `p${i}`, sira: i + 1, acildi: i < k })),
    takimlar: Array.from({ length: takimSayisi }, (_, t) => {
      const uyeler = oyuncular.filter((_, i) => i % takimSayisi === t)
      return {
        takim: t + 1,
        uye: uyeler.length,
        sorular: Array.from({ length: toplam }, (_, i) => ({
          dogru: uyeler.filter((o) => o.sonuc[i] === 1).length,
          yanlis: uyeler.filter((o) => o.sonuc[i] === 0).length,
        })),
      }
    }),
  }
}

/**
 * Bir oyunun perde sahnesini verilen oyuncu ve sonuçlarla çizer. Prova, kart önizlemesi ve oyun başlamadan önceki sahne
 * aynı çizimi kullanır; fark yalnızca verinin nereden geldiğidir.
 */
export function oyunSahnesiUret({
  oyun,
  oyuncular,
  k,
  toplam,
  kapat,
  basari = 0.6,
  cevapBekle = false,
  takimSayisi,
}: {
  oyun: OyunAnahtari
  oyuncular: SahneOyuncusu[]
  k: number
  toplam: number
  kapat: () => void
  basari?: number
  cevapBekle?: boolean
  /** Takımlı oyunlarda takım sayısı (halat her zaman 2) */
  takimSayisi?: number
}): React.ReactNode {
  const sorular: ZombiSorusu[] = Array.from({ length: toplam }, (_, i) => ({ adim: `p${i}`, sira: i + 1, acildi: i < k }))
  // Henüz oynanmamış sorular boş (null) görünür; sahne ilk soru açılmadan da başlangıç hâliyle çizilir
  const o = oyuncular.map((x) => ({ ad: x.ad, sonuc: x.sonuc as (1 | 0 | -1)[] }))
  const ts = takimSayisi ?? 3
  if (oyun === 'zombi') {
    const d = zombiHesapla(sorular, o)
    return d ? <ZombiSahnesi d={d} kapat={kapat} /> : null
  }
  if (oyun === 'orman') {
    const d = ormanHesapla(sorular, o)
    return d ? <OrmanSahnesi d={d} kucult={kapat} /> : null
  }
  if (oyun === 'roket') {
    const d = roketHesapla(sorular, o)
    return d ? <RoketSahnesi d={d} kucult={kapat} /> : null
  }
  if (oyun === 'ejderha') {
    const d = ejderhaHesapla(sorular, o)
    return d ? <EjderhaSahnesi d={d} kucult={kapat} /> : null
  }
  if (oyun === 'arena') {
    const d = arenaHesapla(sorular, o)
    return d ? <ArenaSahnesi d={d} kucult={kapat} /> : null
  }
  if (oyun === 'kule') {
    const d = kuleTurHesapla(takimOzetiUret(oyuncular, ts, toplam, k))
    return d ? <KuleSahnesi d={d} kucult={kapat} /> : null
  }
  if (oyun === 'kale') {
    const kale = oyuncular.map((x, i) => ({ ad: x.ad, takim: (i % ts) + 1, sonuc: x.sonuc.map((s, q) => (q < k ? s : null)) }))
    const d = kaleHaritasiHesapla(kale, ts, toplam)
    return d ? <KaleHaritaSahnesi h={d} takimSayisi={ts} kucult={kapat} /> : null
  }
  if (oyun === 'halat') {
    const h = halatTurHesapla(takimOzetiUret(oyuncular, 2, toplam, k))
    const halatOyuncular = oyuncular.map((x, i) => ({ ad: x.ad, takim: (i % 2) + 1, sonuc: x.sonuc.map((s, q) => (q < k ? s : null)) }))
    return h ? <HalatSahnesi h={{ konum: h.konum, kazanan: h.kazanan, oynanan: h.oynanan }} oyuncular={halatOyuncular} zorlaniyor={cevapBekle && !h.kazanan} kucult={kapat} /> : null
  }
  if (oyun === 'merdiven') {
    const ms: MerdivenSorusu[] = sorular.map((s, i) => {
      const cevap = oyuncular.filter((x) => x.sonuc[i] !== null && x.sonuc[i] !== undefined).length
      const dogru = oyuncular.filter((x) => x.sonuc[i] === 1).length
      return { adim: s.adim, sira: s.sira, cevap, oran: s.acildi && cevap > 0 ? Math.round((100 * dogru) / cevap) : null, acildi: s.acildi }
    })
    const d = merdivenHesapla(ms, new Set())
    return (
      <div data-denetim="sahne" className="perde-alan z-40 bg-slate-950/95 flex items-center justify-center p-6">
        <Merdiven d={d} sonSonuc={d.gecmis[d.gecmis.length - 1]?.sonuc ?? null} kucuk={false} joker={() => {}} kapat={kapat} tamEkran />
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
    const oran = oyuncular.filter((x) => x.sonuc[i] === 1).length / Math.max(1, oyuncular.length)
    if (oran >= 0.6) sinif++
    son = { hoca_dogru: hocaDogru, sinif_orani: Math.round(oran * 100) }
  }
  const hocaVeri = oyuncular.map((x) => ({ ad: x.ad, sonuc: x.sonuc.map((s, q) => (q < k ? s : null)) }))
  return <HocaYarisSahnesi hoca={hoca} sinif={sinif} son={son} oynanan={k} toplam={toplam} oyuncular={hocaVeri} bitti={k >= toplam} kapat={kapat} />
}

const ONIZLEME_TOPLAM = 12

/**
 * Oyun kartında ve oyun başladıktan sonra ilk sonuç açılana kadar perdede görünen sahne.
 * `demo` açıksa sahte oyuncularla kendi kendine oynar (örnek); kapalıysa gerçek katılımcıların adlarıyla başlangıç hâlini gösterir.
 * Tam ekran çizilir; üstüne düğmeler z-[60] ile konulur.
 */
export default function OyunOnizleme({ oyun, adlar, demo, takimSayisi }: { oyun: OyunAnahtari; adlar: string[]; demo: boolean; takimSayisi?: number }) {
  const [k, setK] = useState(demo ? 2 : 0)
  const [cevapBekle, setCevapBekle] = useState(false)

  const oyuncular: SahneOyuncusu[] = useMemo(() => {
    if (demo) {
      const sayi = adlar.length >= 6 ? Math.min(adlar.length, 24) : 14
      const sahte = sahteOyuncular(sayi, 0.62, ONIZLEME_TOPLAM)
      return sahte.map((s, i) => ({ ad: adlar[i] || s.ad, sonuc: s.sonuc }))
    }
    const liste = adlar.length > 0 ? adlar : []
    return liste.map((ad) => ({ ad, sonuc: Array.from({ length: ONIZLEME_TOPLAM }, () => null) as SonucDizisi }))
  }, [demo, adlar])

  useEffect(() => {
    if (!demo) return
    const t = setInterval(() => setK((x) => (x >= ONIZLEME_TOPLAM - 1 ? 2 : x + 1)), 4200)
    return () => clearInterval(t)
  }, [demo])

  useEffect(() => {
    if (!demo) return
    setCevapBekle(true)
    const t = setTimeout(() => setCevapBekle(false), 1600)
    return () => clearTimeout(t)
  }, [k, demo])

  useEffect(() => {
    // Önizlemede sahnenin "Küçült" düğmesi anlamsızdır
    document.body.classList.add('oyun-kilitli')
    return () => document.body.classList.remove('oyun-kilitli')
  }, [])

  const sahne = useMemo(
    () => oyunSahnesiUret({ oyun, oyuncular, k, toplam: ONIZLEME_TOPLAM, kapat: () => {}, cevapBekle, takimSayisi }),
    [oyun, oyuncular, k, cevapBekle, takimSayisi],
  )
  const enerji = useMemo(() => oyuncular.map((o) => ({ ad: o.ad, sonuc: o.sonuc.map((s, q) => (q < k ? s : null)) })), [oyuncular, k])
  // Önizleme, gerçek veriyle çizilen sahnelerin (z-30 ve z-40 sarmalayıcılar) altında kalsın: kendi katmanı z-20'dir
  // Katılımcı adı yokken (ör. yalnızca takma adla girenler) ve veri gelmeden hiçbir şey çizilmez; gerçek sahne veriyle kendisi açılır
  if (!sahne || (!demo && oyuncular.length === 0)) return null
  return (
    <div data-denetim="sahne" className="perde-alan z-[20]">
      <EnerjiSaglayici oyuncular={enerji as unknown as { ad: string; sonuc: (1 | 0 | -1 | null)[] }[]}>{sahne}</EnerjiSaglayici>
    </div>
  )
}
