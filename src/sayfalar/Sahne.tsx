import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Adim, Ders, DersDurumu, Oturum, PuanSatiri, Sunum } from '../lib/tipler'
import { oturumGetir } from '../lib/veri'
import { adimlariGetir, sunumlariGetirIdIle } from '../lib/akis'
import { kisaAd, oturumAdi } from '../lib/bicim'
import { SlaytCizimi, usePdfBelgeleri } from '../bilesenler/Slayt'
import { SIKLAR, bitisAni } from '../lib/yarisma'

interface Gelen {
  student_id: string
  zaman: string
  ad: string
}

/** Sitenin kök adresi (HashRouter olduğu için sayfa yolları # işaretinden sonra gelir). */
function kokAdres(): string {
  return window.location.origin + window.location.pathname
}

/** Öğrencinin perdede okuyup yazacağı kısa adres, ör. omferdem.github.io/zaphyros-amfi */
function kisaAdres(): string {
  return (window.location.host + window.location.pathname).replace(/\/$/, '')
}

/** Öğrencinin QR'dan açacağı adres. */
function katilimAdresi(oturumId: string, token: string): string {
  return `${kokAdres()}#/katil?s=${oturumId}&t=${token}`
}

function kodBicimle(kod: string): string {
  return `${kod.slice(0, 3)} ${kod.slice(3)}`
}

