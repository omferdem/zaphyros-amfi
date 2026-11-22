import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ZirveSahnesi from './ZirveSahnesi'
import { GUVENLI_ARALIK, merdivenHesapla, type MerdivenDurumu, type MerdivenSorusu } from '../lib/merdiven'
import { OYUN_OLAYI } from '../lib/oyun'
import { zorlukOku } from '../lib/zorluk'

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
export default function MerdivenPaneli({ oturum, anahtar, mod, dugme = true }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda'; dugme?: boolean }) {
  const [kayit, setKayit] = useState<Kayit>(() => oku(oturum))
  const [sorular, setSorular] = useState<MerdivenSorusu[]>([])

  const [jokerDurumu, setJokerDurumu] = useState<{ kullanilan: string[]; seyirci: number[] | null }>({ kullanilan: [], seyirci: null })
  const [jokerHata, setJokerHata] = useState<string | null>(null)
  // Ekipteki öğrencilerin son sorudaki sonucu (ipi çekenler ve sallananlar)
  const [oyuncular, setOyuncular] = useState<{ ad: string; sonuc: (1 | 0 | -1 | null)[] }[]>([])

  const yenile = useCallback(async () => {
    const [{ data }, { data: j }, { data: z }] = await Promise.all([
      supabase.rpc('merdiven_goster', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('joker_durumu', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: anahtar }),
    ])
    const oy = (z as { oyuncular?: { ad: string; sonuc: (1 | 0 | -1 | null)[] }[] } | null)?.oyuncular
    if (oy) setOyuncular(oy)
    const s = (data as { sorular?: MerdivenSorusu[] } | null)?.sorular
    if (s) setSorular(s)
    const jd = j as { kullanilan?: string[]; bu_soru?: { seyirci?: { dagilim?: number[] } } } | null
    if (jd?.kullanilan) setJokerDurumu({ kullanilan: jd.kullanilan, seyirci: jd.bu_soru?.seyirci?.dagilim ?? null })
  }, [oturum, anahtar])

  async function jokerKullan(tur: 'yarim' | 'seyirci' | 'sure') {
    setJokerHata(null)
    const { data, error } = await supabase.rpc('joker_kullan', { p_session: oturum, p_anahtar: anahtar, p_tur: tur })
    const h = (data as { hata?: string } | null)?.hata
    if (error || h) setJokerHata(h === 'soru_acik_degil' ? 'Soru açıkken kullanılır.' : h === 'kullanildi' ? 'Bu joker kullanıldı.' : 'Joker kullanılamadı.')
    await yenile()
  }

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
      else kaydet({ ...oku(oturum), acik: false })
    }
    window.addEventListener(OYUN_OLAYI, dinle)
    return () => window.removeEventListener(OYUN_OLAYI, dinle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oturum])

  const perde = mod === 'perde'
  if (sorular.length === 0) return null

  if (!kayit.acik) {
    if (!dugme) return null
    return (
      <div className={perde ? 'fixed left-4 bottom-24 z-30' : ''}>
        <button className="ikincil-buton !py-1.5 text-sm" onClick={() => kaydet({ ...kayit, acik: true })}>
          🪜 Bilgi merdiveni
        </button>
      </div>
    )
  }

  const d = merdivenHesapla(sorular, new Set(kayit.jokerler), zorlukOku(oturum))
  const sonSonuc = d.gecmis[d.gecmis.length - 1]

  return (
    <div className={perde ? 'perde-alan z-40 bg-slate-950/95 flex items-stretch justify-center p-2 overflow-hidden' : ''}>
      <Merdiven tamEkran={perde} oyuncular={oyuncular} d={d} jokerler={{ kullanilan: jokerDurumu.kullanilan, seyirci: jokerDurumu.seyirci, kullan: jokerKullan, hata: jokerHata }} sonSonuc={sonSonuc?.sonuc ?? null} kucuk={!perde} joker={() => d.jokerlenebilir && kaydet({ ...kayit, jokerler: [...kayit.jokerler, d.jokerlenebilir] })} kapat={() => kaydet({ ...kayit, acik: false })} />
    </div>
  )
}

