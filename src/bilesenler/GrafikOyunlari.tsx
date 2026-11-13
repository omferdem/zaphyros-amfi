import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OYUN_OLAYI, type OyunAnahtari } from '../lib/oyun'
import { roketHesapla, type RoketDurumu } from '../lib/roket'
import { arenaHesapla, ARENA_CANI, type ArenaDurumu } from '../lib/arena'
import { kuleHesapla, type KuleDurumu, type KuleTakimi } from '../lib/kule'
import { takimBilgisi } from '../lib/takim'
import { EJDERHA_ORANI, KAHRAMAN_CANI, ejderhaHesapla, type EjderhaDurumu } from '../lib/ejderha'
import type { ZombiOyuncusu, ZombiSorusu } from '../lib/zombi'
import Konfeti from './Konfeti'

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

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 3500)
    return () => clearInterval(t)
  }, [yenile])

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

function RoketSahnesi({ d, kucult }: { d: RoketDurumu; kucult: () => void }) {
  const n = d.oyuncular.length
  const seritSayisi = Math.max(4, Math.min(14, n))
  const boy = n > 60 ? 'text-xl' : n > 30 ? 'text-2xl' : 'text-3xl'
  const podyum = d.siralama.slice(0, 3)
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold roket-baslik">🚀 Roket Yarışı</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm text-slate-300">Bitiş çizgisi: {d.hedef} doğru</span>
        <button className="ikincil-buton ml-auto !py-1.5" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden roket-uzay border border-white/10">
        <div className="roket-yildizlar" aria-hidden />
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
              className="absolute -translate-y-1/2 transition-all duration-1000 ease-out flex items-center"
              style={{ left: `${4 + oran * 84}%`, top: `${8 + (serit / seritSayisi) * 84 + 4}%` }}
              title={`${o.ad}: ${o.ilerleme} doğru`}
            >
              <span className="roket-iz" style={{ width: `${Math.max(1, oran * 14)}vw` }} aria-hidden />
              <span className={`${boy} inline-block ${bitti ? 'roket-varti' : 'roket-ucus'}`}>
                <span className="inline-block" style={{ transform: 'rotate(45deg)' }}>
                  {karakter(o.ad, ROKETLER)}
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

function EjderhaSahnesi({ d, kucult }: { d: EjderhaDurumu; kucult: () => void }) {
  const n = d.kahramanlar.length
  const boy = n > 80 ? 'text-2xl' : n > 40 ? 'text-4xl' : n > 20 ? 'text-5xl' : 'text-6xl'
  const adBoy = n > 40 ? 'text-[10px] max-w-16' : 'text-sm max-w-24'
  const sonHasar = d.hasarlar[d.hasarlar.length - 1] ?? 0
  const oran = d.can / d.enCok
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
        <button className="ikincil-buton ml-auto !py-1.5" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden ejderha-magara border border-white/10 flex flex-col">
        <div className="relative flex flex-col items-center pt-4 pb-2 gap-2">
          <div className={`text-[11rem] leading-none ${d.kazandi ? 'ejderha-oldu' : 'ejderha-nefes'}`} aria-hidden>
            {d.kazandi ? '💀' : '🐉'}
          </div>
          {!d.kazandi && d.oynanan > 0 && <div className="absolute right-[26%] top-16 text-7xl ejderha-ates" aria-hidden>🔥</div>}
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
                <li key={`${h.ad}-${i}`} className={`text-center leading-none transition-all duration-700 ${dustu ? 'opacity-40 grayscale' : 'ejderha-kahraman'}`}>
                  <div className={boy}>{dustu ? '💤' : karakter(h.ad, KAHRAMANLAR)}</div>
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

function ArenaSahnesi({ d, kucult }: { d: ArenaDurumu; kucult: () => void }) {
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
        <button className="ikincil-buton ml-auto !py-1.5" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden arena-zemin border border-white/10 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-4 arena-platform rounded-[2rem] p-5 mx-auto max-w-6xl">
            {ayaktakiler.map((o, i) => (
              <li key={`${o.ad}-${i}`} className="text-center leading-none arena-savasci">
                <div className={boy}>{karakter(o.ad, ARENA_KARAKTERLERI)}</div>
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

function KuleSahnesi({ d, kucult }: { d: KuleDurumu; kucult: () => void }) {
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
        <button className="ikincil-buton ml-auto !py-1.5" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden kule-gokyuzu border border-white/10 flex items-end justify-around px-6 pb-12">
        <div className="absolute inset-x-0 bottom-0 h-12 kule-zemin" />
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
                  <div key={k} className={`flex-1 min-h-3 mt-0.5 rounded-md bg-linear-to-br ${b.renk} kule-blok border border-white/20`} style={{ animationDelay: `${k * 60}ms` }} />
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
