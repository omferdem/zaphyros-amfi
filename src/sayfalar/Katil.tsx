import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'

interface Bilet {
  bilet: string
  ders: string
  baslik: string | null
}

type Durum =
  | { tur: 'yukleniyor' }
  | { tur: 'qr_yok' }
  | { tur: 'hata'; metin: string }
  | { tur: 'form'; bilet: Bilet }
  | { tur: 'tamam'; ad: string; ders: string }

const HATALAR: Record<string, string> = {
  oturum_yok: 'Bu ders oturumu bulunamadı. Perdedeki QR kodu yeniden okut.',
  yoklama_kapali: 'Bu dersin yoklaması kapandı. Bir sorun varsa hocana söyle.',
  kod_eski: 'Okuttuğun kodun süresi dolmuş. Perdedeki güncel QR kodu yeniden okut.',
  bilet_gecersiz: 'Süre doldu. Perdedeki QR kodu yeniden okutup numaranı tekrar gir.',
  cihaz_gecersiz: 'Tarayıcın tanınamadı. Sayfayı yenileyip tekrar dene.',
  numara_gecersiz: 'Numarayı yalnızca rakam (ve gerekiyorsa harf) olarak yaz.',
  liste_disi: 'Bu numara dersin listesinde yok. Numaranı kontrol et; doğruysa hocana söyle.',
  numara_kullanildi: 'Bu numarayla bu derste başka bir telefondan yoklama verilmiş. Hatalıysa hocana söyle.',
  cihaz_kullanildi: 'Bu telefondan bu derste başka bir numarayla yoklama verildi. Her öğrenci kendi telefonunu kullanmalı.',
  tekrar_dene: 'Bir çakışma oldu. Lütfen tekrar dene.',
}

// Form hatası sayılmayan, akışı bitiren hatalar
const KALICI = new Set(['oturum_yok', 'yoklama_kapali', 'kod_eski', 'bilet_gecersiz', 'cihaz_kullanildi', 'cihaz_gecersiz'])

function biletAnahtari(s: string) {
  return `amfi_bilet_${s}`
}
function katildiAnahtari(s: string) {
  return `amfi_katildi_${s}`
}

export default function Katil() {
  const [parametreler, setParametreler] = useSearchParams()
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
      setDurum({ tur: 'qr_yok' })
      return
    }

    if (!token) {
      // Yoklamaya zaten girildiyse sonucu, sayfa yenilendiyse daha önce alınan bileti göster.
      // (QR yeniden okutulursa karar her zaman sunucuya bırakılır.)
      const katildi = oku(katildiAnahtari(oturum))
      if (katildi) {
        const { ad, ders } = JSON.parse(katildi) as { ad: string; ders: string }
        setDurum({ tur: 'tamam', ad, ders })
        return
      }
      const kayitli = sessionStorage.getItem(biletAnahtari(oturum))
      if (kayitli) setDurum({ tur: 'form', bilet: JSON.parse(kayitli) as Bilet })
      else setDurum({ tur: 'qr_yok' })
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
    setDurum({ tur: 'tamam', ad, ders: durum.bilet.ders })
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-sm space-y-5">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest text-center">Derse katıl</p>

        {durum.tur === 'yukleniyor' && <p className="text-center text-slate-300">Kod kontrol ediliyor…</p>}

        {durum.tur === 'qr_yok' && (
          <>
            <h1 className="text-2xl font-extrabold text-center">Hoş geldin</h1>
            <p className="text-sm text-slate-300 text-center">
              Derse katılmak için perdedeki QR kodu telefonunun kamerasıyla okut.
            </p>
          </>
        )}

        {durum.tur === 'hata' && (
          <>
            <h1 className="text-xl font-extrabold text-center">Yoklamaya girilemedi</h1>
            <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-4">{durum.metin}</p>
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
            <button disabled={gonderiliyor || !numara.trim()} className="parlak-buton w-full rounded-xl py-3.5 font-bold text-lg disabled:opacity-60">
              {gonderiliyor ? 'Gönderiliyor…' : 'Yoklamaya katıl'}
            </button>
            {formHata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{formHata}</p>}
            <p className="text-[11px] text-slate-500 text-center">
              Yalnızca numaran kaydedilir. Konum, fotoğraf ya da cihaz bilgisi alınmaz.
            </p>
          </form>
        )}

        {durum.tur === 'tamam' && (
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl text-emerald-300">
              ✓
            </div>
            <h1 className="text-2xl font-extrabold">Yoklaman alındı</h1>
            <p className="text-slate-300">
              {durum.ad && <b className="text-white">{durum.ad}</b>}
              {durum.ad && ', '}
              {durum.ders} dersine hoş geldin.
            </p>
            <p className="text-xs text-slate-500">Bu sayfayı kapatabilirsin.</p>
          </div>
        )}
      </section>
    </main>
  )
}
