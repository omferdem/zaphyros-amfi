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
export default function MerdivenPaneli({ oturum, anahtar, mod, dugme = true }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda'; dugme?: boolean }) {
  const [kayit, setKayit] = useState<Kayit>(() => oku(oturum))
  const [sorular, setSorular] = useState<MerdivenSorusu[]>([])

  const [jokerDurumu, setJokerDurumu] = useState<{ kullanilan: string[]; seyirci: number[] | null }>({ kullanilan: [], seyirci: null })
  const [jokerHata, setJokerHata] = useState<string | null>(null)

  const yenile = useCallback(async () => {
    const [{ data }, { data: j }] = await Promise.all([
      supabase.rpc('merdiven_goster', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('joker_durumu', { p_session: oturum, p_anahtar: anahtar }),
    ])
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

  const d = merdivenHesapla(sorular, new Set(kayit.jokerler))
  const sonSonuc = d.gecmis[d.gecmis.length - 1]

  return (
    <div className={perde ? 'fixed inset-0 z-40 bg-slate-950/95 flex items-start justify-center p-3 pb-28 pt-14 overflow-y-auto' : ''}>
      <Merdiven tamEkran={perde} d={d} jokerler={{ kullanilan: jokerDurumu.kullanilan, seyirci: jokerDurumu.seyirci, kullan: jokerKullan, hata: jokerHata }} sonSonuc={sonSonuc?.sonuc ?? null} kucuk={!perde} joker={() => d.jokerlenebilir && kaydet({ ...kayit, jokerler: [...kayit.jokerler, d.jokerlenebilir] })} kapat={() => kaydet({ ...kayit, acik: false })} />
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

export function Merdiven({ d, sonSonuc, kucuk, joker, kapat, jokerler, tamEkran = false }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null; kucuk: boolean; joker: () => void; kapat: () => void; jokerler?: SoruJokerleri; tamEkran?: boolean }) {
  const basamaklar = Array.from({ length: d.toplam }, (_, i) => i + 1)
  return (
    <div className={`cam-panel rounded-3xl p-4 space-y-3 ${kucuk ? 'w-full' : tamEkran ? 'w-[min(64rem,96vw)] max-h-[96vh] overflow-y-auto' : 'w-[min(60rem,94vw)]'}`}>
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
        <MerdivenSahnesi d={d} sonSonuc={sonSonuc} />
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
                ['yarim', '✂ Yarı yarıya', 'Telefonlarda 2 yanlış şık silinir'],
                ['seyirci', '👥 Seyirci', 'İlk 10 saniyedeki cevap dağılımını perdede göster'],
                ['sure', '⏱ +15 sn', 'Açık sorunun süresini 15 saniye uzat'],
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

/**
 * Perdede merdiven: iki yan direk, basamaklar alttan üste dizilir, güvenli basamaklar altın renkte ve kalkanlıdır.
 * Sınıf tırmanıcısı basamaklar arasında yumuşakça kayar; yanlışta güvenli basamağa süzülür.
 */
function MerdivenSahnesi({ d, sonSonuc }: { d: MerdivenDurumu; sonSonuc: 'cikti' | 'dustu' | 'joker' | null }) {
  const n = Math.max(1, d.toplam)
  // 0. konum zemin; n. konum en tepe
  const yuzde = (b: number) => 4 + (b / n) * 82
  const basamaklar = Array.from({ length: n }, (_, i) => i + 1)
  const hic = d.gecmis.length === 0
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_16rem] items-stretch">
      <div className="relative h-[min(58vh,34rem)] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-t from-emerald-950 via-slate-900 to-indigo-950">
        {/* yıldızlar */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_15%,white_0_1px,transparent_2px),radial-gradient(circle_at_70%_30%,white_0_1px,transparent_2px),radial-gradient(circle_at_45%_8%,white_0_1px,transparent_2px),radial-gradient(circle_at_85%_12%,white_0_1px,transparent_2px)]" aria-hidden />
        {/* direkler */}
        <div className="absolute left-[28%] right-[28%] top-3 bottom-3">
          <span className="absolute left-0 top-0 bottom-0 w-2 rounded-full bg-gradient-to-b from-amber-200 to-amber-700 shadow-lg" />
          <span className="absolute right-0 top-0 bottom-0 w-2 rounded-full bg-gradient-to-b from-amber-200 to-amber-700 shadow-lg" />
          {basamaklar.map((b) => {
            const cikildi = b <= d.basamak
            const guvenli = b % GUVENLI_ARALIK === 0
            return (
              <div key={b} className="absolute left-0 right-0 flex items-center justify-center" style={{ bottom: `${((b / n) * 100 * 0.82 + 4) * 0.94}%` }}>
                <span
                  className={`h-3 w-full rounded-full transition-colors duration-700 ${
                    cikildi ? 'bg-gradient-to-r from-emerald-300 to-teal-400' : guvenli ? 'bg-gradient-to-r from-amber-200 to-amber-400' : 'bg-white/20'
                  }`}
                />
                <span className={`absolute -left-14 text-sm font-bold tabular-nums ${cikildi ? 'text-emerald-300' : guvenli ? 'text-amber-300' : 'text-slate-500'}`}>{b}</span>
                {guvenli && <span className="absolute -right-12 text-lg" title="Güvenli basamak">🛡</span>}
              </div>
            )
          })}
          {/* tırmanıcı: yumuşak kayar */}
          <div
            className="absolute left-1/2 -translate-x-1/2 text-6xl select-none transition-[bottom] duration-[1800ms] ease-out"
            style={{ bottom: `${yuzde(d.basamak) * 0.94 - 2}%` }}
            aria-label={`Sınıf ${d.basamak}. basamakta`}
          >
            <span className={`inline-block ${sonSonuc === 'dustu' ? 'merdiven-dus' : 'merdiven-sallan'}`}>{d.kazandi ? '🏆' : sonSonuc === 'dustu' ? '😵' : '🧗'}</span>
            <span className="absolute -top-2 left-full ml-1 whitespace-nowrap rounded-full bg-black/60 border border-white/15 px-2 py-0.5 text-xs font-bold">Sınıf</span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-emerald-900 to-transparent" aria-hidden />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm space-y-2 self-stretch">
        <p className="font-display font-extrabold text-base">Nasıl oynanır?</p>
        <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
          <li>Sınıf tek yarışmacıdır; her soruda cevap verenlerin en az yarısı bilirse bir basamak çıkar.</li>
          <li>{d.toplam} basamak var. Altın renkli 🛡 basamaklar güvenlidir.</li>
          <li>Bilemezse en son güvenli basamağa iner.</li>
          <li>3 joker var, turda birer kez: ✂ yarı yarıya, 👥 seyirci, ⏱ +15 sn. Ayrıca bir yanlış cevabı kurtaran kurtarma hakkı vardır.</li>
        </ul>
        {hic && <p className="text-xs text-slate-400">İlk sorunun sonucu açılınca tırmanıcı kımıldar.</p>}
      </div>
    </div>
  )
}
