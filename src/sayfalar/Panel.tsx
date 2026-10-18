import { useEffect, useState } from 'react'
import { baglantiyiDene } from '../lib/supabase'
import { SURUM } from '../surum'

type Durum = 'kontrol' | 'tamam' | 'hata'

export default function Panel() {
  const [durum, setDurum] = useState<Durum>('kontrol')

  useEffect(() => {
    baglantiyiDene()
      .then((ok) => setDurum(ok ? 'tamam' : 'hata'))
      .catch(() => setDurum('hata'))
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-8 w-full max-w-lg space-y-6">
        <header className="flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="w-11 h-11" />
          <div>
            <h1 className="text-xl font-extrabold">
              AmfiOS <span className="text-indigo-400">Hoca Paneli</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">sürüm {SURUM}</p>
          </div>
        </header>

        <p className="text-sm text-slate-300 leading-relaxed">
          Sistemin iskeleti hazır. Ders oluşturma, sınıf listesi ve QR yoklama bir sonraki sürümde
          bu panele gelecek.
        </p>

        <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Sunucu bağlantısı</span>
          {durum === 'kontrol' && <span className="text-xs text-slate-400">kontrol ediliyor…</span>}
          {durum === 'tamam' && <span className="text-xs font-bold text-emerald-400">bağlı</span>}
          {durum === 'hata' && <span className="text-xs font-bold text-rose-400">bağlanamadı</span>}
        </div>
      </section>
    </main>
  )
}
