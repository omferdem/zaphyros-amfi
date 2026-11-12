import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import type { DersDurumu } from '../lib/tipler'
import { youtubeGomme } from '../lib/video'

type Adim = NonNullable<DersDurumu['adim']>

const RENKLER = ['text-rose-300', 'text-sky-300', 'text-amber-300', 'text-emerald-300', 'text-violet-300', 'text-cyan-300']

/** Fikirler kelime bulutu gibi dizilir: çok yazılan büyük görünür. */
export function KelimeBulutu({ fikirler, buyuk = false, gizle }: { fikirler: { m: string; n: number }[]; buyuk?: boolean; gizle?: (metin: string) => void }) {
  if (fikirler.length === 0) return <p className="text-slate-400 text-center">Henüz fikir yok.</p>
  const enCok = Math.max(...fikirler.map((f) => f.n))
  const taban = buyuk ? 1.4 : 0.95
  const aralik = buyuk ? 2.6 : 1.2
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 leading-tight">
      {fikirler.map((f, i) => (
        <li
          key={f.m.toLowerCase()}
          className={`font-extrabold ${RENKLER[i % RENKLER.length]} ${gizle ? 'group relative' : ''}`}
          style={{ fontSize: `${taban + (enCok > 1 ? (aralik * (f.n - 1)) / (enCok - 1) : 0)}rem` }}
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
        <div className="bg-sky-500 transition-[width] duration-700" style={{ width: `${oranSol}%` }} />
        <div className="bg-rose-500 flex-1" />
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
  sinir: 'En fazla 3 fikir yazabilirsin.',
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
        {adim.soru && <h1 className="text-xl font-extrabold">{adim.soru}</h1>}
        {telefonModu && adim.video ? (
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
  const bitti = yazilanlar.length >= 3

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
      if (s.hata === 'sinir' && yazilanlar.length < 3) setYazilanlar((l) => [...l, ...Array(3 - l.length).fill('…')])
      return
    }
    const yeni = [...yazilanlar, m]
    setYazilanlar(yeni)
    sakla(fikirAnahtari(adim.id), JSON.stringify(yeni))
    setMetin('')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold leading-snug whitespace-pre-line">{adim.soru}</h1>
      {acik && !bitti && (
        <form onSubmit={gonder} className="space-y-3">
          <input
            autoFocus
            className="giris-kutusu text-lg"
            placeholder="Bir kelime ya da kısa bir ifade"
            maxLength={40}
            autoComplete="off"
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
          />
          <button disabled={mesgul || metin.trim().length < 2} className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-50">
            Gönder ({3 - yazilanlar.length} hakkın var)
          </button>
        </form>
      )}
      {acik && bitti && <p className="text-emerald-300 font-bold">Üç fikrini de gönderdin. Perdeye bak.</p>}
      {!acik && <p className="text-slate-400">Fikir toplama kapandı. Perdeye bak.</p>}
      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
      {yazilanlar.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {yazilanlar.filter((y) => y !== '…').map((y) => (
            <li key={y} className="rounded-full bg-white/10 px-3 py-1 text-sm">
              {y}
            </li>
          ))}
        </ul>
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
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold leading-snug whitespace-pre-line">{adim.soru}</h1>
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
                className={`rounded-2xl px-3 py-5 font-bold text-lg transition-all ${i === 0 ? 'bg-sky-600' : 'bg-rose-600'} ${
                  taraf === i ? 'ring-4 ring-white' : taraf !== null ? 'opacity-50' : ''
                } disabled:opacity-60`}
              >
                {e}
              </button>
            ))}
          </div>
          {acik && taraf !== null && (
            <div className="space-y-3">
              <textarea
                className="giris-kutusu"
                rows={3}
                maxLength={200}
                placeholder="Gerekçen (isteğe bağlı, perdede isimsiz görünür)"
                value={metin}
                onChange={(e) => {
                  setMetin(e.target.value)
                  setGonderildi(false)
                }}
              />
              <button disabled={mesgul || gonderildi} onClick={gonder} className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-60">
                {gonderildi ? 'Oyun alındı ✓' : kayit ? 'Oyumu güncelle' : 'Oyumu gönder'}
              </button>
              {gonderildi && <p className="text-xs text-slate-400 text-center">Sonuç açıklanana kadar fikrini değiştirebilirsin.</p>}
            </div>
          )}
          {acik && taraf === null && <p className="text-sm text-slate-400 text-center">Bir taraf seç.</p>}
          {!acik && <p className="text-slate-400">Oylama kapandı. Perdeye bak.</p>}
        </>
      )}
      {sonuc && <OylamaSonucu adim={adim} />}
      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
    </div>
  )
}
