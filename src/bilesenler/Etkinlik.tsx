import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import type { DersDurumu } from '../lib/tipler'
import { youtubeGomme } from '../lib/video'
import { gorselMi } from '../lib/foto'

type Adim = NonNullable<DersDurumu['adim']>

const RENKLER = ['text-rose-300', 'text-sky-300', 'text-amber-300', 'text-emerald-300', 'text-violet-300', 'text-cyan-300']

/** Fikirler kelime bulutu gibi dizilir: çok yazılan büyük görünür. */
/** Sunucunun bildirdiği kalan süreden (ms) saniye cinsinden geri sayım; süre yoksa null. */
export function useKalanSaniye(kalanMs: number | null | undefined, anahtar: string): number | null {
  const [bitis, setBitis] = useState<number | null>(null)
  const [simdi, setSimdi] = useState(Date.now())
  useEffect(() => {
    setBitis(kalanMs == null ? null : Date.now() + kalanMs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, kalanMs == null ? null : Math.round(kalanMs / 1500)])
  useEffect(() => {
    if (bitis === null) return
    const t = setInterval(() => setSimdi(Date.now()), 250)
    return () => clearInterval(t)
  }, [bitis])
  return bitis === null ? null : Math.max(0, Math.ceil((bitis - simdi) / 1000))
}

export function KelimeBulutu({
  fikirler,
  buyuk = false,
  gizle,
  mod = 'bulut',
}: {
  fikirler: { m: string; n: number }[]
  buyuk?: boolean
  gizle?: (metin: string) => void
  mod?: 'bulut' | 'firtina' | 'acik'
}) {
  if (fikirler.length === 0) return <p className="text-slate-400 text-center">Henüz {mod === 'acik' ? 'cevap' : 'fikir'} yok.</p>
  // Beyin fırtınası ve açık uçlu soruda cevaplar kart olarak, yazıldığı gibi okunur
  if (mod !== 'bulut') {
    return (
      <ul className={`grid gap-3 w-full ${buyuk ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
        {fikirler.map((f, i) => (
          <li
            key={f.m.toLowerCase()}
            className={`pop rounded-2xl border border-white/10 bg-white/7 p-4 leading-snug group relative ${buyuk ? 'text-xl' : 'text-sm'}`}
            style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}
          >
            <span className={`mr-2 ${RENKLER[i % RENKLER.length]}`} aria-hidden>
              ●
            </span>
            {f.m}
            {f.n > 1 && <span className="ml-2 text-xs text-slate-400">×{f.n}</span>}
            {gizle && (
              <button
                onClick={() => gizle(f.m)}
                aria-label="Bu cevabı gizle"
                className="absolute top-1 right-2 text-xs text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    )
  }
  const enCok = Math.max(...fikirler.map((f) => f.n))
  const taban = buyuk ? 1.4 : 0.95
  const aralik = buyuk ? 2.6 : 1.2
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 leading-tight">
      {fikirler.map((f, i) => (
        <li
          key={f.m.toLowerCase()}
          className={`pop font-display font-extrabold drop-shadow-[0_2px_12px_currentColor] ${RENKLER[i % RENKLER.length]} ${gizle ? 'group relative' : ''}`}
          style={{ animationDelay: `${Math.min(i, 20) * 40}ms`, fontSize: `${taban + (enCok > 1 ? (aralik * (f.n - 1)) / (enCok - 1) : 0)}rem` }}
          title={f.n > 1 ? `${f.n} kişi yazdı` : undefined}
        >
          {f.m}
          {gizle && (
            <button
              onClick={() => gizle(f.m)}
              aria-label={`"${f.m}" fikrini gizle`}
              className="ml-1 align-super text-[10px] text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** İki taraflı oylamanın sonucu: oran çubuğu ve gerekçeler. */
export function OylamaSonucu({ adim, buyuk = false }: { adim: Adim; buyuk?: boolean }) {
  const [sol, sag] = adim.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
  const [a, b] = adim.sayilar ?? [0, 0]
  const toplam = a + b
  const oranSol = toplam ? (a / toplam) * 100 : 50
  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between font-extrabold ${buyuk ? 'text-3xl lg:text-5xl' : 'text-lg'}`}>
        <span className="text-sky-300">
          {sol} <span className="tabular-nums">{a}</span>
        </span>
        <span className="text-rose-300 text-right">
          <span className="tabular-nums">{b}</span> {sag}
        </span>
      </div>
      <div className={`flex overflow-hidden rounded-full bg-white/10 ${buyuk ? 'h-8' : 'h-4'}`}>
        <div className="bg-linear-to-r from-sky-400 to-blue-600 transition-[width] duration-1000" style={{ width: `${oranSol}%` }} />
        <div className="bg-linear-to-r from-pink-500 to-rose-600 flex-1" />
      </div>
      {adim.gerekceler && adim.gerekceler.length > 0 && (
        <ul className={`grid gap-2 ${buyuk ? 'sm:grid-cols-2 text-xl' : 'text-sm'}`}>
          {adim.gerekceler.slice(0, buyuk ? 8 : 20).map((g, i) => (
            <li key={i} className={`rounded-2xl px-4 py-2 border-l-4 bg-white/5 ${g.t === 0 ? 'border-sky-500' : 'border-rose-500'}`}>
              {g.m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** YouTube ise gömülü oynatıcı, değilse bağlantı. */
export function VideoOynatici({ adres, baslik, className = '' }: { adres: string; baslik?: string | null; className?: string }) {
  // Fotoğraf adımı da bu bileşenle gösterilir
  if (gorselMi(adres))
    return <img src={adres} alt={baslik || 'Fotoğraf'} className={`mx-auto max-h-[75vh] w-auto max-w-full rounded-2xl object-contain ${className}`} />
  const gomme = youtubeGomme(adres)
  if (gomme)
    return (
      <iframe
        src={gomme}
        title={baslik || 'Video'}
        className={`w-full aspect-video rounded-2xl bg-black ${className}`}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    )
  return (
    <a href={adres} target="_blank" rel="noopener noreferrer" className="parlak-buton rounded-xl px-5 py-3 font-bold inline-block">
      Videoyu aç
    </a>
  )
}

// ---------------------------------------------------------------------------
// Öğrenci telefonu

const HATALAR: Record<string, string> = {
  kapali: 'Bu etkinlik kapandı.',
  etkinlik_yok: 'Bu etkinlik artık perdede değil.',
  metin_kisa: 'En az 2 harf yaz.',
  metin_uzun: 'Biraz kısalt.',
  ayni: 'Bu fikri zaten yazdın.',
  sinir: 'Gönderme hakkın doldu.',
  sure_bitti: 'Süre doldu, cevabın alınamadı.',
  dolu: 'Etkinlik doldu.',
  taraf_gecersiz: 'Bir taraf seç.',
  cihaz_gecersiz: 'Tarayıcın tanınamadı. Sayfayı yenile.',
}

function fikirAnahtari(adim: string) {
  return `amfi_fikir_${adim}`
}
function oyAnahtari(adim: string) {
  return `amfi_oy_${adim}`
}

/** Beyin fırtınası, oylama ve video için öğrenci ekranı. */
export function EtkinlikCevabi({ oturum, adim, telefonModu }: { oturum: string; adim: Adim; telefonModu: boolean }) {
  const acik = adim.soru_durum === 'acik'
  if (adim.tur === 'video') {
    return (
      <div className="space-y-3">
        {adim.soru && <h1 className={`${adim.video ? 'text-xl' : 'text-2xl leading-relaxed'} font-extrabold whitespace-pre-line`}>{adim.soru}</h1>}
        {!adim.video ? null : telefonModu ? (
          <VideoOynatici adres={adim.video} baslik={adim.soru} />
        ) : (
          <p className="text-slate-300">Perdedeki videoyu izle.</p>
        )}
      </div>
    )
  }
  return adim.tur === 'fikir' ? (
    <FikirFormu oturum={oturum} adim={adim} acik={acik} />
  ) : (
    <OyFormu oturum={oturum} adim={adim} acik={acik} />
  )
}

function FikirFormu({ oturum, adim, acik }: { oturum: string; adim: Adim; acik: boolean }) {
  const [yazilanlar, setYazilanlar] = useState<string[]>(() => {
    try {
      return JSON.parse(oku(fikirAnahtari(adim.id)) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [metin, setMetin] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const mod = adim.mod ?? 'bulut'
  const hak = mod === 'acik' ? 1 : 3
  const bitti = yazilanlar.length >= hak
  const kalanSn = useKalanSaniye(adim.kalan_ms, adim.id)
  const sureDoldu = kalanSn === 0

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    const m = metin.trim()
    if (!m) return
    setMesgul(true)
    setHata(null)
    const { data, error } = await supabase.rpc('katki_gonder', { p_session: oturum, p_cihaz: cihazKimligi(), p_metin: m, p_taraf: null })
    setMesgul(false)
    const s = (data ?? {}) as { durum?: string; hata?: string }
    if (error || (!s.durum && !s.hata)) {
      setHata('Sunucuya ulaşılamadı, tekrar dene.')
      return
    }
    if (s.hata) {
      setHata(HATALAR[s.hata] ?? 'Fikir alınamadı.')
      if (s.hata === 'sinir' && yazilanlar.length < hak) setYazilanlar((l) => [...l, ...Array(hak - l.length).fill('…')])
      return
    }
    const yeni = [...yazilanlar, m]
    setYazilanlar(yeni)
    sakla(fikirAnahtari(adim.id), JSON.stringify(yeni))
    setMetin('')
  }

  const etiket = mod === 'acik' ? 'Açık uçlu soru' : mod === 'firtina' ? 'Beyin fırtınası' : 'Kelime bulutu'
  const etiketRenk = mod === 'acik' ? 'text-ze-lime' : mod === 'firtina' ? 'text-ze-pink' : 'text-ze-cyan'
  return (
    <div className="glass-panel p-5 space-y-4 animate-pop">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono text-[11px] uppercase font-bold ${etiketRenk}`}>{etiket}</span>
        {mod !== 'acik' && mod !== 'bulut' && (
          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white/10 text-ze-yellow font-bold">
            Fikir hakkı: {yazilanlar.filter((y) => y !== '…').length} / {hak}
          </span>
        )}
        {acik && adim.sure_sn != null && kalanSn !== null && (
          <span className={`font-mono text-xs px-2.5 py-1 rounded-lg font-bold ${kalanSn <= 10 ? 'bg-ze-danger/20 text-ze-danger' : 'bg-ze-pink/20 text-ze-pink'}`}>
            Kalan: {String(Math.floor(kalanSn / 60)).padStart(2, '0')}:{String(kalanSn % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <h1 className="font-display font-bold text-base leading-snug whitespace-pre-line">{adim.soru}</h1>
      {acik && !bitti && !sureDoldu && (
        <form onSubmit={gonder} className="space-y-3">
          {mod === 'bulut' ? (
            <input
              autoFocus
              className="ze-input min-h-[52px] px-4 font-display font-bold text-base"
              placeholder="Tek kelime yaz (örn: Adalet)"
              maxLength={40}
              autoComplete="off"
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
            />
          ) : (
            <div className="space-y-1">
              <textarea
                autoFocus
                className="ze-input p-3.5 text-sm"
                rows={mod === 'acik' ? 4 : 2}
                placeholder={mod === 'acik' ? 'Cevabını buraya detaylıca yazabilirsin…' : 'Kısa cümleni yaz…'}
                maxLength={mod === 'acik' ? 300 : 120}
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 text-right tabular-nums">
                {metin.length} / {mod === 'acik' ? 300 : 120}
              </p>
            </div>
          )}
          {mod === 'acik' && <p className="text-[11px] text-slate-300 bg-white/5 px-3 py-2 rounded-xl border border-white/10">Not: Cevapların hoca yansıtınca perdede görünür.</p>}
          <button disabled={mesgul || metin.trim().length < 2} className="btn-primary w-full py-3.5 rounded-2xl font-display font-bold text-sm">
            {mod === 'acik' ? 'Cevabı gönder' : mod === 'bulut' ? 'Gönder' : `Fikir ekle (${hak - yazilanlar.length} hakkın kaldı)`}
          </button>
        </form>
      )}
      {acik && bitti && <p className="text-center text-xs text-ze-lime font-semibold">{mod === 'acik' ? 'Cevabın gönderildi. Perdeye bak.' : mod === 'bulut' ? 'Kelimen perdeye gönderildi!' : 'Fikir hakkın doldu. Perdeye bak.'}</p>}
      {acik && sureDoldu && !bitti && <p className="text-slate-400 text-sm text-center">Süre doldu. Perdeye bak.</p>}
      {!acik && <p className="text-slate-400 text-sm text-center">{mod === 'acik' ? 'Cevaplar toplandı. Hocan yansıtınca perdede görünecek.' : 'Fikir toplama kapandı. Perdeye bak.'}</p>}
      {hata && <p role="alert" className="text-xs text-ze-danger bg-ze-danger/15 border border-ze-danger/40 rounded-xl p-3">{hata}</p>}
      {yazilanlar.filter((y) => y !== '…').length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <span className="text-[11px] text-slate-400">Gönderdiğin fikirler:</span>
          {yazilanlar.filter((y) => y !== '…').map((y, i) => (
            <div key={y} className="p-2.5 rounded-xl bg-white/5 text-xs text-slate-200 flex items-start gap-2">
              <span className="font-mono text-ze-cyan font-bold">#{i + 1}</span>
              <span>{y}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OyFormu({ oturum, adim, acik }: { oturum: string; adim: Adim; acik: boolean }) {
  const kayit = (() => {
    try {
      return JSON.parse(oku(oyAnahtari(adim.id)) ?? 'null') as { taraf: number; metin: string } | null
    } catch {
      return null
    }
  })()
  const [taraf, setTaraf] = useState<number | null>(kayit?.taraf ?? null)
  const [metin, setMetin] = useState(kayit?.metin ?? '')
  const [gonderildi, setGonderildi] = useState(!!kayit)
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [sol, sag] = adim.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
  const sonuc = adim.soru_durum === 'sonuc'

  async function gonder() {
    if (taraf === null) return
    setMesgul(true)
    setHata(null)
    const { data, error } = await supabase.rpc('katki_gonder', { p_session: oturum, p_cihaz: cihazKimligi(), p_metin: metin, p_taraf: taraf })
    setMesgul(false)
    const s = (data ?? {}) as { durum?: string; hata?: string }
    if (error || (!s.durum && !s.hata)) {
      setHata('Sunucuya ulaşılamadı, tekrar dene.')
      return
    }
    if (s.hata) {
      setHata(HATALAR[s.hata] ?? 'Oy alınamadı.')
      return
    }
    sakla(oyAnahtari(adim.id), JSON.stringify({ taraf, metin }))
    setGonderildi(true)
  }

  return (
    <div className="glass-panel p-5 space-y-4 animate-pop">
      <div className="space-y-1">
        <span className="font-mono text-[11px] uppercase text-ze-yellow font-bold">Şeytanın avukatı oylaması</span>
        <h1 className="font-display font-bold text-base leading-snug whitespace-pre-line">{adim.soru}</h1>
      </div>
      {!sonuc && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[sol, sag].map((e, i) => (
              <button
                key={i}
                disabled={!acik}
                onClick={() => {
                  setTaraf(i)
                  setGonderildi(false)
                }}
                className={`pressable min-h-[76px] p-3 rounded-2xl font-display font-extrabold text-sm flex flex-col items-center justify-center gap-1.5 border-2 transition-all ${
                  taraf === i
                    ? i === 0
                      ? 'bg-ze-lime/20 border-ze-lime shadow-[0_0_24px_rgba(184,255,74,0.25)]'
                      : 'bg-ze-pink/20 border-ze-pink shadow-[0_0_24px_rgba(255,77,157,0.25)]'
                    : 'bg-white/5 border-white/10 text-slate-300'
                } disabled:opacity-60`}
              >
                <span aria-hidden>{i === 0 ? '✓' : '✕'}</span>
                <span>{e}</span>
              </button>
            ))}
          </div>
          {acik && taraf !== null && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium block">Gerekçen (isteğe bağlı)</label>
                <textarea
                  className="ze-input p-3 text-xs"
                  rows={2}
                  maxLength={200}
                  placeholder="Neden bu tarafı seçtin? (kısa argümanın; perdede isimsiz görünür)"
                  value={metin}
                  onChange={(e) => {
                    setMetin(e.target.value)
                    setGonderildi(false)
                  }}
                />
              </div>
              <button disabled={mesgul || gonderildi} onClick={gonder} className="btn-primary w-full py-3 rounded-2xl font-display font-bold text-sm">
                {gonderildi ? 'Oyun alındı ✓' : kayit ? 'Oyumu güncelle' : 'Tarafımı ve gerekçemi gönder'}
              </button>
              {gonderildi && <p className="text-xs text-slate-400 text-center">Sonuç açıklanana kadar fikrini değiştirebilirsin.</p>}
            </div>
          )}
          {acik && taraf === null && <p className="text-sm text-slate-400 text-center">Bir taraf seç.</p>}
          {!acik && <p className="text-slate-400 text-sm text-center">Oylama kapandı. Perdeye bak.</p>}
        </>
      )}
      {sonuc && <OylamaSonucu adim={adim} />}
      {hata && <p role="alert" className="text-xs text-ze-danger bg-ze-danger/15 border border-ze-danger/40 rounded-xl p-3">{hata}</p>}
    </div>
  )
}
