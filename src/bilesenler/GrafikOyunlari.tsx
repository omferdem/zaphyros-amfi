import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OYUN_OLAYI, type OyunAnahtari } from '../lib/oyun'
import { roketHesapla, type RoketDurumu } from '../lib/roket'
import { arenaHesapla, ARENA_CANI, type ArenaDurumu } from '../lib/arena'
import { kuleHesapla, type KuleDurumu, type KuleTakimi } from '../lib/kule'
import { kaleHesapla, type KaleDurumu } from '../lib/kale'
import Gorsel, { adIndeksi, arkaPlan, gorselAdresi } from './Gorsel'
import { SILAHLAR, useRaund } from './Hareket'
import { Sinema, merkez, rastgele } from './Sinema'
import { takimBilgisi } from '../lib/takim'
import { EJDERHA_ORANI, KAHRAMAN_CANI, ejderhaHesapla, type EjderhaDurumu } from '../lib/ejderha'
import type { ZombiOyuncusu, ZombiSorusu } from '../lib/zombi'
import Konfeti from './Konfeti'
import { sesCal, useOyunSesi } from '../lib/ses'

type Veri = { sorular: ZombiSorusu[]; oyuncular: ZombiOyuncusu[] }

function karakter(ad: string, liste: string[]): string {
  let h = 0
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0
  return liste[h % liste.length]
}

/**
 * Ortak kabuk: oyunun açık/kapalı durumunu saklar, oyun olayını dinler, oyuncu verisini (zombi_goster) çeker ve
 * perdede küçük özet + büyük sahne arasında geçiş sağlar. Oyuna özgü kurallar ve görünüm dışarıdan verilir.
 */
function OyunKabugu<D, V = Veri>({
  oyun,
  baslik,
  oturum,
  anahtar,
  mod,
  hesapla,
  getir,
  ozet,
  sahne,
  konum,
}: {
  oyun: OyunAnahtari
  baslik: string
  oturum: string
  anahtar: string | null
  mod: 'perde' | 'kumanda'
  hesapla: (v: V) => D | null
  /** Veri kaynağı; verilmezse oyuncu sonuçları (zombi_goster) çekilir */
  getir?: (oturum: string, anahtar: string | null) => Promise<V | null>
  ozet: (d: D) => React.ReactNode
  sahne: (d: D, kucult: () => void) => React.ReactNode
  /** Kapalıyken düğmenin ve açıkken özet kutusunun perdedeki dikey yeri (Tailwind bottom sınıfı) */
  konum: string
}) {
  const kayit = `amfi_${oyun}_${oturum}`
  const [acik, setAcik] = useState(() => {
    try {
      return localStorage.getItem(kayit) === '1'
    } catch {
      return false
    }
  })
  const [buyuk, setBuyuk] = useState(false)
  const [veri, setVeri] = useState<V | null>(null)

  const yenile = useCallback(async () => {
    if (getir) {
      const v = await getir(oturum, anahtar)
      if (v) setVeri(v)
      return
    }
    const { data } = await supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: anahtar })
    const v = data as { sorular?: ZombiSorusu[]; oyuncular?: ZombiOyuncusu[] } | null
    if (v?.sorular && v.oyuncular) setVeri({ sorular: v.sorular, oyuncular: v.oyuncular } as unknown as V)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oturum, anahtar])

  // Oyun açık değilken sunucuya sorulmaz (beş oyun paneli aynı sayfada durur; boşuna istek atmasınlar)
  useEffect(() => {
    if (!acik) return
    yenile()
    const t = setInterval(yenile, 3500)
    return () => clearInterval(t)
  }, [yenile, acik])

  function ac(a: boolean) {
    setAcik(a)
    try {
      localStorage.setItem(kayit, a ? '1' : '0')
    } catch {
      // Depolama kapalıysa durum yalnızca bu açılışta tutulur
    }
  }

  useEffect(() => {
    function dinle(e: Event) {
      if ((e as CustomEvent<{ oyun: string }>).detail?.oyun === oyun) {
        ac(true)
        setBuyuk(true)
      } else {
        // Başka bir oyun seçildi ya da bireysele dönüldü: bu oyun kapanır
        ac(false)
        setBuyuk(false)
      }
    }
    window.addEventListener(OYUN_OLAYI, dinle)
    return () => window.removeEventListener(OYUN_OLAYI, dinle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oturum])

  const d = useMemo(() => (veri ? hesapla(veri) : null), [veri, hesapla])
  const perde = mod === 'perde'

  // Bu oyun seçili değilse ve henüz açılmadıysa hiçbir şey göstermeyiz (düğmeler yalnızca oyun seçilince çıkar)
  if (!acik) return null
  if (!d) {
    return perde ? (
      <div className={`fixed right-4 ${konum} z-30 cam-panel rounded-2xl px-4 py-2 text-sm text-slate-300`}>
        {baslik}: ilk sorunun sonucu açılınca başlar.
      </div>
    ) : null
  }
  if (!perde) return <div className="text-sm">{ozet(d)}</div>
  return (
    <>
      {!buyuk && (
        <div className={`fixed right-4 ${konum} z-30 w-[min(22rem,90vw)]`}>
          <div className="cam-panel rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <b>{baslik}</b>
              <button className="ml-auto text-xs text-slate-500 hover:text-white" onClick={() => ac(false)} title="Oyunu gizle">
                ✕
              </button>
            </div>
            {ozet(d)}
            <button className="parlak-buton rounded-xl px-3 py-1.5 text-sm font-bold w-full" onClick={() => setBuyuk(true)}>
              ⛶ Sahneyi büyüt
            </button>
          </div>
        </div>
      )}
      {buyuk && sahne(d, () => setBuyuk(false))}
    </>
  )
}

