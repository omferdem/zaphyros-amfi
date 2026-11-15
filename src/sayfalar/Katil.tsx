import TepkiSeridi from '../bilesenler/TepkiSeridi'
import Gorsel from '../bilesenler/Gorsel'
import { varlikBildir } from '../lib/varlik'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import type { DersDurumu } from '../lib/tipler'
import SoruCevabi from '../bilesenler/SoruCevabi'
import { EtkinlikCevabi } from '../bilesenler/Etkinlik'
import { useSlaytGorseli } from '../lib/gorsel'
import SinifDugmeleri from '../bilesenler/SinifDugmeleri'

interface Bilet {
  bilet: string
  ders: string
  baslik: string | null
}

type Durum =
  | { tur: 'yukleniyor' }
  | { tur: 'kod' }
  | { tur: 'hata'; metin: string }
  | { tur: 'form'; bilet: Bilet }
  | { tur: 'ders'; ad: string | null; ders: string }

const HATALAR: Record<string, string> = {
  oturum_yok: 'Bu ders oturumu bulunamadı. Perdedeki QR kodu yeniden okut.',
  yoklama_kapali: 'Bu dersin yoklaması kapandı. Bir sorun varsa hocana söyle.',
  kod_eski: 'Okuttuğun kodun süresi dolmuş. Perdedeki güncel QR kodu yeniden okut.',
  bilet_gecersiz: 'Süre doldu. Perdedeki QR kodu yeniden okutup numaranı tekrar gir.',
  cihaz_gecersiz: 'Tarayıcın tanınamadı. Sayfayı yenileyip tekrar dene.',
  numara_gecersiz: 'Numarayı yalnızca rakam (ve gerekiyorsa harf) olarak yaz.',
  liste_disi:
    'Bu numara bu dersin (şubenin) listesinde yok. Numaranı kontrol et. Başka bir şubedeysen kendi şubenin ders kodunu ya da QR kodunu kullan; doğruysa hocana söyle.',
  numara_kullanildi: 'Bu numarayla bu derste başka bir telefondan yoklama verilmiş. Hatalıysa hocana söyle.',
  cihaz_kullanildi: 'Bu telefondan bu derste başka bir numarayla yoklama verildi. Her öğrenci kendi telefonunu kullanmalı.',
  tekrar_dene: 'Bir çakışma oldu. Lütfen tekrar dene.',
  kod_yanlis: 'Bu kod tutmadı. Perdedeki (ya da hocanın söylediği) güncel kodu yaz.',
}

// Form hatası sayılmayan, akışı bitiren hatalar
const KALICI = new Set(['oturum_yok', 'yoklama_kapali', 'kod_eski', 'bilet_gecersiz', 'cihaz_kullanildi', 'cihaz_gecersiz'])

function biletAnahtari(s: string) {
  return `amfi_bilet_${s}`
}
function katildiAnahtari(s: string) {
  return `amfi_katildi_${s}`
}
/** Yoklamaya girmeden (yoklama kapalıyken kodla) derse katılan öğrenci için. */
function dersAnahtari(s: string) {
  return `amfi_ders_${s}`
}