/** Dakikada bir değişen ders kodu (geç gelenler için). */
function useDersKodu(oturumId: string, etkin: boolean) {
  const [kod, setKod] = useState<string | null>(null)
  useEffect(() => {
    if (!etkin) {
      setKod(null)
      return
    }
    let iptal = false
    let zamanlayici: ReturnType<typeof setTimeout>
    async function yenile() {
      const { data, error } = await supabase.rpc('ders_kodu', { p_session: oturumId })
      if (iptal) return
      if (error || !data) {
        zamanlayici = setTimeout(yenile, 5000)
        return
      }
      const d = data as { kod: string; kalan_ms: number }
      setKod(d.kod)
      zamanlayici = setTimeout(yenile, Math.max(500, d.kalan_ms + 300))
    }
    yenile()
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [oturumId, etkin])
  return kod
}

export default function Sahne() {
  const { oturumId = '' } = useParams()
  const [oturum, setOturum] = useState<(Oturum & { courses: Ders }) | null | undefined>(undefined)
  const [mevcut, setMevcut] = useState(0)
  const [gelenler, setGelenler] = useState<Gelen[]>([])
  const [adimlar, setAdimlar] = useState<Adim[]>([])
  const [sunumlar, setSunumlar] = useState<Map<string, Sunum>>(new Map())
  const [mevcutGoster, setMevcutGoster] = useState(true)
  const [kodGoster, setKodGoster] = useState(true)
  const [kumandaAcik, setKumandaAcik] = useState(false)
  const [puanAcik, setPuanAcik] = useState(false)

  const acik = !!oturum && oturum.yoklama_acik && !oturum.bitti
  const kod = useDersKodu(oturumId, !!oturum && !oturum.bitti)

  // Oturum, sınıf mevcudu ve akış
  useEffect(() => {
    oturumGetir(oturumId)
      .then(async (o) => {
        setOturum(o)
        if (!o) return
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', o.course_id)
        setMevcut(count ?? 0)
      })
      .catch(() => setOturum(null))
  }, [oturumId])

  const akisId = oturum?.lesson_id ?? null
  useEffect(() => {
    if (!akisId) {
      setAdimlar([])
      return
    }
    adimlariGetir(akisId)
      .then(async (a) => {
        setAdimlar(a)
        const idler = [...new Set(a.flatMap((x) => (x.presentation_id ? [x.presentation_id] : [])))]
        const s = await sunumlariGetirIdIle(idler)
        setSunumlar(new Map(s.map((x) => [x.id, x])))
      })
      .catch(() => setAdimlar([]))
  }, [akisId])

  const { belgeler } = usePdfBelgeleri(oturum?.courses.subject_id, [...sunumlar.keys()])

  // Gelenler listesi: ilk yüklemede ve her yeni kayıtta yeniden çekilir.
  const gelenleriYukle = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('student_id, zaman, students(ad_soyad)')
      .eq('session_id', oturumId)
      .order('zaman', { ascending: false })
      .limit(1000)
    if (!data) return
    setGelenler(
      (data as unknown as { student_id: string; zaman: string; students: { ad_soyad: string } | null }[]).map((r) => ({
        student_id: r.student_id,
        zaman: r.zaman,
        ad: kisaAd(r.students?.ad_soyad ?? ''),
      })),
    )
  }, [oturumId])

  const bekleyen = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    gelenleriYukle()
    const tetikle = () => {
      if (bekleyen.current) return
      bekleyen.current = setTimeout(() => {
        bekleyen.current = null
        gelenleriYukle()
      }, 400)
    }
    const kanal = supabase
      .channel(`sahne:${oturumId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `session_id=eq.${oturumId}` }, tetikle)
      // Kumandadan gelen adım değişikliği ve yoklama durumu da bu yoldan gelir.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${oturumId}` }, (p) =>
        setOturum((o) => (o ? { ...o, ...(p.new as Partial<Oturum>) } : o)),
      )
      .subscribe()
    // Realtime bağlantısı koparsa diye 20 saniyede bir yedek yenileme
    const yedek = setInterval(() => {
      gelenleriYukle()
      oturumGetir(oturumId)
        .then((o) => {
          if (o) setOturum((e) => (e ? { ...e, aktif_adim: o.aktif_adim, yoklama_acik: o.yoklama_acik, bitti: o.bitti, soru_durum: o.soru_durum } : o))
        })
        .catch(() => {})
    }, 20000)
    return () => {
      clearInterval(yedek)
      if (bekleyen.current) clearTimeout(bekleyen.current)
      supabase.removeChannel(kanal)
    }
  }, [oturumId, gelenleriYukle])

  const aktifSira = useMemo(() => adimlar.findIndex((a) => a.id === oturum?.aktif_adim), [adimlar, oturum?.aktif_adim])
  const aktif = aktifSira >= 0 ? adimlar[aktifSira] : null
  const slaytGorunumu = aktif?.tur === 'slayt'

  const git = useCallback(
    async (adim: Adim | undefined) => {
      if (!adim) return
      setOturum((o) => (o ? { ...o, aktif_adim: adim.id } : o))
      await supabase.from('sessions').update({ aktif_adim: adim.id }).eq('id', oturumId)
    },
    [oturumId],
  )
  const ileri = useCallback(() => git(adimlar[aktifSira + 1]), [git, adimlar, aktifSira])
  const geri = useCallback(() => git(adimlar[aktifSira - 1]), [git, adimlar, aktifSira])

  // Klavye ve sunum kumandası (clicker): sağ ok, PageDown, boşluk ileri; sol ok, PageUp geri.
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        ileri()
      } else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        geri()
      } else if (e.key === 'k' || e.key === 'K') {
        setKodGoster((g) => !g)
      } else if (e.key === 'f' || e.key === 'F') {
        tamEkran()
      }
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [ileri, geri])

  async function yoklamaDurumu(ac: boolean) {
    const { data } = await supabase
      .from('sessions')
      .update(ac ? { yoklama_acik: true, bitti: null } : { yoklama_acik: false })
      .eq('id', oturumId)
      .select('id, course_id, baslik, yoklama_acik, basladi, bitti, lesson_id, aktif_adim, soru_durum')
      .single()
    if (data) setOturum((o) => (o ? { ...o, ...(data as Oturum) } : o))
  }

  if (oturum === undefined)
    return <main className="min-h-screen flex items-center justify-center text-slate-400">Yükleniyor…</main>
  if (oturum === null)
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-400">
        <p>
          Oturum bulunamadı. <Link to="/panel" className="underline">Panele dön</Link>
        </p>
      </main>
    )

  const araclar = (
    <div className="flex flex-wrap items-center gap-2">
      {adimlar.length > 0 && (
        <>
          <button className="ikincil-buton" onClick={geri} disabled={aktifSira <= 0} aria-label="Önceki adım">
            ◀
          </button>
          <span className="text-sm font-mono text-slate-300 tabular-nums">
            {aktifSira + 1} / {adimlar.length}
          </span>
          <button className="ikincil-buton" onClick={ileri} disabled={aktifSira >= adimlar.length - 1} aria-label="Sonraki adım">
            ▶
          </button>
        </>
      )}
      {!slaytGorunumu && aktif?.tur !== 'soru' && (
        <button className="ikincil-buton" onClick={() => setMevcutGoster(!mevcutGoster)}>
          {mevcutGoster ? 'Mevcudu gizle' : 'Mevcudu göster'}
        </button>
      )}
      <button className="ikincil-buton" onClick={() => yoklamaDurumu(!acik)}>
        {acik ? 'Yoklamayı kapat' : 'Yoklamayı aç'}
      </button>
      <button className="ikincil-buton" onClick={() => setKodGoster((g) => !g)}>
        {kodGoster ? 'Kodu gizle' : 'Kodu göster'}
      </button>
      {adimlar.some((a) => a.tur === 'soru') && (
        <button className="ikincil-buton" onClick={() => setPuanAcik(true)}>
          Puan tablosu
        </button>
      )}
      <button className="ikincil-buton" onClick={() => setKumandaAcik(true)}>
        Kumanda
      </button>
      <button className="ikincil-buton" onClick={tamEkran}>
        Tam ekran
      </button>
      <Link to={`/panel/oturum/${oturum.id}`} className="ikincil-buton">
        Panel
      </Link>
    </div>
  )

  return (
    <>
      {aktif?.tur === 'soru' ? (
        <SoruSahnesi
          // Her soruda baştan kurulur; önceki sorunun bitmiş sayacı yeni soruya taşınmasın.
          key={aktif.id}
          oturumId={oturum.id}
          adimId={aktif.id}
          soruDurum={oturum.soru_durum}
          araclar={araclar}
          kod={kodGoster ? kod : null}
        />
      ) : slaytGorunumu && aktif ? (
        <SlaytSahnesi
          belge={aktif.presentation_id ? belgeler.get(aktif.presentation_id) : undefined}
          sayfaNo={aktif.sayfa_no ?? 1}
          araclar={araclar}
          kod={kodGoster ? kod : null}
          katilan={gelenler.length}
        />
      ) : (
        <YoklamaSahnesi
          oturum={oturum}
          acik={acik}
          gelenler={gelenler}
          mevcut={mevcut}
          mevcutGoster={mevcutGoster}
          kod={kodGoster ? kod : null}
          araclar={araclar}
        />
      )}
      {kumandaAcik && <KumandaQr oturumId={oturum.id} kapat={() => setKumandaAcik(false)} />}
      {puanAcik && <PuanTablosu oturumId={oturum.id} kapat={() => setPuanAcik(false)} />}
    </>
  )
}

