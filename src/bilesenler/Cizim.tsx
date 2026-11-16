import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export type CizimModu = 'kapali' | 'lazer' | 'tahta'

interface Vurus {
  renk: string
  kalinlik: number
  /** 0-1 arası normalleştirilmiş noktalar [x, y, x, y, ...] */
  n: number[]
  silgi?: boolean
}

export const KALEM_RENKLERI = [
  { ad: 'Beyaz', renk: '#ffffff' },
  { ad: 'Sarı', renk: '#fde047' },
  { ad: 'Kırmızı', renk: '#f43f5e' },
  { ad: 'Mavi', renk: '#38bdf8' },
  { ad: 'Yeşil', renk: '#4ade80' },
] as const
const KALINLIKLAR = [3, 6, 12]
const SILGI_KALINLIK = 28

export const lazerKanali = (oturum: string) => `lazer:${oturum}`
const depoAnahtari = (oturum: string) => `amfi_cizim_${oturum}`

/** Çizimleri ders bitince temizlemek için. */
export function cizimleriSil(oturum: string): void {
  try {
    sessionStorage.removeItem(depoAnahtari(oturum))
  } catch {
    /* önemsiz */
  }
}

function yukle(oturum: string): Record<string, Vurus[]> {
  try {
    return JSON.parse(sessionStorage.getItem(depoAnahtari(oturum)) ?? '{}') as Record<string, Vurus[]>
  } catch {
    return {}
  }
}

/**
 * Perde çizim katmanı. "tahta": boş beyaz ya da kara tahta. "lazer": slaytın üstünde kırmızı nokta; basılı tutunca seçili kalemle çizer.
 * Çizimler slayta (anahtar) bağlıdır; slayt değişip geri gelince görünür. Veritabanına yazılmaz: bellekte ve sekmenin sessionStorage'ında durur.
 * Telefon kumandasındaki dokunmatik yüzey, lazer kanalından (Broadcast) aynı lazeri oynatır.
 */
