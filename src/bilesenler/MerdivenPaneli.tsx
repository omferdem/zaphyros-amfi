import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { GUVENLI_ARALIK, merdivenHesapla, type MerdivenDurumu, type MerdivenSorusu } from '../lib/merdiven'
import { OYUN_OLAYI } from '../lib/oyun'

const ANAHTAR = (oturum: string) => `amfi_merdiven_${oturum}`

interface Kayit {
  acik: boolean
  jokerler: string[]
}

function oku(oturum: string): Kayit {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR(oturum)) ?? 'null') as Partial<Kayit> | null
    return { acik: !!h?.acik, jokerler: Array.isArray(h?.jokerler) ? h.jokerler : [] }
  } catch {
    return { acik: false, jokerler: [] }
  }
}

/**
 * Bilgi merdiveni: sınıf tek yarışmacı gibi basamak çıkar. Her soruda cevap verenlerin en az yarısı doğru bilirse
 * bir basamak çıkılır; bilemezse son güvenli basamağa (5, 10, ...) inilir. Hoca yanlış bir soruyu (en fazla 2 kez)
 * jokerle yok sayabilir. Soru çözülürken merdiven kıpırdamaz; sonuç açılınca ya da soru geçilince güncellenir.
 */
export default function MerdivenPaneli({ oturum, anahtar, mod }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda' }) {
  const [kayit, setKayit] = useState<Kayit>(() => oku(oturum))
  const [sorular, setSorular] = useState<MerdivenSorusu[]>([])

  const yenile = useCallback(async () => {
    const { data } = await supabase.rpc('merdiven_goster', { p_session: oturum, p_anahtar: anahtar })
    const s = (data as { sorular?: MerdivenSorusu[] } | null)?.sorular
    if (s) setSorular(s)
  }, [oturum, anahtar])

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 4000)
    return () => clearInterval(t)
  }, [yenile])

  function kaydet(k: Kayit) {
    setKayit(k)
    try {
      localStorage.setItem(ANAHTAR(oturum), JSON.stringify(k))
    } catch {
      // Depolama kapalıysa durum yalnızca bu açılışta tutulur
    }
  }

  // Akıştaki "oyun" adımı merdiveni başlatınca panel kendiliğinden açılır
  useEffect(() => {
    function dinle(e: Event) {
      if ((e as CustomEvent<{ oyun: string }>).detail?.oyun === 'merdiven') kaydet({ ...oku(oturum), acik: true })
    }
    window.addEventListener(OYUN_OLAYI, dinle)
    return () => window.removeEventListener(OYUN_OLAYI, dinle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oturum])

  const perde = mod === 'perde'
  if (sorular.length === 0) return null

  if (!kayit.acik) {
    return (
      <div className={perde ? 'fixed left-4 bottom-24 z-30' : ''}>
        <button className="ikincil-buton !py-1.5 text-sm" onClick={() => kaydet({ ...kayit, acik: true })}>
          🪜 Bilgi merdiveni
        </button>
      </div>
    )
  }

  const d = merdivenHesapla(sorular, new Set(kayit.jokerler))
  const sonSonuc = d.gecmis[d.gecmis.length - 1]

  return (
    <div className={perde ? 'fixed inset-x-4 bottom-28 z-30 flex justify-center' : ''}>
      <Merdiven d={d} sonSonuc={sonSonuc?.sonuc ?? null} kucuk={!perde} joker={() => d.jokerlenebilir && kaydet({ ...kayit, jokerler: [...kayit.jokerler, d.jokerlenebilir] })} kapat={() => kaydet({ ...kayit, acik: false })} />
    </div>
  )
}

function Merdiven({ d, sonSonuc, kucuk, joker, kapat }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null; kucuk: boolean; joker: () => void; kapat: () => void }) {
  const basamaklar = Array.from({ length: d.toplam }, (_, i) => i + 1)
  return (
    <div className={`cam-panel rounded-3xl p-4 space-y-3 ${kucuk ? 'w-full' : 'w-[min(60rem,94vw)]'}`}>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-bold">🪜 Bilgi merdiveni</span>
        <span className="font-display font-extrabold tabular-nums">
          {d.basamak} / {d.toplam}
        </span>
        <span className="text-xs text-slate-400">güvenli basamak her {GUVENLI_ARALIK}. basamak</span>
        <button className="ml-auto text-xs text-slate-500 hover:text-white" onClick={kapat} title="Merdiveni gizle">
          ✕
        </button>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {basamaklar.map((n) => {
          const cikildi = n <= d.basamak
          const simdi = n === d.basamak
          const guvenli = n % GUVENLI_ARALIK === 0
          return (
            <li
              key={n}
              className={`min-w-9 rounded-lg px-2 py-1.5 text-center text-sm font-bold tabular-nums transition-all duration-500 ${
                cikildi ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950' : 'bg-white/5 text-slate-400'
              } ${simdi ? 'ring-2 ring-white scale-110' : ''} ${guvenli && !cikildi ? 'border border-amber-300/60' : ''}`}
              title={guvenli ? 'Güvenli basamak' : undefined}
            >
              {guvenli ? '🛡' : ''}
              {n}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {d.kazandi ? (
          <p className="text-xl font-display font-extrabold pop">
            🏆 <span className="renkli-yazi">Sınıf merdiveni tamamladı!</span>
          </p>
        ) : sonSonuc === 'cikti' ? (
          <p className="text-emerald-300 font-bold">⬆ Sınıf bir basamak çıktı</p>
        ) : sonSonuc === 'dustu' ? (
          <p className="text-rose-300 font-bold">⬇ Sınıf {d.basamak}. basamağa düştü</p>
        ) : sonSonuc === 'joker' ? (
          <p className="text-amber-300 font-bold">🛟 Joker kullanıldı, basamak korundu</p>
        ) : (
          <p className="text-slate-400">İlk sorunun sonucu açılınca merdiven kımıldar.</p>
        )}
        {d.jokerlenebilir && (
          <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" onClick={joker}>
            🛟 Joker kullan ({d.jokerKalan} hak)
          </button>
        )}
        {!d.jokerlenebilir && d.jokerKalan < 2 && <span className="text-xs text-slate-500">Kalan joker: {d.jokerKalan}</span>}
      </div>
    </div>
  )
}