function tamEkran() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

// ---------------------------------------------------------------------------

function KodSeridi({ kod, buyuk = false }: { kod: string; buyuk?: boolean }) {
  return (
    <p className={`text-center text-slate-300 ${buyuk ? 'text-base lg:text-lg' : 'text-sm'}`}>
      Geç mi kaldın? <b className="text-white">{kisaAdres()}</b> adresine gir, kodu yaz:{' '}
      <b className={`font-mono text-white tracking-widest ${buyuk ? 'text-2xl lg:text-3xl' : 'text-xl'}`}>{kodBicimle(kod)}</b>
    </p>
  )
}

function SlaytSahnesi({
  belge,
  sayfaNo,
  araclar,
  kod,
  katilan,
}: {
  belge: Parameters<typeof SlaytCizimi>[0]['belge']
  sayfaNo: number
  araclar: React.ReactNode
  kod: string | null
  katilan: number
}) {
  return (
    <main className="h-screen bg-black flex flex-col relative group">
      <SlaytCizimi belge={belge} sayfaNo={sayfaNo} className="flex-1 min-h-0" />
      {/* Araç çubuğu yalnızca fare üzerine gelince görünür; perdede slaytı kapatmaz. */}
      <div className="absolute top-0 inset-x-0 p-3 flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <div className="cam-panel rounded-2xl p-2">{araclar}</div>
      </div>
      {kod && (
        <div className="absolute bottom-3 right-3 cam-panel rounded-2xl px-4 py-2 flex items-center gap-4">
          <span className="text-xs text-slate-400">
            <b className="text-emerald-300 text-sm">{katilan}</b> katılan
          </span>
          <KodSeridi kod={kod} />
        </div>
      )}
    </main>
  )
}

