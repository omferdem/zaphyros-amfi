import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import type { DersDurumu, PuanSatiri } from '../lib/tipler'
import { ZE_SIKLAR, bitisAni } from '../lib/yarisma'
import Konfeti from './Konfeti'

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
  /** Telefon modunda sonuç açıklanınca ilk 5 (perde yok) */
  puanlar?: PuanSatiri[] | null
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
export default function SoruCevabi({ oturum, adim, yoklamali, numarali = false }: { oturum: string; adim: SoruAdimi; yoklamali: boolean; /** Ders oturumu (ders dışı etkinlik değil): kodla giren öğrenci numarasını yazar, yalnızca kimlik içindir, yoklama yazmaz */ numarali?: boolean }) {
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

  // Telefon titreşimi: doğruda kısa çift, yanlışta tek uzun (cevap vermeyene titreşim yok); destek yoksa sessizce geçilir
  useEffect(() => {
    if (adim.soru_durum !== 'sonuc' || !sonucum?.cevapladi) return
    try {
      navigator.vibrate?.(sonucum.dogru ? [70, 50, 70] : 260)
    } catch {
      /* titreşim desteklenmiyor */
    }
  }, [adim.id, adim.soru_durum, sonucum?.cevapladi, sonucum?.dogru])

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
  const elenen = adim.elenen ?? []
  const kalan = bitis === null ? null : Math.max(0, bitis - simdi)

  if (acik && (!kimlikVar || adSor))
    return (
      <TakmaAdFormu
        oturum={oturum}
        numarali={numarali}
        tamam={(ad) => {
          sakla(takmaAdAnahtari(oturum), ad)
          setTakmaAd(ad)
          setAdSor(false)
        }}
      />
    )

  const sonucta = adim.soru_durum === 'sonuc'
  const dagilim = adim.dagilim ?? []
  const toplamCevap = dagilim.reduce((a, b) => a + b, 0)
  const dogruIndex = typeof adim.dogru_index === 'number' ? adim.dogru_index : -1
  const yuzde = (i: number) => (toplamCevap > 0 ? Math.round(((dagilim[i] ?? 0) / toplamCevap) * 100) : 0)
  // Geri sayım halkası (zapedu2): r=22 yarıçaplı SVG
  const yaricap = 22
  const cevre = 2 * Math.PI * yaricap
  const sureOrani = kalan !== null ? Math.min(1, kalan / ((adim.sure_sn ?? 20) * 1000)) : 0
  const secimli = secim !== null

  return (
    <div className="space-y-3.5 animate-pop">
      {/* Soru başlığı + geri sayım halkası */}
      <div className="glass-panel p-4 flex items-center gap-3.5">
        {acik && kalan !== null && (
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r={yaricap} stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
              <circle
                cx="26"
                cy="26"
                r={yaricap}
                stroke={Math.ceil(kalan / 1000) <= 5 ? '#ff4757' : '#22e3d2'}
                strokeWidth="4"
                fill="none"
                strokeDasharray={cevre}
                strokeDashoffset={cevre - sureOrani * cevre}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono font-bold text-sm">{Math.ceil(kalan / 1000)}s</span>
          </div>
        )}
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-ze-pink font-bold uppercase">
            Soru {adim.sira} / {adim.toplam} · Hızlı yarışma
            {adim.final_turu && <b className="ml-2 rounded-full bg-amber-400 text-slate-950 px-2 py-0.5">🔥 FİNAL TURU ×2 puan</b>}
          </span>
          <h1 className="font-display font-bold text-base leading-snug whitespace-pre-line">{adim.soru}</h1>
        </div>
      </div>

      {/* Sonuç: puan şeridi */}
      {sonucta && sonucum && (
        <div className={`glass-panel p-4 flex items-center justify-between ${!sonucum.cevapladi ? '' : sonucum.dogru ? 'bg-ze-lime/15 border-ze-lime/50' : 'bg-ze-danger/15 border-ze-danger/50'}`}>
          <div>
            <span className={`text-xs font-mono uppercase font-bold ${!sonucum.cevapladi ? 'text-slate-300' : sonucum.dogru ? 'text-ze-lime' : 'text-ze-danger'}`}>
              {!sonucum.cevapladi ? 'Cevap vermedin' : sonucum.dogru ? 'Doğru cevap!' : `Yanlış seçim${dogruIndex >= 0 ? ` · Doğru: ${ZE_SIKLAR[dogruIndex % ZE_SIKLAR.length].harf}` : ''}`}
            </span>
            <p className="font-display font-extrabold text-2xl">{sonucum.dogru ? `+${sonucum.puan ?? 0} puan` : '+0 puan'}</p>
          </div>
          <div className="text-right font-mono">
            <span className="text-[11px] text-slate-300 block">Toplam puanın</span>
            <span className="text-lg font-bold text-ze-cyan">{sonucum.toplam}</span>
          </div>
        </div>
      )}
      {sonucta && sonucum === null && <p className="text-slate-400 text-sm text-center">Sonuç geliyor…</p>}
      {sonucta && sonucum?.dogru && <Konfeti adet={36} />}

      {/* Şıklar: açıkken dokunma kartları, sonuçta yüzdeli çubuklar */}
      {!sonucta ? (
        <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Yarışma şıkları">
          {secenekler.map((x, i) => {
            const z = ZE_SIKLAR[i % ZE_SIKLAR.length]
            const secildi = secim === i
            const elendi = elenen.includes(i)
            return (
              <button
                key={i}
                onClick={() => cevapla(i)}
                disabled={!acik || kalan === 0 || secimli || elendi}
                role="radio"
                aria-checked={secildi}
                className={`pressable w-full min-h-[64px] p-3.5 rounded-2xl text-left flex items-center justify-between gap-3 border-2 transition-all ${
                  secildi ? 'bg-white/15 border-white shadow-[0_0_25px_rgba(255,255,255,0.2)]' : 'bg-white/[0.05] border-white/10 hover:bg-white/10'
                } ${secimli && !secildi ? 'opacity-45' : ''} ${elendi ? 'opacity-25 line-through' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl flex flex-col items-center justify-center font-display font-extrabold text-sm shrink-0 leading-none text-ze-bg" style={{ background: z.hex }}>
                    <span>{z.harf}</span>
                    <span className="text-[10px]">{z.sekil}</span>
                  </span>
                  <span className="font-bold text-sm leading-snug">{x}</span>
                </div>
                {elendi && <span className="text-xs text-slate-400">elendi</span>}
                {secildi && <span className="text-ze-lime text-lg">✓</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {secenekler.map((x, i) => {
            const z = ZE_SIKLAR[i % ZE_SIKLAR.length]
            const dogru = i === dogruIndex
            const secildi = secim === i
            const yanlisSecim = secildi && !dogru
            return (
              <div key={i} className={`p-3 rounded-2xl space-y-1.5 ${dogru ? 'border-2 border-ze-lime bg-ze-lime/15' : yanlisSecim ? 'border-2 border-ze-danger bg-ze-danger/20' : 'border border-white/10 bg-white/[0.04] opacity-65'}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center font-mono text-ze-bg" style={{ background: z.hex }}>
                      {z.harf}
                    </span>
                    <span>{x}</span>
                  </div>
                  <span className={`font-mono font-bold ${dogru ? 'text-ze-lime' : yanlisSecim ? 'text-ze-danger' : 'text-slate-300'}`}>%{yuzde(i)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${yuzde(i)}%`, background: dogru ? '#b8ff4a' : yanlisSecim ? '#ff4757' : z.hex }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cevap alındı bandı */}
      {acik && secimli && (
        <div className="p-3.5 rounded-2xl bg-ze-purple/25 border border-ze-purple/50 flex items-center gap-2 text-xs font-bold animate-pop">
          <span className="text-ze-cyan">🔒</span>
          <span>
            Cevabın alındı ({ZE_SIKLAR[(secim ?? 0) % ZE_SIKLAR.length].harf}) · Süre bitimi bekleniyor
          </span>
        </div>
      )}

      {/* İlk 5 sıralama */}
      {sonucta && sonucum?.puanlar && sonucum.puanlar.length > 0 && (
        <div className="glass-panel p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-display font-bold text-ze-yellow">🏆 İlk 5 sıralama</span>
            <span className="font-mono text-[11px] text-slate-400">{sonucum.oyuncu} katılımcı</span>
          </div>
          <div className="space-y-1">
            {sonucum.puanlar.map((p, i) => {
              const ben = !!sonucum.ad && p.ad === sonucum.ad
              return (
                <div key={`${p.ad}-${i}`} className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs ${ben ? 'bg-ze-purple/30 border border-ze-pink/50 font-bold' : 'text-slate-300'}`}>
                  <span>
                    #{p.sira} {p.ad}
                    {ben ? ' (Sen)' : ''}
                  </span>
                  <span className="font-mono text-ze-cyan">{p.puan}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {sonucta && sonucum && sonucum.sira !== null && (
        <p className="text-center text-xs text-slate-400">
          {sonucum.oyuncu} kişi içinde <b className="text-white">{sonucum.sira}.</b> sıradasın
        </p>
      )}

      {hata && <p className="text-sm text-ze-danger bg-ze-danger/15 border border-ze-danger/40 rounded-xl p-3">{hata}</p>}
    </div>
  )
}

function TakmaAdFormu({ oturum, tamam, numarali = false }: { oturum: string; tamam: (ad: string) => void; numarali?: boolean }) {
  const [ad, setAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    setMesgul(true)
    setHata(null)
    const { data, error } = numarali
      ? await supabase.rpc('numarayla_katil', { p_session: oturum, p_cihaz: cihazKimligi(), p_numara: ad.trim() })
      : await supabase.rpc('takma_ad_al', { p_session: oturum, p_cihaz: cihazKimligi(), p_ad: ad })
    setMesgul(false)
    const s = (data ?? {}) as { durum?: string; ad?: string; hata?: string }
    if (error || !s.durum) {
      setHata(
        s.hata === 'numara_gecersiz'
          ? 'Bu numara sınıf listesinde yok. Numaranı kontrol et.'
          : s.hata === 'numara_kullanildi'
            ? 'Bu numarayla başka bir telefondan girilmiş.'
            : s.hata === 'ad_kullaniliyor'
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
      <p className="text-sm text-slate-300">{numarali ? 'Öğrenci numaranı yaz; puan tablosunda adınla görünürsün. Bu yoklama yerine geçmez.' : 'Puan tablosunda görünecek bir ad yaz.'}</p>
      <input
        autoFocus
        required
        maxLength={numarali ? 20 : 24}
        autoComplete="off"
        inputMode={numarali ? 'numeric' : undefined}
        className="giris-kutusu text-xl text-center"
        placeholder={numarali ? 'Öğrenci numarası' : 'Takma ad'}
        value={ad}
        onChange={(e) => setAd(e.target.value)}
      />
      <button disabled={mesgul || ad.trim().length < (numarali ? 1 : 2)} className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-50">
        Katıl
      </button>
      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
    </form>
  )
}
