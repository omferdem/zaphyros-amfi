import { SIK_RENKLERI } from './renkler'
// Bilgi yarışmasında sahne, kumanda ve öğrenci telefonunun ortak kullandığı küçük yardımcılar.

/** Şık harfleri ve renkleri (perdede ve telefonda aynı; öğrenci rengi görüp basabilsin). */
/** zapedu2 tasarımındaki şık renkleri (öğrenci telefonu): A pembe, B mor, C turkuaz, D sarı. */
export const ZE_SIKLAR = SIK_RENKLERI

export const SIKLAR = [
  { harf: 'A', sekil: '▲', renk: 'bg-linear-to-br from-rose-500 to-pink-600 shadow-[0_8px_28px_rgba(244,63,94,0.4)]', cerceve: 'border-rose-400', yazi: 'text-rose-200' },
  { harf: 'B', sekil: '◆', renk: 'bg-linear-to-br from-sky-400 to-blue-600 shadow-[0_8px_28px_rgba(56,189,248,0.4)]', cerceve: 'border-sky-400', yazi: 'text-sky-200' },
  { harf: 'C', sekil: '●', renk: 'bg-linear-to-br from-amber-400 to-orange-500 shadow-[0_8px_28px_rgba(251,191,36,0.4)]', cerceve: 'border-amber-400', yazi: 'text-amber-200' },
  { harf: 'D', sekil: '■', renk: 'bg-linear-to-br from-emerald-400 to-teal-600 shadow-[0_8px_28px_rgba(52,211,153,0.4)]', cerceve: 'border-emerald-400', yazi: 'text-emerald-200' },
  { harf: 'E', sekil: '★', renk: 'bg-linear-to-br from-violet-500 to-purple-700 shadow-[0_8px_28px_rgba(139,92,246,0.4)]', cerceve: 'border-violet-400', yazi: 'text-violet-200' },
  { harf: 'F', sekil: '⬢', renk: 'bg-linear-to-br from-cyan-400 to-teal-500 shadow-[0_8px_28px_rgba(34,211,238,0.4)]', cerceve: 'border-cyan-400', yazi: 'text-cyan-200' },
]

/** Sunucunun bildirdiği kalan süreden yerel saatle bitiş anı. */
export function bitisAni(kalanMs: number | null | undefined): number | null {
  return typeof kalanMs === 'number' ? Date.now() + kalanMs : null
}
