import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Giriş yapmış hocanın şifre belirlemesi ya da değiştirmesi (sonraki girişlerde e-posta gerekmez). */
export default function SifreBelirle() {
  const [acik, setAcik] = useState(false)
  const [sifre, setSifre] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [tamam, setTamam] = useState(false)

  function kapat() {
    setAcik(false)
    setSifre('')
    setTekrar('')
    setHata(null)
    setTamam(false)
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    if (sifre.length < 8) return setHata('Şifre en az 8 karakter olmalı.')
    if (sifre !== tekrar) return setHata('İki şifre aynı değil.')
    setMesgul(true)
    const { error } = await supabase.auth.updateUser({ password: sifre })
    setMesgul(false)
    if (error) {
      setHata(
        error.message.toLowerCase().includes('different')
          ? 'Yeni şifre eskisinden farklı olmalı.'
          : 'Şifre kaydedilemedi. Biraz sonra tekrar dene.',
      )
      return
    }
    setTamam(true)
  }

  return (
    <>
      <button className="text-xs text-slate-300 hover:text-white" onClick={() => setAcik(true)} title="Şifre belirle ya da değiştir">
        🔑 Şifre
      </button>
      {acik && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={kapat}>
          <form onSubmit={kaydet} className="cam-panel rounded-3xl p-6 max-w-sm w-full space-y-4 girdi" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">🔑 Şifre belirle</h2>
            {tamam ? (
              <>
                <p className="text-sm text-emerald-300">Şifren kaydedildi. Artık giriş ekranında "Şifreyle" sekmesinden e-posta beklemeden girebilirsin.</p>
                <button type="button" className="parlak-buton w-full rounded-2xl py-3" onClick={kapat}>
                  Tamam
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">Bu şifreyle masaüstü uygulamasına ve diğer bilgisayarlarına e-posta beklemeden girersin.</p>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="giris-kutusu"
                  placeholder="Yeni şifre (en az 8 karakter)"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  autoFocus
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="giris-kutusu"
                  placeholder="Yeni şifre (tekrar)"
                  value={tekrar}
                  onChange={(e) => setTekrar(e.target.value)}
                />
                {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
                <div className="flex gap-2">
                  <button disabled={mesgul} className="parlak-buton flex-1 rounded-2xl py-3 disabled:opacity-60">
                    {mesgul ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button type="button" className="ikincil-buton !py-3" onClick={kapat}>
                    Vazgeç
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
