import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OYUN_OLAYI } from '../lib/oyun'
import { KURTULMA_ORANI, zombiHesapla, type ZombiDurumu, type ZombiOyuncuDurumu, type ZombiOyuncusu, type ZombiSorusu } from '../lib/zombi'
import Konfeti from './Konfeti'
import { useOyunSesi } from '../lib/ses'

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
 * yaklaşır ve altında kalanı yakalar. Oyun sonunda öğrencilerin %70'i zirvedeyse sınıf kurtulur. Her öğrenci ilk adıyla
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
        Zirvede <b className="text-emerald-300">{d.zirvede}</b> · yakalanan <b className="text-rose-300">{d.yakalanan}</b> · hedef %{Math.round(KURTULMA_ORANI * 100)}
      </p>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-linear-to-r from-emerald-400 to-teal-300 transition-[width] duration-700" style={{ width: `${Math.round(d.oran * 100)}%` }} />
      </div>
      {d.bitti && <p className={d.kazandi ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>{d.kazandi ? '🏆 Sınıf kurtuldu!' : '☠ Zombiler kazandı'}</p>}
    </div>
  )
}

/** Tam ekran sahne: piramit, karakterler ve zombi sürüsü. */
export function ZombiSahnesi({ d, kapat }: { d: ZombiDurumu; kapat: () => void }) {
  useOyunSesi(d.oynanan, d.bitti, d.kazandi)
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
        <span className="text-xs text-slate-400">Kurtulmak için sınıfın %{Math.round(KURTULMA_ORANI * 100)}'i zirveye çıkmalı</span>
        <button className="ikincil-buton ml-auto !py-1.5" onClick={kapat}>
          Küçült
        </button>
      </div>
      <div className="relative flex-1 min-h-0 rounded-3xl overflow-hidden zombi-gokyuzu border border-white/10">
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
          className="absolute inset-x-0 bottom-0 zombi-sis transition-[height] duration-1000 ease-out"
          style={{ height: `${Math.min(kat, d.zombiSeviyesi + 1) * birim}%` }}
        >
          <div className="absolute inset-x-0 top-0 flex justify-around text-4xl -translate-y-1/2 zombi-yuru" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${i * 180}ms` }}>
                🧟
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
                className={`absolute -translate-x-1/2 text-center leading-none transition-all duration-1000 ease-out ${zombi ? 'zombi-yakalanan' : o.durum === 'zirve' ? 'zombi-zirvede' : 'zombi-yuruyen'}`}
                style={{ left: `${Math.max(4, Math.min(96, sol))}%`, bottom: `${altta}%` }}
                title={o.ad}
              >
                <div className={boy}>{zombi ? '🧟' : karakter(o.ad)}</div>
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
