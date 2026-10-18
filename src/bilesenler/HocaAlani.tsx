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

/** Giriş yapmış ve izin listesinde olan hocaya içeriği gösterir. cercevesiz: sahne ekranı için. */
export default function HocaAlani({ cercevesiz = false }: { cercevesiz?: boolean }) {
  const oturum = useGiris()
  const hoca = useHocaMi(oturum)

  if (oturum === undefined) return <Bekle />
  if (!oturum) return <Giris />
  if (hoca === undefined) return <Bekle />

  if (!hoca) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <section className="cam-panel rounded-3xl p-8 w-full max-w-md space-y-4">
          <h1 className="text-lg font-bold">Bu hesap hoca olarak tanımlı değil</h1>
          <p className="text-sm text-slate-300">
            <b>{oturum.user.email}</b> ile giriş yaptın ama bu adres sistemde hoca olarak kayıtlı değil. Erişim için
            sistem yöneticisiyle görüş.
          </p>
          <button className="ikincil-buton" onClick={() => supabase.auth.signOut()}>
            Çıkış yap
          </button>
        </section>
      </main>
    )
  }

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
