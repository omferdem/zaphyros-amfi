import { useMemo } from 'react'
import { useOyunSesi } from '../lib/ses'
import type { KaleOyuncusu } from '../lib/kaleHarita'
import { enerjiHesapla, gorunenAd, kalabalikAyari } from '../lib/oyunMotoru'
import { takimBilgisi } from '../lib/takim'
import Gorsel, { adIndeksi, arkaPlan } from './Gorsel'
import Konfeti from './Konfeti'
import { CamurSicrama, HavaiFisek } from './FinalEfekti'

export interface HalatSahneDurumu {
  /** -1 (1. takım kazandı) ile +1 (2. takım kazandı) */
  konum: number
  kazanan: 1 | 2 | null
  oynanan: number
}

interface Kisi {
  ad: string
  takim: 1 | 2
  enerji: number
  son: 'arti' | 'eksi' | 'bos' | null
  seri: number
  ozel: boolean
}

const STIL = `
@keyframes halat-zorla { 0%,100% { transform: rotate(var(--egim)) translateX(0) } 25% { transform: rotate(calc(var(--egim) - 3deg)) translateX(calc(var(--yon) * -3px)) } 75% { transform: rotate(calc(var(--egim) + 2deg)) translateX(calc(var(--yon) * 2px)) } }
@keyframes halat-titre { 0%,100% { transform: translateY(0) } 25% { transform: translateY(-2px) } 75% { transform: translateY(2px) } }
@keyframes halat-tokle { 0% { transform: rotate(var(--egim)) } 35% { transform: translate(calc(var(--yon) * 22px), 8px) rotate(calc(var(--yon) * 24deg)) } 100% { transform: rotate(var(--egim)) } }
@keyframes halat-yuk { 0% { opacity: 0; transform: translateY(6px) scale(.7) } 20% { opacity: 1; transform: translateY(-4px) scale(1.15) } 80% { opacity: 1; transform: translateY(-16px) scale(1) } 100% { opacity: 0; transform: translateY(-24px) } }
@keyframes halat-toz { 0% { opacity: .0; transform: translate(0,0) scale(.4) } 20% { opacity: .85 } 100% { opacity: 0; transform: translate(var(--tx), -28px) scale(1.8) } }
@keyframes halat-dus { 0% { transform: rotate(var(--egim)) } 100% { transform: translateY(18%) rotate(calc(var(--yon) * 78deg)) } }
@keyframes halat-camur { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04, .94) } }
`

function renk(e: number): string {
  return e >= 60 ? 'bg-emerald-400' : e >= 30 ? 'bg-amber-400' : 'bg-rose-500'
}

/** 16:9 perde varsayımıyla karakterin en büyük çıkacağı sütun sayısını seçer (genişlik 41vw, yükseklik 26vw'ye sığmalı). */
function takimDizilimi(n: number): { sutun: number; satir: number } {
  let en = { sutun: Math.max(1, n), satir: 1 }
  let enBoy = 0
  for (let s = 1; s <= Math.max(1, n); s++) {
    const satir = Math.ceil(n / s)
    const boy = Math.min(41 / s, 25.9 / satir)
    if (boy > enBoy + 1e-6) {
      enBoy = boy
      en = { sutun: s, satir }
    }
  }
  return en
}

