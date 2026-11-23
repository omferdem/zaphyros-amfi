import { useEffect, useMemo, useRef } from 'react'
import { ORMAN_KALBI, type OrmanOyuncusu, type OrmanSonucu } from '../lib/orman'
import { gorunenAd, kalabalikAyari, tohumluRastgele } from '../lib/oyunMotoru'
import { sesCal, useOyunSesi } from '../lib/ses'
import { useAkiskanSayilar } from '../lib/akiskan'
import Gorsel, { adIndeksi } from './Gorsel'
import { KarakterEnerjisi } from './KarakterEnerjisi'
import Konfeti from './Konfeti'
import { EvIsigi, HavaiFisek } from './FinalEfekti'

/** Patikanın dönemeçleri (100x60 birim); soldan altta başlar, sağ üstteki eve varır. */
const PATIKA: [number, number][] = [
  [6, 54],
  [20, 50],
  [30, 40],
  [18, 31],
  [30, 21],
  [48, 26],
  [58, 41],
  [74, 36],
  [70, 18],
  [84, 14],
  [91, 10],
]
/** Dikey birim yatay birimin 0,6 katıdır (alan 100:60); mesafeler cqw cinsinden düşünülür. */
const DIKEY = 0.6

function patikaNoktasi(oran: number): { x: number; y: number } {
  const parcalar = PATIKA.slice(1).map((p, i) => ({ a: PATIKA[i], b: p, u: Math.hypot(p[0] - PATIKA[i][0], (p[1] - PATIKA[i][1]) * DIKEY) }))
  const toplam = parcalar.reduce((t, p) => t + p.u, 0)
  let kalan = Math.max(0, Math.min(1, oran)) * toplam
  for (const p of parcalar) {
    if (kalan <= p.u) {
      const f = p.u === 0 ? 0 : kalan / p.u
      return { x: p.a[0] + (p.b[0] - p.a[0]) * f, y: p.a[1] + (p.b[1] - p.a[1]) * f }
    }
    kalan -= p.u
  }
  return { x: PATIKA[PATIKA.length - 1][0], y: PATIKA[PATIKA.length - 1][1] }
}

/** Patikanın o noktadaki dik yönü (cqw uzayında birim vektör). */
function dikYon(oran: number): { nx: number; ny: number } {
  const a = patikaNoktasi(Math.max(0, oran - 0.015))
  const b = patikaNoktasi(Math.min(1, oran + 0.015))
  const tx = b.x - a.x
  const ty = (b.y - a.y) * DIKEY
  const u = Math.hypot(tx, ty) || 1
  return { nx: -ty / u, ny: tx / u }
}

function patikayaUzaklik(x: number, y: number): number {
  let en = Infinity
  for (let i = 1; i < PATIKA.length; i++) {
    const [ax, ay] = PATIKA[i - 1]
    const [bx, by] = PATIKA[i]
    const vx = bx - ax
    const vy = (by - ay) * DIKEY
    const wx = x - ax
    const wy = (y - ay) * DIKEY
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    en = Math.min(en, Math.hypot(wx - vx * t, wy - vy * t))
  }
  return en
}

interface Agac {
  x: number
  y: number
  s: number
  kat: 0 | 1 | 2
}
/** Üç derinlik katmanı: uzak (küçük, sisli), orta, yakın (büyük, koyu). Patikanın üstüne ağaç dikilmez. */
const AGACLAR: Agac[] = (() => {
  const r = tohumluRastgele(11)
  const liste: Agac[] = []
  const katlar: { kat: 0 | 1 | 2; adet: number; y0: number; y1: number; s0: number; s1: number }[] = [
    { kat: 0, adet: 46, y0: 12, y1: 30, s0: 0.5, s1: 0.8 },
    { kat: 1, adet: 34, y0: 24, y1: 46, s0: 0.8, s1: 1.15 },
    { kat: 2, adet: 24, y0: 40, y1: 62, s0: 1.2, s1: 1.7 },
  ]
  for (const k of katlar) {
    let deneme = 0
    let eklenen = 0
    while (eklenen < k.adet && deneme < 600) {
      deneme++
      const x = r() * 104 - 2
      const y = k.y0 + r() * (k.y1 - k.y0)
      const s = k.s0 + r() * (k.s1 - k.s0)
      if (patikayaUzaklik(x, y) < 5 + s * 2.2) continue
      if (x > 62 && y > 45 && k.kat !== 0) continue // "kurdun yakaladıkları" alanı
      if (Math.hypot(x - 91, (y - 9) * DIKEY) < 9) continue // ev
      liste.push({ x, y, s, kat: k.kat })
      eklenen++
    }
  }
  return liste.sort((a, b) => a.y - b.y)
})()

