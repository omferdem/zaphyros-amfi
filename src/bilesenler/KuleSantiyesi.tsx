import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import Konfeti from './Konfeti'
import { HavaiFisek } from './FinalEfekti'
import Gorsel, { arkaPlan, gorselAdresi } from './Gorsel'
import { takimBilgisi } from '../lib/takim'
import { sesCal, useOyunSesi } from '../lib/ses'
import type { KuleDurumu } from '../lib/kule'

/** Birimler sahnenin yüksekliğine (cqh) göre: blok görseli en-boy oranı bozulmadan, sabit yükseklikte durur. */
const BH = 7.5
const ZEMIN = 13

/**
 * Kule yarışı: her takımın kendi şantiyesi. Bloklar gerçek görselleriyle sabit boyutta üst üste biner; kule yükseldikçe
 * kamera yukarı kayar (bloklar küçülmez). Yeni bloklar gökten iner, toz kalkar; rüzgâr kuralı işleyince üst blok sallanıp düşer.
 */
export function KuleSantiyesi({ d, kucult }: { d: KuleDurumu; kucult: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, true, 'kule')
  const satirlar = [...d.satirlar].sort((a, b) => a.takim - b.takim)
  const sahneRef = useRef<HTMLDivElement>(null)
  const dunyaRef = useRef<HTMLDivElement>(null)
  const gokRef = useRef<HTMLDivElement>(null)
  const blokRef = useRef(new Map<string, HTMLImageElement>())
  const siteRef = useRef(new Map<number, HTMLDivElement>())
  const onceki = useRef<Map<number, number> | null>(null)
  const kameraIlk = useRef(true)
  const ipler = useRef(new Map<HTMLElement, HTMLElement>()).current

  const enYuksek = Math.max(0, ...satirlar.map((s) => Math.min(d.hedef, s.katlar)))
  // Lider kulenin tepesi sahnenin %80'inde kalacak şekilde kamera kayar
  const kayma = Math.max(0, ZEMIN + enYuksek * BH + 20 - 100)

  useEffect(() => {
    const dunya = dunyaRef.current
    if (!dunya) return
    if (kameraIlk.current) {
      kameraIlk.current = false
      gsap.set(dunya, { yPercent: kayma })
      gsap.set(gokRef.current, { yPercent: kayma * 0.25 })
      return
    }
    const t = gsap.to(dunya, { yPercent: kayma, duration: 1.8, ease: 'power2.inOut', delay: 0.4 })
    const g = gsap.to(gokRef.current, { yPercent: kayma * 0.25, duration: 1.8, ease: 'power2.inOut', delay: 0.4 })
    return () => {
      t.kill()
      g.kill()
    }
  }, [kayma])

  // Blok gelişi ve düşüşü
  useEffect(() => {
    const yeni = new Map(satirlar.map((s) => [s.takim, Math.min(d.hedef, s.katlar)]))
    const eski = onceki.current
    onceki.current = yeni
    if (!eski) return
    const H = sahneRef.current?.clientHeight ?? 500
    const cqh = H / 100
    const tweens: gsap.core.Animation[] = []
    for (const s of satirlar) {
      const kat = yeni.get(s.takim) ?? 0
      const onc = eski.get(s.takim) ?? 0
      const site = siteRef.current.get(s.takim)
      if (kat > onc) {
        for (let k = onc; k < kat; k++) {
          const el = blokRef.current.get(`${s.takim}-${k}`)
          if (!el) continue
          const sira = k - onc
          gsap.set(el, { opacity: 0 })
          tweens.push(
            gsap.fromTo(
              el,
              { y: -(H * 0.9), opacity: 1, rotation: sira % 2 ? 4 : -4 },
              {
                y: 0,
                rotation: 0,
                duration: 0.8,
                delay: 0.5 + sira * 0.55,
                ease: 'bounce.out',
                onStart: () => {
                  gsap.set(el, { opacity: 1 })
                  // Vinç halatı: bloğu yukarıdan indirir (halat kancadan bloğun tepesine uzanır)
                  if (!site) return
                  const ip = document.createElement('span')
                  ip.style.cssText = 'position:absolute;left:40%;top:0;width:2px;background:#e2e8f0;box-shadow:0 0 4px rgba(0,0,0,.5);pointer-events:none;transform:translateX(-50%)'
                  const kanca = document.createElement('span')
                  kanca.textContent = '🪝'
                  kanca.style.cssText = 'position:absolute;left:0;bottom:-10px;font-size:14px;line-height:1;transform:translateX(-50%)'
                  ip.appendChild(kanca)
                  site.appendChild(ip)
                  ipler.set(el, ip)
                },
                onUpdate: () => {
                  const ip = ipler.get(el)
                  if (!ip || !site) return
                  ip.style.height = `${Math.max(0, el.getBoundingClientRect().top - site.getBoundingClientRect().top)}px`
                },
                onComplete: () => {
                  ipler.get(el)?.remove()
                  ipler.delete(el)
                  sesCal('tik')
                  if (!site) return
                  // toz bulutu
                  const toz = document.createElement('span')
                  toz.textContent = '💨'
                  toz.style.cssText = `position:absolute;left:50%;bottom:${ZEMIN + k * BH - 1}cqh;font-size:${BH * 0.9}cqh;pointer-events:none;transform:translateX(-50%)`
                  site.appendChild(toz)
                  gsap.fromTo(toz, { scale: 0.4, opacity: 0.9 }, { scale: 1.8, opacity: 0, duration: 0.7, ease: 'power1.out', onComplete: () => toz.remove() })
                },
              },
            ),
          )
        }
      } else if (kat < onc && site) {
        // Rüzgâr: en üst blok sallanır ve düşer
        const dusen = document.createElement('img')
        dusen.src = gorselAdresi(`blok-${s.takim}.webp`)
        dusen.alt = ''
        dusen.style.cssText = `position:absolute;left:50%;bottom:${ZEMIN + kat * BH}cqh;height:${BH}cqh;transform:translateX(-50%);pointer-events:none`
        site.appendChild(dusen)
        const ruzgar = document.createElement('span')
        ruzgar.textContent = '🌬️'
        ruzgar.style.cssText = `position:absolute;left:10%;bottom:${ZEMIN + kat * BH}cqh;font-size:${BH * 1.6}cqh;pointer-events:none`
        site.appendChild(ruzgar)
        sesCal('whoosh')
        const tl = gsap.timeline({ onComplete: () => { dusen.remove(); ruzgar.remove() } })
        tl.fromTo(ruzgar, { x: -20, opacity: 0 }, { x: 40, opacity: 1, duration: 0.6 })
          .to(dusen, { rotation: 6, duration: 0.1, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.1)
          .to(dusen, { x: 40 * (cqh / 5), y: 80 * cqh, rotation: 70, opacity: 0, duration: 1, ease: 'power2.in' })
          .to(ruzgar, { opacity: 0, duration: 0.4 }, '<')
        tweens.push(tl)
      }
    }
    return () => {
      // Yeni veri gelince süren animasyonlar bitirilir (bloklar yerine oturur)
      tweens.forEach((t) => t.progress(1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])

  const genislik = `${Math.min(24, 92 / Math.max(1, satirlar.length))}%`

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col p-3 sm:p-5 pb-24 gap-3">
      {d.bitti && (
        <>
          <Konfeti />
          <HavaiFisek />
        </>
      )}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold kule-baslik">🏗️ Kule Yarışı</h2>
        <span className="text-sm text-slate-300">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm text-slate-300">Hedef: {d.hedef} blok (doğru oranı 3 bloğa kadar kazandırır)</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kucult}>
          Küçült
        </button>
      </div>

      <div ref={sahneRef} className="relative flex-1 min-h-0 rounded-3xl overflow-hidden border border-white/10" style={{ containerType: 'size', ...arkaPlan('arka-kule.webp') }}>
        <div ref={gokRef} className="absolute inset-0 pointer-events-none" aria-hidden />
        {/* hedef çizgisi */}
        <div className="absolute inset-x-4 border-t-2 border-dashed border-amber-300/40 pointer-events-none z-10" style={{ top: `${100 - (ZEMIN + d.hedef * BH + 20 - kayma)}cqh`, transition: 'top 1.8s' }} aria-hidden>
          <span className="absolute right-0 -top-5 text-xs text-amber-200">🏁 {d.hedef} blok</span>
        </div>
        <div ref={dunyaRef} className="absolute inset-0">
          <div className="absolute inset-x-0 bottom-0" style={{ height: `${ZEMIN}cqh`, backgroundImage: `url("${gorselAdresi('kule-zemin.webp')}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-x-[2%] top-0 bottom-0 flex justify-around">
            {satirlar.map((s) => {
              const kat = Math.min(d.hedef, s.katlar)
              const lider = s.sira === 1 && s.blok > 0
              const kazandi = d.bitti && d.kazanan === s.takim
              const alkis = d.bitti && !kazandi
              return (
                <div
                  key={s.takim}
                  ref={(el) => {
                    if (el) siteRef.current.set(s.takim, el)
                  }}
                  className="relative h-full"
                  style={{ width: genislik }}
                >
                  {/* vinç */}
                  <div className="absolute" style={{ right: '4%', bottom: `${ZEMIN}cqh`, width: '1.2cqh', height: `${(d.hedef + 1) * BH}cqh`, background: 'repeating-linear-gradient(135deg,#f59e0b 0 6px,#78350f 6px 12px)' }} aria-hidden />
                  <div className="absolute origin-top" style={{ right: '4%', bottom: `${ZEMIN + (d.hedef + 1) * BH}cqh`, width: '60%', height: '1cqh', background: '#f59e0b' }} aria-hidden>
                    <span className="absolute left-0 top-full w-px bg-slate-300" style={{ height: `${BH * 1.2}cqh` }} />
                  </div>
                  {/* blok kulesi */}
                  {Array.from({ length: kat }, (_, k) => (
                    <img
                      key={k}
                      ref={(el) => {
                        if (el) blokRef.current.set(`${s.takim}-${k}`, el)
                      }}
                      src={gorselAdresi(`blok-${s.takim}.webp`)}
                      alt=""
                      draggable={false}
                      className="absolute select-none"
                      style={{ left: '40%', transform: 'translateX(-50%)', bottom: `${ZEMIN + k * BH}cqh`, height: `${BH}cqh`, width: 'auto' }}
                    />
                  ))}
                  {lider && !d.bitti && (
                    <div className="absolute text-[6cqh] leading-none kule-tac" style={{ left: '40%', transform: 'translateX(-50%)', bottom: `${ZEMIN + kat * BH}cqh` }} aria-hidden>
                      👑
                    </div>
                  )}
                  {kazandi && (
                    <div className="absolute text-[9cqh] leading-none pop" style={{ left: '40%', transform: 'translateX(-30%)', bottom: `${ZEMIN + kat * BH}cqh` }} aria-hidden>
                      🚩
                    </div>
                  )}
                  {/* işçiler */}
                  <div className="absolute flex items-end -space-x-[1cqh]" style={{ left: '8%', bottom: `${ZEMIN - 4}cqh` }}>
                    {[0, 1, 2].map((i) => (
                      <Gorsel key={i} ad={`ogrenci-${((s.takim * 3 + i) % 8) + 1}.webp`} emoji="👷" className="h-[11cqh] w-auto drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" emojiClass="text-[5cqh]" />
                    ))}
                  </div>
                  {alkis && (
                    <span className="absolute text-[5cqh] animate-bounce" style={{ left: '12%', bottom: `${ZEMIN + 5}cqh` }} aria-hidden>
                      👏
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* etiketler ve yükseklik çubukları: kamerayla kaymaz */}
        <div className="absolute inset-x-[2%] bottom-1 flex justify-around z-20 pointer-events-none">
          {satirlar.map((s) => {
            const b = takimBilgisi(s.takim)
            const kat = Math.min(d.hedef, s.katlar)
            return (
              <div key={s.takim} className="flex flex-col items-center gap-0.5" style={{ width: genislik }}>
                <div className="h-1.5 w-[70%] rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div className="h-full rounded-full transition-[width] duration-[1500ms] ease-out" style={{ width: `${(kat / d.hedef) * 100}%`, background: 'linear-gradient(90deg,#fbbf24,#f97316)' }} />
                </div>
                <p className="rounded-full bg-slate-950/85 border border-white/15 px-3 py-0.5 text-xs sm:text-sm font-bold whitespace-nowrap">
                  {b.emoji} {b.ad} <span className="text-slate-400 font-normal">({s.uye} kişi · {kat}/{d.hedef})</span>
                </p>
              </div>
            )
          })}
        </div>

        {d.bitti && d.kazanan !== null && (
          <div className="absolute inset-x-0 top-[6%] flex justify-center z-30 pointer-events-none">
            <div className="cam-panel rounded-3xl px-8 py-3 text-center girdi">
              <p className="text-3xl font-display font-extrabold">
                🏆 {takimBilgisi(d.kazanan).emoji} {takimBilgisi(d.kazanan).ad} takım kazandı!
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 text-center">Her soruda takımın doğru oranı 0-3 blok getirir; takımın yarısından fazlası yanlış yaparsa rüzgâr üst bloğu düşürür.</p>
    </div>
  )
}
