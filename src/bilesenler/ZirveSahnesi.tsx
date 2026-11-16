import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import Gorsel from './Gorsel'
import Konfeti from './Konfeti'
import { GUVENLI_ARALIK, type MerdivenDurumu } from '../lib/merdiven'
import { sesCal, useOyunSesi } from '../lib/ses'
import type { SoruJokerleri } from './MerdivenPaneli'

/**
 * Zirveye Tırmanış: sınıf bir tırmanış ekibidir. Dağın eteğinden zirveye kıvrılan patikada kamplar sıralanır;
 * 5, 10, ... kamplar güvenlidir (bayraklı çadır). Ekip patika boyunca yürür, çığda son güvenli kampa kayar.
 * Hareket GSAP zaman çizelgeleriyle akar; boşta ekip nefes alır, kar yağar, yükseldikçe hava kararır.
 */

// 1000 x 600 kutuda, dağın içinde kalan dolambaçlı patika (soldan alttan zirveye)
const YOL =
  'M 90 570 C 260 575, 450 575, 560 520 S 330 470, 420 430 S 720 430, 680 370 S 500 340, 590 290 S 780 270, 730 210 S 640 170, 700 130 S 760 100, 782 66'
const DAG = '0,600 0,430 160,340 300,370 480,230 640,130 790,48 900,170 1000,300 1000,600'
const KAR_BOLGESI = '640,130 790,48 900,170 820,150 760,110'

const JOKER_ADLARI: Record<string, string> = {
  yarim: '✂ Kestirme yol: telefonlarda 2 yanlış şık silindi',
  seyirci: '📻 Telsizle şerpaya soruldu: seyirci dağılımı açıldı',
  sure: '🫁 Oksijen tüpü: +15 saniye',
}

interface Nokta {
  x: number
  y: number
}