export default function Katil() {
  const [parametreler, setParametreler] = useSearchParams()
  const navigate = useNavigate()
  const oturum = parametreler.get('s')
  const token = parametreler.get('t')
  const [durum, setDurum] = useState<Durum>({ tur: 'yukleniyor' })
  const [numara, setNumara] = useState(() => oku('amfi_ogrenci_no') ?? '')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [formHata, setFormHata] = useState<string | null>(null)
  const basladi = useRef(false)

  useEffect(() => {
    if (basladi.current) return
    basladi.current = true

    if (!oturum) {
      // Sayfa yenilendi ya da bağlantı kopup geldi: son 12 saatte katıldığı açık derse kod sorulmadan geri dön
      try {
        const kayit = JSON.parse(oku('amfi_son_oturum') ?? 'null') as { s: string; t: number } | null
        if (kayit && Date.now() - kayit.t < 12 * 3600 * 1000) {
          supabase.rpc('ders_durumu', { p_session: kayit.s }).then(({ data }) => {
            const d = data as { bitti?: boolean; hata?: string; ders?: string } | null
            if (d && !d.hata && !d.bitti && oku(katildiAnahtari(kayit.s) ) !== null) navigate(`/katil?s=${kayit.s}`, { replace: true })
            else if (d && !d.hata && !d.bitti && oku(dersAnahtari(kayit.s)) !== null) navigate(`/katil?s=${kayit.s}`, { replace: true })
            else setDurum({ tur: 'kod' })
          })
          return
        }
      } catch {
        /* kayıt okunamadıysa kod ekranı açılır */
      }
      setDurum({ tur: 'kod' })
      return
    }
    sakla('amfi_son_oturum', JSON.stringify({ s: oturum, t: Date.now() }))

    if (!token) {
      // Yoklamaya zaten girildiyse ya da derse kodla katıldıysa ders görünümü, sayfa yenilendiyse
      // daha önce alınan bilet gösterilir. (QR yeniden okutulursa karar her zaman sunucuya bırakılır.)
      const katildi = oku(katildiAnahtari(oturum))
      if (katildi) {
        const { ad, ders } = JSON.parse(katildi) as { ad: string; ders: string }
        setDurum({ tur: 'ders', ad, ders })
        return
      }
      const kayitli = sessionStorage.getItem(biletAnahtari(oturum))
      if (kayitli) {
        setDurum({ tur: 'form', bilet: JSON.parse(kayitli) as Bilet })
        return
      }
      const dersKaydi = oku(dersAnahtari(oturum))
      if (dersKaydi) {
        setDurum({ tur: 'ders', ad: null, ders: (JSON.parse(dersKaydi) as { ders: string }).ders })
        return
      }
      setDurum({ tur: 'kod' })
      return
    }

    supabase
      .rpc('katilim_bileti', { p_session: oturum, p_token: token, p_cihaz: cihazKimligi() })
      .then(({ data, error }) => {
        // Kod adres çubuğundan silinir; link başkasına gönderilse de işe yaramaz.
        setParametreler({ s: oturum }, { replace: true })
        if (error || !data) {
          setDurum({ tur: 'hata', metin: 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip QR kodu yeniden okut.' })
          return
        }
        const sonuc = data as Partial<Bilet> & { hata?: string }
        if (sonuc.hata) {
          setDurum({ tur: 'hata', metin: HATALAR[sonuc.hata] ?? 'Bir sorun oldu. QR kodu yeniden okut.' })
          return
        }
        const bilet = sonuc as Bilet
        sessionStorage.setItem(biletAnahtari(oturum), JSON.stringify(bilet))
        setDurum({ tur: 'form', bilet })
      })
  }, [oturum, token, setParametreler])

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    if (durum.tur !== 'form' || !oturum) return
    setGonderiliyor(true)
    setFormHata(null)
    const { data, error } = await supabase.rpc('check_in', {
      p_session: oturum,
      p_bilet: durum.bilet.bilet,
      p_cihaz: cihazKimligi(),
      p_ogrenci_no: numara,
    })
    setGonderiliyor(false)
    if (error || !data) {
      setFormHata('Sunucuya ulaşılamadı. Tekrar dene.')
      return
    }
    const sonuc = data as { durum?: string; ad?: string; hata?: string }
    if (sonuc.hata) {
      const metin = HATALAR[sonuc.hata] ?? 'Bir sorun oldu. Tekrar dene.'
      if (KALICI.has(sonuc.hata)) {
        sessionStorage.removeItem(biletAnahtari(oturum))
        setDurum({ tur: 'hata', metin })
      } else {
        setFormHata(metin)
      }
      return
    }
    const ad = sonuc.ad ?? ''
    sakla('amfi_ogrenci_no', numara.trim())
    sakla(katildiAnahtari(oturum), JSON.stringify({ ad, ders: durum.bilet.ders }))
    sessionStorage.removeItem(biletAnahtari(oturum))
    setDurum({ tur: 'ders', ad, ders: durum.bilet.ders })
  }

  /** Geç gelen öğrenci: perdedeki 6 haneli kodla katılır. */
  async function kodlaKatil(kod: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('kodla_katil', { p_kod: kod, p_cihaz: cihazKimligi() })
    if (error || !data) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'
    const sonuc = data as { hata?: string; oturum?: string; ders?: string; baslik?: string | null; bilet?: string }
    // Ders kodu değilse habersiz quiz kodu olabilir: öğrenci quiz ekranına geçer.
    if (sonuc.hata === 'kod_yanlis') {
      const { data: quiz } = await supabase.rpc('quiz_bul', { p_kod: kod })
      if (quiz && !(quiz as { hata?: string }).hata) {
        navigate(`/quiz?k=${kod}`)
        return null
      }
    }
    if (sonuc.hata || !sonuc.oturum) return HATALAR[sonuc.hata ?? ''] ?? 'Bir sorun oldu. Tekrar dene.'
    const s = sonuc.oturum
    const ders = sonuc.ders ?? ''
    const katildi = oku(katildiAnahtari(s))
    if (katildi) {
      // Bu telefondan bu derste yoklama zaten verilmiş.
      const k = JSON.parse(katildi) as { ad: string; ders: string }
      setDurum({ tur: 'ders', ad: k.ad, ders: k.ders })
    } else if (sonuc.bilet) {
      const bilet: Bilet = { bilet: sonuc.bilet, ders, baslik: sonuc.baslik ?? null }
      sessionStorage.setItem(biletAnahtari(s), JSON.stringify(bilet))
      setDurum({ tur: 'form', bilet })
    } else {
      sakla(dersAnahtari(s), JSON.stringify({ ders }))
      sakla(`amfi_kod_${s}`, kod)
      sakla('amfi_son_oturum', JSON.stringify({ s, t: Date.now() }))
      setDurum({ tur: 'ders', ad: null, ders })
    }
    // Adres oturuma bağlanır; sayfa yenilenirse aynı ekran kayıtlı bilgiden geri gelir.
    navigate(`/katil?s=${s}`, { replace: true })
    return null
  }

  if (durum.tur === 'ders' && oturum) return <DersTakibi oturum={oturum} ad={durum.ad} ders={durum.ders} />

  return (
    <main className="min-h-screen flex flex-col justify-center p-4 max-w-md mx-auto">
      {durum.tur === 'yukleniyor' && (
        <div className="glass-panel p-5 space-y-4 animate-pop" aria-busy="true">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl p-1 animate-spin" style={{ background: 'conic-gradient(from 0deg, #ff4d9d, #7c5cff, #22e3d2, #ff4d9d)' }}>
              <div className="w-full h-full bg-ze-bg rounded-lg" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">Kod kontrol ediliyor…</p>
              <p className="font-mono text-[11px] text-slate-400">Senkronizasyon bekleniyor</p>
            </div>
          </div>
          <div className="h-12 rounded-xl bg-white/10 animate-pulse" />
        </div>
      )}

      {durum.tur === 'kod' && <KodFormu gonder={kodlaKatil} />}

      {durum.tur === 'hata' && (
        <div className="space-y-5 animate-pop">
          <div role="alert" className="glass-panel p-5 text-center space-y-3 border-ze-danger/40">
            <div className="w-12 h-12 rounded-2xl bg-ze-danger/20 text-ze-danger flex items-center justify-center mx-auto text-2xl" aria-hidden>
              ⚠
            </div>
            <h1 className="font-display font-bold text-lg">Yoklamaya girilemedi</h1>
            <p className="text-xs text-slate-300 leading-relaxed">{durum.metin}</p>
          </div>
          <p className="text-xs text-slate-400 text-center">Perdede 6 haneli bir ders kodu varsa onu da kullanabilirsin:</p>
          <KodFormu gonder={kodlaKatil} kucuk />
        </div>
      )}

      {durum.tur === 'form' && (
        <form onSubmit={gonder} className="my-auto space-y-5 py-4 animate-pop">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="min-w-0">
                <span className="font-mono text-xs text-ze-cyan font-bold">Canlı yoklama</span>
                <h1 className="font-display font-extrabold text-xl truncate">{durum.bilet.ders}</h1>
                {durum.bilet.baslik && <p className="text-xs text-slate-400 truncate">{durum.bilet.baslik}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="ogrenci-no" className="text-xs font-semibold text-slate-200 block">
                Öğrenci numaranı gir
              </label>
              <input
                id="ogrenci-no"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                maxLength={24}
                placeholder="Örn: 20241048"
                value={numara}
                onChange={(e) => setNumara(e.target.value)}
                className="ze-input min-h-[54px] px-4 border-white/20 font-mono font-bold text-lg"
              />
            </div>
            {formHata && (
              <div role="alert" className="p-3 rounded-xl bg-ze-danger/20 border border-ze-danger/40 text-ze-danger text-xs font-bold animate-pop">
                {formHata}
              </div>
            )}
            <button disabled={gonderiliyor || !numara.trim()} className="btn-primary w-full py-3.5 rounded-2xl font-display font-bold text-base flex items-center justify-center gap-2">
              <span>✓</span>
              <span>{gonderiliyor ? 'Gönderiliyor…' : 'Yoklamamı ver'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 text-center">Yalnızca numaran kaydedilir. Konum, fotoğraf ya da cihaz bilgisi alınmaz.</p>
        </form>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

function KodFormu({ gonder, kucuk = false }: { gonder: (kod: string) => Promise<string | null>; kucuk?: boolean }) {
  const [kod, setKod] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const temiz = kod.replace(/\D/g, '')

  async function gonderForm(e: React.FormEvent) {
    e.preventDefault()
    setMesgul(true)
    setHata(null)
    const h = await gonder(temiz)
    setMesgul(false)
    if (h) setHata(h)
  }

  return (
    <form onSubmit={gonderForm} className={`space-y-6 ${kucuk ? '' : 'py-4'} animate-pop`}>
      {!kucuk && (
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-ze-gradient p-[2px] mx-auto shadow-[0_0_32px_rgba(255,77,157,0.45)]">
              <div className="w-full h-full bg-ze-bg rounded-[14px] flex items-center justify-center">
                <span className="font-display font-extrabold text-2xl text-ze-gradient">ZE</span>
              </div>
            </div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight">Derse katıl</h1>
        </div>
      )}
      <div className="glass-panel p-5 space-y-4">
        <label htmlFor="ders-kodu" className="text-xs font-mono uppercase tracking-wider text-slate-300 block text-center">
          6 haneli ders kodu
        </label>
        <input
          id="ders-kodu"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={7}
          placeholder="123 456"
          aria-label="6 haneli sayısal ders kodu"
          value={kod}
          onChange={(e) => {
            setKod(e.target.value)
            setHata(null)
          }}
          className={`ze-input min-h-[64px] text-center font-mono font-extrabold text-3xl tracking-[0.35em] border-2 px-3 ${hata ? 'border-ze-danger text-ze-danger' : 'border-white/20 text-ze-yellow'}`}
        />
        {hata && (
          <div role="alert" className="p-3 rounded-xl bg-ze-danger/20 border border-ze-danger/40 text-ze-danger text-xs font-bold flex items-center justify-center gap-2 animate-pop">
            <span aria-hidden>⚠</span>
            <span>{hata}</span>
          </div>
        )}
        <button disabled={mesgul || temiz.length !== 6} className="btn-primary w-full py-3.5 rounded-2xl font-display font-bold text-base">
          {mesgul ? 'Kontrol ediliyor…' : 'Katıl'}
        </button>
      </div>
      {!kucuk && (
        <>
          <p className="text-center text-xs text-slate-400">Perdedeki kodu yaz ya da QR'ı okut.</p>
          <p className="text-center">
            <Link to="/panel" className="text-[11px] text-slate-500 hover:text-slate-300">
              Hoca girişi
            </Link>
          </p>
        </>
      )}
    </form>
  )
}

/**
 * Derse katılmış öğrencinin ekranı: perdede ne varsa onu izler. Slayttaysa slaytın metni
 * görünür. Değişiklik veritabanının yayınından gelir; bağlantı koparsa 20 saniyede bir sorulur.
 */
/** Şubede açık quiz varsa derse girmiş öğrenciye tek dokunuşluk bant gösterir (kod ve numara sorulmaz). RPC yoksa sessizce görünmez. */
function QuizBandi({ oturum }: { oturum: string }) {
  const [quiz, setQuiz] = useState<{ baslik: string; sure_dk: number; kimlik: boolean; bitti: boolean } | null>(null)
  useEffect(() => {
    let iptal = false
    async function sor() {
      const { data, error } = await supabase.rpc('oturum_quizi', { p_session: oturum, p_cihaz: cihazKimligi() })
      if (iptal || error) return
      setQuiz((data as { quiz?: typeof quiz })?.quiz ?? null)
    }
    sor()
    const t = setInterval(sor, 10000)
    return () => {
      iptal = true
      clearInterval(t)
    }
  }, [oturum])
  if (!quiz || quiz.bitti || !quiz.kimlik) return null
  return (
    <Link
      to={`/quiz?o=${oturum}`}
      className="p-3 rounded-2xl bg-gradient-to-r from-ze-pink/25 via-ze-purple/25 to-ze-cyan/20 border border-ze-pink/50 flex items-center justify-between gap-2 animate-pop"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-8 h-8 rounded-xl bg-ze-pink/25 text-ze-pink flex items-center justify-center shrink-0" aria-hidden>
          📝
        </span>
        <span className="min-w-0">
          <span className="font-display font-bold text-xs block truncate">Quiz başladı: {quiz.baslik}</span>
          <span className="font-mono text-[11px] text-ze-yellow">Süre: {quiz.sure_dk} dk</span>
        </span>
      </span>
      <span className="btn-primary px-3.5 py-1.5 rounded-xl font-display font-bold text-xs flex items-center">Başla</span>
    </Link>
  )
}

/** Kaydedilen görsellerin ve indirmelerin adı: DersAdi_Hafta3_Slayt12.png (Türkçe karakterler sadeleşir). */
function dosyaAdi(ders: string, baslik: string | null | undefined, slayt: number | null): string {
  const sade = (m: string) =>
    m
      .replace(/ç/gi, (c) => (c === 'ç' ? 'c' : 'C'))
      .replace(/ğ/gi, (c) => (c === 'ğ' ? 'g' : 'G'))
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ö/gi, (c) => (c === 'ö' ? 'o' : 'O'))
      .replace(/ş/gi, (c) => (c === 'ş' ? 's' : 'S'))
      .replace(/ü/gi, (c) => (c === 'ü' ? 'u' : 'U'))
      .replace(/[^A-Za-z0-9]+/g, '')
  const hafta = baslik?.match(/(\d+)/)?.[1]
  return `${sade(ders) || 'Ders'}_${hafta ? `Hafta${hafta}_` : ''}Slayt${slayt ?? 0}.png`
}

function DersTakibi({ oturum, ad, ders }: { oturum: string; ad: string | null; ders: string }) {
  const [durum, setDurum] = useState<DersDurumu | null>(null)

  useEffect(() => {
    let iptal = false
    async function sor() {
      const { data } = await supabase.rpc('ders_durumu', { p_session: oturum })
      if (!iptal && data && !(data as { hata?: string }).hata) setDurum(data as DersDurumu)
    }
    sor()
    const kanal = supabase
      .channel(`oturum:${oturum}`)
      .on('broadcast', { event: 'durum' }, ({ payload }) => {
        if (payload && typeof payload === 'object' && 'ders' in payload) setDurum(payload as DersDurumu)
        else sor()
      })
      .subscribe()
    const t = setInterval(sor, 20000)
    return () => {
      iptal = true
      clearInterval(t)
      supabase.removeChannel(kanal)
    }
  }, [oturum])

  // Çevrimiçi sayısı için sahneye "bağlıyım" bildirimi (veritabanına yazılmaz)
  useEffect(() => varlikBildir(oturum, cihazKimligi()), [oturum])
  const [oturumKodu] = useState(() => oku(`amfi_kod_${oturum}`))

  // Devam serisi: yoklaması alınmış öğrenciye "🔥 N ders üst üste" rozeti (fonksiyon yoksa ya da hata olursa sessizce görünmez)
  const [seri, setSeri] = useState<{ seri: number; katilan: number; toplam: number } | null>(null)
  const yoklamaAlindi = ad !== null
  useEffect(() => {
    if (!yoklamaAlindi) return
    supabase.rpc('devam_serisi', { p_session: oturum, p_cihaz: cihazKimligi() }).then(({ data, error }) => {
      if (!error && data) setSeri(data as { seri: number; katilan: number; toplam: number })
    })
  }, [yoklamaAlindi, oturum])

  // Ders bitince, derste yarışma oynandıysa öğrencinin kendi sırası ve puanı gösterilir
  const [karne, setKarne] = useState<{ sira: number; toplam: number; oyuncu: number } | null>(null)
  const dersBitti = !!durum?.bitti
  useEffect(() => {
    if (!dersBitti) return
    supabase.rpc('benim_sonucum', { p_session: oturum, p_cihaz: cihazKimligi() }).then(({ data }) => {
      const d = data as { sira?: number | null; toplam?: number; oyuncu?: number } | null
      if (d && d.sira && d.toplam && d.oyuncu) setKarne({ sira: d.sira, toplam: d.toplam, oyuncu: d.oyuncu })
    })
  }, [dersBitti, oturum])

  const adim = durum?.adim
  // Veri tasarrufu: açıkken slayt görseli telefona indirilmez (yalnızca slaytın yazısı görünür)
  const [tasarruf, setTasarruf] = useState(() => oku('amfi_veri_tasarrufu') === '1')
  const gorselGoster = !!adim?.gorsel && !!durum?.telefon_modu && !tasarruf
  const gorsel = useSlaytGorseli(adim?.tur === 'slayt' && gorselGoster ? adim.gorsel : null)
  const satirlar = (adim?.tur === 'slayt' ? adim.metin ?? '' : '').split('\n').filter(Boolean)

  return (
    <main className="min-h-screen p-4 pb-28 flex flex-col gap-4 max-w-lg mx-auto">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono font-semibold text-slate-300 truncate">{durum?.ders ?? ders}</p>
          {durum?.baslik && <p className="text-xs text-slate-500 truncate">{durum.baslik}</p>}
        </div>
        {ad !== null && (
          <span className="nabiz shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-lime bg-lime/15 border border-lime/35 rounded-lg px-2 py-1 whitespace-nowrap">
            ✓ {ad ? `${ad}, ` : ''}yoklama alındı
          </span>
        )}
        {seri && seri.seri >= 2 && (
          <span className="shrink-0 text-[11px] font-mono font-bold text-sari bg-sari/15 border border-sari/35 rounded-lg px-2 py-1 whitespace-nowrap" title={`${seri.toplam} dersin ${seri.katilan}'ine katıldın`}>
            <Gorsel ad={`rozet-seri-${seri.seri >= 10 ? 3 : seri.seri >= 5 ? 2 : 1}.webp`} emoji={seri.seri >= 5 ? '⭐' : '🔥'} className="inline-block w-5 h-5 align-text-bottom mr-0.5" emojiClass="" /> {seri.seri} ders üst üste
          </span>
        )}
      </header>

      <QuizBandi oturum={oturum} />

      {adim?.tur === 'slayt' && adim.gorsel && durum?.telefon_modu && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10">
          <span className="text-xs text-slate-300">Veri tasarrufu (slayt görsellerini gizle)</span>
          <button
            role="switch"
            aria-checked={tasarruf}
            aria-label="Veri tasarrufu"
            onClick={() => {
              sakla('amfi_veri_tasarrufu', tasarruf ? '0' : '1')
              setTasarruf(!tasarruf)
            }}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors ${tasarruf ? 'bg-turkuaz' : 'bg-white/15'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-zemin transition-transform ${tasarruf ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      )}

      {ad === null && durum?.yoklama_acik && !durum.bitti && (
        <div className="rounded-2xl bg-sari/10 border border-sari/35 p-3 flex gap-3 items-start">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-sari/20 text-sari flex items-center justify-center text-lg" aria-hidden>
            📲
          </span>
          <p className="text-sm text-amber-100">
            <b className="block text-sari">Yoklama şu an açık</b>
            Yoklaman henüz yazılmadı. Perdedeki <b>QR kodu</b> telefonunun kamerasıyla okut. (Ders kodu yoklama yazmaz; projeksiyonsuz derste hocan kodla yoklama alır.)
          </p>
        </div>
      )}

      <section className="glass-panel p-4 flex-1 flex flex-col">
        {!durum ? (
          <div className="my-auto space-y-4" aria-busy="true">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl p-1 animate-spin" style={{ background: 'conic-gradient(from 0deg, #ff4d9d, #7c5cff, #22e3d2, #ff4d9d)' }}>
                <div className="w-full h-full bg-zemin rounded-lg" />
              </div>
              <div>
                <p className="text-sm font-bold">Ders adımı yükleniyor…</p>
                <p className="text-[11px] font-mono text-slate-400">Bağlanıyor</p>
              </div>
            </div>
            <div className="h-28 rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-10 rounded-xl bg-white/10 animate-pulse" />
          </div>
        ) : durum.bitti ? (
          <div className="my-auto space-y-5 py-3 text-center relative overflow-hidden animate-pop">
            <svg className="w-full h-16 mx-auto animate-confetti" viewBox="0 0 320 60" fill="none" aria-hidden>
              <circle cx="40" cy="18" r="5" fill="#ff4d9d" />
              <rect x="85" y="10" width="10" height="6" rx="2" transform="rotate(25 85 10)" fill="#22e3d2" />
              <circle cx="145" cy="22" r="4" fill="#ffd23f" />
              <polygon points="195,8 203,20 187,20" fill="#b8ff4a" />
              <rect x="245" y="14" width="12" height="6" rx="2" transform="rotate(-20 245 14)" fill="#7c5cff" />
              <circle cx="285" cy="26" r="5" fill="#ff4d9d" />
            </svg>
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-ze-gradient p-[1.5px] mx-auto shadow-lg">
                <div className="w-full h-full bg-ze-bg rounded-[14px] flex items-center justify-center">
                  <span className="font-display font-extrabold text-xl text-ze-gradient">ZE</span>
                </div>
              </div>
              <h1 className="font-display font-extrabold text-2xl">Ders bitti, teşekkürler</h1>
              <p className="text-xs text-slate-300">{durum.ders}</p>
            </div>
            {karne && (
              <div className="glass-panel p-5 space-y-3 text-left border-ze-cyan/40">
                <div className="flex items-center gap-2 text-ze-yellow font-display font-bold text-sm">
                  <span aria-hidden>🏆</span>
                  <span>Bugünkü ders karnen</span>
                </div>
                <p className="font-display font-bold text-base leading-snug">
                  Bugünkü yarışmada {karne.oyuncu} kişi arasında <span className="text-ze-cyan">{karne.sira}. oldun</span>, <span className="font-mono text-ze-lime">{karne.toplam} puan</span>
                </p>
              </div>
            )}
            {seri && seri.seri >= 2 && (
              <div className="glass-panel p-4 flex items-center justify-between bg-ze-yellow/10 border-ze-yellow/35">
                <div className="flex items-center gap-2.5 text-left">
                  <span className="w-10 h-10 rounded-xl bg-ze-yellow/20 text-ze-yellow flex items-center justify-center text-lg" aria-hidden>
                    🔥
                  </span>
                  <div>
                    <p className="font-display font-bold text-sm">{seri.seri} ders üst üste katılım serisi!</p>
                    <p className="text-[11px] text-slate-300">Haftaya da gelerek serini koru</p>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-lg text-ze-yellow">{seri.seri}x</span>
              </div>
            )}
            <p className="text-xs text-slate-400">Bu sayfayı kapatabilirsin.</p>
          </div>
        ) : adim?.tur === 'slayt' ? (
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              Slayt {adim.sayfa_no}
              {adim.sayfa_sayisi ? ` / ${adim.sayfa_sayisi}` : ''}
            </p>
            {gorselGoster &&
              (gorsel.url ? (
                <>
                  <img
                    src={gorsel.url}
                    alt={`Slayt ${adim.sayfa_no}`}
                    className={`w-full rounded-xl bg-white transition-opacity ${gorsel.gecis ? 'opacity-50' : ''}`}
                  />
                  <a
                    href={gorsel.url}
                    download={dosyaAdi(durum?.ders ?? ders, durum?.baslik, adim.sayfa_no)}
                    className="text-[11px] text-slate-400 hover:text-white underline self-end"
                  >
                    Görseli kaydet
                  </a>
                </>
              ) : (
                <div className="aspect-video rounded-xl bg-white/5 flex items-center justify-center text-sm text-slate-400 text-center px-4">
                  {gorsel.hata ? 'Görsel yüklenemedi. Aşağıdaki metne bak.' : 'Slayt yükleniyor…'}
                </div>
              ))}
            {satirlar.length ? (
              gorselGoster ? (
                <details className="text-sm text-slate-300" open={gorsel.hata}>
                  <summary className="cursor-pointer text-slate-400">Slaytın metni</summary>
                  <div className="mt-2 space-y-2">
                    {satirlar.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                  </div>
                </details>
              ) : (
                <>
                  <h1 className="text-xl font-extrabold leading-snug">{satirlar[0]}</h1>
                  {satirlar.slice(1).map((s, i) => (
                    <p key={i} className="text-base text-slate-200 leading-relaxed">
                      {s}
                    </p>
                  ))}
                </>
              )
            ) : gorselGoster ? null : (
              <p className="text-slate-400">{durum?.telefon_modu ? 'Bu slaytta yazı yok.' : 'Bu slaytta yazı yok; perdeye bak.'}</p>
            )}
          </div>
        ) : adim?.tur === 'soru' ? (
          <SoruCevabi key={adim.id} oturum={oturum} adim={adim} yoklamali={ad !== null} />
        ) : adim?.tur === 'fikir' || adim?.tur === 'oylama' || adim?.tur === 'video' ? (
          <EtkinlikCevabi key={adim.id} oturum={oturum} adim={adim} telefonModu={!!durum?.telefon_modu} />
        ) : adim?.tur === 'yoklama' ? (
          <div className="m-auto text-center space-y-3 pop">
            <div className="w-16 h-16 rounded-2xl bg-turkuaz/15 border border-turkuaz/40 text-turkuaz flex items-center justify-center mx-auto text-3xl" aria-hidden>
              ▣
            </div>
            <p className="font-mono text-xs uppercase tracking-wider text-turkuaz font-bold">Canlı yoklama açık</p>
            <h1 className="font-display font-extrabold text-2xl">Perdeye bak, QR'ı okut</h1>
            <p className="text-xs text-slate-300">Kameranı perdedeki QR koda doğrult, numaranı gir.</p>
          </div>
        ) : (
          <div className="m-auto text-center space-y-5 pop">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full opacity-30 blur-md nefes" style={{ background: 'linear-gradient(135deg, #ff4d9d, #7c5cff 52%, #22e3d2)' }} />
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="relative z-10 w-14 h-14" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display font-bold text-xl leading-snug">Hocanın ekranını izle. Bir sonraki adım burada görünecek.</h1>
              <p className="text-xs text-slate-400">Ders akışı canlı bağlı. Yeni soru ya da etkinlik başlayınca ekranın kendiliğinden açılır.</p>
            </div>
          </div>
        )}
      </section>

      {durum && !durum.bitti && <SinifDugmeleri oturum={oturum} />}
      {durum && !durum.bitti && !(adim?.tur === 'soru' && adim.soru_durum === 'acik') && <TepkiSeridi oturum={oturum} />}
      {oturumKodu && !durum?.bitti && (
        <span className="fixed right-3 bottom-3 z-20 rounded-lg bg-ze-bg/80 border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-400 backdrop-blur" title="Ders kodu (sayfa yenilenirse kod sorulmaz)">
          Kod {oturumKodu.slice(0, 3)} {oturumKodu.slice(3)}
        </span>
      )}
    </main>
  )
}
