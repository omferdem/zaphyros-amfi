import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGiris, useHocaMi } from '../lib/giris'
import { SURUM } from '../surum'
import BaglantiGostergesi from './BaglantiGostergesi'
import Giris from './Giris'

function Bekle() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-slate-400">Yükleniyor…</p>
    </main>
  )
}

/**
 * Giriş yapmış ama hoca listesinde olmayan kullanıcı. Kurulum henüz kimseye ait değilse
 * (yeni açılmış bir kopya) ilk giren hoca kurulumu sahiplenebilir.
 */
function YetkiYok({ eposta }: { eposta: string }) {
  const [sahipsiz, setSahipsiz] = useState<boolean | undefined>(undefined)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('kurulum_sahipsiz').then(({ data, error }) => setSahipsiz(!error && data === true))
  }, [])

  async function sahiplen() {
    setHata(null)
    const { data, error } = await supabase.rpc('kurulumu_sahiplen')
    if (error || data !== true) {
      setHata('Kurulum sahiplenilemedi. Başka biri senden önce sahiplenmiş olabilir.')
      setSahipsiz(false)
      return
    }
    window.location.reload()
  }

  if (sahipsiz === undefined) return <Bekle />

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-8 w-full max-w-md space-y-4">
        {sahipsiz ? (
          <>
            <h1 className="text-lg font-bold">Bu kurulum henüz kimseye ait değil</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Bu siteyi sen kurduysan aşağıdaki düğmeyle sahibi ol. <b>{eposta}</b> bu kurulumun hocası olarak
              kaydedilir; bundan sonra başka hiç kimse bu yolla hoca olamaz.
            </p>
            <button className="parlak-buton w-full rounded-xl py-3 font-bold" onClick={sahiplen}>
              Kurulumu sahiplen
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Bu hesap hoca olarak tanımlı değil</h1>
            <p className="text-sm text-slate-300">
              <b>{eposta}</b> ile giriş yaptın ama bu adres bu kurulumda hoca olarak kayıtlı değil.
            </p>
          </>
        )}
        {hata && <p className="text-sm text-rose-300">{hata}</p>}
        <button className="ikincil-buton" onClick={() => supabase.auth.signOut()}>
          Çıkış yap
        </button>
      </section>
    </main>
  )
}

/** Giriş yapmış ve izin listesinde olan hocaya içeriği gösterir. cercevesiz: sahne ekranı için. */
export default function HocaAlani({ cercevesiz = false }: { cercevesiz?: boolean }) {
  const oturum = useGiris()
  const hoca = useHocaMi(oturum)

  if (oturum === undefined) return <Bekle />
  if (!oturum) return <Giris />
  if (hoca === undefined) return <Bekle />

  if (!hoca) return <YetkiYok eposta={oturum.user.email ?? ''} />

  if (cercevesiz) return <Outlet />

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/panel" className="flex items-center gap-2">
            <img src="./favicon.svg" alt="" className="w-8 h-8" />
            <span className="font-extrabold">
              AmfiOS <span className="text-indigo-400">Panel</span>
            </span>
          </Link>
          <span className="text-[10px] text-slate-500 font-mono">v{SURUM}</span>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden sm:inline">
              <BaglantiGostergesi />
            </span>
            <span className="hidden md:inline text-xs text-slate-400">{oturum.user.email}</span>
            <button className="text-xs text-slate-300 hover:text-white" onClick={() => supabase.auth.signOut()}>
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
