import { supabase } from '../lib/supabase'
import { useOyunSesi } from '../lib/ses'
import { HALKA_SAYISI, HUCRE_SAYISI, evDilimi, kaleHaritasiHesapla, type KaleHaritasi, type KaleOyuncusu } from '../lib/kaleHarita'
import { takimBilgisi } from '../lib/takim'
import Konfeti from './Konfeti'
import { BuyukVurgu, HavaiFisek } from './FinalEfekti'

export interface KaleHaritaGirdisi {
  takimSayisi: number
  toplamSoru: number
  oyuncular: KaleOyuncusu[]
}

/** takim_oyuncu_sonuclari (0041) çıktısını çeker. */
export async function kaleHaritaVerisi(oturum: string, anahtar: string | null): Promise<KaleHaritaGirdisi | null> {
  const { data } = await supabase.rpc('takim_oyuncu_sonuclari', { p_session: oturum, p_anahtar: anahtar })
  const v = data as { sayi?: number; sorular?: unknown[]; oyuncular?: KaleOyuncusu[]; hata?: string } | null
  if (!v || v.hata || !v.sorular || !v.oyuncular) return null
  return { takimSayisi: v.sayi ?? 0, toplamSoru: v.sorular.length, oyuncular: v.oyuncular }
}

export const kaleHaritaHesapla = (g: KaleHaritaGirdisi): KaleHaritasi | null => kaleHaritasiHesapla(g.oyuncular, g.takimSayisi, g.toplamSoru)

const RENKLER = ['#f43f5e', '#38bdf8', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee', '#a16207', '#94a3b8']
const R_DIS = 46
const R_IC = 17

function dilimYolu(halka: number, dilim: number): string {
  const kalinlik = (R_DIS - R_IC) / HALKA_SAYISI
  const r2 = R_DIS - halka * kalinlik - 0.6
  const r1 = r2 - kalinlik + 1.2
  const a0 = (dilim / HUCRE_SAYISI) * 2 * Math.PI - Math.PI / 2 + 0.02
  const a1 = ((dilim + 1) / HUCRE_SAYISI) * 2 * Math.PI - Math.PI / 2 - 0.02
  const nokta = (r: number, a: number) => `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`
  return `M ${nokta(r2, a0)} A ${r2} ${r2} 0 0 1 ${nokta(r2, a1)} L ${nokta(r1, a1)} A ${r1} ${r1} 0 0 0 ${nokta(r1, a0)} Z`
}

function merkez(halka: number, dilim: number): { x: number; y: number } {
  const kalinlik = (R_DIS - R_IC) / HALKA_SAYISI
  const r = R_DIS - halka * kalinlik - kalinlik / 2
  const a = ((dilim + 0.5) / HUCRE_SAYISI) * 2 * Math.PI - Math.PI / 2
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }
}

const ZEMIN = ['#4d7c2f', '#7a6330', '#6b6b66']
const ZEMIN_ACIK = ['#6a9a43', '#9a8244', '#8b8b85']

