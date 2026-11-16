import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OYUN_OLAYI } from '../lib/oyun'
import { KURTULMA_ORANI, zombiHesapla, type ZombiDurumu, type ZombiOyuncuDurumu, type ZombiOyuncusu, type ZombiSorusu } from '../lib/zombi'
import Konfeti from './Konfeti'
import { useOyunSesi } from '../lib/ses'
import Gorsel, { adIndeksi, arkaPlan } from './Gorsel'
import { useRaund } from './Hareket'
import { Sinema, merkez, rastgele } from './Sinema'
import { sesCal } from '../lib/ses'

const ANAHTAR = (oturum: string) => `amfi_zombi_${oturum}`
const KARAKTERLER = ['🧑‍🎓', '👩‍🎓', '🧙', '🦸', '🥷', '🧑‍🚀', '👨‍🔬', '👩‍🎨', '🧝', '🕵️', '👩‍🚀', '🧑‍🍳', '🦹', '🤠', '👩‍🏫', '🧑‍🎤']

function karakter(ad: string): string {
  let h = 0
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0
  return KARAKTERLER[h % KARAKTERLER.length]
}

function oku(oturum: string): boolean {
  try {
    return localStorage.getItem(ANAHTAR(oturum)) === '1'
  } catch {
    return false
  }
}

/**
 * Zombi Kaçışı: sınıf piramidin zirvesine çıkmaya çalışır. Doğru cevap bir kat yükseltir; zombiler her soruda biraz
 * yaklaşır ve altında kalanı yakalar. Oyun sonunda sınıfın %60'ı yakalanmadan kalırsa sınıf kurtulur. Her öğrenci ilk adıyla
 * ayrı bir karakter olarak perdede görünür. Soru çözülürken kimsenin cevabı belli olmaz; sonuç açılınca karakterler yürür.
 */
export default function ZombiPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  const [acik, setAcik] = useState(() => oku(oturum))
  const [buyuk, setBuyuk] = useState(false)
  const [veri, setVeri] = useState<{ sorular: ZombiSorusu[]; oyuncular: ZombiOyuncusu[] } | null>(null)

  const yenile = useCallback(async () => {
    const { data } = await supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: anahtar })
    const v = data as { sorular?: ZombiSorusu[]; oyuncular?: ZombiOyuncusu[]; hata?: string } | null
    if (v?.sorular && v.oyuncular) setVeri({ sorular: v.sorular, oyuncular: v.oyuncular })
  }, [oturum, anahtar])

  // Oyun açık değilken sunucuya sorulmaz
  useEffect(() => {
    if (!acik) return
    yenile()
    const t = setInterval(yenile, 3500)
    return () => clearInterval(t)
  }, [yenile, acik])

  function ac(a: boolean) {
    setAcik(a)
    try {
      localStorage.setItem(ANAHTAR(oturum), a ? '1' : '0')
    } catch {
      // Depolama kapalıysa durum yalnızca bu açılışta tutulur
    }
  }

  useEffect(() => {
    function dinle(e: Event) {
      if ((e as CustomEvent<{ oyun: string }>).detail?.oyun === 'zombi') {
        ac(true)
        setBuyuk(true)
      } else {
        // Başka bir oyun seçildi ya da bireysele dönüldü: zombi kapanır
        ac(false)
        setBuyuk(false)
      }
    }
    window.addEventListener(OYUN_OLAYI, dinle)
    return () => window.removeEventListener(OYUN_OLAYI, dinle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oturum])

  const d = useMemo(() => (veri ? zombiHesapla(veri.sorular, veri.oyuncular) : null), [veri])
  const perde = mod === 'perde'
  if (!d) return null

  if (!acik) return null

  if (!perde) return <Ozet d={d} kapat={() => ac(false)} />

  return (
    <>
      {!buyuk && (
        <div className="fixed right-4 bottom-28 z-30 w-[min(22rem,90vw)]">
          <div className="cam-panel rounded-2xl p-3 space-y-2">
            <Ozet d={d} kapat={() => ac(false)} />
            <button className="parlak-buton rounded-xl px-3 py-1.5 text-sm font-bold w-full" onClick={() => setBuyuk(true)}>
              ⛶ Piramidi büyüt
            </button>
          </div>
        </div>
      )}
      {buyuk && <ZombiSahnesi d={d} kapat={() => setBuyuk(false)} />}
    </>
  )
}

function Ozet({ d, kapat }: { d: ZombiDurumu; kapat: () => void }) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <b>🧟 Zombi kaçışı</b>
        <span className="text-xs text-slate-400">
          soru {d.oynanan} / {d.toplamSoru}
        </span>
        <button className="ml-auto text-xs text-slate-500 hover:text-white" onClick={kapat} title="Zombi kaçışını gizle">
          ✕
        </button>
      </div>
      <p>
        Zirvede <b className="text-emerald-300">{d.zirvede}</b> · yakalanan <b className="text-rose-300">{d.yakalanan}</b> · kurtulan %{Math.round(d.kurtulanOrani * 100)} (hedef %{Math.round(KURTULMA_ORANI * 100)})
      </p>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-linear-to-r from-emerald-400 to-teal-300 transition-[width] duration-700" style={{ width: `${Math.round(d.kurtulanOrani * 100)}%` }} />
      </div>
      {d.bitti && <p className={d.kazandi ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{d.kazandi ? '🏆 Sınıf kurtuldu!' : '☠ Zombiler kazandı'}</p>}
    </div>
  )
}

