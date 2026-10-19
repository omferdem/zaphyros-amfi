import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import type { DersDurumu } from '../lib/tipler'
import { SIKLAR, bitisAni } from '../lib/yarisma'

type SoruAdimi = NonNullable<DersDurumu['adim']>

interface Sonucum {
  ad: string | null
  cevapladi: boolean
  secim: number | null
  dogru: boolean | null
  puan: number | null
  toplam: number
  sira: number | null
  oyuncu: number
}

const HATALAR: Record<string, string> = {
  sure_bitti: 'Süre doldu, cevabın alınamadı.',
  soru_yok: 'Bu soru artık perdede değil.',
  secim_gecersiz: 'Bir sorun oldu, tekrar dene.',
  cihaz_gecersiz: 'Tarayıcın tanınamadı. Sayfayı yenile.',
}

function takmaAdAnahtari(oturum: string) {
  return `amfi_takma_${oturum}`
}
function cevapAnahtari(adim: string) {
  return `amfi_cevap_${adim}`
}

/**
 * Öğrenci telefonunda bilgi yarışması sorusu. Yoklaması alınan öğrenci adıyla yarışır;
 * yoklamasız derste önce takma ad sorulur.
 */
export default function SoruCevabi({ oturum, adim, yoklamali }: { oturum: string; adim: SoruAdimi; yoklamali: boolean }) {
  const [takmaAd, setTakmaAd] = useState(() => oku(takmaAdAnahtari(oturum)))
  const [secim, setSecim] = useState<number | null>(() => {
    const k = oku(cevapAnahtari(adim.id))
    return k === null ? null : Number(k)
  })
  const [hata, setHata] = useState<string | null>(null)
  const [adSor, setAdSor] = useState(false)
  const [sonucum, setSonucum] = useState<Sonucum | null>(null)
  const [bitis, setBitis] = useState(() => bitisAni(adim.kalan_ms))
  const [simdi, setSimdi] = useState(Date.now())

  // Sunucudan her yeni kalan süre geldiğinde (soru yeniden açıldıysa da) sayaç düzeltilir.
  useEffect(() => {
    if (adim.soru_durum === 'acik') setBitis(bitisAni(adim.kalan_ms))
  }, [adim.soru_durum, adim.kalan_ms])

  const kimlikVar = yoklamali || !!takmaAd
  const acik = adim.soru_durum === 'acik'

  useEffect(() => {
    if (!acik) return
    const t = setInterval(() => setSimdi(Date.now()), 250)
    return () => clearInterval(t)
  }, [acik])

  // Sonuç açıklanınca öğrencinin kendi durumu sorulur.
  useEffect(() => {
    if (adim.soru_durum !== 'sonuc') return
    supabase.rpc('benim_sonucum', { p_session: oturum, p_cihaz: cihazKimligi() }).then(({ data }) => {
      if (data) setSonucum(data as Sonucum)
    })
  }, [oturum, adim.id, adim.soru_durum])

  async function cevapla(i: number) {
    setHata(null)
    setSecim(i)
    const { data, error } = await supabase.rpc('cevap_ver', { p_session: oturum, p_cihaz: cihazKimligi(), p_secim: i })
    const sonuc = (data ?? {}) as { durum?: string; hata?: string }
    if (error || (!sonuc.durum && !sonuc.hata)) {
      setSecim(null)
      setHata('Sunucuya ulaşılamadı, tekrar bas.')
      return
    }
    if (sonuc.hata === 'kimlik_yok') {
      setSecim(null)
      setAdSor(true)
      return
    }
    if (sonuc.hata && sonuc.hata !== 'zaten_cevapladin') {
      setSecim(null)
      setHata(HATALAR[sonuc.hata] ?? 'Cevap alınamadı.')
      return
    }
    sakla(cevapAnahtari(adim.id), String(i))
  }

  const secenekler = adim.secenekler ?? []
  const kalan = bitis === null ? null : Math.max(0, bitis - simdi)

  if (acik && (!kimlikVar || adSor))
    return (
      <TakmaAdFormu
        oturum={oturum}
        tamam={(ad) => {
          sakla(takmaAdAnahtari(oturum), ad)
          setTakmaAd(ad)
          setAdSor(false)
        }}
      />
    )

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <h1 className="flex-1 text-xl font-extrabold leading-snug whitespace-pre-line">{adim.soru}</h1>
        {acik && kalan !== null && (
          <span className="shrink-0 w-12 h-12 rounded-full border-2 border-fuchsia-400 flex items-center justify-center text-lg font-bold tabular-nums">
            {Math.ceil(kalan / 1000)}
          </span>
        )}
      </div>

      {acik && secim === null && (
        <div className="grid gap-3">
          {secenekler.map((x, i) => {
            const sik = SIKLAR[i % SIKLAR.length]
            return (
              <button
                key={i}
                onClick={() => cevapla(i)}
                disabled={kalan === 0}
                className={`${sik.renk} rounded-2xl px-4 py-4 flex items-center gap-3 text-left text-lg font-bold active:scale-[0.98] transition-transform disabled:opacity-50`}
              >
                <span className="w-9 h-9 rounded-lg bg-black/25 flex items-center justify-center shrink-0">{sik.harf}</span>
                <span className="flex-1">{x}</span>
              </button>
            )
          })}
        </div>
      )}

      {acik && secim !== null && (
        <div className="text-center space-y-2 py-6">
          <p className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-bold ${SIKLAR[secim % SIKLAR.length].renk}`}>
            {SIKLAR[secim % SIKLAR.length].harf} · {secenekler[secim]}
          </p>
          <p className="text-slate-300">Cevabın alındı. Sonucu bekle.</p>
        </div>
      )}

      {adim.soru_durum === 'sonuc' && (
        <div className="text-center space-y-3 py-4">
          {sonucum === null ? (
            <p className="text-slate-400">Sonuç geliyor…</p>
          ) : !sonucum.cevapladi ? (
            <p className="text-xl font-bold text-slate-300">Bu soruya cevap vermedin.</p>
          ) : sonucum.dogru ? (
            <>
              <p className="text-4xl">✓</p>
              <p className="text-2xl font-extrabold text-emerald-300">Doğru! +{sonucum.puan}</p>
            </>
          ) : (
            <>
              <p className="text-4xl">✗</p>
              <p className="text-2xl font-extrabold text-rose-300">Yanlış</p>
            </>
          )}
          {typeof adim.dogru_index === 'number' && (
            <p className="text-sm text-slate-300">
              Doğru cevap: <b className="text-white">{secenekler[adim.dogru_index]}</b>
            </p>
          )}
          {sonucum && sonucum.sira !== null && (
            <p className="text-sm text-slate-400">
              {sonucum.ad && <b className="text-slate-200">{sonucum.ad}</b>} · toplam <b className="text-white">{sonucum.toplam}</b> puan ·{' '}
              {sonucum.oyuncu} kişi içinde <b className="text-white">{sonucum.sira}.</b>
            </p>
          )}
        </div>
      )}

      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
    </div>
  )
}

function TakmaAdFormu({ oturum, tamam }: { oturum: string; tamam: (ad: string) => void }) {
  const [ad, setAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    setMesgul(true)
    setHata(null)
    const { data, error } = await supabase.rpc('takma_ad_al', { p_session: oturum, p_cihaz: cihazKimligi(), p_ad: ad })
    setMesgul(false)
    const s = (data ?? {}) as { durum?: string; ad?: string; hata?: string }
    if (error || !s.durum) {
      setHata(
        s.hata === 'ad_kullaniliyor'
          ? 'Bu ad alınmış, başka bir ad yaz.'
          : s.hata === 'ad_kisa'
            ? 'En az 2 harf yaz.'
            : 'Ad kaydedilemedi, tekrar dene.',
      )
      return
    }
    tamam(s.ad ?? ad)
  }

  return (
    <form onSubmit={gonder} className="space-y-4">
      <h1 className="text-xl font-extrabold">Yarışmaya katıl</h1>
      <p className="text-sm text-slate-300">Puan tablosunda görünecek bir ad yaz.</p>
      <input
        autoFocus
        required
        maxLength={24}
        autoComplete="off"
        className="giris-kutusu text-xl text-center"
        placeholder="Takma ad"
        value={ad}
        onChange={(e) => setAd(e.target.value)}
      />
      <button disabled={mesgul || ad.trim().length < 2} className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-50">
        Katıl
      </button>
      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
    </form>
  )
}
