import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { sesCal } from '../lib/ses'

/**
 * Oyuna özel final efektleri (GSAP). Her biri sahne kökünün içine konur, tıklamayı engellemez ve oyun bitince bir kez oynar.
 * Ortak podyum bunların ardından açılır.
 */

const RENKLER = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#c084fc']

/** Havai fişek: rastgele noktalarda patlayan parçacıklar. */
export function HavaiFisek({ patlama = 7 }: { patlama?: number }) {
  const kap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = kap.current
    if (!el) return
    const tl = gsap.timeline()
    for (let b = 0; b < patlama; b++) {
      tl.call(
        () => {
          const w = el.clientWidth
          const h = el.clientHeight
          const cx = w * (0.12 + Math.random() * 0.76)
          const cy = h * (0.1 + Math.random() * 0.42)
          const renk = RENKLER[Math.floor(Math.random() * RENKLER.length)]
          sesCal('whoosh')
          for (let i = 0; i < 16; i++) {
            const p = document.createElement('span')
            p.textContent = '✦'
            p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;color:${renk};font-size:${14 + Math.random() * 12}px;text-shadow:0 0 10px ${renk};pointer-events:none`
            el.appendChild(p)
            const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3
            const r = 70 + Math.random() * 110
            gsap.to(p, { x: Math.cos(a) * r, y: Math.sin(a) * r + 30, opacity: 0, scale: 0.3, duration: 1.1 + Math.random() * 0.5, ease: 'power2.out', onComplete: () => p.remove() })
          }
        },
        [],
        b * 0.7,
      )
    }
    return () => {
      tl.kill()
      el.replaceChildren()
    }
  }, [patlama])
  return <div ref={kap} className="pointer-events-none absolute inset-0 z-[90] overflow-hidden" aria-hidden />
}

/** Helikopter gelir, zirvedekileri alıp gider. */
export function Helikopter() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tl = gsap.timeline({ delay: 0.8 })
    tl.fromTo(el, { xPercent: 0, x: '110vw', y: '-5vh', opacity: 1 }, { x: '52vw', y: '14vh', duration: 2.4, ease: 'power2.out' })
      .to(el, { y: '17vh', duration: 0.5, yoyo: true, repeat: 5, ease: 'sine.inOut' })
      .to(el, { x: '-20vw', y: '2vh', duration: 2.2, ease: 'power2.in' })
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-[91] text-[9vh] leading-none opacity-0" aria-hidden>
      🚁
    </div>
  )
}

/** Zirveye bayrak dikme, kupa ve kalkan tokuşturma gibi büyük emojili vurgular. */
export function BuyukVurgu({ emoji, alt, konum = 'orta' }: { emoji: string; alt?: string; konum?: 'orta' | 'ust' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tl = gsap.timeline({ delay: 0.6 })
    tl.fromTo(el, { scale: 0.1, rotation: -25, opacity: 0, y: -80 }, { scale: 1, rotation: 0, opacity: 1, y: 0, duration: 1.1, ease: 'elastic.out(1,0.5)' }).to(el, { y: -10, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    sesCal('alkis')
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-[91] text-center ${konum === 'ust' ? 'top-[8%]' : 'top-[30%]'}`} aria-hidden>
      <div ref={ref} className="text-[16vh] leading-none opacity-0 drop-shadow-[0_0_30px_rgba(253,224,71,0.8)]">
        {emoji}
      </div>
      {alt && <p className="mt-1 text-2xl font-display font-extrabold text-amber-200 drop-shadow">{alt}</p>}
    </div>
  )
}

/** Kaybeden tarafa çamur sıçrar (halat). */
export function CamurSicrama({ taraf }: { taraf: 'sol' | 'sag' }) {
  const kap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = kap.current
    if (!el) return
    const parcalar = Array.from(el.querySelectorAll('span'))
    const tl = gsap.timeline({ delay: 0.5 })
    tl.fromTo(parcalar, { scale: 0, y: -40, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(2)' })
    sesCal('yanlis')
    return () => {
      tl.kill()
    }
  }, [])
  return (
    <div ref={kap} className={`pointer-events-none absolute bottom-[8%] z-[91] flex flex-wrap items-end justify-center gap-2 w-[46%] ${taraf === 'sol' ? 'left-[2%]' : 'right-[2%]'}`} aria-hidden>
      {['💦', '🟤', '💦', '🟤', '💦', '🟤', '💦'].map((e, i) => (
        <span key={i} className="text-[8vh] leading-none opacity-0">
          {e}
        </span>
      ))}
      <p className="w-full text-center text-2xl font-display font-extrabold text-amber-100 drop-shadow">Çamura düştüler!</p>
    </div>
  )
}

/** Evin ışıkları yanar: sıcak parıltı (orman). */
export function EvIsigi() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const t = gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 2, ease: 'power1.inOut', yoyo: true, repeat: -1 })
    return () => {
      t.kill()
    }
  }, [])
  return <div ref={ref} className="pointer-events-none absolute inset-0 z-[80] opacity-0" style={{ background: 'radial-gradient(circle at 80% 22%, rgba(251,191,36,0.45), transparent 38%)' }} aria-hidden />
}
