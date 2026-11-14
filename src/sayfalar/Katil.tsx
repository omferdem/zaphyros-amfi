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
      setDurum({ tur: 'kod' })
      return
    }

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
      setDurum({ tur: 'ders', ad: null, ders })
    }
    // Adres oturuma bağlanır; sayfa yenilenirse aynı ekran kayıtlı bilgiden geri gelir.
    navigate(`/katil?s=${s}`, { replace: true })
    return null
  }

  if (durum.tur === 'ders' && oturum) return <DersTakibi oturum={oturum} ad={durum.ad} ders={durum.ders} />

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-sm space-y-5">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest text-center">Derse katıl</p>

        {durum.tur === 'yukleniyor' && <p className="text-center text-slate-300">Kod kontrol ediliyor…</p>}

        {durum.tur === 'kod' && <KodFormu gonder={kodlaKatil} />}

        {durum.tur === 'hata' && (
          <>
            <h1 className="text-xl font-extrabold text-center">Yoklamaya girilemedi</h1>
            <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-4">{durum.metin}</p>
            <p className="text-xs text-slate-400 text-center">Perdede 6 haneli bir ders kodu varsa onu da kullanabilirsin:</p>
            <KodFormu gonder={kodlaKatil} kucuk />
          </>
        )}

        {durum.tur === 'form' && (
          <form onSubmit={gonder} className="space-y-4">
            <div className="text-center">
              <h1 className="text-xl font-extrabold">{durum.bilet.ders}</h1>
              {durum.bilet.baslik && <p className="text-sm text-slate-400">{durum.bilet.baslik}</p>}
            </div>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Öğrenci numaran</span>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                maxLength={24}
                value={numara}
                onChange={(e) => setNumara(e.target.value)}
                className="giris-kutusu text-2xl font-mono tracking-wider text-center"
              />
            </label>
            <button disabled={gonderiliyor || !numara.trim()} className="parlak-buton w-full rounded-2xl py-4 text-lg disabled:opacity-60">
              {gonderiliyor ? 'Gönderiliyor…' : 'Yoklamaya katıl ✋'}
            </button>
            {formHata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{formHata}</p>}
            <p className="text-[11px] text-slate-500 text-center">
              Yalnızca numaran kaydedilir. Konum, fotoğraf ya da cihaz bilgisi alınmaz.
            </p>
          </form>
        )}
      </section>
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
    <form onSubmit={gonderForm} className="space-y-4">
      {!kucuk && (
        <>
          <p className="text-6xl text-center suzul" aria-hidden>
            🎓
          </p>
          <h1 className="text-3xl font-extrabold text-center renkli-yazi pb-1">Hoş geldin!</h1>
          <p className="text-sm text-slate-300 text-center">
            Perdedeki QR kodu telefonunun kamerasıyla okut ya da perdede yazan 6 haneli ders kodunu gir.
          </p>
        </>
      )}
      <input
        inputMode="numeric"
        autoComplete="off"
        maxLength={7}
        placeholder="123 456"
        aria-label="Ders kodu"
        value={kod}
        onChange={(e) => setKod(e.target.value)}
        className="giris-kutusu !py-4 text-3xl font-mono tracking-[0.3em] text-center"
      />
      <button disabled={mesgul || temiz.length !== 6} className="parlak-buton w-full rounded-2xl py-4 text-lg disabled:opacity-50">
        {mesgul ? 'Kontrol ediliyor…' : 'Derse katıl 🚀'}
      </button>
      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
      {!kucuk && (
        <p className="text-center">
          <Link to="/panel" className="text-xs text-slate-500 hover:text-slate-300">
            Hoca girişi
          </Link>
        </p>
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
    <Link to={`/quiz?o=${oturum}`} className="rounded-2xl border border-amber-300/50 bg-amber-400/10 p-4 flex items-center gap-3 girdi">
      <span className="text-3xl nabiz" aria-hidden>
        📝
      </span>
      <span className="flex-1 min-w-0">
        <b className="block truncate">Quiz başladı: {quiz.baslik}</b>
        <span className="text-xs text-slate-300">{`${quiz.sure_dk} dakika. Dokun, hemen başla.`}</span>
      </span>
      <span className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold">Başla</span>
    </Link>
  )
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
    <main className="min-h-screen p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-indigo-300 truncate">{durum?.ders ?? ders}</p>
          {durum?.baslik && <p className="text-sm text-slate-400 truncate">{durum.baslik}</p>}
        </div>
        {ad !== null && (
          <span className="nabiz text-[11px] font-bold text-emerald-300 bg-emerald-500/15 rounded-full px-2.5 py-1 whitespace-nowrap">
            ✓ {ad ? `${ad}, ` : ''}yoklama alındı
          </span>
        )}
        {seri && seri.seri >= 2 && (
          <span className="text-[11px] font-bold text-amber-200 bg-amber-500/15 rounded-full px-2.5 py-1 whitespace-nowrap" title={`${seri.toplam} dersin ${seri.katilan}'ine katıldın`}>
            {seri.seri >= 5 ? '⭐' : '🔥'} {seri.seri} ders üst üste
          </span>
        )}
      </header>

      <QuizBandi oturum={oturum} />

      {adim?.tur === 'slayt' && adim.gorsel && durum?.telefon_modu && (
        <button
          className="self-end text-[11px] text-slate-400 hover:text-white"
          onClick={() => {
            sakla('amfi_veri_tasarrufu', tasarruf ? '0' : '1')
            setTasarruf(!tasarruf)
          }}
          title="Slayt görseli telefona indirilmez; mobil verin az gidiyorsa aç"
        >
          {tasarruf ? '🖼️ Slayt görselini göster' : '📶 Veri tasarrufu: görseli gizle'}
        </button>
      )}

      {ad === null && durum?.yoklama_acik && !durum.bitti && (
        <p className="rounded-2xl bg-amber-500/15 text-amber-100 text-sm p-3 text-center">
          Yoklama şu an açık ama yoklaman henüz yazılmadı. Perdedeki <b>QR kodu</b> telefonunun kamerasıyla okut. (Ders kodu yoklama yazmaz; projeksiyonsuz derste hocan kodla yoklama alır.)
        </p>
      )}

      <section className="cam-panel rounded-3xl p-5 flex-1 flex flex-col">
        {!durum ? (
          <p className="text-slate-400 text-sm m-auto">Bağlanıyor…</p>
        ) : durum.bitti ? (
          <div className="m-auto text-center space-y-2 girdi">
            <p className="text-6xl suzul" aria-hidden>
              👋
            </p>
            <p className="text-2xl font-display font-extrabold">Ders bitti</p>
            {karne && (
              <p className="text-lg font-bold text-amber-200">
                🏅 Bugünkü yarışmada {karne.oyuncu} kişi arasında {karne.sira}. oldun ({karne.toplam} puan)
              </p>
            )}
            <p className="text-slate-300">Teşekkürler. Bu sayfayı kapatabilirsin.</p>
          </div>
        ) : adim?.tur === 'slayt' ? (
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
              Slayt {adim.sayfa_no}
              {adim.sayfa_sayisi ? ` / ${adim.sayfa_sayisi}` : ''}
            </p>
            {gorselGoster &&
              (gorsel.url ? (
                <img
                  src={gorsel.url}
                  alt={`Slayt ${adim.sayfa_no}`}
                  className={`w-full rounded-xl bg-white transition-opacity ${gorsel.gecis ? 'opacity-50' : ''}`}
                />
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
          <p className="text-slate-300 m-auto text-center">Yoklama alınıyor. Perdeye bak.</p>
        ) : (
          <p className="text-slate-300 m-auto text-center">Hocanın ekranını izle. Bir sonraki adım burada görünecek.</p>
        )}
      </section>

      {durum && !durum.bitti && <SinifDugmeleri oturum={oturum} />}
    </main>
  )
}