// ---------------------------------------------------------------------------------------------------- Roket yarışı

const ROKETLER = ['🚀', '🛸', '🚀', '🚀']

export function RoketPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  return (
    <OyunKabugu<RoketDurumu>
      oyun="roket"
      baslik="🚀 Roket yarışı"
      oturum={oturum}
      anahtar={anahtar}
      mod={mod}
      hesapla={(v) => roketHesapla(v.sorular, v.oyuncular)}
      konum="bottom-28"
      ozet={(d) => (
        <p className="text-sm">
          Soru {d.oynanan} / {d.toplamSoru} · bitiren <b className="text-emerald-300">{d.bitirenler}</b> · lider <b>{d.siralama[0]?.ad ?? '-'}</b>
        </p>
      )}
      sahne={(d, kucult) => <RoketSahnesi d={d} kucult={kucult} />}
    />
  )
}

export function RoketSahnesi({ d, kucult }: { d: RoketDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, true)
  const n = d.oyuncular.length
  const seritSayisi = Math.max(4, Math.min(14, n))
  const boy = n > 60 ? 'text-xl' : n > 30 ? 'text-2xl' : 'text-3xl'
  const podyum = d.siralama.slice(0, 3)
  const { aktif: aktifRaund, raund } = useRaund(d.oynanan, 4500)
  const roketRef = useRef<Map<number, HTMLElement>>(new Map())
  // Yeni soruda: doğru bilenler turbo ile fırlar; yanlış bilenlere gökten meteor çarpar, roket sarsılıp döner
  useEffect(() => {
    if (raund === 0) return
    const s = new Sinema()
    void (async () => {
      const dogrular = d.oyuncular.map((o, i) => ({ o, i })).filter((x) => x.o.son === 1 && x.o.bitirdi === null).slice(0, 16)
      dogrular.forEach(({ i }, k) => {
        const p = merkez(roketRef.current.get(i))
        if (p) void s.patlama(p, { resim: 'efekt-turbo.webp', emoji: '💨', boyut: 90, sure: 700, gecik: k * 40 })
      })
      if (dogrular.length > 0) sesCal('whoosh')
      await s.bekle(900)
      if (s.durdu) return
      const yanlislar = d.oyuncular.map((o, i) => ({ o, i })).filter((x) => x.o.son !== null && x.o.son !== 1 && x.o.bitirdi === null).slice(0, 14)
      yanlislar.forEach(({ i }, k) => {
        const el = roketRef.current.get(i)
        const p = merkez(el)
        if (!p) return
        const gecik = k * 140
        void s.ucur({ from: { x: p.x + rastgele(160, 320), y: -60 }, to: p, emoji: '☄️', boyut: 64, sure: 750, gecik, yay: -30, don: 40, iz: '🔥', olcek: 1.1 }).then(() => {
          if (s.durdu) return
          void s.patlama(p, { resim: 'efekt-darbe.webp', emoji: '💥', boyut: 80 })
          s.sars(el, { siddet: 16, sure: 700 })
          if (k === 0) sesCal('yanlis')
        })
      })
    })()
    return () => s.durdur()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raund])
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold roket-baslik">🚀 Roket Yarışı</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm text-slate-300">Bitiş çizgisi: {d.hedef} doğru</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden roket-uzay border border-white/10" style={arkaPlan('arka-roket-yatay.webp')}>
        <div className="absolute left-[3%] top-[8%] text-6xl opacity-70 roket-gezegen" aria-hidden>
          🪐
        </div>
        <div className="absolute right-[2%] top-0 bottom-0 w-[6%] roket-bitis flex items-center justify-center" aria-hidden>
          <span className="text-4xl rotate-90 tracking-[0.3em] text-white/70 font-bold">VARIŞ</span>
        </div>
        {d.oyuncular.map((o, i) => {
          const oran = Math.min(1, o.ilerleme / d.hedef)
          const serit = i % seritSayisi
          const bitti = o.bitirdi !== null
          return (
            <div
              key={`${o.ad}-${i}`}
              ref={(el) => {
                if (el) roketRef.current.set(i, el)
                else roketRef.current.delete(i)
              }}
              className={`absolute -translate-y-1/2 transition-all duration-1000 ease-out flex items-center ${aktifRaund && o.son === 1 ? 'roket-hizlan' : ''}`}
              style={{ left: `${4 + oran * 84}%`, top: `${8 + (serit / seritSayisi) * 84 + 4}%` }}
              title={`${o.ad}: ${o.ilerleme} doğru`}
            >
              <span className="roket-iz" style={{ width: `${Math.max(1, oran * 14)}vw` }} aria-hidden />
              <span className={`inline-block ${bitti ? 'roket-varti' : 'roket-ucus'}`}>
                <span className="inline-block" style={{ transform: 'rotate(90deg)' }}>
                  <Gorsel ad={`roket-${adIndeksi(o.ad, 6)}.webp`} emoji={karakter(o.ad, ROKETLER)} className={n > 60 ? 'w-8 h-8' : n > 30 ? 'w-11 h-11' : 'w-14 h-14'} emojiClass={`${boy} inline-block`} />
                </span>
              </span>
              <span className="text-[10px] font-bold px-1 rounded bg-slate-950/70 whitespace-nowrap ml-1 max-w-24 truncate">{o.ad}</span>
            </div>
          )
        })}
        {podyum.length > 0 && podyum[0].ilerleme > 0 && (
          <div className="absolute left-3 bottom-3 cam-panel rounded-2xl p-3 text-sm space-y-0.5 z-10">
            <p className="font-bold text-xs text-slate-300">Liderler</p>
            {podyum.map((o, i) => (
              <p key={`${o.ad}-${i}`}>
                {['🥇', '🥈', '🥉'][i]} {o.ad} <span className="text-slate-400">({o.ilerleme})</span>
              </p>
            ))}
          </div>
        )}
        {d.bitti && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] z-20">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-3 girdi">
              <p className="text-6xl">🏁</p>
              <p className="text-3xl font-display font-extrabold">Yarış bitti</p>
              {podyum.map((o, i) => (
                <p key={`${o.ad}-${i}`} className="text-2xl">
                  {['🥇', '🥈', '🥉'][i]} {o.ad}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 text-center">Her doğru cevap roketi ileri iter. Cevap vermeyen ya da yanlış bilen yerinde kalır.</p>
    </div>
  )
}

// -------------------------------------------------------------------------------------------------- Ejderha savaşı

const KAHRAMANLAR = ['🧙', '🥷', '🦸', '🧝', '🤺', '🏹', '🧑‍🚀', '👩‍🚒', '🦹', '🧚']

export function EjderhaPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  return (
    <OyunKabugu<EjderhaDurumu>
      oyun="ejderha"
      baslik="🐉 Ejderha savaşı"
      oturum={oturum}
      anahtar={anahtar}
      mod={mod}
      hesapla={(v) => ejderhaHesapla(v.sorular, v.oyuncular)}
      konum="bottom-28"
      ozet={(d) => (
        <div className="space-y-1.5 text-sm">
          <p>
            Ejderha canı <b className="text-rose-300">{d.can}</b> / {d.enCok} · ayakta <b className="text-emerald-300">{d.ayakta}</b>
          </p>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-linear-to-r from-rose-500 to-orange-400 transition-[width] duration-700" style={{ width: `${(d.can / d.enCok) * 100}%` }} />
          </div>
          {d.bitti && <p className={d.kazandi ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{d.kazandi ? '🏆 Ejderha yenildi!' : '🔥 Ejderha kazandı'}</p>}
        </div>
      )}
      sahne={(d, kucult) => <EjderhaSahnesi d={d} kucult={kucult} />}
    />
  )
}

export function EjderhaSahnesi({ d, kucult }: { d: EjderhaDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, d.kazandi)
  const n = d.kahramanlar.length
  const boy = n > 80 ? 'text-2xl' : n > 40 ? 'text-4xl' : n > 20 ? 'text-5xl' : 'text-6xl'
  const adBoy = n > 40 ? 'text-[10px] max-w-16' : 'text-sm max-w-24'
  const sonHasar = d.hasarlar[d.hasarlar.length - 1] ?? 0
  const oran = d.can / d.enCok
  const { raund } = useRaund(d.oynanan, 9000)
  const ejderhaRef = useRef<HTMLDivElement>(null)
  const kahramanRef = useRef<Map<number, HTMLLIElement>>(new Map())

  // Her yeni soruda bir sahne oynar: doğru bilenler silahlarıyla ejderhaya koşup vurur, ejderha kükrer ve ağzından ateş
  // topları fırlatır; yanlış bilenler vurulup devrilir. Sıra: saldırı, hasar, kükreme, ateş, devrilme.
  useEffect(() => {
    if (raund === 0) return
    const s = new Sinema()
    const soluk: HTMLElement[] = []
    void (async () => {
      const e = ejderhaRef.current
      if (!e) return
      const r = e.getBoundingClientRect()
      const govde = { x: r.left + r.width * 0.52, y: r.top + r.height * 0.55 }
      const agiz = { x: r.left + r.width * 0.13, y: r.top + r.height * 0.43 }
      const gorunen = (i: number) => {
        const li = kahramanRef.current.get(i)
        const p = merkez(li)
        return li && p && p.y > 0 && p.y < window.innerHeight ? { li, p } : null
      }
      const saldirganlar = d.kahramanlar
        .map((h, i) => ({ h, i, g: gorunen(i) }))
        .filter((x) => x.h.son === 1 && x.h.dustu === null && x.g)
        .slice(0, 36)
      const kayiplar = d.kahramanlar
        .map((h, i) => ({ h, i, g: gorunen(i) }))
        .filter((x) => x.h.son !== null && x.h.son !== 1 && (x.h.dustu === null || x.h.dustu === d.oynanan) && x.g)
        .slice(0, 24)

      // 1) Saldırı: doğru bilen kahraman koşup ejderhaya vurur, sonra yerine döner
      saldirganlar.forEach(({ h, g }, k) => {
        const li = g!.li
        li.style.opacity = '0.15'
        soluk.push(li)
        const hedef = { x: govde.x + rastgele(-60, 60), y: govde.y + rastgele(-40, 50) }
        const gecik = k * 60 + rastgele(0, 300)
        const resim = `kahraman-${adIndeksi(h.ad, 8)}.webp`
        void s
          .ucur({ from: g!.p, to: hedef, resim, emoji: karakter(h.ad, KAHRAMANLAR), boyut: 62, sure: 1000, gecik, yay: 110, don: 16, iz: '✨' })
          .then(async () => {
            if (s.durdu) return
            void s.patlama(hedef, { resim: 'efekt-darbe.webp', emoji: '💥', boyut: 84, sure: 420 })
            s.sars(e, { siddet: 6, sure: 300 })
            if (k % 4 === 0) sesCal('tik')
            await s.ucur({ from: hedef, to: g!.p, resim, emoji: karakter(h.ad, KAHRAMANLAR), boyut: 62, sure: 700, yay: 50, don: -10 })
            li.style.opacity = ''
          })
      })
      await s.bekle(1000 + saldirganlar.length * 60 + 450)
      if (s.durdu) return

      // 2) Hasar
      if (sonHasar > 0) {
        void s.yazi({ x: govde.x, y: r.top + r.height * 0.22 }, `−${sonHasar}`, { boyut: 76, sure: 1700 })
        sesCal('dogru')
      }
      await s.bekle(900)
      if (s.durdu || d.kazandi) return

      // 3) Kükreme ve ateş: ejderha ağzından ateş topları fırlatır, yanlış bilenleri vurur
      if (kayiplar.length > 0) {
        s.nabiz(e, { olcek: 1.16, aci: -4, sure: 900 })
        sesCal('whoosh')
        await s.bekle(650)
        if (s.durdu) return
        kayiplar.forEach(({ h, g }, k) => {
          const gecik = k * 130
          void s.patlama(agiz, { resim: 'efekt-ates.webp', emoji: '🔥', boyut: 70, sure: 380, gecik })
          void s
            .ucur({ from: agiz, to: g!.p, resim: 'efekt-ates.webp', emoji: '🔥', boyut: 74, sure: 720, gecik, yay: 30, iz: '🔥', olcek: 1.3 })
            .then(() => {
              if (s.durdu) return
              void s.patlama(g!.p, { resim: 'efekt-darbe.webp', emoji: '💥', boyut: 86 })
              s.devril(g!.li, { kalk: h.dustu === null })
              void s.yazi({ x: g!.p.x, y: g!.p.y - 24 }, '−1 ❤', { boyut: 26, renk: '#fda4af', sure: 1300 })
              if (k === 0) sesCal('yanlis')
            })
        })
      }
    })()
    return () => {
      s.durdur()
      for (const li of soluk) li.style.opacity = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raund])

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && d.kazandi && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold ejderha-baslik">🐉 Ejderha Savaşı</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm">
          Ayakta <b className="text-emerald-300 tabular-nums">{d.ayakta}</b> / {n}
        </span>
        <span className="text-xs text-slate-400">Doğru cevap ejderhaya vurur; yanlış ya da cevapsız kahraman bir can kaybeder ({KAHRAMAN_CANI} can). Ejderha can: sınıf×soru×%{Math.round(EJDERHA_ORANI * 100)}</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden ejderha-magara border border-white/10 flex flex-col" style={arkaPlan('arka-ejderha.webp')}>
        <div className="relative flex flex-col items-center pt-4 pb-2 gap-2">
          <div ref={ejderhaRef} className={`relative leading-none ${d.kazandi ? 'ejderha-oldu' : 'ejderha-nefes'}`}>
            <Gorsel
              ad={d.kazandi ? 'ejderha-oldu.webp' : oran < 0.4 ? 'ejderha-yaralandi.webp' : 'ejderha.webp'}
              emoji={d.kazandi ? '💀' : '🐉'}
              className="h-[min(34vh,22rem)] w-auto"
              emojiClass="text-[11rem] leading-none"
            />
          </div>
          <div className="w-[min(40rem,86%)] space-y-1">
            <div className="h-6 rounded-full bg-black/50 border border-white/15 overflow-hidden">
              <div className="h-full bg-linear-to-r from-rose-600 via-orange-500 to-amber-300 transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(0, oran) * 100}%` }} />
            </div>
            <p className="text-center text-sm tabular-nums">
              <b>{d.can}</b> / {d.enCok} can {sonHasar > 0 && <span className="text-emerald-300">· son soruda −{sonHasar}</span>}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-4">
            {d.kahramanlar.map((h, i) => {
              const dustu = h.dustu !== null
              return (
                <li
                  key={`${h.ad}-${i}`}
                  ref={(el) => {
                    if (el) kahramanRef.current.set(i, el)
                    else kahramanRef.current.delete(i)
                  }}
                  className={`relative text-center leading-none transition-opacity duration-700 ${dustu ? 'opacity-40 grayscale' : 'ejderha-kahraman'}`}
                >
                  {!dustu && <span className="absolute -right-1 top-0 text-base sm:text-xl pointer-events-none" aria-hidden>{SILAHLAR[adIndeksi(h.ad, SILAHLAR.length) - 1]}</span>}
                  <div className={boy}>{dustu ? '💤' : <Gorsel ad={`kahraman-${adIndeksi(h.ad, 8)}.webp`} emoji={karakter(h.ad, KAHRAMANLAR)} className={n > 80 ? 'w-8 h-8' : n > 40 ? 'w-12 h-12' : n > 20 ? 'w-16 h-16' : 'w-20 h-20'} emojiClass={boy} />}</div>
                  <div className={`${adBoy} font-bold truncate mx-auto`}>{h.ad}</div>
                  <div className={n > 40 ? "text-[9px] tracking-tighter" : "text-xs tracking-tighter"}>{'❤️'.repeat(Math.max(0, h.kalan)) + '🖤'.repeat(KAHRAMAN_CANI - Math.max(0, h.kalan))}</div>
                </li>
              )
            })}
          </ul>
        </div>
        {d.bitti && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
              <p className="text-7xl">{d.kazandi ? '🏆' : '🔥'}</p>
              <p className="text-4xl font-display font-extrabold">{d.kazandi ? 'Ejderha yenildi!' : 'Ejderha kazandı'}</p>
              <p className="text-slate-300">{d.kazandi ? `${d.ayakta} kahraman ayakta kaldı` : `Ejderhanın ${d.can} canı kaldı`}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------- Son kalan arenası

const ARENA_KARAKTERLERI = ['🥷', '🤺', '🧙', '🦸', '🧑‍🚀', '🦹', '🧝', '🤠', '👩‍🚀', '🧑‍🎤']

export function ArenaPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  return (
    <OyunKabugu<ArenaDurumu>
      oyun="arena"
      baslik="⚔️ Son kalan arenası"
      oturum={oturum}
      anahtar={anahtar}
      mod={mod}
      hesapla={(v) => arenaHesapla(v.sorular, v.oyuncular)}
      konum="bottom-28"
      ozet={(d) => (
        <p className="text-sm">
          Ayakta <b className="text-emerald-300">{d.ayakta}</b> / {d.oyuncular.length} · soru {d.oynanan} / {d.toplamSoru}
        </p>
      )}
      sahne={(d, kucult) => <ArenaSahnesi d={d} kucult={kucult} />}
    />
  )
}

export function ArenaSahnesi({ d, kucult }: { d: ArenaDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, true)
  const { raund } = useRaund(d.oynanan, 6000)
  const savasciRef = useRef<Map<number, HTMLLIElement>>(new Map())
  // Yeni soruda: doğru bilenler zıplayıp zafer pozu verir; yanlış bilenlerin üstüne dev çekiç düşer, canı bitenler arenadan fırlar
  useEffect(() => {
    if (raund === 0) return
    const s = new Sinema()
    void (async () => {
      const gor = (i: number) => {
        const li = savasciRef.current.get(i)
        const p = merkez(li)
        return li && p && p.y > 0 && p.y < window.innerHeight ? { li, p } : null
      }
      d.oyuncular
        .map((o, i) => ({ o, i, g: gor(i) }))
        .filter((x) => x.o.son === 1 && x.o.elendi === null && x.g)
        .slice(0, 18)
        .forEach(({ g }, k) => s.nabiz(g!.li, { olcek: 1.3, aci: 8, sure: 700, gecik: k * 30 }))
      const kayiplar = d.oyuncular
        .map((o, i) => ({ o, i, g: gor(i) }))
        .filter((x) => x.o.son !== null && x.o.son !== 1 && (x.o.elendi === null || x.o.elendi === d.oynanan) && x.g)
        .slice(0, 16)
      kayiplar.forEach(({ o, g }, k) => {
        const gecik = k * 130
        void s.ucur({ from: { x: g!.p.x, y: -90 }, to: g!.p, emoji: '🔨', boyut: 78, sure: 650, gecik, yay: 0, don: 25, olcek: 1.2 }).then(async () => {
          if (s.durdu) return
          void s.patlama(g!.p, { resim: 'efekt-darbe.webp', emoji: '💥', boyut: 90 })
          s.sars(g!.li, { siddet: 12, sure: 600 })
          if (k === 0) sesCal('yanlis')
          if (o.elendi === d.oynanan) {
            // Canı bitti: arenadan lava doğru fırlar
            await s.bekle(350)
            if (s.durdu) return
            g!.li.style.visibility = 'hidden'
            await s.ucur({ from: g!.p, to: { x: g!.p.x + rastgele(-120, 120), y: window.innerHeight + 40 }, resim: `kahraman-${adIndeksi(o.ad, 8)}.webp`, emoji: karakter(o.ad, ARENA_KARAKTERLERI), boyut: 60, sure: 1100, yay: 180, don: 540 })
            void s.patlama({ x: g!.p.x, y: window.innerHeight - 40 }, { emoji: '🔥', boyut: 70 })
          } else {
            s.devril(g!.li, { kalk: true })
          }
        })
      })
    })()
    return () => s.durdur()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raund])
  const n = d.oyuncular.length
  const boy = n > 80 ? 'text-2xl' : n > 40 ? 'text-3xl' : n > 20 ? 'text-5xl' : 'text-6xl'
  const adBoy = n > 40 ? 'text-[10px] max-w-16' : 'text-sm max-w-24'
  const ayaktakiler = d.oyuncular.filter((o) => o.elendi === null)
  const dusenler = d.oyuncular.filter((o) => o.elendi !== null)
  const kazananlar = d.bitti ? d.siralama.filter((o) => o.elendi === null).slice(0, 3) : []
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold arena-baslik">⚔️ Son Kalan Arenası</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm">
          Ayakta <b className="text-emerald-300 tabular-nums">{d.ayakta}</b> / {n}
        </span>
        <span className="text-xs text-slate-400">{ARENA_CANI} can: yanlış ya da cevapsız bir can götürür, canı biten arenadan düşer.</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden arena-zemin border border-white/10 flex flex-col" style={arkaPlan('arka-arena.webp')}>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-4 arena-platform rounded-[2rem] p-5 mx-auto max-w-6xl">
            {ayaktakiler.map((o, i) => (
              <li
                key={`${o.ad}-${i}`}
                ref={(el) => {
                  if (el) savasciRef.current.set(i, el)
                  else savasciRef.current.delete(i)
                }}
                className="relative text-center leading-none arena-savasci"
              >
                <div className={boy}><Gorsel ad={`kahraman-${adIndeksi(o.ad, 8)}.webp`} emoji={karakter(o.ad, ARENA_KARAKTERLERI)} className={n > 80 ? 'w-8 h-8' : n > 40 ? 'w-10 h-10' : n > 20 ? 'w-16 h-16' : 'w-20 h-20'} emojiClass={boy} /></div>
                <div className={`${adBoy} font-bold truncate mx-auto`}>{o.ad}</div>
                <div className="text-xs">{'❤️'.repeat(Math.max(0, o.kalan)) + '🖤'.repeat(ARENA_CANI - Math.max(0, o.kalan))}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="arena-lav px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 min-h-14">
          <span className="text-xs font-bold text-orange-200 mr-1">🌋 Düşenler ({dusenler.length})</span>
          {dusenler.map((o, i) => (
            <span key={`${o.ad}-${i}`} className="text-xs text-orange-100/80">
              💀 {o.ad}
            </span>
          ))}
        </div>
        {d.bitti && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px]">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
              <p className="text-7xl">👑</p>
              <p className="text-4xl font-display font-extrabold">Arenanın son kalanları</p>
              {kazananlar.map((o, i) => (
                <p key={`${o.ad}-${i}`} className="text-2xl">
                  {['🥇', '🥈', '🥉'][i]} {o.ad} <span className="text-slate-400 text-base">({o.dogru} doğru)</span>
                </p>
              ))}
              {d.ayakta > 3 && <p className="text-slate-300 text-sm">… ve {d.ayakta - 3} kişi daha ayakta</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- Kule yarışı

interface KuleVeri {
  takimlar: KuleTakimi[]
  oynanan: number
  toplam: number
}

async function kuleVerisi(oturum: string, anahtar: string | null): Promise<KuleVeri | null> {
  const [t, z] = await Promise.all([
    supabase.rpc('takim_goster', { p_session: oturum, p_anahtar: anahtar }),
    supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: anahtar }),
  ])
  const takimlar = (t.data as { takimlar?: { takim: number; uye: number; dogru: number }[] } | null)?.takimlar
  const sorular = (z.data as { sorular?: ZombiSorusu[] } | null)?.sorular
  if (!takimlar || !sorular) return null
  return { takimlar: takimlar.map((x) => ({ takim: x.takim, uye: x.uye, dogru: x.dogru })), oynanan: sorular.filter((s) => s.acildi).length, toplam: sorular.length }
}

export function KulePaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  return (
    <OyunKabugu<KuleDurumu, KuleVeri>
      oyun="kule"
      baslik="🏗️ Kule yarışı"
      oturum={oturum}
      anahtar={anahtar}
      mod={mod}
      getir={kuleVerisi}
      hesapla={(v) => kuleHesapla(v.takimlar, v.oynanan, v.toplam)}
      konum="bottom-28"
      ozet={(d) => {
        const en = [...d.satirlar].sort((a, b) => a.sira - b.sira)[0]
        return (
          <p className="text-sm">
            Soru {d.oynanan} / {d.toplamSoru} · önde {en ? `${takimBilgisi(en.takim).emoji} ${takimBilgisi(en.takim).ad}` : '-'}
          </p>
        )
      }}
      sahne={(d, kucult) => <KuleSahnesi d={d} kucult={kucult} />}
    />
  )
}

export function KuleSahnesi({ d, kucult }: { d: KuleDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, true)
  const satirlar = [...d.satirlar].sort((a, b) => a.takim - b.takim)
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold kule-baslik">🏗️ Kule Yarışı</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm text-slate-300">Hedef: kişi başına {d.hedef} doğru</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden kule-gokyuzu border border-white/10 flex items-end justify-around px-6 pb-12" style={arkaPlan('arka-kule.webp')}>
        <div className="absolute inset-x-0 bottom-0 h-12 kule-zemin" style={{ backgroundImage: `url("${gorselAdresi('kule-zemin.webp')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-x-6 top-[8%] border-t-2 border-dashed border-amber-300/50" aria-hidden>
          <span className="absolute -top-5 right-0 text-xs text-amber-200">🏁 hedef: {d.hedef} kat</span>
        </div>
        {satirlar.map((s) => {
          const b = takimBilgisi(s.takim)
          const yukseklik = Math.min(1, s.blok / d.hedef)
          const lider = s.sira === 1 && s.blok > 0
          return (
            <div key={s.takim} className="relative flex flex-col items-center justify-end h-full w-[18%] min-w-24">
              {lider && <div className="text-4xl kule-tac mb-1" aria-hidden>👑</div>}
              <div className="w-full flex flex-col-reverse justify-start overflow-hidden transition-all duration-1000 ease-out" style={{ height: `${yukseklik * 84}%` }}>
                {Array.from({ length: Math.max(0, s.katlar) }, (_, k) => (
                  <div key={k} className={`flex-1 min-h-3 mt-0.5 rounded-md bg-linear-to-br ${b.renk} kule-blok border border-white/20`} style={{ animationDelay: `${k * 60}ms`, backgroundImage: `url("${gorselAdresi(`blok-${s.takim}.webp`)}")`, backgroundSize: '100% 100%' }} />
                ))}
              </div>
              <p className="absolute -bottom-10 text-center text-sm font-bold whitespace-nowrap">
                {b.emoji} {b.ad} <span className="text-slate-400 font-normal">({s.uye} kişi · {s.blok.toFixed(1)})</span>
              </p>
            </div>
          )
        })}
        {d.bitti && d.kazanan !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
              <p className="text-7xl">🏆</p>
              <p className="text-4xl font-display font-extrabold">
                {takimBilgisi(d.kazanan).emoji} {takimBilgisi(d.kazanan).ad} takım kazandı!
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 text-center">Her doğru cevap takımın kulesine kat ekler; sıralama kişi başına doğru sayısına göredir, böylece kalabalık takım avantajlı olmaz.</p>
    </div>
  )
}

// -------------------------------------------------------------------------------------------------- Kale kuşatması

const KALE_RENKLERI = ['#f43f5e', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f97316']

export function KalePaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  return (
    <OyunKabugu<KaleDurumu, KuleVeri>
      oyun="kale"
      baslik="🏰 Kale kuşatması"
      oturum={oturum}
      anahtar={anahtar}
      mod={mod}
      getir={kuleVerisi}
      hesapla={(v) => kaleHesapla(v.takimlar, v.oynanan, v.toplam)}
      konum="bottom-28"
      ozet={(d) => {
        const en = [...d.satirlar].sort((a, b) => a.sira - b.sira)[0]
        return (
          <p className="text-sm">
            Soru {d.oynanan} / {d.toplamSoru} · önde {en ? `${takimBilgisi(en.takim).emoji} ${takimBilgisi(en.takim).ad}` : '-'}
          </p>
        )
      }}
      sahne={(d, kucult) => <KaleSahnesi d={d} kucult={kucult} />}
    />
  )
}

/** Kaleler çemberin üzerinde eşit aralıkla durur; konumlar harita kutusunun yüzdesidir. */
function kaleKonumu(sira: number, toplam: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (sira * 2 * Math.PI) / toplam
  return { x: 50 + 34 * Math.cos(a), y: 50 + 33 * Math.sin(a) }
}

export function KaleSahnesi({ d, kucult }: { d: KaleDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, true)
  const { raund } = useRaund(d.oynanan, 5000)
  const kaleRef = useRef<Map<number, HTMLElement>>(new Map())
  const onceki = useRef<Map<number, number>>(new Map())
  // İlerleyen her takım karşı kaleye mancınık taşları fırlatır; taş düşünce hedef kale sarsılır ve yanar
  useEffect(() => {
    const yeni = new Map(d.satirlar.map((x) => [x.takim, x.ilerleme]))
    const eski = onceki.current
    onceki.current = yeni
    if (raund === 0) return
    const s = new Sinema()
    void (async () => {
      let sira = 0
      for (const x of d.satirlar) {
        const fark = x.ilerleme - (eski.get(x.takim) ?? 0)
        if (fark < 0.4) continue
        const a = merkez(kaleRef.current.get(x.takim))
        const b = merkez(kaleRef.current.get(x.hedefTakim))
        if (!a || !b) continue
        const atis = Math.min(3, Math.ceil(fark))
        for (let k = 0; k < atis; k++) {
          const gecik = sira * 220 + k * 260
          void s.ucur({ from: a, to: { x: b.x + rastgele(-14, 14), y: b.y + rastgele(-10, 10) }, emoji: '🪨', boyut: 46, sure: 1000, gecik, yay: 150, don: 360, iz: '💨', olcek: 1.2 }).then(() => {
            if (s.durdu) return
            void s.patlama(b, { resim: 'efekt-darbe.webp', emoji: '💥', boyut: 84 })
            s.sars(kaleRef.current.get(x.hedefTakim), { siddet: 8, sure: 500 })
            if (k === 0 && sira < 2) sesCal('tik')
          })
        }
        sira++
      }
    })()
    return () => s.durdur()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raund])
  const satirlar = [...d.satirlar].sort((a, b) => a.takim - b.takim)
  const konum = new Map(satirlar.map((s, i) => [s.takim, kaleKonumu(i, satirlar.length)]))
  const KALE_YARICAPI = 7
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold kule-baslik">🏰 Kale Kuşatması</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm text-slate-300">
          Hedef: kişi başına {d.hedef} doğru ({d.yuruyus} yürüyüş + {d.kusatma} kuşatma)
        </span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden border border-white/10" style={arkaPlan('arka-kule.webp')}>
        {/* Saldırı yolları */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {satirlar.map((s) => {
            const a = konum.get(s.takim)!
            const b = konum.get(s.hedefTakim)!
            return <line key={s.takim} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={KALE_RENKLERI[(s.takim - 1) % 6]} strokeWidth="0.35" strokeDasharray="1.2 1.2" opacity="0.55" />
          })}
        </svg>

        {/* Ordular: yürüyüş yolunda ilerler, kuşatma başlayınca hedef kalenin etrafına dizilir */}
        {satirlar.map((s) => {
          const a = konum.get(s.takim)!
          const b = konum.get(s.hedefTakim)!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const uzunluk = Math.hypot(dx, dy) || 1
          // Ordu, hedef kalenin kuşatma halkasının kenarında durur
          const yol = Math.max(0, uzunluk - KALE_YARICAPI * 1.9)
          const x = a.x + (dx / uzunluk) * (KALE_YARICAPI + yol * s.yuruyusOrani)
          const y = a.y + (dy / uzunluk) * (KALE_YARICAPI + yol * s.yuruyusOrani)
          const renk = KALE_RENKLERI[(s.takim - 1) % 6]
          const bakis = Math.atan2(-dy, -dx) // hedef kaleden saldıran orduya doğru
          return (
            <div key={`ordu-${s.takim}`}>
              {s.asama === 'yuruyor' && (
                <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out text-3xl" style={{ left: `${x}%`, top: `${y}%`, filter: `drop-shadow(0 0 8px ${renk})` }} title={`${takimBilgisi(s.takim).ad} ordusu yürüyor`}>
                  ⚔️
                </div>
              )}
              {Array.from({ length: s.kusatan }, (_, k) => {
                // Kuşatma sırası: saldıran tarafta başlar, iki yana açılır
                const kayma = (Math.floor((k + 1) / 2) * (k % 2 === 1 ? -1 : 1) * 2 * Math.PI) / Math.max(1, d.kusatma)
                const ac = bakis + kayma
                const hx = b.x + Math.cos(ac) * KALE_YARICAPI * 1.35
                const hy = b.y + Math.sin(ac) * KALE_YARICAPI * 1.35
                return (
                  <div
                    key={k}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-xl kule-blok transition-all duration-700"
                    style={{ left: `${hx}%`, top: `${hy}%`, filter: `drop-shadow(0 0 6px ${renk})`, animationDelay: `${k * 80}ms` }}
                    title={`${takimBilgisi(s.takim).ad} askeri`}
                  >
                    🛡️
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Kaleler */}
        {satirlar.map((s) => {
          const p = konum.get(s.takim)!
          const b = takimBilgisi(s.takim)
          const dustu = d.dusen.includes(s.takim)
          const lider = s.sira === 1 && s.blok > 0
          return (
            <div
              key={`kale-${s.takim}`}
              ref={(el) => {
                if (el) kaleRef.current.set(s.takim, el)
                else kaleRef.current.delete(s.takim)
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {lider && !d.bitti && <div className="text-2xl kule-tac -mb-1" aria-hidden>👑</div>}
              <div className={`relative ${dustu ? 'grayscale opacity-70' : ''}`}>
                <Gorsel ad={`takim-kalkan-${s.takim}.webp`} emoji={b.emoji} className="w-16 h-16 sm:w-20 sm:h-20" alt={b.ad} />
                <span className="absolute -bottom-2 -right-3 text-4xl sm:text-5xl" aria-hidden>
                  {dustu ? '🔥' : '🏰'}
                </span>
              </div>
              <p className="mt-2 text-center text-xs sm:text-sm font-bold whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-950/70">
                {b.ad} <span className="text-slate-400 font-normal">({s.uye} kişi · {s.blok.toFixed(1)})</span>
              </p>
              <div className="mt-1 h-1.5 w-24 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full transition-[width] duration-1000" style={{ width: `${(s.ilerleme / d.hedef) * 100}%`, background: KALE_RENKLERI[(s.takim - 1) % 6] }} />
              </div>
              <p className="text-[10px] text-slate-300 mt-0.5">{dustu ? 'kuşatıldı!' : s.asama === 'yuruyor' ? 'yürüyor' : s.asama === 'kusatiyor' ? `kuşatıyor ${s.kusatan}/${d.kusatma}` : 'kuşattı'}</p>
            </div>
          )
        })}

        {d.bitti && d.kazanan !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] z-20">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
              <p className="text-7xl">🏆</p>
              <p className="text-4xl font-display font-extrabold">
                {takimBilgisi(d.kazanan).emoji} {takimBilgisi(d.kazanan).ad} takım kazandı!
              </p>
              {d.dusen.length > 0 && <p className="text-slate-300">{d.dusen.map((t) => takimBilgisi(t).ad).join(', ')} kalesi kuşatıldı.</p>}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 text-center">Her takım bir sonraki takımın kalesine saldırır. Doğru cevaplar ordunu yürütür, sonra kalenin etrafını sarar; sıralama kişi başına doğruya göredir.</p>
    </div>
  )
}
