import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Ders, Oturum } from '../lib/tipler'
import { oturumGetir } from '../lib/veri'
import { kisaAd, oturumAdi } from '../lib/bicim'

interface Gelen {
  student_id: string
  zaman: string
  ad: string
}

/** Öğrencinin QR'dan açacağı adres. HashRouter olduğu için #/katil biçimindedir. */
function katilimAdresi(oturumId: string, token: string): string {
  const kok = window.location.origin + window.location.pathname
  return `${kok}#/katil?s=${oturumId}&t=${token}`
}

export default function Sahne() {
  const { oturumId = '' } = useParams()
  const [oturum, setOturum] = useState<(Oturum & { courses: Ders }) | null | undefined>(undefined)
  const [mevcut, setMevcut] = useState(0)
  const [gelenler, setGelenler] = useState<Gelen[]>([])
  const [qr, setQr] = useState<string | null>(null)
  const [qrHata, setQrHata] = useState(false)
  const [kalan, setKalan] = useState({ ms: 10000, toplam: 10000, an: Date.now() })
  const [simdi, setSimdi] = useState(Date.now())
  const [mevcutGoster, setMevcutGoster] = useState(true)

  const acik = !!oturum && oturum.yoklama_acik && !oturum.bitti

  // Oturum ve sınıf mevcudu
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${oturumId}` }, (p) =>
        setOturum((o) => (o ? { ...o, ...(p.new as Partial<Oturum>) } : o)),
      )
      .subscribe()
    // Realtime bağlantısı koparsa diye 20 saniyede bir yedek yenileme
    const yedek = setInterval(gelenleriYukle, 20000)
    return () => {
      clearInterval(yedek)
      if (bekleyen.current) clearTimeout(bekleyen.current)
      supabase.removeChannel(kanal)
    }
  }, [oturumId, gelenleriYukle])

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

  async function yoklamaDurumu(ac: boolean) {
    const { data } = await supabase
      .from('sessions')
      .update(ac ? { yoklama_acik: true, bitti: null } : { yoklama_acik: false })
      .eq('id', oturumId)
      .select('id, course_id, baslik, yoklama_acik, basladi, bitti')
      .single()
    if (data) setOturum((o) => (o ? { ...o, ...(data as Oturum) } : o))
  }

  function tamEkran() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
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

  const oran = mevcut ? gelenler.length / mevcut : 0

  return (
    <main className="min-h-screen flex flex-col p-5 lg:p-8 gap-5">
      <header className="flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-sm font-mono text-indigo-300">{oturum.courses.ad}</p>
          <h1 className="text-2xl lg:text-3xl font-extrabold truncate">{oturumAdi(oturum)}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
          <button className="ikincil-buton" onClick={() => setMevcutGoster(!mevcutGoster)}>
            {mevcutGoster ? 'Mevcudu gizle' : 'Mevcudu göster'}
          </button>
          <button className="ikincil-buton" onClick={() => yoklamaDurumu(!acik)}>
            {acik ? 'Yoklamayı kapat' : 'Yoklamayı aç'}
          </button>
          <button className="ikincil-buton" onClick={tamEkran}>
            Tam ekran
          </button>
          <Link to={`/panel/oturum/${oturum.id}`} className="ikincil-buton">
            Panel
          </Link>
        </div>
      </header>

      <div className="flex-1 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-stretch">
        <section className="cam-panel rounded-3xl p-5 lg:p-6 flex flex-col items-center justify-center gap-4">
          {acik ? (
            <>
              <p className="text-lg lg:text-xl text-slate-200 text-center">
                Telefonunun kamerasıyla okut, numaranı gir.
              </p>
              <div className="bg-white rounded-3xl p-3 w-full max-w-[min(56vh,600px)] aspect-square flex items-center justify-center">
                {qr ? (
                  <img src={qr} alt="Yoklama QR kodu" className="w-full h-full [image-rendering:pixelated]" />
                ) : (
                  <span className="text-slate-500 text-sm">{qrHata ? 'Sunucuya ulaşılamıyor, deneniyor…' : 'Hazırlanıyor…'}</span>
                )}
              </div>
              <div className="w-full max-w-[min(56vh,600px)] h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-indigo-400 transition-[width] duration-200 ease-linear" style={{ width: `${kalanOran * 100}%` }} />
              </div>
              <p className="text-xs text-slate-500">Kod birkaç saniyede bir değişir. Fotoğrafı başkasına gönderilen kod işe yaramaz.</p>
            </>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm font-mono uppercase tracking-widest text-slate-400">Yoklama kapandı</p>
              <p className="text-6xl font-extrabold">{gelenler.length}</p>
              <p className="text-slate-300">öğrenci derse katıldı</p>
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