export default function ZirveSahnesi({ d, sonSonuc, jokerler, sonOran }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null; jokerler?: SoruJokerleri; sonOran: number | null }) {
  const n = Math.max(1, d.toplam)
  useOyunSesi(d.gecmis.length, d.kazandi, true)
  const yolRef = useRef<SVGPathElement>(null)
  const grupRef = useRef<HTMLDivElement>(null)
  const bobRef = useRef<HTMLDivElement>(null)
  const sarsRef = useRef<HTMLDivElement>(null)
  const cigRef = useRef<HTMLDivElement>(null)
  const bayrakRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const konum = useRef({ b: d.basamak })
  const [noktalar, setNoktalar] = useState<Nokta[]>([])
  const [giris, setGiris] = useState(d.gecmis.length === 0)
  const [toast, setToast] = useState<string | null>(null)
  const oncekiJoker = useRef<string[]>(jokerler?.kullanilan ?? [])

  // Kamp konumları patikanın üzerinde eşit aralıkla
  useLayoutEffect(() => {
    const p = yolRef.current
    if (!p) return
    const L = p.getTotalLength()
    setNoktalar(
      Array.from({ length: n + 1 }, (_, i) => {
        const q = p.getPointAtLength((L * i) / n)
        return { x: q.x, y: q.y }
      }),
    )
  }, [n])

  function yerlestir(b: number) {
    const p = yolRef.current
    const g = grupRef.current
    if (!p || !g) return
    const L = p.getTotalLength()
    const q = p.getPointAtLength((L * Math.max(0, Math.min(n, b))) / n)
    g.style.left = `${q.x / 10}%`
    g.style.top = `${q.y / 6}%`
  }

  // Basamak değişince ekip patika boyunca yürür ya da çığda kayar
  useEffect(() => {
    const hedef = d.basamak
    if (hedef === konum.current.b) {
      yerlestir(hedef)
      return
    }
    const dustu = hedef < konum.current.b
    sesCal(dustu ? 'yanlis' : 'dogru')
    const tl = gsap.timeline()
    if (dustu) {
      tl.fromTo(cigRef.current, { opacity: 0, xPercent: 70, yPercent: -70, scale: 0.6 }, { opacity: 1, xPercent: -10, yPercent: 15, scale: 1.6, duration: 0.9, ease: 'power2.in' }, 0)
        .to(sarsRef.current, { rotation: -16, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.3)
        .to(konum.current, { b: hedef, duration: 1.1, ease: 'power3.in', onUpdate: () => yerlestir(konum.current.b) }, 0.5)
        .to(cigRef.current, { opacity: 0, duration: 0.7 }, '>-0.2')
        .to(sarsRef.current, { rotation: 0, duration: 0.3 })
    } else {
      tl.to(sarsRef.current, { y: -10, duration: 0.18, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
        .to(konum.current, { b: hedef, duration: 1.6, ease: 'power2.inOut', onUpdate: () => yerlestir(konum.current.b) }, 0)
        .to(sarsRef.current, { y: 0, duration: 0.2 })
    }
    return () => {
      tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.basamak, n])

  // İlk çizimde ve kamp konumları hazır olunca ekip yerine konur
  useEffect(() => {
    yerlestir(konum.current.b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noktalar])

  // Boşta yaşam: ekip nefes alır
  useEffect(() => {
    const t = gsap.to(bobRef.current, { y: -4, scaleY: 1.03, transformOrigin: '50% 100%', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    return () => {
      t.kill()
    }
  }, [])

  // Zirve: bayrak dikilir
  useEffect(() => {
    if (!d.kazandi || !bayrakRef.current) return
    const t = gsap.fromTo(bayrakRef.current, { scale: 0.2, rotation: -30, opacity: 0 }, { scale: 1.6, rotation: 0, opacity: 1, duration: 1, ease: 'elastic.out(1,0.5)' })
    return () => {
      t.kill()
    }
  }, [d.kazandi])

  // Joker kullanılınca kısa animasyon
  useEffect(() => {
    const k = jokerler?.kullanilan ?? []
    const yeni = k.find((x) => !oncekiJoker.current.includes(x))
    oncekiJoker.current = k
    if (yeni && JOKER_ADLARI[yeni]) setToast(JOKER_ADLARI[yeni])
  }, [jokerler?.kullanilan])
  useEffect(() => {
    if (!toast || !toastRef.current) return
    const tl = gsap.timeline({ onComplete: () => setToast(null) })
    tl.fromTo(toastRef.current, { y: 40, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }).to(toastRef.current, { opacity: 0, y: -20, duration: 0.5, delay: 2.4 })
    return () => {
      tl.kill()
    }
  }, [toast])

  // 10 saniyelik "Nasıl oynanır"
  useEffect(() => {
    if (!giris) return
    const t = setTimeout(() => setGiris(false), 10000)
    return () => clearTimeout(t)
  }, [giris])

  const ilerleme = d.basamak / n
  const kar = useMemo(() => Array.from({ length: 48 }, (_, i) => ({ sol: (i * 37) % 100, gecikme: -((i * 0.73) % 6), sure: 5 + ((i * 7) % 5), boy: 3 + (i % 4) })), [])
  const karSayisi = Math.round(10 + ilerleme * 38)
  const guvenliKamp = (b: number) => b % GUVENLI_ARALIK === 0

  return (
    <div className="relative mx-auto overflow-hidden rounded-3xl border border-white/10 [container-type:inline-size]" style={{ aspectRatio: '5 / 3', width: 'min(100%, calc(min(58vh, 34rem) * 5 / 3))', background: 'linear-gradient(to top, #1e1b4b, #312e81 45%, #0ea5e9 130%)' }}>
      {/* gökyüzü: yükseldikçe kararır */}
      <div className="absolute inset-0 bg-slate-950 pointer-events-none transition-opacity duration-[1500ms]" style={{ opacity: 0.05 + ilerleme * 0.5 }} aria-hidden />
      <svg viewBox="0 0 1000 600" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="dagrenk" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#14532d" />
            <stop offset="0.45" stopColor="#57534e" />
            <stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        <polygon points={DAG} fill="url(#dagrenk)" stroke="#0f172a" strokeWidth="5" strokeLinejoin="round" />
        <polygon points={KAR_BOLGESI} fill="#f8fafc" opacity="0.9" />
        <path d={YOL} fill="none" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" opacity="0.5" />
        <path ref={yolRef} d={YOL} fill="none" stroke="#fde68a" strokeWidth="9" strokeLinecap="round" strokeDasharray="2 14" />
      </svg>

      {/* kamplar */}
      {noktalar.slice(1).map((q, i) => {
        const b = i + 1
        const cikildi = b <= d.basamak
        const guvenli = guvenliKamp(b)
        return (
          <div key={b} className="absolute -translate-x-1/2 -translate-y-1/2 text-center leading-none" style={{ left: `${q.x / 10}%`, top: `${q.y / 6}%` }}>
            <span className={guvenli ? 'text-[3.6cqw]' : 'text-[2cqw] opacity-80'}>{guvenli ? '⛺' : '🔸'}</span>
            {guvenli && <span className="absolute -top-[1.6cqw] left-1/2 text-[2cqw]">🚩</span>}
            <span className={`block text-[1.3cqw] font-bold tabular-nums ${cikildi ? 'text-emerald-300' : guvenli ? 'text-amber-300' : 'text-white/50'}`}>{b}</span>
          </div>
        )
      })}

      {/* zirve bayrağı */}
      <div ref={bayrakRef} className="absolute -translate-x-1/2 -translate-y-full text-[4cqw] leading-none" style={{ left: '78.2%', top: '10%', opacity: d.kazandi ? 1 : 0.55 }}>
        🚩
      </div>
      {d.kazandi && <Konfeti />}

      {/* ekip */}
      <div ref={grupRef} className="absolute -translate-x-1/2 -translate-y-[85%] z-10" style={{ left: '9%', top: '95%' }}>
        <div ref={sarsRef}>
          <div ref={bobRef} className="flex flex-col items-center">
            {sonOran !== null && sonSonuc && (
              <span className={`mb-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[1.5cqw] font-bold ${sonSonuc === 'dustu' ? 'bg-rose-500/80 border-rose-200/40' : 'bg-emerald-500/80 border-emerald-200/40'}`}>
                {sonSonuc === 'dustu' ? `Çığ! Sınıfın %${sonOran}'i bildi` : `Sınıfın %${sonOran}'i bildi`}
              </span>
            )}
            <div className="flex items-end -space-x-[1.2cqw]">
              {[1, 2, 3, 4, 5].map((k) => (
                <Gorsel key={k} ad={`ogrenci-${k}.webp`} emoji="🧗" className="w-[5cqw] h-[5cqw] drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" emojiClass="text-[3cqw]" />
              ))}
            </div>
            <span className="mt-0.5 rounded-full bg-black/60 border border-white/15 px-2 text-[1.4cqw] font-bold">Sınıf · {d.basamak}. kamp</span>
          </div>
        </div>
      </div>

      {/* çığ */}
      <div ref={cigRef} className="absolute left-[42%] top-[25%] text-[14cqw] leading-none pointer-events-none opacity-0 z-20" aria-hidden>
        🌨️
      </div>

      {/* kar */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {kar.slice(0, karSayisi).map((k, i) => (
          <span key={i} className="kar-tanesi absolute -top-4 rounded-full bg-white/80" style={{ left: `${k.sol}%`, width: k.boy, height: k.boy, animationDelay: `${k.gecikme}s`, animationDuration: `${k.sure - ilerleme * 2}s` }} />
        ))}
      </div>

      {/* joker */}
      {toast && (
        <div ref={toastRef} className="absolute left-1/2 top-[6%] -translate-x-1/2 z-30 rounded-2xl bg-amber-400 text-slate-950 px-4 py-2 font-bold text-[1.8cqw] whitespace-nowrap shadow-xl">
          {toast}
        </div>
      )}

      {/* nasıl oynanır: ilk 10 saniye */}
      {giris && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-[2px] p-[3cqw]" onClick={() => setGiris(false)}>
          <div className="cam-panel rounded-3xl p-[2.5cqw] max-w-[70cqw] space-y-[1cqw] text-[1.9cqw]">
            <p className="font-display font-extrabold text-[2.8cqw]">⛰ Zirveye Tırmanış: nasıl oynanır?</p>
            <ul className="list-disc pl-[2.5cqw] space-y-[0.6cqw] text-slate-200">
              <li>Sınıf bir tırmanış ekibidir; zirveye {n} kamp var.</li>
              <li>Her soruda sınıfın en az %{d.esik}'i doğru bilirse ekip bir kamp yukarı çıkar.</li>
              <li>Bilemezse çığ düşer, ekip son güvenli kampa (⛺ bayraklı) kayar.</li>
              <li>Üç eşya: ✂ Kestirme yol, 📻 Telsizle şerpaya sor, 🫁 Oksijen tüpü.</li>
            </ul>
            <p className="text-[1.4cqw] text-slate-400">Başlamak için dokun ya da 10 saniye bekle.</p>
          </div>
        </div>
      )}
    </div>
  )
}
