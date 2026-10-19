// Bilgi yarışmasında sahne, kumanda ve öğrenci telefonunun ortak kullandığı küçük yardımcılar.

/** Şık harfleri ve renkleri (perdede ve telefonda aynı; öğrenci rengi görüp basabilsin). */
export const SIKLAR = [
  { harf: 'A', renk: 'bg-rose-500', cerceve: 'border-rose-400', yazi: 'text-rose-200' },
  { harf: 'B', renk: 'bg-sky-500', cerceve: 'border-sky-400', yazi: 'text-sky-200' },
  { harf: 'C', renk: 'bg-amber-500', cerceve: 'border-amber-400', yazi: 'text-amber-200' },
  { harf: 'D', renk: 'bg-emerald-500', cerceve: 'border-emerald-400', yazi: 'text-emerald-200' },
  { harf: 'E', renk: 'bg-violet-500', cerceve: 'border-violet-400', yazi: 'text-violet-200' },
  { harf: 'F', renk: 'bg-cyan-500', cerceve: 'border-cyan-400', yazi: 'text-cyan-200' },
]

/** Sunucunun bildirdiği kalan süreden yerel saatle bitiş anı. */
export function bitisAni(kalanMs: number | null | undefined): number | null {
  return typeof kalanMs === 'number' ? Date.now() + kalanMs : null
}