const AGAC_RENK = ['#0e2a1f', '#0b3a26', '#062a1a']
const YILDIZLAR = (() => {
  const r = tohumluRastgele(5)
  return Array.from({ length: 34 }, () => ({ x: r() * 100, y: r() * 16, r: 0.12 + r() * 0.22, g: r() * 4 }))
})()

const STIL = `
@keyframes orman-sis { 0% { transform: translateX(-4%) } 50% { transform: translateX(4%) } 100% { transform: translateX(-4%) } }
@keyframes orman-ates { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
@keyframes orman-kac { 0% { opacity: 1; transform: translate(-50%, -88%) } 15% { transform: translate(calc(-50% - .6cqw), -88%) } 30% { transform: translate(calc(-50% + .6cqw), -88%) } 45% { opacity: 1; transform: translate(-50%, -88%) } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-88% + var(--dy))) scale(.5) } }
@keyframes orman-atla { 0% { opacity: 0; transform: translate(-50%, -130%) scale(.5) } 25% { opacity: 1; transform: translate(-50%, -40%) scale(1.3) } 75% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -10%) scale(1) } }
@keyframes orman-yuru { 0%,100% { transform: translateY(0) rotate(-2deg) } 25% { transform: translateY(-5%) rotate(0deg) } 50% { transform: translateY(0) rotate(2deg) } 75% { transform: translateY(-5%) rotate(0deg) } }
@keyframes orman-gel { 0%, 70% { opacity: 0; transform: scale(.4) } 100% { opacity: 1; transform: scale(1) } }
`

function Agac({ a }: { a: Agac }) {
  return (
    <g transform={`translate(${a.x} ${a.y}) scale(${a.s})`} fill={AGAC_RENK[a.kat]} opacity={a.kat === 0 ? 0.8 : 1}>
      <polygon points="0,-9 -3.2,-4 3.2,-4" />
      <polygon points="0,-6.2 -4.1,0 4.1,0" />
      <polygon points="0,-3 -5,4.2 5,4.2" />
      <rect x="-0.6" y="4.2" width="1.2" height="2" fill="#2b1a0e" />
    </g>
  )
}