/** Tam ekran sahne: piramit, karakterler ve zombi sürüsü. */
export function ZombiSahnesi({ d, kapat }: { d: ZombiDurumu; kapat: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, d.kazandi)
  const { aktif, raund } = useRaund(d.oynanan, 5000)
  const sisRef = useRef<HTMLDivElement>(null)
  const karakterRef = useRef<Map<number, HTMLDivElement>>(new Map())
  // Yeni soruda: sürüden zombiler koşup yakalanan oyuncuların üstüne atlar; piramidi çıkanlar yıldızla kutlanır
  useEffect(() => {
    if (raund === 0) return
    const s = new Sinema()
    void (async () => {
      await s.bekle(1100) // karakterler yeni katlarına yürüsün
      if (s.durdu) return
      const sis = merkez(sisRef.current)
      const yakalananlar = d.oyuncular.map((o, i) => ({ o, i })).filter((x) => x.o.durum === 'yakalandi' && x.o.bittigiSoru === d.oynanan).slice(0, 12)
      yakalananlar.forEach(({ i }, k) => {
        const p = merkez(karakterRef.current.get(i))
        if (!p) return
        const gecik = k * 160
        void s.ucur({ from: { x: (sis?.x ?? p.x) + rastgele(-180, 180), y: sis?.y ?? p.y + 60 }, to: p, resim: `zombi-${(k % 3) + 1}.webp`, emoji: '🧟', boyut: 64, sure: 700, gecik, yay: 50, olcek: 1.2 }).then(() => {
          if (s.durdu) return
          void s.patlama(p, { resim: 'efekt-yakalandi.webp', emoji: '💥', boyut: 90 })
          s.sars(karakterRef.current.get(i), { siddet: 10, sure: 600 })
          if (k === 0) sesCal('yanlis')
        })
      })
      d.oyuncular
        .map((o, i) => ({ o, i }))
        .filter((x) => x.o.durum === 'zirve' && x.o.bittigiSoru === d.oynanan)
        .slice(0, 10)
        .forEach(({ i }, k) => {
          const p = merkez(karakterRef.current.get(i))
          if (p) void s.patlama({ x: p.x, y: p.y - 30 }, { resim: 'efekt-kurtuldu.webp', emoji: '✨', boyut: 96, gecik: k * 120 })
        })
    })()
    return () => s.durdur()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raund])
  const kat = d.zirve
  const birim = 100 / (kat + 2) // yüzde cinsinden bir katın yüksekliği (zemin ve bayrak payı dahil)
  // Katlardaki oyuncuları yan yana diz: aynı seviyedekiler eşit aralıkla dağılır
  const gruplar = useMemo(() => {
    const m = new Map<string, ZombiOyuncuDurumu[]>()
    for (const o of d.oyuncular) {
      const anahtar = o.durum === 'yakalandi' ? `z${o.yakalandigiSeviye ?? 0}` : `c${o.seviye}`
      m.set(anahtar, [...(m.get(anahtar) ?? []), o])
    }
    return m
  }, [d.oyuncular])
  const kalabalik = d.oyuncular.length
  const boy = kalabalik > 90 ? 'text-lg' : kalabalik > 50 ? 'text-2xl' : kalabalik > 24 ? 'text-3xl' : 'text-4xl'
  const ad = kalabalik > 90 ? 'text-[8px]' : kalabalik > 50 ? 'text-[9px]' : 'text-[11px]'
  const gBoy = kalabalik > 90 ? 'w-6 h-6' : kalabalik > 50 ? 'w-9 h-9' : kalabalik > 24 ? 'w-12 h-12' : 'w-16 h-16'

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-sm flex flex-col p-3 sm:p-5 gap-3">
      {d.bitti && d.kazandi && <Konfeti />}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold zombi-baslik">🧟 Zombi Kaçışı</h2>
        <span className="text-slate-300 text-sm">
          Soru {d.oynanan} / {d.toplamSoru}
        </span>
        <span className="text-sm">
          Zirvede <b className="text-emerald-300 text-lg tabular-nums">{d.zirvede}</b>
        </span>
        <span className="text-sm">
          Yakalanan <b className="text-rose-300 text-lg tabular-nums">{d.yakalanan}</b>
        </span>
        <span className="text-xs text-slate-400">Kurtulmak için oyun sonunda sınıfın %{Math.round(KURTULMA_ORANI * 100)}'i yakalanmadan kalmalı ({d.kurtulan} kişi kurtuldu)</span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kapat}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden zombi-gokyuzu border border-white/10" style={arkaPlan('arka-zombi.webp')}>
        {/* Zemin */}
        <div className="absolute inset-x-0 bottom-0 zombi-zemin" style={{ height: `${birim}%` }} />
        {/* Piramit katları: yukarı çıktıkça daralır */}
        {Array.from({ length: kat }, (_, i) => {
          const t = i + 1
          const genislik = 94 - ((t - 1) / kat) * 70
          return (
            <div
              key={t}
              className={`absolute left-1/2 -translate-x-1/2 zombi-kat ${t === kat ? 'zombi-kat-zirve' : ''}`}
              style={{ bottom: `${t * birim}%`, height: `${birim}%`, width: `${genislik}%` }}
              aria-label={`${t}. kat`}
            />
          )
        })}
        {/* Zirve bayrağı */}
        <div className="absolute left-1/2 -translate-x-1/2 text-5xl zombi-bayrak" style={{ bottom: `${(kat + 1) * birim}%` }} aria-hidden>
          🏁
        </div>
        {/* Zombi sürüsü: seviyeye kadar yeşil sis, kenarında zombiler */}
        <div
          ref={sisRef}
          className="absolute inset-x-0 bottom-0 zombi-sis transition-[height] duration-1000 ease-out"
          style={{ height: `${Math.min(kat, d.zombiSeviyesi + 1) * birim}%` }}
        >
          <div className="absolute inset-x-0 top-0 flex justify-around text-4xl -translate-y-1/2 zombi-yuru" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${i * 180}ms` }}>
                <Gorsel ad={`zombi-${(i % 3) + 1}.webp`} emoji="🧟" className="w-14 h-14 sm:w-20 sm:h-20" emojiClass="text-4xl" />
              </span>
            ))}
          </div>
        </div>
        {/* Karakterler */}
        {[...gruplar.entries()].map(([anahtar, liste]) => {
          const zombi = anahtar.startsWith('z')
          const seviye = Number(anahtar.slice(1))
          return liste.map((o, i) => {
            const sol = ((i + 0.5) / liste.length) * (90 - Math.min(60, (seviye / kat) * 60)) + 5 + (Math.min(60, (seviye / kat) * 60) / 2)
            const altta = (seviye + (zombi ? 0.1 : 0.55)) * birim
            return (
              <div
                key={`${o.ad}-${i}`}
                ref={(el) => {
                  const gi = d.oyuncular.indexOf(o)
                  if (el) karakterRef.current.set(gi, el)
                  else karakterRef.current.delete(gi)
                }}
                className={`absolute -translate-x-1/2 text-center leading-none transition-all duration-1000 ease-out ${zombi ? 'zombi-yakalanan' : o.durum === 'zirve' ? 'zombi-zirvede' : 'zombi-yuruyen'} ${aktif && !zombi && o.son === 1 ? 'zombi-zipla' : ''}`}
                style={{ left: `${Math.max(4, Math.min(96, sol))}%`, bottom: `${altta}%` }}
                title={o.ad}
              >
                {aktif && zombi && o.bittigiSoru === d.oynanan && <Gorsel ad="efekt-yakalandi.webp" emoji="💥" className="ej-patla absolute inset-0 m-auto w-24 h-24 pointer-events-none z-10" emojiClass="ej-patla absolute inset-0 text-4xl" />}
                {aktif && !zombi && o.durum === 'zirve' && o.bittigiSoru === d.oynanan && <Gorsel ad="efekt-kurtuldu.webp" emoji="✨" className="ej-patla absolute inset-0 m-auto w-24 h-24 pointer-events-none z-10" emojiClass="ej-patla absolute inset-0 text-4xl" />}
                <div className={boy}>{zombi ? <Gorsel ad={`zombi-${adIndeksi(o.ad, 3)}.webp`} emoji="🧟" className={gBoy} emojiClass={boy} /> : <Gorsel ad={`ogrenci-${adIndeksi(o.ad, 8)}.webp`} emoji={karakter(o.ad)} className={gBoy} emojiClass={boy} />}</div>
                <div className={`${ad} font-bold px-1 rounded bg-slate-950/70 whitespace-nowrap max-w-20 truncate ${zombi ? 'text-rose-300' : o.durum === 'zirve' ? 'text-amber-200' : 'text-white'}`}>{o.ad}</div>
              </div>
            )
          })
        })}
        {d.bitti && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px]">
            <div className="cam-panel rounded-[2rem] p-8 text-center space-y-2 girdi">
              <p className="text-7xl">{d.kazandi ? '🏆' : '☠️'}</p>
              <p className="text-4xl font-display font-extrabold">{d.kazandi ? 'Sınıf kurtuldu!' : 'Zombiler kazandı'}</p>
              <p className="text-slate-300">
                {d.zirvede} / {d.oyuncular.length} öğrenci zirveye çıktı (%{Math.round(d.oran * 100)})
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 text-center">Doğru cevap bir kat yükseltir. Zombiler her soruda yaklaşır; altında kalan yakalanır. Cevap vermeyen yerinde kalır.</p>
    </div>
  )
}
