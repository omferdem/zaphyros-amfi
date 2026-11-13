import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { adrestekiGirisHatasi } from '../lib/giris'
import { oku, sakla } from '../lib/cihaz'
import { SURUM } from '../surum'
import BaglantiGostergesi from './BaglantiGostergesi'

type Yontem = 'sifre' | 'baglanti'
const YONTEM_ANAHTARI = 'amfi_giris_yontemi'

export default function Giris() {
  const [yontem, setYontem] = useState<Yontem>(() => (oku(YONTEM_ANAHTARI) === 'baglanti' ? 'baglanti' : 'sifre'))
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [durum, setDurum] = useState<'bos' | 'gonderiliyor' | 'gonderildi'>('bos')
  const [hata, setHata] = useState<string | null>(adrestekiGirisHatasi())

  function yontemSec(y: Yontem) {
    setYontem(y)
    setHata(null)
    setDurum('bos')
    sakla(YONTEM_ANAHTARI, y)
  }

  async function baglantiGonder(e: React.FormEvent) {
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
          ? 'Giriş e-postası sınırına takıldın (ücretsiz e-posta saatte 2 ile sınırlı). Gelen son e-postadaki bağlantıyı kullan, şifreyle gir ya da bir saat sonra tekrar dene.'
          : 'Bağlantı gönderilemedi. E-posta adresini kontrol edip tekrar dene.',
      )
      return
    }
    setDurum('gonderildi')
  }

  async function sifreyleGir(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setDurum('gonderiliyor')
    const { error } = await supabase.auth.signInWithPassword({ email: eposta.trim(), password: sifre })
    if (error) {
      setDurum('bos')
      setHata(
        error.status === 429
          ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.'
          : 'E-posta ya da şifre yanlış. Henüz şifre belirlemediysen "E-posta bağlantısı" ile girip panelin üstündeki "🔑 Şifre" düğmesinden belirle.',
      )
      return
    }
    // Başarılı girişte oturum değişir; HocaAlani kendiliğinden paneli açar.
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-[2rem] p-8 w-full max-w-md space-y-6 girdi">
        <header className="flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="w-12 h-12 suzul" />
          <div>
            <h1 className="text-2xl font-extrabold">
              ZAPEDU <span className="renkli-yazi">Hoca Paneli</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">sürüm {SURUM}</p>
          </div>
        </header>

        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1 text-sm font-bold">
          {(
            [
              ['sifre', '🔑 Şifreyle'],
              ['baglanti', '✉️ E-posta bağlantısı'],
            ] as const
          ).map(([y, etiket]) => (
            <button
              key={y}
              type="button"
              role="tab"
              aria-selected={yontem === y}
              onClick={() => yontemSec(y)}
              className={`rounded-full py-2 transition-colors ${yontem === y ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {etiket}
            </button>
          ))}
        </div>

        {yontem === 'sifre' ? (
          <form onSubmit={sifreyleGir} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">E-posta adresin</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
                className="giris-kutusu"
                placeholder="ornek@universite.edu.tr"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Şifre</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                className="giris-kutusu"
              />
            </label>
            <button disabled={durum === 'gonderiliyor'} className="parlak-buton w-full rounded-2xl py-3.5 text-lg disabled:opacity-60">
              {durum === 'gonderiliyor' ? 'Giriliyor…' : 'Giriş yap'}
            </button>
            <p className="text-xs text-slate-500">
              İlk kez mi giriyorsun? "E-posta bağlantısı" ile gir, sonra panelden şifre belirle. Bir daha e-posta beklemezsin.
            </p>
          </form>
        ) : durum === 'gonderildi' ? (
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              <b className="text-slate-100">{eposta}</b> adresine bir giriş bağlantısı gönderdik.
            </p>
            <p>
              Bağlantıyı <b className="text-slate-100">bu cihazda, bu tarayıcıda</b> aç. Başka bir cihazda açılan
              bağlantı çalışmaz. Masaüstü uygulamasını kullanıyorsan bağlantıyı tarayıcıda aç, şifre belirle, uygulamaya
              şifreyle gir.
            </p>
            <button className="text-indigo-300 underline text-xs" onClick={() => setDurum('bos')}>
              Başka bir adres dene
            </button>
          </div>
        ) : (
          <form onSubmit={baglantiGonder} className="space-y-4">
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
            <button disabled={durum === 'gonderiliyor'} className="parlak-buton w-full rounded-2xl py-3.5 text-lg disabled:opacity-60">
              {durum === 'gonderiliyor' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
            </button>
            <p className="text-xs text-slate-500">Her girişte e-postana tek kullanımlık bir bağlantı gelir.</p>
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