/** Orman'dan eve dönüş: katmanlı gece ormanı, patikada ilerleyen öğrenciler, kurt ve ev. */
export function OrmanSahnesi({ d, kucult }: { d: OrmanSonucu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, d.oyuncular.some((o) => o.durum === 'evde'), 'orman')
  // Kurt uluması: ilk kalp 1'e düşünce ve her yeni yakalanışta
  const oncekiKurt = useRef({ gozu: d.kurtGozu, yakalanan: d.oyuncular.filter((o) => o.durum === 'kapildi').length })
  useEffect(() => {
    const yakalanan = d.oyuncular.filter((o) => o.durum === 'kapildi').length
    const o = oncekiKurt.current
    if ((d.kurtGozu && !o.gozu) || yakalanan > o.yakalanan) sesCal('kurt')
    oncekiKurt.current = { gozu: d.kurtGozu, yakalanan }
  }, [d.kurtGozu, d.oyuncular])
  const n = d.oyuncular.length
  const ayar = kalabalikAyari(n)
  const ozel = useMemo(() => new Set([...d.siralama.slice(0, 3), ...d.siralama.slice(-3)].map((o) => o.ad)), [d.siralama])
  const evde = d.oyuncular.filter((o) => o.durum === 'evde')
  const yakalanan = d.oyuncular.filter((o) => o.durum === 'kapildi').sort((a, b) => (a.bittigiSoru ?? 0) - (b.bittigiSoru ?? 0))
  // Karakter genişliği (alanın yüzdesi): kalabalıkta küçülür
  const boy = n <= 20 ? 6.2 : n <= 40 ? 5 : n <= 60 ? 4.2 : 3.6
  const adPunto = Math.max(1.1, boy * 0.3)
  const GOSTER = 4

  // Aynı adımdaki oyuncular patikanın iki yanına yelpaze gibi açılır; 4'ten fazlası "+N" rozetinde toplanır
  const yoldakiler = useMemo(() => {
    const gruplar = new Map<number, OrmanOyuncusu[]>()
    for (const o of d.oyuncular) {
      if (o.durum !== 'yolda') continue
      gruplar.set(o.adim, [...(gruplar.get(o.adim) ?? []), o])
    }
    const cikti: { o: OrmanOyuncusu; yuva: number; tek: boolean }[] = []
    const rozetler: { x: number; y: number; n: number; anahtar: number }[] = []
    for (const [adim, liste] of gruplar) {
      const sirali = [...liste].sort((a, b) => b.kalp - a.kalp || a.ad.localeCompare(b.ad, 'tr'))
      sirali.slice(0, GOSTER).forEach((o, k) => cikti.push({ o, yuva: k, tek: liste.length === 1 }))
      if (liste.length > GOSTER) {
        const p = patikaNoktasi(adim / d.patika)
        rozetler.push({ x: p.x, y: p.y, n: liste.length - GOSTER, anahtar: adim })
      }
    }
    return { cikti, rozetler }
  }, [d.oyuncular, d.patika])

  // Karakterler patikada adım adım sıçramaz; iki soru arasında eğrileri izleyerek akıcı yürür
  const hedefAdim = useMemo(() => new Map(d.oyuncular.map((o) => [o.ad, o.adim] as [string, number])), [d.oyuncular])
  const { deger: animAdim, akiyor } = useAkiskanSayilar(hedefAdim, 1600)

  const eveVaran = evde.slice(0, 10)
  const kapanisKurt = d.oyuncular.some((o) => o.durum === 'kapildi' && o.bittigiSoru === d.oynanan)

  return (
    <div data-denetim="sahne" className="perde-alan z-40 bg-slate-950 flex flex-col p-3 sm:p-5 gap-3">
      <style>{STIL}</style>
      {d.bitti && evde.length > 0 && (
        <>
          <Konfeti />
          <HavaiFisek patlama={5} />
          <EvIsigi />
        </>
      )}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl font-display font-extrabold">🌲 Orman'dan eve dönüş</h2>
        <span className="text-sm text-slate-300 tabular-nums">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm">
          Evde <b className="text-emerald-300 tabular-nums">{evde.length}</b> / {n}
        </span>
        <span className="text-xs text-slate-400">
          Her doğru 1 adım; yanlış ya da cevapsız 1 kalp götürür ({ORMAN_KALBI} kalp). Kalbi biten kurda yakalanır; üst üste 3 doğru fener bulup 1 kalp kazandırır. Eve {d.patika} adımda varılır.
        </span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10"
          style={{ aspectRatio: '100 / 60', width: 'min(100%, calc((100vh - 7rem) * 100 / 60))', containerType: 'inline-size' }}
        >
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" role="img" aria-label="Orman patikası">
            <defs>
              <linearGradient id="orman-gok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0b1437" />
                <stop offset="0.45" stopColor="#1b2a5e" />
                <stop offset="1" stopColor="#24527a" />
              </linearGradient>
              <linearGradient id="orman-yer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#14532d" />
                <stop offset="1" stopColor="#052e16" />
              </linearGradient>
              <radialGradient id="orman-ay" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#fef9c3" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fef9c3" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="orman-sis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#cbd5e1" stopOpacity="0" />
                <stop offset="0.5" stopColor="#cbd5e1" stopOpacity="0.22" />
                <stop offset="1" stopColor="#cbd5e1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="100" height="60" fill="url(#orman-gok)" />
            {YILDIZLAR.map((y, i) => (
              <circle key={i} cx={y.x} cy={y.y} r={y.r} fill="#fff" style={{ animation: `orman-ates ${2 + y.g}s ease-in-out infinite` }} />
            ))}
            <circle cx="16" cy="8" r="9" fill="url(#orman-ay)" />
            <circle cx="16" cy="8" r="3.3" fill="#fefce8" />
            <circle cx="15" cy="7.2" r="0.8" fill="#fde68a" opacity="0.7" />
            {/* Uzak tepeler */}
            <path d="M0 26 Q12 14 26 24 T52 22 T78 24 T100 18 V32 H0 Z" fill="#0c1d3d" opacity="0.9" />
            <rect y="22" width="100" height="38" fill="url(#orman-yer)" />
            {AGACLAR.filter((a) => a.kat === 0).map((a, i) => (
              <Agac key={`a0-${i}`} a={a} />
            ))}
            <rect x="-5" y="20" width="110" height="9" fill="url(#orman-sis)" style={{ animation: 'orman-sis 18s ease-in-out infinite' }} />
            {AGACLAR.filter((a) => a.kat === 1).map((a, i) => (
              <Agac key={`a1-${i}`} a={a} />
            ))}
            {/* Dere ve köprü */}
            <path d="M 36 42 Q 42 36 48 44 T 62 49" stroke="#0e7490" strokeWidth="2.2" fill="none" opacity="0.9" strokeLinecap="round" />
            <path d="M 36 42 Q 42 36 48 44 T 62 49" stroke="#67e8f9" strokeWidth="0.5" fill="none" opacity="0.6" strokeDasharray="1 2" />
            {/* Patika: toprak yol, kenarı açık */}
            <polyline points={PATIKA.map((p) => p.join(',')).join(' ')} fill="none" stroke="#3b2410" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={PATIKA.map((p) => p.join(',')).join(' ')} fill="none" stroke="#92602f" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={PATIKA.map((p) => p.join(',')).join(' ')} fill="none" stroke="#c08a4a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 2.4" opacity="0.8" />
            {/* Köprü */}
            <g transform="translate(43 39.4) rotate(18)">
              <rect x="-3.6" y="-1.1" width="7.2" height="2.2" rx="0.3" fill="#7c4a1e" />
              <path d="M-3.6 -1.1 H3.6 M-3.6 0 H3.6 M-3.6 1.1 H3.6" stroke="#3b2410" strokeWidth="0.2" />
            </g>
            {/* Ev: biri varınca pencereleri ve baca ateşi yanar */}
            <g transform="translate(91 8)">
              <rect x="-5" y="-1" width="10" height="7" fill="#78350f" />
              <polygon points="-6.2,-1 0,-6.2 6.2,-1" fill="#7f1d1d" />
              <rect x="3" y="-5.5" width="1.4" height="3" fill="#44403c" />
              <rect x="-1.1" y="2" width="2.2" height="4" fill="#451a03" />
              <rect x="-4" y="0.8" width="2" height="2" fill={evde.length > 0 ? '#fde047' : '#422006'} style={evde.length > 0 ? { filter: 'drop-shadow(0 0 1.2px #fde047)' } : undefined} />
              <rect x="2" y="0.8" width="2" height="2" fill={evde.length > 0 ? '#fde047' : '#422006'} style={evde.length > 0 ? { filter: 'drop-shadow(0 0 1.2px #fde047)' } : undefined} />
              {evde.length > 0 && <circle cx="3.7" cy="-6.4" r="0.9" fill="#fb923c" style={{ animation: 'orman-ates 1.2s ease-in-out infinite' }} />}
            </g>
            {/* Yakın ağaçlar sahnenin kenarlarını çerçeveler */}
            {AGACLAR.filter((a) => a.kat === 2).map((a, i) => (
              <Agac key={`a2-${i}`} a={a} />
            ))}
            {/* Kurt gözleri: kalbi 1'e düşen olunca çalıların arasında parlar */}
            {d.kurtGozu &&
              [[14, 40], [54, 33], [78, 26]].map(([x, y], i) => (
                <text key={i} x={x} y={y} fontSize="3.2" className="animate-breathe">
                  👀
                </text>
              ))}
            <rect x="-5" y="38" width="110" height="12" fill="url(#orman-sis)" style={{ animation: 'orman-sis 24s ease-in-out infinite reverse' }} />
          </svg>
          {/* Gökyüzü ve orman, sorular ilerledikçe kararır */}
          <div className="absolute inset-0 bg-slate-950 pointer-events-none transition-opacity duration-1000" style={{ opacity: 0.05 + d.karanlik * 0.45 }} aria-hidden />

          {/* Patikadaki öğrenciler */}
          {yoldakiler.cikti.map(({ o, yuva, tek }, i) => {
            const ad = gorunenAd(o.ad, ayar, ozel.has(o.ad))
            const oran = (animAdim.get(o.ad) ?? o.adim) / d.patika
            const p = patikaNoktasi(oran)
            const { nx, ny } = dikYon(oran)
            const yon = yuva % 2 === 0 ? 1 : -1
            const mesafe = tek ? 0 : (Math.floor(yuva / 2) + 0.55) * boy * 0.95
            const x = p.x + nx * mesafe * yon
            const y = p.y + (ny * mesafe * yon) / DIKEY
            const yuruyor = akiyor && Math.abs((animAdim.get(o.ad) ?? o.adim) - o.adim) > 0.02
            return (
              <div
                key={`${o.ad}-${i}`}
                className="absolute flex flex-col items-center leading-none"
                style={{ left: `${x}%`, top: `${y / DIKEY}%`, width: `${boy}%`, transform: 'translate(-50%, -88%)', zIndex: Math.round(y) }}
                title={`${o.ad}: ${o.adim} adım, ${o.kalp} kalp`}
              >
                <KarakterEnerjisi ad={o.ad} className="relative w-[80%] mb-[3%]" />
                <div className="w-full" style={yuruyor ? { animation: `orman-yuru ${0.55 + (i % 5) * 0.04}s ease-in-out infinite`, transformOrigin: '50% 100%' } : undefined}>
                  <Gorsel ad={`ogrenci-${adIndeksi(o.ad, 8)}.webp`} emoji="🧒" poz="kos" className="w-full aspect-square drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]" emojiClass="text-2xl" />
                </div>
                {o.fener > 0 && (
                  <span className="absolute right-0 top-1/3 block" style={{ fontSize: `${boy * 0.4}cqw`, width: `${boy * 0.4}cqw`, height: `${boy * 0.4}cqw` }} aria-label="fener">
                    <Gorsel ad="orman-fener.webp" emoji="🏮" className="w-full h-full" emojiClass="" />
                  </span>
                )}
                {ad && (
                  <span className="font-bold text-white whitespace-nowrap rounded bg-slate-950/65 px-[3%]" style={{ fontSize: `${adPunto}cqw` }}>
                    {ad}
                  </span>
                )}
                <span style={{ fontSize: `${Math.max(0.9, boy * 0.26)}cqw` }} aria-hidden>
                  {'❤️'.repeat(Math.max(0, o.kalp))}
                </span>
              </div>
            )
          })}
          {yoldakiler.rozetler.map((r) => (
            <span
              key={`rozet-${r.anahtar}`}
              className="absolute rounded-full bg-slate-950/80 border border-white/30 font-extrabold text-amber-200 tabular-nums px-[0.6%]"
              style={{ left: `${r.x}%`, top: `${r.y / DIKEY}%`, transform: 'translate(-50%, -50%)', fontSize: `${Math.max(1.2, boy * 0.38)}cqw`, zIndex: 80 }}
              title="Aynı adımdaki diğer öğrenciler"
            >
              +{r.n}
            </span>
          ))}

          {/* Bu soruda yakalananlar: kurt atlar, öğrenci sarsılır ve kenardaki alana çekilir */}
          {d.oyuncular
            .filter((o) => o.durum === 'kapildi' && o.bittigiSoru === d.oynanan)
            .slice(0, 8)
            .map((o, i) => {
              const p = patikaNoktasi(Math.min(1, o.adim / d.patika))
              return (
                <div key={`yak-${o.ad}-${i}`} className="absolute pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y / DIKEY}%`, zIndex: 90 }}>
                  <div
                    className="absolute flex flex-col items-center"
                    style={{ width: `${boy}cqw`, left: 0, top: 0, animation: 'orman-kac 2.2s ease-in forwards', ['--dx' as string]: `${80 - p.x}cqw`, ['--dy' as string]: `${(55 - p.y) * DIKEY}cqw` }}
                  >
                    <Gorsel ad={`ogrenci-${adIndeksi(o.ad, 8)}.webp`} emoji="😰" poz="dus" className="w-full aspect-square grayscale" emojiClass="text-2xl" />
                  </div>
                  <span className="absolute" style={{ fontSize: `${boy * 0.9}cqw`, animation: 'orman-atla 1.6s ease-out forwards', left: 0, top: 0 }}>
                    🐺
                  </span>
                </div>
              )
            })}

          {/* Eve varanlar evin önünde toplanır */}
          {eveVaran.map((o, i) => (
            <div key={`ev-${o.ad}-${i}`} className="absolute" style={{ left: `${81 + (i % 5) * 3.6}%`, top: `${(17 + Math.floor(i / 5) * 4.4) / DIKEY}%`, width: `${Math.min(boy, 4.2)}%`, transform: 'translate(-50%, -50%)' }} title={`${o.ad}: eve vardı`}>
              <Gorsel ad={`ogrenci-${adIndeksi(o.ad, 8)}.webp`} emoji="🧒" poz="kos" className="w-full aspect-square" emojiClass="text-2xl" />
            </div>
          ))}
          {evde.length > eveVaran.length && (
            <span className="absolute rounded-full bg-emerald-600/90 text-white font-extrabold px-[0.8%] tabular-nums" style={{ left: '95%', top: `${27 / DIKEY}%`, transform: 'translate(-50%, 0)', fontSize: '1.4cqw' }}>
              +{evde.length - eveVaran.length}
            </span>
          )}

          {/* Kurdun yakaladıkları */}
          <div className="absolute rounded-2xl bg-slate-950/75 border border-rose-400/30 p-[0.8%]" style={{ right: '1.5%', bottom: '2.5%', width: '36%', maxHeight: '26%', overflow: 'hidden' }}>
            <p className="font-bold text-rose-200" style={{ fontSize: '1.3cqw' }}>
              🐺 Kurdun yakaladıkları ({yakalanan.length})
            </p>
            <div className="flex flex-wrap gap-x-[1.2cqw] gap-y-[0.3cqw] mt-[0.4cqw]">
              {yakalanan.slice(0, n > 40 ? 24 : 16).map((o, i) => {
                const yeni = o.bittigiSoru === d.oynanan
                return (
                  <span key={`k-${o.ad}-${i}`} className="inline-flex items-center gap-[0.3cqw] text-slate-200" style={{ fontSize: '1.05cqw', animation: yeni ? 'orman-gel 2.4s ease-out both' : undefined }}>
                    <Gorsel ad={`ogrenci-${adIndeksi(o.ad, 8)}.webp`} emoji="😰" poz="dus" className="w-[2.3cqw] h-[2.3cqw] grayscale opacity-80" emojiClass="text-sm" />
                    <span className="truncate max-w-[6cqw]">{n > 40 ? o.ad.split(/\s+/)[0] : o.ad}</span>
                  </span>
                )
              })}
              {yakalanan.length > (n > 40 ? 24 : 16) && <span className="font-bold text-rose-300" style={{ fontSize: '1.1cqw' }}>+{yakalanan.length - (n > 40 ? 24 : 16)}</span>}
              {yakalanan.length === 0 && <span className="text-slate-400" style={{ fontSize: '1cqw' }}>Henüz kimse yakalanmadı</span>}
            </div>
          </div>
          {kapanisKurt && <span className="sr-only">Kurt birini yakaladı</span>}

          {d.bitti && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] z-[100]">
              <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi max-w-lg">
                <p className="text-7xl flex justify-center">{evde.length > 0 ? <Gorsel ad="orman-ev.webp" emoji="🏠" className="h-28 w-auto" emojiClass="text-7xl" /> : '🌙'}</p>
                <p className="text-4xl font-display font-extrabold">{evde.length > 0 ? 'Evin ışıkları yandı!' : 'Kimse eve varamadı'}</p>
                {d.siralama.slice(0, 3).map((o, i) => (
                  <p key={`${o.ad}-${i}`} className="text-xl">
                    {['🥇', '🥈', '🥉'][i]} {o.ad}{' '}
                    <span className="text-slate-400 text-sm">{o.durum === 'evde' ? `${o.bittigiSoru}. soruda vardı` : `${o.adim} / ${d.patika} adım`}</span>
                  </p>
                ))}
                <p className="text-xs text-slate-400">
                  {evde.length} kişi eve vardı · {yakalanan.length} kişi kurda yakalandı
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { OrmanOyuncusu }