/** Hücrenin sahibi takımın rengiyle çadır, bayrak ve asker çizer (halka küçüldükçe ölçek küçülür). */
function KampCizimi({ x, y, renk, olcek, ad }: { x: number; y: number; renk: string; olcek: number; ad: string }) {
  return (
    <g transform={`translate(${x} ${y + 0.8 * olcek}) scale(${olcek})`}>
      <ellipse cx="0" cy="2.2" rx="4.2" ry="1.1" fill="rgba(0,0,0,0.35)" />
      {/* çadır */}
      <polygon points="-2.8,1.9 0,-2.5 2.8,1.9" fill={renk} stroke="rgba(0,0,0,0.55)" strokeWidth="0.25" />
      <polygon points="-0.8,1.9 0,-0.2 0.8,1.9" fill="rgba(0,0,0,0.55)" />
      <polygon points="0,-2.5 -2.8,1.9 -1.6,1.9" fill="rgba(255,255,255,0.18)" />
      {/* bayrak */}
      <line x1="0" y1="-2.5" x2="0" y2="-5.6" stroke="#3f2d1a" strokeWidth="0.3" />
      <polygon points="0,-5.6 2.9,-4.7 0,-3.8" fill={renk} stroke="#fff" strokeWidth="0.2" style={{ transformOrigin: '0px -4.7px', animation: 'kale-bayrak 1.6s ease-in-out infinite' }} />
      {/* asker */}
      <g transform="translate(-3.5 1.2)">
        <line x1="1.1" y1="-3.4" x2="1.1" y2="1.4" stroke="#a8a29e" strokeWidth="0.22" />
        <polygon points="1.1,-4.1 0.8,-3.3 1.4,-3.3" fill="#e5e7eb" />
        <rect x="-0.7" y="-1.4" width="1.4" height="2.2" rx="0.4" fill={renk} stroke="rgba(0,0,0,0.5)" strokeWidth="0.15" />
        <circle cx="0" cy="-2.1" r="0.75" fill="#fcd9b6" />
        <path d="M-0.8 -2.3 A0.8 0.8 0 0 1 0.8 -2.3 Z" fill="#6b7280" />
      </g>
      {ad && (
        <text x="0" y="4.4" fontSize="1.7" textAnchor="middle" fill="#fff" fontWeight="bold" stroke="rgba(0,0,0,0.7)" strokeWidth="0.3" paintOrder="stroke">
          {ad}
        </text>
      )}
    </g>
  )
}

/** Hedef kale: hendek, surlar, dört kule ve ortada ana bina; kuşatan takımın bayrağı çekilir. */
function KaleCizimi({ bayrak }: { bayrak: string }) {
  return (
    <g transform="translate(50 50)">
      <circle r="16.6" fill="#0c4a6e" />
      <circle r="16.6" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="1.2 1.6" opacity="0.7" />
      <circle r="14.6" fill="#78716c" stroke="#44403c" strokeWidth="0.5" />
      {Array.from({ length: 20 }, (_, i) => (
        <rect key={i} x="-0.7" y="-15.7" width="1.4" height="1.6" fill="#a8a29e" stroke="#44403c" strokeWidth="0.15" transform={`rotate(${i * 18})`} />
      ))}
      <circle r="12.4" fill="#a8a29e" />
      <circle r="12.4" fill="none" stroke="#57534e" strokeWidth="0.3" />
      {[45, 135, 225, 315].map((a) => (
        <g key={a} transform={`rotate(${a}) translate(0 -10.6)`}>
          <circle r="3" fill="#d6d3d1" stroke="#57534e" strokeWidth="0.3" />
          <polygon points="0,-6 -3.4,-1.6 3.4,-1.6" fill="#9a3412" stroke="#431407" strokeWidth="0.25" transform="rotate(0)" />
          <rect x="-0.4" y="-0.4" width="0.8" height="1.4" fill="#292524" />
        </g>
      ))}
      <rect x="-5.4" y="-4.8" width="10.8" height="9.2" fill="#e7e5e4" stroke="#57534e" strokeWidth="0.35" />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={-5.4 + i * 2.2} y="-5.8" width="1.4" height="1.2" fill="#e7e5e4" stroke="#57534e" strokeWidth="0.25" />
      ))}
      <path d="M-1.5 4.4 V0.6 A1.5 1.5 0 0 1 1.5 0.6 V4.4 Z" fill="#451a03" stroke="#1c1917" strokeWidth="0.3" />
      <rect x="-4.3" y="-2.4" width="1.3" height="2" rx="0.5" fill="#1c1917" />
      <rect x="3" y="-2.4" width="1.3" height="2" rx="0.5" fill="#1c1917" />
      <line x1="0" y1="-5.8" x2="0" y2="-11.4" stroke="#3f2d1a" strokeWidth="0.35" />
      <polygon points="0,-11.4 5,-9.8 0,-8.2" fill={bayrak} stroke="#fff" strokeWidth="0.25" style={{ transformOrigin: '0px -9.8px', animation: 'kale-bayrak 1.6s ease-in-out infinite' }} />
    </g>
  )
}

