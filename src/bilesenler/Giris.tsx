import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { adrestekiGirisHatasi } from '../lib/giris'
import { SURUM } from '../surum'
import BaglantiGostergesi from './BaglantiGostergesi'

export default function Giris() {
  const [eposta, setEposta] = useState('')
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'gonderildi'>('bos')
  const [hata, setHata] = useState<string | null>(adrestekiGirisHatasi())

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setDurum('gonderiliyor')
    const { error } = await supabase.auth.signInWithOtp({
      email: eposta.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) {
      setDurum('bos')
      setHata(
        error.status === 429
          ? 'Giriş e-postası sınırına takıldın (ücretsiz e-posta saatte 2 ile sınırlı). Gelen son e-postadaki bağlantıyı kullan ya da bir saat sonra tekrar iste.'
          : 'Bağlantı gönderilemedi. E-posta adresini kontrol edip tekrar dene.',
      )
      return
    }
    setDurum('gonderildi')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-8 w-full max-w-md space-y-6">
        <header className="flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="w-11 h-11" />
          <div>
            <h1 className="text-xl font-extrabold">
              AmfiOS <span className="text-indigo-400">Hoca Paneli</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">sürüm {SURUM}</p>
          </div>
        </header>

        {durum === 'gonderildi' ? (
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              <b className="text-slate-100">{eposta}</b> adresine bir giriş bağlantısı gönderdik.
            </p>
            <p>
              Bağlantıyı <b className="text-slate-100">bu cihazda, bu tarayıcıda</b> aç. Başka bir cihazda açılan
              bağlantı çalışmaz.
            </p>
            <button className="text-indigo-300 underline text-xs" onClick={() => setDurum('bos')}>
              Başka bir adres dene
            </button>
          </div>
        ) : (
          <form onSubmit={gonder} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">E-posta adresin</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
                className="giris-kutusu"
                placeholder="ornek@universite.edu.tr"
              />
            </label>
            <button disabled={durum === 'gonderiliyor'} className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-60">
              {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
            </button>
            <p className="text-xs text-slate-500">Şifre yok. Her girişte e-postana tek kullanımlık bir bağlantı gelir.</p>
          </form>
        )}

        {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

        <footer className="pt-2 border-t border-white/5">
          <BaglantiGostergesi />
        </footer>
      </section>
    </main>
  )
}