export interface SoruJokerleri {
  kullanilan: string[]
  /** Seyirci jokerinin ilk 10 saniyedeki şık dağılımı */
  seyirci: number[] | null
  kullan: (tur: 'yarim' | 'seyirci' | 'sure') => void
  hata: string | null
}

const SIK_HARFLERI = ['A', 'B', 'C', 'D', 'E', 'F']

export function Merdiven({ d, sonSonuc, kucuk, joker, kapat, jokerler, tamEkran = false, oyuncular }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null; kucuk: boolean; joker: () => void; kapat: () => void; jokerler?: SoruJokerleri; tamEkran?: boolean; oyuncular?: { ad: string; sonuc: (1 | 0 | -1 | null)[] }[] }) {
  const basamaklar = Array.from({ length: d.toplam }, (_, i) => i + 1)
  return (
    <div className={`cam-panel rounded-3xl p-4 space-y-3 ${kucuk ? 'w-full' : tamEkran ? 'w-full h-full overflow-hidden flex flex-col' : 'w-[min(60rem,94vw)]'}`}>
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
      {kucuk ? (
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
      ) : (
        <MerdivenSahnesi d={d} sonSonuc={sonSonuc} jokerler={jokerler} oyuncular={oyuncular} />
      )}
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
      {jokerler && (
        <div className="space-y-2 border-t border-white/10 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-bold text-slate-300">Soru jokerleri:</span>
            {(
              [
                ['yarim', '✂ Kestirme yol', 'Yarı yarıya: telefonlarda 2 yanlış şık silinir'],
                ['seyirci', '📻 Şerpaya sor', 'Seyirci: ilk 10 saniyedeki cevap dağılımını perdede göster'],
                ['sure', '🫁 Oksijen +15 sn', 'Açık sorunun süresini 15 saniye uzat'],
              ] as const
            ).map(([tur, ad, ipucu]) => {
              const kullanildi = jokerler.kullanilan.includes(tur)
              return (
                <button key={tur} disabled={kullanildi} title={ipucu} onClick={() => jokerler.kullan(tur)} className={kullanildi ? 'ikincil-buton !py-1 !px-2 text-xs opacity-40' : 'ikincil-buton !py-1 !px-2 text-xs'}>
                  {ad}
                  {kullanildi ? ' ✓' : ''}
                </button>
              )
            })}
            {jokerler.hata && <span className="text-xs text-rose-300">{jokerler.hata}</span>}
          </div>
          {jokerler.seyirci && (
            <div className="flex items-end gap-3 h-20" aria-label="Seyirci dağılımı">
              {(() => {
                const toplam = jokerler.seyirci.reduce((a, b) => a + b, 0)
                return jokerler.seyirci.map((n, i) => (
                  <div key={i} className="flex flex-col items-center justify-end gap-1 w-12 h-full">
                    <span className="text-[11px] tabular-nums">{toplam > 0 ? `%${Math.round((100 * n) / toplam)}` : '–'}</span>
                    <span className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-fuchsia-400" style={{ height: `${toplam > 0 ? Math.max(4, (n / toplam) * 100) : 4}%` }} />
                    <span className="text-xs font-bold">{SIK_HARFLERI[i]}</span>
                  </div>
                ))
              })()}
              <span className="text-[11px] text-slate-400 pb-5">ilk 10 saniyedeki cevaplar</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Perdede merdiven: Zirveye Tırmanış sahnesi ve yanında kurallar. */
function MerdivenSahnesi({ d, sonSonuc, jokerler, oyuncular }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null; jokerler?: SoruJokerleri; oyuncular?: { ad: string; sonuc: (1 | 0 | -1 | null)[] }[] }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <ZirveSahnesi d={d} sonSonuc={sonSonuc} jokerler={jokerler} sonOran={d.sonOran} oyuncular={oyuncular} />
    </div>
  )
}
