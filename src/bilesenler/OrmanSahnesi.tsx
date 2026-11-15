import { useMemo } from 'react'
import { ORMAN_KALBI, type OrmanOyuncusu, type OrmanSonucu } from '../lib/orman'
import { gorunenAd, kalabalikAyari } from '../lib/oyunMotoru'
import { useOyunSesi } from '../lib/ses'
import Konfeti from './Konfeti'

/** Patikanın dönemeçleri (viewBox 100x60); soldan altta başlar, sağ üstteki eve varır. */
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
  [91, 9],
]

function patikaNoktasi(oran: number): { x: number; y: number } {
  const parcalar = PATIKA.slice(1).map((p, i) => ({ a: PATIKA[i], b: p, u: Math.hypot(p[0] - PATIKA[i][0], p[1] - PATIKA[i][1]) }))
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

function sapma(ad: string): number {
  let h = 0
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0
  return ((h % 100) / 100 - 0.5) * 3.2
}

const AGACLAR: [number, number][] = [
  [12, 12], [24, 8], [40, 10], [58, 7], [75, 5], [8, 30], [44, 36], [64, 28], [86, 30], [10, 44], [40, 50], [60, 52], [82, 50], [96, 40], [52, 14], [28, 52],
]

/** Orman'dan eve dönüş: patikada ilerleyen öğrenciler, kalpler, fener, kurt ve kararan gökyüzü. */
export function OrmanSahnesi({ d, kucult }: { d: OrmanSonucu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, d.oyuncular.some((o) => o.durum === 'evde'))
  const n = d.oyuncular.length
  const ayar = kalabalikAyari(n)
  const ozel = useMemo(() => new Set([...d.siralama.slice(0, 3), ...d.siralama.slice(-3)].map((o) => o.ad)), [d.siralama])
  const evde = d.oyuncular.filter((o) => o.durum === 'evde')
  const boy = Math.round(4.2 * ayar.olcek * 10) / 10

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && evde.length > 0 && <Konfeti />}
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
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden border border-white/10" style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #14532d 100%)' }}>
        {/* Gökyüzü ve orman, sorular ilerledikçe kararır */}
        <div className="absolute inset-0 bg-slate-950 pointer-events-none transition-opacity duration-1000" style={{ opacity: 0.1 + d.karanlik * 0.6 }} aria-hidden />
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="img" aria-label="Orman patikası">
          {AGACLAR.map(([x, y], i) => (
            <text key={i} x={x} y={y} fontSize="5" textAnchor="middle" opacity="0.85">
              🌲
            </text>
          ))}
          <polyline points={PATIKA.map((p) => p.join(',')).join(' ')} fill="none" stroke="#a16207" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          <polyline points={PATIKA.map((p) => p.join(',')).join(' ')} fill="none" stroke="#ca8a04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 3" opacity="0.8" />
          {/* Dere ve köprü */}
          <path d="M 36 44 Q 42 38 48 46 T 62 50" stroke="#38bdf8" strokeWidth="1.4" fill="none" opacity="0.7" />
          <text x="40" y="43" fontSize="3.5">
            🌉
          </text>
          {/* Ev: biri varınca ışıkları yanar */}
          <text x="91" y="8" fontSize="9" textAnchor="middle" style={{ filter: evde.length > 0 ? 'drop-shadow(0 0 3px #fde047)' : 'none' }}>
            🏠
          </text>
          {evde.length > 0 && (
            <text x="91" y="12.5" fontSize="3" textAnchor="middle">
              {d.bitti ? '🔥💡' : '💡'}
            </text>
          )}
          {/* Kurt gözleri: kalbi 1'e düşen olunca çalıların arasında parlar */}
          {d.kurtGozu &&
            [[14, 38], [54, 33], [78, 24]].map(([x, y], i) => (
              <text key={i} x={x} y={y} fontSize="3.4" className="animate-breathe">
                👀
              </text>
            ))}
          {d.oyuncular.map((o, i) => {
            const oran = o.durum === 'evde' ? 1 : o.adim / d.patika
            const p = patikaNoktasi(oran)
            const x = o.durum === 'evde' ? 84 + (i % 7) * 1.4 : p.x + sapma(o.ad)
            const y = o.durum === 'evde' ? 15 + Math.floor(i / 7) * 2.2 : p.y + sapma(o.ad + 'y')
            const ad = gorunenAd(o.ad, ayar, ozel.has(o.ad))
            return (
              <g key={`${o.ad}-${i}`} style={{ transition: 'transform 1s ease-out' }}>
                {o.durum === 'kapildi' ? (
                  <>
                    <text x={x} y={y} fontSize={boy} textAnchor="middle">
                      🐾
                    </text>
                    <text x={x} y={y - boy * 0.7} fontSize={boy * 0.9} textAnchor="middle" opacity="0.8">
                      💨
                    </text>
                  </>
                ) : (
                  <>
                    <text x={x} y={y} fontSize={boy} textAnchor="middle">
                      {o.kalp <= 1 && o.durum === 'yolda' ? '😰' : '🧒'}
                    </text>
                    {o.fener > 0 && o.durum === 'yolda' && (
                      <text x={x + boy * 0.6} y={y - boy * 0.4} fontSize={boy * 0.7}>
                        🏮
                      </text>
                    )}
                    <text x={x} y={y + boy * 0.75} fontSize={boy * 0.5} textAnchor="middle">
                      {'❤️'.repeat(Math.max(0, o.kalp))}
                    </text>
                  </>
                )}
                {ad && (
                  <text x={x} y={y + boy * 1.35} fontSize={boy * 0.5} textAnchor="middle" fill="white" fontWeight="bold" stroke="rgba(0,0,0,0.6)" strokeWidth="0.15" paintOrder="stroke">
                    {ad}
                  </text>
                )}
              </g>
            )
          })}
          {/* Kurt: yakalanan her öğrencinin yanında kısa bir an görünür */}
          {d.oyuncular.some((o) => o.durum === 'kapildi' && o.bittigiSoru === d.oynanan) && (
            <text x="6" y="58" fontSize="5" className="animate-pop">
              🐺
            </text>
          )}
        </svg>
        {d.bitti && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi max-w-lg">
              <p className="text-7xl">{evde.length > 0 ? '🏠' : '🌙'}</p>
              <p className="text-4xl font-display font-extrabold">{evde.length > 0 ? 'Evin ışıkları yandı!' : 'Kimse eve varamadı'}</p>
              {d.siralama.slice(0, 3).map((o, i) => (
                <p key={`${o.ad}-${i}`} className="text-xl">
                  {['🥇', '🥈', '🥉'][i]} {o.ad}{' '}
                  <span className="text-slate-400 text-sm">{o.durum === 'evde' ? `${o.bittigiSoru}. soruda vardı` : `${o.adim} / ${d.patika} adım`}</span>
                </p>
              ))}
              <p className="text-xs text-slate-400">
                {evde.length} kişi eve vardı · {d.oyuncular.filter((o) => o.durum === 'kapildi').length} kişi kurda yakalandı
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export type { OrmanOyuncusu }