/** Halat çekme tam ekran sahnesi: perdede yalnızca halat ve iki takım; her öğrenci adı ve enerji barıyla halatın üstünde durur. */
export function HalatSahnesi({ h, oyuncular, zorlaniyor, kucult }: { h: HalatSahneDurumu; oyuncular: KaleOyuncusu[]; zorlaniyor: boolean; kucult: () => void }) {
  useOyunSesi(h.oynanan, h.kazanan !== null, true, 'halat')
  const kisiler = useMemo(() => {
    const hepsi: Kisi[] = oyuncular
      .filter((o) => o.takim === 1 || o.takim === 2)
      .map((o) => {
        const e = enerjiHesapla(o.sonuc)
        return { ad: o.ad, takim: o.takim as 1 | 2, enerji: e.enerji, son: e.son, seri: e.seri, ozel: false }
      })
    // Kalabalıkta yalnızca her takımın en güçlü ve en bitkin iki oyuncusu adla görünür
    for (const t of [1, 2]) {
      const s = hepsi.filter((k) => k.takim === t).sort((a, b) => b.enerji - a.enerji)
      s.slice(0, 2).forEach((k) => (k.ozel = true))
      s.slice(-2).forEach((k) => (k.ozel = true))
    }
    return hepsi
  }, [oyuncular])

  const ayar = kalabalikAyari(Math.max(kisiler.filter((k) => k.takim === 1).length, kisiler.filter((k) => k.takim === 2).length) * 2)
  const a = takimBilgisi(1)
  const b = takimBilgisi(2)
  const kaybeden = h.kazanan === 1 ? 2 : h.kazanan === 2 ? 1 : null
  const kayma = h.konum * 9

  function takimAlani(t: 1 | 2) {
    const uyeler = kisiler.filter((k) => k.takim === t).sort((x, y) => x.ad.localeCompare(y.ad, 'tr'))
    const { sutun, satir } = takimDizilimi(uyeler.length)
    const boy = `min(calc(41vw / ${sutun}), calc(46vh / ${satir}), 7rem)`
    const yon = t === 1 ? -1 : 1 // takımın çektiği yön
    const dustu = kaybeden === t
    return (
      <div className="flex flex-wrap content-center justify-center gap-x-[0.4%] gap-y-1 w-[44%]" style={{ ['--yon' as string]: String(yon) }}>
        {uyeler.map((k, i) => {
          const sinif = dustu ? 'halat-dus' : !zorlaniyor && k.son === 'eksi' ? 'halat-tokle' : zorlaniyor ? 'halat-zorla' : ''
          const hareket =
            sinif === 'halat-dus'
              ? 'halat-dus 1.4s ease-in forwards'
              : sinif === 'halat-tokle'
                ? 'halat-tokle 1s ease-out 1'
                : sinif === 'halat-zorla'
                  ? `halat-zorla ${0.45 + (i % 4) * 0.07}s ease-in-out infinite`
                  : undefined
          const ad = gorunenAd(k.ad, ayar, k.ozel)
          return (
            <div
              key={`${k.ad}-${i}`}
              className="relative flex flex-col items-center"
              style={{ width: boy, ['--egim' as string]: `${yon * -8}deg`, transformOrigin: '50% 100%', animation: hareket, transform: sinif ? undefined : `rotate(${yon * -8}deg)` }}
            >
              <div className="relative w-[88%] h-[4px] sm:h-[5px] rounded-full bg-black/55 overflow-hidden" style={{ minHeight: 3 }} title={`Enerji ${k.enerji}`}>
                <div className={`h-full ${renk(k.enerji)} transition-all duration-700`} style={{ width: `${k.enerji}%` }} />
              </div>
              {!zorlaniyor && k.son && k.son !== 'bos' && (
                <span
                  key={`yuk-${h.oynanan}`}
                  className={`absolute -top-3 font-display font-extrabold drop-shadow ${k.son === 'arti' ? 'text-emerald-300' : 'text-rose-300'}`}
                  style={{ fontSize: `max(10px, calc(${boy} * 0.26))`, animation: 'halat-yuk 1.8s ease-out forwards' }}
                >
                  {k.son === 'arti' ? '+1' : '−1'}
                  {k.son === 'arti' && k.seri > 0 && k.seri % 3 === 0 ? '🔥' : ''}
                </span>
              )}
              <Gorsel ad={`ogrenci-${adIndeksi(k.ad, 8)}.webp`} poz={h.kazanan ? (h.kazanan === k.takim ? 'sevin' : 'dus') : 'cek'} emoji="🧑" className="w-full aspect-square" emojiClass="text-4xl" />
              {ad && (
                <span className="text-center font-bold text-white drop-shadow leading-none truncate max-w-full" style={{ fontSize: `max(10px, calc(${boy} * 0.17))` }}>
                  {ad}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div data-denetim="sahne" className="perde-alan z-40 overflow-hidden flex flex-col" style={arkaPlan('arka-halat.webp', 'linear-gradient(#1e3a8a, #0f172a)')}>
      <style>{STIL}</style>
      {h.kazanan !== null && (
        <>
          <Konfeti />
          <HavaiFisek patlama={4} />
          <CamurSicrama taraf={h.kazanan === 1 ? 'sag' : 'sol'} />
        </>
      )}
      <div className="relative z-20 flex items-center gap-3 px-4 pt-3">
        <span className={`inline-block rounded-full px-4 py-1 font-display font-extrabold text-xl text-white bg-gradient-to-r ${a.renk}`}>
          {a.emoji} {a.ad}
        </span>
        <span className="mx-auto text-sm font-bold text-white/80 tabular-nums">🪢 Halat çekme · Soru {h.oynanan}</span>
        <span className={`inline-block rounded-full px-4 py-1 font-display font-extrabold text-xl text-white bg-gradient-to-r ${b.renk}`}>
          {b.ad} {b.emoji}
        </span>
        <button className="ikincil-buton !py-1.5 text-sm kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {/* Zemin ve çamur çukurları */}
        <div className="absolute inset-0 bg-slate-950/45" />
        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-b from-lime-800/90 to-emerald-950/95" />
        <div className="absolute left-0 bottom-[26%] w-[9%] h-[14%] rounded-[50%] bg-amber-900 shadow-inner" style={{ animation: kaybeden === 1 ? 'halat-camur 1.2s ease-in-out infinite' : undefined, opacity: kaybeden === 1 ? 1 : 0.55 }} />
        <div className="absolute right-0 bottom-[26%] w-[9%] h-[14%] rounded-[50%] bg-amber-900 shadow-inner" style={{ animation: kaybeden === 2 ? 'halat-camur 1.2s ease-in-out infinite' : undefined, opacity: kaybeden === 2 ? 1 : 0.55 }} />
        {/* Sabit orta çizgi: halat bu çizgiden kaymış gibi okunur */}
        <div className="absolute left-1/2 top-[8%] bottom-[6%] w-1 -translate-x-1/2 border-l-4 border-dashed border-white/40" aria-hidden />

        <div className="absolute inset-0 flex items-center transition-transform duration-[1500ms]" style={{ transform: `translateX(${kayma}vw)`, transitionTimingFunction: 'cubic-bezier(.3,1.25,.5,1)', paddingInline: '2%' }}>
          {takimAlani(1)}
          <div className="flex-1" />
          {takimAlani(2)}
          {/* Halat takımların önünden geçer */}
          <div
            className="absolute inset-x-[1%] top-1/2 h-3.5 -translate-y-1/2 rounded-full shadow-lg pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(115deg, #b8864b 0 7px, #8a5a2b 7px 14px)',
              animation: zorlaniyor ? 'halat-titre 0.12s linear infinite' : undefined,
            }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[170%] text-5xl drop-shadow pointer-events-none" aria-hidden>
            🚩
          </div>
          {/* Toz bulutları: sonuç açılınca kazanan tarafın ayaklarından kalkar */}
          {!zorlaniyor &&
            h.oynanan > 0 &&
            Array.from({ length: 7 }, (_, i) => (
              <span
                key={`toz-${h.oynanan}-${i}`}
                className="absolute text-3xl pointer-events-none"
                style={{
                  left: `${h.konum <= 0 ? 8 + i * 5 : 92 - i * 5}%`,
                  bottom: '30%',
                  ['--tx' as string]: `${(h.konum <= 0 ? -1 : 1) * (20 + i * 6)}px`,
                  animation: `halat-toz 1.4s ease-out ${i * 0.08}s both`,
                }}
                aria-hidden
              >
                💨
              </span>
            ))}
        </div>
      </div>

      {h.kazanan !== null && (
        <div className="absolute inset-x-0 bottom-[6%] z-20 flex justify-center pointer-events-none">
          <div className="cam-panel rounded-[2rem] px-8 py-4 text-center girdi">
            <p className="text-4xl font-display font-extrabold">
              <span aria-hidden>{takimBilgisi(h.kazanan).emoji}</span> <span className="renkli-yazi">{takimBilgisi(h.kazanan).ad} takım halatı çekti!</span>
            </p>
            <p className="text-slate-300 text-sm">{takimBilgisi(kaybeden ?? 1).ad} takım çamura düştü 🤿</p>
          </div>
        </div>
      )}
    </div>
  )
}