const KALE_STIL = `@keyframes kale-bayrak { 0%,100% { transform: skewY(0deg) scaleX(1) } 50% { transform: skewY(-9deg) scaleX(.88) } }`

/** Kale kuşatması hücre haritası: ortada hedef kale, takımların kampları halkalar hâlinde toprağı paylaşır. */
export function KaleHaritaSahnesi({ h, takimSayisi, kucult }: { h: KaleHaritasi; takimSayisi: number; kucult: () => void }) {
  useOyunSesi(h.oynanan, h.bitti, true, 'kale')
  const sirali = [...h.takimlar].sort((a, b) => b.ic - a.ic || b.toplam - a.toplam)
  const kalabalik = h.hucreler.filter((c) => c.takim !== null).length > 24
  const kalinlik = (R_DIS - R_IC) / HALKA_SAYISI
  return (
    <div data-denetim="sahne" className="perde-alan z-40 bg-slate-950/95 flex flex-col p-3 sm:p-4 gap-2">
      <style>{KALE_STIL}</style>
      {h.bitti && h.kazanan !== null && (
        <>
          <Konfeti />
          <HavaiFisek />
          <BuyukVurgu emoji="🚩" alt="Kale ele geçirildi!" konum="ust" />
        </>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-display font-extrabold">🏰 Kale kuşatması</h2>
        <span className="text-sm text-slate-300 tabular-nums">Soru {h.oynanan}</span>
        <span className="text-xs text-slate-400 hidden xl:inline">2 doğruda 1 hücre; boş toprak bitince rakibin komşu hücresi alınır. İç halkayı tutan takım kaleyi kuşatır.</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_12rem] gap-3">
        <div className="relative min-h-0 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 80%)' }}>
          <svg viewBox="0 0 100 100" className="h-full max-h-full w-auto max-w-full" role="img" aria-label="Kale haritası">
            <defs>
              <filter id="kale-doku" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="g" />
                <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 0.55 -0.12" />
              </filter>
              <clipPath id="kale-disk">
                <circle cx="50" cy="50" r={R_DIS + 2} />
              </clipPath>
            </defs>
            <circle cx="50" cy="50" r={R_DIS + 2.6} fill="#3f2d1a" />
            <g clipPath="url(#kale-disk)">
              <circle cx="50" cy="50" r={R_DIS + 2} fill="#4d7c2f" />
              {Array.from({ length: HALKA_SAYISI }, (_, i) => (
                <circle key={i} cx="50" cy="50" r={R_DIS + 2 - i * kalinlik} fill={ZEMIN[i]} />
              ))}
              <rect width="100" height="100" filter="url(#kale-doku)" />
            </g>
            {h.hucreler.map((c) => {
              const renk = c.takim === null ? null : RENKLER[(c.takim - 1) % RENKLER.length]
              return (
                <path
                  key={`${c.halka}-${c.dilim}`}
                  d={dilimYolu(c.halka, c.dilim)}
                  fill={renk ?? ZEMIN_ACIK[c.halka]}
                  fillOpacity={renk ? 0.4 : 0.1}
                  stroke={renk ?? 'rgba(255,255,255,0.35)'}
                  strokeOpacity={renk ? 0.95 : 1}
                  strokeWidth={renk ? 0.45 : 0.25}
                  strokeDasharray={renk ? undefined : '0.9 0.9'}
                >
                  <title>{c.sahip ? `${c.sahip} (${takimBilgisi(c.takim ?? 1).ad}) · ${c.soru}. soruda` : 'Boş toprak'}</title>
                </path>
              )
            })}
            {h.hucreler
              .filter((c) => c.takim !== null && c.sahip)
              .map((c) => {
                const p = merkez(c.halka, c.dilim)
                const ilk = (c.sahip ?? '').trim().split(/\s+/)[0] ?? ''
                const ad = kalabalik && c.halka === 2 ? '' : ilk.slice(0, 7)
                return <KampCizimi key={`k-${c.halka}-${c.dilim}`} x={p.x} y={p.y} renk={RENKLER[((c.takim ?? 1) - 1) % RENKLER.length]} olcek={[1, 0.92, 0.78][c.halka] ?? 0.8} ad={ad} />
              })}
            <KaleCizimi bayrak={h.kusatan !== null ? RENKLER[(h.kusatan - 1) % RENKLER.length] : '#e5e7eb'} />
            {/* Bu sorudaki hamleler: asker evinden hücreye koşar, bayrak diker; ele geçirmede iki asker çarpışır */}
            {h.oynanan > 0 &&
              h.hucreler
                .filter((c) => c.takim !== null && c.soru === h.oynanan)
                .map((c, i) => {
                  const ev = merkez(0, evDilimi(c.takim ?? 1, takimSayisi))
                  const hedef = merkez(c.halka, c.dilim)
                  const gecikme = Math.min(2.5, i * 0.12)
                  return (
                    <g key={`hamle-${h.oynanan}-${c.halka}-${c.dilim}`}>
                      <text fontSize="3.4" textAnchor="middle" opacity="0">
                        🪖
                        <animateMotion path={`M ${ev.x} ${ev.y} L ${hedef.x} ${hedef.y}`} dur="2.4s" begin={`${gecikme}s`} fill="freeze" />
                        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin={`${gecikme}s`} fill="freeze" />
                      </text>
                      {c.geriAlindi && (
                        <text x={hedef.x} y={hedef.y} fontSize="5" textAnchor="middle" opacity="0">
                          💥
                          <animate attributeName="opacity" values="0;1;0" dur="0.8s" begin={`${gecikme + 2.2}s`} fill="freeze" />
                        </text>
                      )}
                    </g>
                  )
                })}
            {/* Mancınık: her soruda taşlar kaleye düşer */}
            {h.oynanan > 0 &&
              Array.from({ length: Math.min(5, Math.max(1, h.hucreler.filter((c) => c.soru === h.oynanan).length)) }, (_, i) => {
                const a = ((i * 2.4 + h.oynanan) % (2 * Math.PI)) - Math.PI / 2
                const x0 = 50 + (R_DIS + 1) * Math.cos(a)
                const y0 = 50 + (R_DIS + 1) * Math.sin(a)
                return (
                  <text key={`tas-${h.oynanan}-${i}`} fontSize="3" textAnchor="middle" opacity="0">
                    🪨
                    <animateMotion path={`M ${x0} ${y0} Q 50 ${y0 - 30} 50 50`} dur="1.4s" begin={`${0.3 + i * 0.35}s`} fill="freeze" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.4s" begin={`${0.3 + i * 0.35}s`} fill="freeze" />
                  </text>
                )
              })}
          </svg>
          {h.bitti && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
              <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
                <p className="text-7xl">{h.kazanan !== null ? '🏆' : '🏰'}</p>
                <p className="text-4xl font-display font-extrabold">
                  {h.kazanan !== null ? `${takimBilgisi(h.kazanan).emoji} ${takimBilgisi(h.kazanan).ad} takım ${h.kusatan === h.kazanan ? 'kaleyi kuşattı!' : 'kazandı!'}` : 'Kale kimseye düşmedi'}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="cam-panel rounded-2xl p-2.5 space-y-1.5 overflow-y-auto text-xs">
          <h3 className="font-bold text-slate-300">Durum ({takimSayisi} takım)</h3>
          {sirali.map((t, i) => {
            const b = takimBilgisi(t.takim)
            return (
              <div key={t.takim} className="rounded-lg border border-white/10 px-2 py-1" style={{ borderLeft: `4px solid ${RENKLER[(t.takim - 1) % RENKLER.length]}` }}>
                <p className="font-bold leading-tight">
                  {i + 1}. {b.emoji} {b.ad}
                </p>
                <p className="text-[11px] text-slate-300 tabular-nums leading-tight">
                  İç {t.ic}/{HUCRE_SAYISI} · toplam {t.toplam}
                  {t.geriAlinan > 0 && ` · ${t.geriAlinan} alınan`}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
