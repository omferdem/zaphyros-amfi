import { useEffect, useRef, useState } from 'react'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { GRUPLU_OYUNLAR } from '../lib/oyunAc'
import { ilkAd } from '../lib/oyunMotoru'
import { sesCal } from '../lib/ses'
import { supabase } from '../lib/supabase'
import type { PuanSatiri } from '../lib/tipler'
import Konfeti from './Konfeti'

const takimliMi = (mod: OyunAnahtari | null) => mod === 'halat' || (mod !== null && GRUPLU_OYUNLAR.includes(mod))
const TAKIM_RENKLERI = ['text-ze-pink', 'text-ze-cyan', 'text-ze-yellow', 'text-ze-lime', 'text-purple-300', 'text-orange-300']

/** Oyun başlamadan önceki bekleme ekranı: katılanlar, takımlar, dağıtma düğmeleri, 3-2-1 ve kural. */
export function Lobi({
  oturumId,
  mod,
  paketAdi,
  soruSayisi,
  sureDk,
  cevrimici,
  adlar = [],
  basla,
  iptal,
}: {
  oturumId: string
  mod: OyunAnahtari | null
  paketAdi: string
  soruSayisi: number
  sureDk: number | null
  cevrimici: number
  /** Yoklamadan gelen katılımcı adları (bireysel modda balonlarda görünür) */
  adlar?: string[]
  basla: () => Promise<void>
  iptal: () => void
}) {
  const takimli = takimliMi(mod)
  const [takimlar, setTakimlar] = useState<{ takim: number; adlar: string[] }[]>([])
  const [takimSayisi, setTakimSayisi] = useState(0)
  const [sayim, setSayim] = useState<number | null>(null)
  const baslaRef = useRef(basla)
  baslaRef.current = basla

  async function yukle() {
    const [l, g] = await Promise.all([
      supabase.rpc('takim_listesi', { p_session: oturumId, p_anahtar: null }),
      supabase.rpc('takim_goster', { p_session: oturumId, p_anahtar: null }),
    ])
    const liste = (l.data as { takimlar?: { takim: number; adlar: string[] }[] } | null)?.takimlar ?? []
    setTakimlar(liste)
    setTakimSayisi((g.data as { sayi?: number } | null)?.sayi ?? 0)
  }
  useEffect(() => {
    if (!takimli) return
    void yukle()
    const t = setInterval(() => void yukle(), 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takimli, oturumId])

  useEffect(() => {
    if (sayim === null) return
    if (sayim === 0) {
      void baslaRef.current()
      return
    }
    sesCal('tik')
    const t = setTimeout(() => setSayim(sayim - 1), 1000)
    return () => clearTimeout(t)
  }, [sayim])

  async function dagit(yontem: 'dengele' | 'rastgele') {
    await supabase.rpc('takim_dagit', {
      p_session: oturumId,
      p_anahtar: null,
      p_yontem: yontem,
    })
    await yukle()
  }

  const kural = mod ? OYUNLAR[mod].nasil : 'Sorular tek tek perdeye gelir. Telefonundan cevap ver; ne kadar hızlı ve doğru bilirsen o kadar çok puan alırsın.'
  const kuralSatirlari = kural.split(/(?<=[.!?])\s+/).slice(0, 3)
  const takimSutunlari = Array.from({ length: takimSayisi }, (_, i) => ({
    takim: i + 1,
    adlar: takimlar.find((t) => t.takim === i + 1)?.adlar ?? [],
  }))
  const toplamUye = takimlar.reduce((a, t) => a + t.adlar.length, 0)

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur flex flex-col items-center justify-center p-6 gap-6">
      {sayim !== null ? (
        <div className="text-center space-y-6 max-w-2xl">
          <p key={sayim} className="font-display font-extrabold text-[12rem] leading-none text-ze-yellow animate-pop">
            {sayim > 0 ? sayim : '🚀'}
          </p>
          <ul className="space-y-2 text-2xl text-slate-200">
            {kuralSatirlari.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="text-center space-y-1">
            <h2 className="font-display font-extrabold text-4xl">{mod ? `${OYUNLAR[mod].emoji} ${OYUNLAR[mod].ad}` : '🎮 Zapoot'}</h2>
            <p className="text-slate-300">
              {paketAdi} · {sureDk ? `${sureDk} dakika` : `${soruSayisi} soru`}
            </p>
            <p className="text-lg font-bold text-ze-lime">{takimli ? `${toplamUye} kişi takımını seçti` : `${Math.max(cevrimici, adlar.length)} öğrenci katıldı`}</p>
          </div>
          {takimli ? (
            <div
              className="grid gap-3 w-full max-w-5xl"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, takimSutunlari.length)}, minmax(0, 1fr))`,
              }}
            >
              {takimSutunlari.map((t) => (
                <div key={t.takim} className="glass-panel p-3 min-h-40">
                  <p className={`font-display font-extrabold text-lg ${TAKIM_RENKLERI[(t.takim - 1) % 6]}`}>
                    Takım {t.takim} <span className="text-slate-400 text-sm">({t.adlar.length})</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-sm max-h-48 overflow-hidden">
                    {t.adlar.slice(0, 12).map((a, i) => (
                      <li key={i} className="truncate">
                        {a}
                      </li>
                    ))}
                    {t.adlar.length > 12 && <li className="text-slate-400">+{t.adlar.length - 12} kişi daha</li>}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3 max-w-4xl">
              {adlar.slice(0, 80).map((ad, i) => (
                <span key={`ad-${i}`} className="flex flex-col items-center gap-1 w-20 animate-breathe" style={{ animationDelay: `${(i % 7) * 120}ms` }}>
                  <span className="w-12 h-12 rounded-full bg-linear-to-br from-ze-pink to-ze-purple flex items-center justify-center text-xl font-bold">{(ad.trim()[0] ?? '?').toLocaleUpperCase('tr')}</span>
                  <span className="text-xs truncate w-full text-center text-slate-200">{ilkAd(ad)}</span>
                </span>
              ))}
              {Array.from({ length: Math.max(0, Math.min(cevrimici - adlar.length, 80 - adlar.length)) }, (_, i) => (
                <span key={`anon-${i}`} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl animate-breathe" style={{ animationDelay: `${(i % 7) * 120}ms` }} title="Adı henüz görünmeyen katılımcı">
                  🙂
                </span>
              ))}
              {cevrimici === 0 && adlar.length === 0 && <p className="text-slate-400">Öğrenciler telefonundan katıldıkça burada görünür.</p>}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {takimli && (
              <>
                <button className="ikincil-buton" onClick={() => void dagit('dengele')}>
                  ⚖ Takımları dengele
                </button>
                <button className="ikincil-buton" onClick={() => void dagit('rastgele')}>
                  🎲 Rastgele dağıt
                </button>
              </>
            )}
            <button className="parlak-buton rounded-2xl px-8 py-3 font-display font-extrabold text-xl" onClick={() => setSayim(3)}>
              ▶ Başlat
            </button>
            <button className="ikincil-buton" onClick={iptal}>
              Vazgeç
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface TakimSatiri {
  takim: number
  puan: number
  ortalama: number
  sira: number
}

/** Final töreni: 3. sonra 2. sonra 1. davul sesiyle ve konfetiyle; altta tüm sıralama. Takım modunda önce kazanan takım. */
export function Final({ oturumId, takimli, kapat }: { oturumId: string; takimli: boolean; kapat: () => void }) {
  const [puanlar, setPuanlar] = useState<PuanSatiri[] | null>(null)
  const [takimlar, setTakimlar] = useState<TakimSatiri[]>([])
  const [asama, setAsama] = useState(0)
  const [hepsi, setHepsi] = useState(false)

  useEffect(() => {
    void supabase.rpc('puan_tablosu', { p_session: oturumId, p_limit: 200 }).then(({ data }) => setPuanlar((data as PuanSatiri[] | null) ?? []))
    if (takimli) {
      void supabase.rpc('takim_goster', { p_session: oturumId, p_anahtar: null }).then(({ data }) => {
        const t = ((data as { takimlar?: TakimSatiri[] } | null)?.takimlar ?? []).slice().sort((a, b) => a.sira - b.sira)
        setTakimlar(t)
      })
    }
  }, [oturumId, takimli])

  useEffect(() => {
    if (!puanlar) return
    const zamanlar = [900, 2800, 4800, 7000]
    const t = zamanlar.map((ms, i) =>
      setTimeout(() => {
        setAsama(i + 1)
        sesCal(i < 2 ? 'alkis' : i === 2 ? 'zafer' : 'baslat')
      }, ms),
    )
    return () => t.forEach(clearTimeout)
  }, [puanlar])

  const ilk3 = puanlar?.slice(0, 3) ?? []
  const duzen = [
    {
      p: ilk3[2],
      yer: 3,
      ac: asama >= 1,
      yukseklik: 'h-20',
      renk: 'from-orange-400 to-amber-700',
      madalya: '🥉',
    },
    {
      p: ilk3[1],
      yer: 2,
      ac: asama >= 2,
      yukseklik: 'h-32',
      renk: 'from-slate-300 to-slate-500',
      madalya: '🥈',
    },
    {
      p: ilk3[0],
      yer: 1,
      ac: asama >= 3,
      yukseklik: 'h-44',
      renk: 'from-amber-300 to-orange-500',
      madalya: '🥇',
    },
  ]
  const sirali = [duzen[1], duzen[2], duzen[0]]
  const kazananTakim = takimlar[0]

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur overflow-y-auto p-6">
      {asama >= 3 && <Konfeti adet={90} />}
      <div className="mx-auto max-w-4xl space-y-6 text-center">
        <h2 className="font-display font-extrabold text-5xl">🏆 Final</h2>
        {takimli && kazananTakim && (
          <p className="text-2xl font-bold text-ze-yellow animate-pop">
            Kazanan takım: Takım {kazananTakim.takim} · üye başı {kazananTakim.ortalama} puan
          </p>
        )}
        {!puanlar && <p className="text-slate-400">Sonuçlar hazırlanıyor…</p>}
        {puanlar && puanlar.length === 0 && <p className="text-slate-400">Henüz cevap yok.</p>}
        {puanlar && puanlar.length > 0 && (
          <div className="grid grid-cols-3 items-end gap-3 pt-4">
            {sirali.map((d) =>
              d.p ? (
                <div key={d.yer} className={`text-center transition-all duration-700 ${d.ac ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                  <p className="text-5xl">{d.madalya}</p>
                  <p className="font-display font-extrabold text-2xl truncate px-1">{d.p.ad}</p>
                  <p className="font-mono text-slate-300 mb-2">
                    {d.p.puan} puan · {d.p.dogru} doğru
                  </p>
                  <div className={`${d.yukseklik} rounded-t-2xl bg-linear-to-b ${d.renk} shadow-lg`} />
                </div>
              ) : (
                <div key={d.yer} />
              ),
            )}
          </div>
        )}
        {takimli && takimlar.length > 0 && asama >= 4 && (
          <ul className="space-y-1 text-left max-w-md mx-auto">
            {takimlar.map((t) => (
              <li key={t.takim} className="glass-panel px-4 py-2 flex justify-between">
                <span className="font-bold">
                  {t.sira}. Takım {t.takim}
                </span>
                <span className="font-mono">üye başı {t.ortalama}</span>
              </li>
            ))}
          </ul>
        )}
        {puanlar && puanlar.length > 3 && asama >= 4 && (
          <div className="space-y-2">
            <button className="ikincil-buton" onClick={() => setHepsi((h) => !h)}>
              {hepsi ? 'Gizle' : 'Tümünü göster'}
            </button>
            {hepsi && (
              <ol className="max-w-md mx-auto text-left space-y-1">
                {puanlar.slice(3).map((p, i) => (
                  <li key={i} className="glass-panel px-4 py-1.5 flex justify-between text-sm">
                    <span>
                      {p.sira}. {p.ad}
                    </span>
                    <span className="font-mono">
                      {p.puan}
                      {p.seri && p.seri >= 3 ? ` · 🔥${p.seri}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        <button className="parlak-buton rounded-2xl px-8 py-3 font-display font-extrabold" onClick={kapat}>
          Tamam
        </button>
      </div>
    </div>
  )
}

export { takimliMi }
