import { useEffect, useRef, useState } from 'react'

/**
 * Hoca perdesinin ortak kabuğu: üstte sabit araç şeridi (44 px), sağda isteğe bağlı kod şeridi, altta isteğe bağlı kontrol şeridi.
 * Sahneler bu şeritlerin altında/yanında kalan alana çizilir; değerler CSS değişkenleri olarak yayınlanır
 * (--perde-ust, --perde-sag, --perde-alt) ve `.perde-alan` sınıfı bunları okur. Böylece hiçbir şerit sahnenin üstüne binmez.
 */
export const ARAC_YUKSEKLIK = 44

/** Bileşen ekrandayken kök öğeye bir CSS değişkeni yazar; kalkınca siler. */
export function usePerdeDegiskeni(ad: string, deger: string) {
  useEffect(() => {
    document.documentElement.style.setProperty(ad, deger)
    return () => {
      document.documentElement.style.removeProperty(ad)
    }
  }, [ad, deger])
}

/** Üst araç şeridi: asla sarmaz; fare 3 sn hareketsizse yer değiştirmeden soluklaşır. */
export function AracSeridi({ children }: { children: React.ReactNode }) {
  usePerdeDegiskeni('--perde-ust', `${ARAC_YUKSEKLIK}px`)
  const [soluk, setSoluk] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const uyan = () => {
      setSoluk(false)
      if (t) clearTimeout(t)
      t = setTimeout(() => setSoluk(true), 3000)
    }
    uyan()
    window.addEventListener('pointermove', uyan)
    window.addEventListener('keydown', uyan)
    window.addEventListener('pointerdown', uyan)
    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('pointermove', uyan)
      window.removeEventListener('keydown', uyan)
      window.removeEventListener('pointerdown', uyan)
    }
  }, [])
  return (
    <div
      data-denetim="arac"
      className={`@container fixed top-0 inset-x-0 z-[65] flex flex-nowrap items-center gap-2 px-2 bg-slate-950/85 backdrop-blur border-b border-white/10 transition-opacity duration-700 ${soluk ? 'opacity-30 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}
      style={{ height: ARAC_YUKSEKLIK }}
    >
      {children}
    </div>
  )
}

/** Sağ kenardaki kod şeridi: kod ve adres 90 derece sola dönük yazılır; yoklama açıksa altında küçük karekod durur. */
export function KodSerit({
  kod,
  adres,
  qr,
  qrHata,
  kalanOran,
  katilan,
  acik,
  qrGizli,
  qrAc,
}: {
  kod: string
  adres: string
  qr: string | null
  qrHata: boolean
  kalanOran: number
  katilan: number
  acik: boolean
  qrGizli: boolean
  qrAc: (ac: boolean) => void
}) {
  const [kapali, setKapali] = useState(false)
  const qrVar = acik && !qrGizli
  const genislik = kapali ? 24 : qrVar ? 148 : 56
  usePerdeDegiskeni('--perde-sag', `${genislik}px`)
  if (kapali)
    return (
      <button
        data-denetim="kod"
        onClick={() => setKapali(false)}
        aria-label="Kod şeridini göster"
        title="Katılım kodunu göster"
        className="fixed right-0 z-[64] bg-slate-900/70 text-slate-300 hover:text-white text-xs"
        style={{ top: ARAC_YUKSEKLIK, bottom: 0, width: 24 }}
      >
        ◂
      </button>
    )
  return (
    <aside
      data-denetim="kod"
      className="fixed right-0 z-[64] flex flex-col items-center gap-2 py-2 bg-slate-950/70 border-l border-white/10"
      style={{ top: ARAC_YUKSEKLIK, bottom: 0, width: genislik }}
    >
      <button onClick={() => setKapali(true)} aria-label="Kod şeridini gizle" title="Şeridi gizle" className="shrink-0 h-6 w-full text-xs text-slate-400 hover:text-white">
        ▸
      </button>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        <p className="whitespace-nowrap text-center font-bold leading-tight text-[clamp(13px,2.6vh,22px)] [writing-mode:vertical-rl] rotate-180">
          <span className="text-slate-300">Derse katıl </span>
          <span className="font-mono text-sari tracking-widest text-[1.5em]">{kod}</span>
          <span className="text-slate-400"> · {adres}</span>
          <span className="text-emerald-300"> · {katilan} katılan</span>
        </p>
      </div>
      {qrVar && (
        <div className="shrink-0 flex flex-col items-center gap-1 pb-1">
          <div className="bg-white rounded-lg p-1 w-[128px] h-[128px] flex items-center justify-center">
            {qr ? <img src={qr} alt="Yoklama QR kodu" className="w-full h-full [image-rendering:pixelated]" /> : <span className="text-slate-500 text-[10px] text-center">{qrHata ? 'Bağlantı yok' : '…'}</span>}
          </div>
          <div className="w-[120px] h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-linear-to-r from-pink-500 to-violet-500" style={{ width: `${kalanOran * 100}%` }} />
          </div>
          <button className="text-[10px] text-slate-400 hover:text-white underline" onClick={() => qrAc(false)}>
            karekodu gizle
          </button>
        </div>
      )}
      {acik && qrGizli && (
        <button className="shrink-0 text-[10px] text-slate-400 hover:text-white underline pb-1" onClick={() => qrAc(true)}>
          karekodu göster
        </button>
      )}
    </aside>
  )
}

/** Alt kontrol şeridi: yüksekliğini ölçüp --perde-alt olarak yayınlar; sahne bunun üstünde biter. */
export function AltSerit({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const yaz = () => document.documentElement.style.setProperty('--perde-alt', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    yaz()
    const ro = new ResizeObserver(yaz)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--perde-alt')
    }
  }, [])
  return (
    <div ref={ref} data-denetim="alt" className={`fixed bottom-0 left-0 z-[60] flex flex-col items-center gap-2 p-2 ${className}`} style={{ right: 'var(--perde-sag, 0px)' }}>
      {children}
    </div>
  )
}