export default function Cizim({ oturum, anahtar, mod, kapat, bitti, ac, kodDegistir }: { oturum: string; anahtar: string; mod: CizimModu; kapat: () => void; bitti: boolean; ac: () => void; kodDegistir?: () => void }) {
  const modRef = useRef(mod)
  modRef.current = mod
  const acRef = useRef(ac)
  acRef.current = ac
  const kapatRef = useRef(kapat)
  kapatRef.current = kapat
  const kodRef = useRef(kodDegistir)
  kodRef.current = kodDegistir
  const komutRef = useRef<(k: string, r?: number) => void>(() => {})
  const canvas = useRef<HTMLCanvasElement>(null)
  const depo = useRef<Record<string, Vurus[]>>(yukle(oturum))
  const [renk, setRenk] = useState<string>(KALEM_RENKLERI[1].renk)
  const [kalinlik, setKalinlik] = useState(6)
  const [silgi, setSilgi] = useState(false)
  const [kara, setKara] = useState(true)
  const [nokta, setNokta] = useState<{ x: number; y: number } | null>(null)
  const [, yenile] = useState(0)
  const cizilen = useRef<Vurus | null>(null)

  const key = mod === 'tahta' ? 'tahta' : anahtar
  const keyRef = useRef(key)
  keyRef.current = key

  const ciz = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== w * 2 || c.height !== h * 2) {
      c.width = w * 2
      c.height = h * 2
    }
    g.setTransform(2, 0, 0, 2, 0, 0)
    g.clearRect(0, 0, w, h)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const v of [...(depo.current[keyRef.current] ?? []), ...(cizilen.current ? [cizilen.current] : [])]) {
      if (v.n.length < 2) continue
      g.globalCompositeOperation = v.silgi ? 'destination-out' : 'source-over'
      g.strokeStyle = v.renk
      g.lineWidth = v.kalinlik
      g.beginPath()
      g.moveTo(v.n[0] * w, v.n[1] * h)
      if (v.n.length === 2) g.lineTo(v.n[0] * w + 0.1, v.n[1] * h)
      for (let i = 2; i < v.n.length; i += 2) g.lineTo(v.n[i] * w, v.n[i + 1] * h)
      g.stroke()
    }
    g.globalCompositeOperation = 'source-over'
  }, [])

  useEffect(() => {
    ciz()
    window.addEventListener('resize', ciz)
    return () => window.removeEventListener('resize', ciz)
  }, [ciz, key, mod])

  useEffect(() => {
    if (bitti) {
      cizimleriSil(oturum)
      depo.current = {}
      ciz()
    }
  }, [bitti, oturum, ciz])

  function kaydet() {
    try {
      sessionStorage.setItem(depoAnahtari(oturum), JSON.stringify(depo.current))
    } catch {
      /* depolama dolu ya da kapalıysa çizimler yalnızca bellekte kalır */
    }
  }

  const baslat = useCallback(
    (x: number, y: number) => {
      cizilen.current = { renk, kalinlik: silgi ? SILGI_KALINLIK : kalinlik, n: [x, y], silgi }
      ciz()
    },
    [renk, kalinlik, silgi, ciz],
  )
  const surdur = useCallback(
    (x: number, y: number) => {
      const v = cizilen.current
      if (!v) return
      const son = v.n.length
      if (Math.abs(v.n[son - 2] - x) + Math.abs(v.n[son - 1] - y) < 0.0015) return
      v.n.push(x, y)
      ciz()
    },
    [ciz],
  )
  const bitir = useCallback(() => {
    const v = cizilen.current
    cizilen.current = null
    if (!v) return
    // Çok uzun vuruşları seyrelt (depolama küçük kalsın)
    if (v.n.length > 400) v.n = v.n.filter((_, i) => Math.floor(i / 2) % 2 === 0 || i >= v.n.length - 2)
    depo.current[keyRef.current] = [...(depo.current[keyRef.current] ?? []), v]
    kaydet()
    yenile((x) => x + 1)
    ciz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciz])

  // Telefon kumandası: dokunmatik yüzey lazeri hareket ettirir
  useEffect(() => {
    const kanal = supabase.channel(lazerKanali(oturum), { config: { broadcast: { self: false } } })
    let basili = false
    kanal.on('broadcast', { event: 'lazer' }, ({ payload }) => {
      const p = payload as { x?: number; y?: number; d?: boolean } | null
      if (typeof p?.x !== 'number' || typeof p.y !== 'number') return
      const x = Math.max(0, Math.min(1, p.x))
      const y = Math.max(0, Math.min(1, p.y))
      // Kumanda dokunmatik yüzeyi kullanılınca lazer kendiliğinden açılır
      if (modRef.current === 'kapali') acRef.current()
      setNokta({ x, y })
      if (p.d && !basili) {
        basili = true
        baslat(x, y)
      } else if (p.d) surdur(x, y)
      else if (basili) {
        basili = false
        bitir()
      }
    })
    // Kumandadan komutlar: geri al, temizle, silgi, kalem rengi, karekodu gizle/göster, lazeri kapat
    kanal.on('broadcast', { event: 'komut' }, ({ payload }) => {
      const p = payload as { k?: string; r?: number } | null
      if (!p?.k) return
      if (p.k === 'kod') kodRef.current?.()
      else if (p.k === 'kapat') kapatRef.current()
      else komutRef.current(p.k, p.r)
    })
    kanal.subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [oturum, baslat, surdur, bitir])

  const geriAl = () => {
    depo.current[key] = (depo.current[key] ?? []).slice(0, -1)
    kaydet()
    yenile((x) => x + 1)
    ciz()
  }
  const temizle = () => {
    depo.current[key] = []
    kaydet()
    yenile((x) => x + 1)
    ciz()
  }

  komutRef.current = (k, r) => {
    if (k === 'geri') geriAl()
    else if (k === 'temizle') temizle()
    else if (k === 'silgi') setSilgi((x) => !x)
    else if (k === 'renk' && typeof r === 'number' && KALEM_RENKLERI[r]) {
      setRenk(KALEM_RENKLERI[r].renk)
      setSilgi(false)
    }
  }
  if (mod === 'kapali') return null
  const koordinat = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  return (
    <>
      <div className={`fixed inset-0 z-[70] ${mod === 'tahta' ? (kara ? 'bg-slate-900' : 'bg-white') : ''}`} style={{ cursor: mod === 'lazer' ? 'none' : 'crosshair' }}>
        <canvas
          ref={canvas}
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const k = koordinat(e)
            setNokta(k)
            baslat(k.x, k.y)
          }}
          onPointerMove={(e) => {
            const k = koordinat(e)
            setNokta(k)
            surdur(k.x, k.y)
          }}
          onPointerUp={bitir}
          onPointerCancel={bitir}
        />
        {mod === 'lazer' && nokta && (
          <span
            className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-red-500 pointer-events-none"
            style={{ left: `${nokta.x * 100}%`, top: `${nokta.y * 100}%`, boxShadow: '0 0 12px 6px rgba(239,68,68,0.7)' }}
            aria-hidden
          />
        )}
      </div>
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[71] cam-panel rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2 text-sm shadow-2xl">
        <b>{mod === 'tahta' ? '🖍️ Tahta' : '🔴 Lazer'}</b>
        {KALEM_RENKLERI.map((r) => (
          <button
            key={r.renk}
            aria-label={r.ad}
            title={r.ad}
            onClick={() => {
              setRenk(r.renk)
              setSilgi(false)
            }}
            className={`w-7 h-7 rounded-full border-2 ${renk === r.renk && !silgi ? 'border-white scale-110' : 'border-white/30'}`}
            style={{ background: r.renk }}
          />
        ))}
        {KALINLIKLAR.map((k) => (
          <button key={k} aria-label={`Kalınlık ${k}`} onClick={() => setKalinlik(k)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${kalinlik === k ? 'bg-white/25' : 'bg-white/10'}`}>
            <span className="rounded-full bg-white block" style={{ width: k + 2, height: k + 2 }} />
          </button>
        ))}
        <button className={silgi ? 'parlak-buton rounded-xl px-2 py-1' : 'ikincil-buton !py-1 !px-2'} onClick={() => setSilgi((s) => !s)}>
          🧽 Silgi
        </button>
        <button className="ikincil-buton !py-1 !px-2" onClick={geriAl}>
          ↶ Geri al
        </button>
        <button className="ikincil-buton !py-1 !px-2" onClick={temizle}>
          🗑 Temizle
        </button>
        {mod === 'tahta' && (
          <button className="ikincil-buton !py-1 !px-2" onClick={() => setKara((k) => !k)}>
            {kara ? '⬜ Beyaz tahta' : '⬛ Kara tahta'}
          </button>
        )}
        <button className="tehlike-buton !py-1 !px-2" onClick={kapat}>
          Kapat
        </button>
      </div>
      <p className="sr-only" data-anahtar={anahtar} />
    </>
  )
}