function YoklamaSahnesi({
  oturum,
  acik,
  gelenler,
  mevcut,
  mevcutGoster,
  kod,
  araclar,
}: {
  oturum: Oturum & { courses: Ders }
  acik: boolean
  gelenler: Gelen[]
  mevcut: number
  mevcutGoster: boolean
  kod: string | null
  araclar: React.ReactNode
}) {
  const oturumId = oturum.id
  const [qr, setQr] = useState<string | null>(null)
  const [qrHata, setQrHata] = useState(false)
  const [kalan, setKalan] = useState({ ms: 10000, toplam: 10000, an: Date.now() })
  const [simdi, setSimdi] = useState(Date.now())

  // Dönen QR: sunucudan güncel kodu al, pencere bitince yenisini iste.
  useEffect(() => {
    if (!acik) {
      setQr(null)
      return
    }
    let iptal = false
    let zamanlayici: ReturnType<typeof setTimeout>
    async function yenile() {
      const { data, error } = await supabase.rpc('qr_token', { p_session: oturumId })
      if (iptal) return
      if (error || !data) {
        setQrHata(true)
        zamanlayici = setTimeout(yenile, 3000)
        return
      }
      setQrHata(false)
      const { token, kalan_ms } = data as { token: string; kalan_ms: number }
      const resim = await QRCode.toDataURL(katilimAdresi(oturumId, token), {
        // L: daha az ve daha iri kare; amfinin arka sıralarından okumak kolaylaşır.
        errorCorrectionLevel: 'L',
        margin: 1,
        width: 720,
        color: { dark: '#040711', light: '#ffffff' },
      })
      if (iptal) return
      setQr(resim)
      setKalan({ ms: kalan_ms, toplam: 10000, an: Date.now() })
      zamanlayici = setTimeout(yenile, Math.max(500, kalan_ms + 150))
    }
    yenile()
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [acik, oturumId])

  // Geri sayım çubuğu
  useEffect(() => {
    const t = setInterval(() => setSimdi(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  const kalanOran = Math.max(0, Math.min(1, (kalan.ms - (simdi - kalan.an)) / kalan.toplam))
  const oran = mevcut ? gelenler.length / mevcut : 0

  return (
    <main className="min-h-screen flex flex-col p-5 lg:p-8 gap-5">
      <header className="flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-sm font-mono text-indigo-300">{oturum.courses.ad}</p>
          <h1 className="text-2xl lg:text-3xl font-extrabold truncate">{oturumAdi(oturum)}</h1>
        </div>
        <div className="ml-auto opacity-60 hover:opacity-100 transition-opacity">{araclar}</div>
      </header>

      <div className="flex-1 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-stretch">
        <section className="cam-panel rounded-3xl p-5 lg:p-6 flex flex-col items-center justify-center gap-4">
          {acik ? (
            <>
              <p className="text-lg lg:text-xl text-slate-200 text-center">Telefonunun kamerasıyla okut, numaranı gir.</p>
              <div className="bg-white rounded-3xl p-3 w-full max-w-[min(52vh,600px)] aspect-square flex items-center justify-center">
                {qr ? (
                  <img src={qr} alt="Yoklama QR kodu" className="w-full h-full [image-rendering:pixelated]" />
                ) : (
                  <span className="text-slate-500 text-sm">{qrHata ? 'Sunucuya ulaşılamıyor, deneniyor…' : 'Hazırlanıyor…'}</span>
                )}
              </div>
              <div className="w-full max-w-[min(52vh,600px)] h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-indigo-400 transition-[width] duration-200 ease-linear" style={{ width: `${kalanOran * 100}%` }} />
              </div>
              {kod ? (
                <KodSeridi kod={kod} buyuk />
              ) : (
                <p className="text-xs text-slate-500">Kod birkaç saniyede bir değişir. Fotoğrafı başkasına gönderilen kod işe yaramaz.</p>
              )}
            </>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm font-mono uppercase tracking-widest text-slate-400">
                {gelenler.length ? 'Yoklama kapandı' : 'Yoklama kapalı'}
              </p>
              {gelenler.length > 0 && (
                <>
                  <p className="text-6xl font-extrabold">{gelenler.length}</p>
                  <p className="text-slate-300">öğrenci derse katıldı</p>
                </>
              )}
              {kod && <KodSeridi kod={kod} />}
            </div>
          )}
        </section>

        <section className="cam-panel rounded-3xl p-6 lg:p-8 flex flex-col gap-5 min-h-0">
          <div>
            <p className="text-sm font-mono uppercase tracking-widest text-emerald-300">Katılan</p>
            <p className="text-7xl lg:text-8xl font-extrabold leading-none mt-2 tabular-nums">
              {gelenler.length}
              {mevcutGoster && <span className="text-3xl lg:text-4xl text-slate-500 font-bold"> / {mevcut}</span>}
            </p>
            {mevcutGoster && mevcut > 0 && (
              <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${oran * 100}%` }} />
              </div>
            )}
          </div>
          <ul className="flex-1 min-h-0 overflow-hidden flex flex-wrap content-start gap-2">
            {gelenler.slice(0, 60).map((g, i) => (
              <li
                key={g.student_id}
                className={`rounded-full px-3 py-1 text-sm lg:text-base ${
                  i === 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/5 text-slate-300'
                }`}
              >
                {g.ad}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

/** Hocanın telefonuyla okutacağı kumanda QR'ı. Öğrencilere gösterilmemeli. */
function KumandaQr({ oturumId, kapat }: { oturumId: string; kapat: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    supabase.rpc('kumanda_anahtari', { p_session: oturumId }).then(async ({ data, error }) => {
      if (error || !data) {
        setHata(true)
        return
      }
      setQr(await QRCode.toDataURL(`${kokAdres()}#/kumanda?s=${oturumId}&k=${data as string}`, { margin: 1, width: 480 }))
    })
  }, [oturumId])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={kapat}>
      <div className="cam-panel rounded-3xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Telefonunu kumanda yap</h2>
        <p className="text-sm text-slate-300">
          Bu kodu kendi telefonunla okut. Okutan kişi dersi yönetebilir, bu yüzden perdede uzun süre açık bırakma.
        </p>
        <div className="bg-white rounded-2xl p-3 aspect-square flex items-center justify-center">
          {qr ? (
            <img src={qr} alt="Kumanda QR kodu" className="w-full" />
          ) : (
            <span className="text-slate-500 text-sm">{hata ? 'Kod alınamadı.' : 'Hazırlanıyor…'}</span>
          )}
        </div>
        <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold w-full" onClick={kapat}>
          Kapat
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bilgi yarışması

function usePuanlar(oturumId: string, etkin: boolean, limit: number) {
  const [puanlar, setPuanlar] = useState<PuanSatiri[] | null>(null)
  useEffect(() => {
    if (!etkin) return
    supabase
      .rpc('puan_tablosu', { p_session: oturumId, p_limit: limit })
      .then(({ data }) => setPuanlar((data as PuanSatiri[] | null) ?? []))
  }, [oturumId, etkin, limit])
  return puanlar
}

function PuanListesi({ puanlar, buyuk = false }: { puanlar: PuanSatiri[]; buyuk?: boolean }) {
  if (puanlar.length === 0) return <p className="text-slate-400 text-center">Henüz cevap yok.</p>
  return (
    <ol className="space-y-2">
      {puanlar.map((p, i) => (
        <li
          key={`${p.ad}-${i}`}
          className={`flex items-center gap-4 rounded-2xl px-5 ${buyuk ? 'py-3 text-2xl' : 'py-2 text-lg'} ${
            i === 0 ? 'bg-amber-400/20 text-amber-100' : 'bg-white/5'
          }`}
        >
          <span className="w-8 font-mono text-slate-400">{p.sira}</span>
          <span className="flex-1 font-bold truncate">{p.ad}</span>
          <span className="font-mono tabular-nums">{p.puan}</span>
        </li>
      ))}
    </ol>
  )
}

/** Perdede bir soru: süre işlerken soru ve şıklar; süre bitince doğru şık, dağılım ve ilk 5. */
function SoruSahnesi({
  oturumId,
  adimId,
  soruDurum,
  araclar,
  kod,
}: {
  oturumId: string
  adimId: string
  soruDurum: 'acik' | 'sonuc' | null
  araclar: React.ReactNode
  kod: string | null
}) {
  const [durum, setDurum] = useState<DersDurumu['adim']>(null)
  const [bitis, setBitis] = useState<number | null>(null)
  const [cevap, setCevap] = useState(0)
  const [simdi, setSimdi] = useState(Date.now())
  const kapatildi = useRef<string | null>(null)
  const sonuc = soruDurum === 'sonuc'
  const puanlar = usePuanlar(oturumId, sonuc, 5)

  // Soru bilgisi (şıkların karışık sırası sunucudan gelir) ve sonuç. Adım değişikliği veritabanına
  // henüz yazılmadıysa sunucu eski adımı döndürür; doğru adım gelene kadar kısa aralıkla yeniden sorulur.
  useEffect(() => {
    let iptal = false
    let zamanlayici: ReturnType<typeof setTimeout>
    async function sor(deneme: number) {
      const { data } = await supabase.rpc('ders_durumu', { p_session: oturumId })
      if (iptal) return
      const d = data as DersDurumu | null
      if (!d?.adim || d.adim.id !== adimId) {
        if (deneme < 20) zamanlayici = setTimeout(() => sor(deneme + 1), 400)
        return
      }
      setDurum(d.adim)
      setCevap(d.adim.cevap_sayisi ?? 0)
      if (d.adim.soru_durum === 'acik') setBitis(bitisAni(d.adim.kalan_ms))
    }
    sor(0)
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [oturumId, adimId, soruDurum])

  // Gelen cevaplar sayılır (kimin ne seçtiği sonuçta açıklanır).
  useEffect(() => {
    const kanal = supabase
      .channel(`soru:${oturumId}:${adimId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: `session_id=eq.${oturumId}` }, (p) => {
        if ((p.new as { step_id?: string }).step_id === adimId) setCevap((c) => c + 1)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(kanal)
    }
  }, [oturumId, adimId])

  useEffect(() => {
    const t = setInterval(() => setSimdi(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  const kalan = bitis === null ? null : Math.max(0, bitis - simdi)

  const sonucuGoster = useCallback(() => {
    kapatildi.current = adimId
    supabase.from('sessions').update({ soru_durum: 'sonuc' }).eq('id', oturumId).eq('soru_durum', 'acik').then(() => {})
  }, [oturumId, adimId])

  // Süre bitince doğru cevap kendiliğinden açıklanır (bir kez).
  useEffect(() => {
    if (soruDurum === 'acik' && kalan === 0 && kapatildi.current !== adimId) sonucuGoster()
  }, [soruDurum, kalan, adimId, sonucuGoster])

  const secenekler = durum?.secenekler ?? []
  const toplamCevap = sonuc && durum?.dagilim ? durum.dagilim.reduce((a, b) => a + b, 0) : cevap

  return (
    <main className="min-h-screen flex flex-col p-5 lg:p-8 gap-5">
      <header className="flex items-center gap-4">
        <p className="text-sm font-mono uppercase tracking-widest text-fuchsia-300">
          Soru {durum ? `${durum.sira} / ${durum.toplam}` : ''}
        </p>
        <div className="ml-auto opacity-60 hover:opacity-100 transition-opacity">{araclar}</div>
      </header>

      <section className="cam-panel rounded-3xl p-6 lg:p-10 flex items-center gap-6">
        <h1 className="flex-1 text-3xl lg:text-5xl font-extrabold leading-tight whitespace-pre-line">{durum?.soru ?? 'Yükleniyor…'}</h1>
        {!sonuc && kalan !== null && (
          <div className="shrink-0 w-28 h-28 lg:w-36 lg:h-36 rounded-full border-4 border-fuchsia-400 flex items-center justify-center">
            <span className="text-5xl lg:text-6xl font-extrabold tabular-nums">{Math.ceil(kalan / 1000)}</span>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 flex-1 content-start">
        {secenekler.map((x, i) => {
          const sik = SIKLAR[i % SIKLAR.length]
          const dogru = sonuc && durum?.dogru_index === i
          const sayi = durum?.dagilim?.[i] ?? 0
          return (
            <div
              key={i}
              className={`relative overflow-hidden rounded-3xl p-5 lg:p-7 flex items-center gap-4 text-2xl lg:text-4xl font-bold transition-opacity ${sik.renk} ${
                sonuc && !dogru ? 'opacity-35' : ''
              }`}
            >
              {sonuc && toplamCevap > 0 && (
                <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${(sayi / toplamCevap) * 100}%` }} />
              )}
              <span className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-black/25 flex items-center justify-center shrink-0">
                {sik.harf}
              </span>
              <span className="relative flex-1">{x}</span>
              {sonuc && <span className="relative font-mono text-xl lg:text-3xl">{sayi}</span>}
              {dogru && <span className="relative text-3xl lg:text-5xl">✓</span>}
            </div>
          )
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-4">
        <p className="text-lg text-slate-300">
          <b className="text-white text-2xl tabular-nums">{toplamCevap}</b> cevap
        </p>
        {!sonuc && (
          <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold" onClick={sonucuGoster}>
            Cevabı göster
          </button>
        )}
        {kod && (
          <div className="ml-auto">
            <KodSeridi kod={kod} />
          </div>
        )}
      </footer>

      {sonuc && puanlar && puanlar.length > 0 && (
        <section className="cam-panel rounded-3xl p-5 lg:p-6">
          <p className="text-sm font-mono uppercase tracking-widest text-amber-300 mb-3">İlk 5</p>
          <PuanListesi puanlar={puanlar} />
        </section>
      )}
    </main>
  )
}

/** Bütün sınıfın puan tablosu (ilk 10). */
function PuanTablosu({ oturumId, kapat }: { oturumId: string; kapat: () => void }) {
  const puanlar = usePuanlar(oturumId, true, 10)
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50" onClick={kapat}>
      <div className="cam-panel rounded-3xl p-6 lg:p-8 max-w-2xl w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-3xl font-extrabold text-center">Puan tablosu</h2>
        {puanlar ? <PuanListesi puanlar={puanlar} buyuk /> : <p className="text-center text-slate-400">Yükleniyor…</p>}
        <button className="ikincil-buton w-full" onClick={kapat}>
          Kapat
        </button>
      </div>
    </div>
  )
}
