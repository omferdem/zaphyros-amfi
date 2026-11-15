import { supabase } from '../lib/supabase'
import { HALKA_SAYISI, HUCRE_SAYISI, kaleHaritasiHesapla, type KaleHaritasi, type KaleOyuncusu } from '../lib/kaleHarita'
import { takimBilgisi } from '../lib/takim'
import Konfeti from './Konfeti'

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

const RENKLER = ['#f43f5e', '#38bdf8', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c']
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

/** Kale kuşatması hücre haritası: ortada hedef kale, takımların bayrakları halkalar hâlinde toprağı paylaşır. */
export function KaleHaritaSahnesi({ h, takimSayisi, kucult }: { h: KaleHaritasi; takimSayisi: number; kucult: () => void }) {
  const sirali = [...h.takimlar].sort((a, b) => b.ic - a.ic || b.toplam - a.toplam)
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 gap-3">
      {h.bitti && h.kazanan !== null && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl font-display font-extrabold">🏰 Kale kuşatması</h2>
        <span className="text-sm text-slate-300 tabular-nums">Soru {h.oynanan}</span>
        <span className="text-xs text-slate-400">Her öğrenci 2 doğruda 1 hücre alır; boş toprak bitince rakibin komşu hücresi ele geçirilir. İç halkayı tamamen tutan takım kaleyi kuşatır.</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_18rem] gap-3">
        <div className="relative min-h-0 rounded-3xl overflow-hidden border border-white/10 bg-slate-900/60 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full max-h-full w-auto max-w-full" role="img" aria-label="Kale haritası">
            <circle cx="50" cy="50" r={R_DIS + 2} fill="rgba(15,23,42,0.6)" />
            {h.hucreler.map((c) => (
              <path
                key={`${c.halka}-${c.dilim}`}
                d={dilimYolu(c.halka, c.dilim)}
                fill={c.takim === null ? 'rgba(148,163,184,0.18)' : RENKLER[(c.takim - 1) % RENKLER.length]}
                fillOpacity={c.takim === null ? 1 : 0.85}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.25"
              >
                <title>{c.sahip ? `${c.sahip} (${takimBilgisi(c.takim ?? 1).ad}) · ${c.soru}. soruda` : 'Boş toprak'}</title>
              </path>
            ))}
            {h.hucreler
              .filter((c) => c.takim !== null && c.sahip)
              .map((c) => {
                const p = merkez(c.halka, c.dilim)
                return (
                  <text key={`t-${c.halka}-${c.dilim}`} x={p.x} y={p.y + 1} fontSize="2.6" textAnchor="middle" fill="white" fontWeight="bold">
                    {`⚑${(c.sahip ?? '').trim()[0]?.toLocaleUpperCase('tr') ?? ''}`}
                  </text>
                )
              })}
            <text x="50" y="53" fontSize="12" textAnchor="middle">
              🏰
            </text>
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
        <div className="cam-panel rounded-3xl p-4 space-y-2 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-300">Durum ({takimSayisi} takım)</h3>
          {sirali.map((t, i) => {
            const b = takimBilgisi(t.takim)
            const enIyi = Object.entries(t.alinan).sort((a, c) => c[1] - a[1]).slice(0, 3)
            return (
              <div key={t.takim} className="rounded-xl border border-white/10 p-2.5" style={{ borderLeft: `4px solid ${RENKLER[(t.takim - 1) % RENKLER.length]}` }}>
                <p className="font-bold text-sm">
                  {i + 1}. {b.emoji} {b.ad}
                </p>
                <p className="text-xs text-slate-300 tabular-nums">
                  İç halka {t.ic}/{HUCRE_SAYISI} · toplam {t.toplam} hücre
                  {t.geriAlinan > 0 && ` · ${t.geriAlinan} ele geçirme`}
                </p>
                {enIyi.length > 0 && <p className="text-[11px] text-slate-400 truncate">{enIyi.map(([ad, n]) => `${ad} (${n})`).join(', ')}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
