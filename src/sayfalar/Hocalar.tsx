import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface HocaSatiri {
  eposta: string
  ad_soyad: string | null
  sahip: boolean
  eklendi: string
  giris_yapti: boolean
  ders_sayisi: number
}

const HATALAR: Record<string, string> = {
  yetki_yok: 'Bu işlemi yalnızca kurulumun sahibi yapabilir.',
  eposta_gecersiz: 'E-posta adresi geçerli görünmüyor.',
  zaten_var: 'Bu adres zaten hoca olarak kayıtlı.',
  sahip_cikarilamaz: 'Kurulumun sahibi çıkarılamaz.',
  bulunamadi: 'Bu adres listede yok.',
}

/** Davet metni: sahibin hocaya e-posta ya da mesajla iletebileceği hazır açıklama. */
function davetMetni(ad: string, adres: string): string {
  const site = window.location.origin + window.location.pathname
  return [
    `Merhaba${ad ? ' ' + ad : ''},`,
    '',
    `ZAPEDU canlı ders sistemine hoca olarak ekledim. Giriş: ${site}`,
    `Sitede "E-posta bağlantısı" sekmesine ${adres} adresini yaz; gelen bağlantıyla gir (bağlantıyı aynı tarayıcıda aç).`,
    'Girdikten sonra panelin üstündeki "🔑 Şifre" düğmesinden şifre belirlersen sonraki girişlerde e-posta beklemezsin.',
    'Dersler, öğrenciler ve yoklamalar sana özeldir; başka hocalar görmez.',
  ].join('\n')
}

/** Kurulumun sahibine açık hoca yönetimi: davet et, listele, erişimi kaldır. */
export default function Hocalar() {
  const [yetki, setYetki] = useState<boolean | undefined>(undefined)
  const [liste, setListe] = useState<HocaSatiri[]>([])
  const [eposta, setEposta] = useState('')
  const [ad, setAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  const yukle = useCallback(async () => {
    const { data, error } = await supabase.rpc('hoca_listele')
    if (error || !data || data.hata) {
      setYetki(false)
      return
    }
    setYetki(true)
    setListe((data.hocalar ?? []) as HocaSatiri[])
  }, [])

  useEffect(() => {
    void yukle()
  }, [yukle])

  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setBilgi(null)
    setMesgul(true)
    const adres = eposta.trim()
    const { data, error } = await supabase.rpc('hoca_ekle', { p_eposta: adres, p_ad: ad.trim() || null })
    setMesgul(false)
    if (error || !data || data.hata) {
      setHata(HATALAR[data?.hata as string] ?? 'Hoca eklenemedi. Biraz sonra tekrar dene.')
      return
    }
    try {
      await navigator.clipboard.writeText(davetMetni(ad.trim(), adres.toLowerCase()))
      setBilgi(`${adres} eklendi. Davet metni panoya kopyalandı; e-posta ya da mesajla gönderebilirsin.`)
    } catch {
      setBilgi(`${adres} eklendi. Davet metnini aşağıdaki "Davet metnini kopyala" düğmesinden alabilirsin.`)
    }
    setEposta('')
    setAd('')
    void yukle()
  }

  async function cikar(h: HocaSatiri) {
    if (!window.confirm(`${h.eposta} hoca listesinden çıkarılsın mı? Dersleri silinmez; yeniden eklenirse geri gelir.`)) return
    setHata(null)
    setBilgi(null)
    const { data, error } = await supabase.rpc('hoca_cikar', { p_eposta: h.eposta })
    if (error || !data || data.hata) {
      setHata(HATALAR[data?.hata as string] ?? 'Çıkarılamadı.')
      return
    }
    setBilgi(`${h.eposta} çıkarıldı.`)
    void yukle()
  }

  async function kopyala(h: HocaSatiri) {
    try {
      await navigator.clipboard.writeText(davetMetni(h.ad_soyad ?? '', h.eposta))
      setBilgi('Davet metni panoya kopyalandı.')
    } catch {
      setHata('Panoya kopyalanamadı.')
    }
  }

  if (yetki === undefined) return <p className="text-sm text-slate-400">Yükleniyor…</p>
  if (!yetki) {
    return (
      <section className="cam-panel rounded-3xl p-6 space-y-3 max-w-xl">
        <h1 className="text-lg font-bold">Hocalar</h1>
        <p className="text-sm text-slate-300">Bu sayfayı yalnızca kurulumun sahibi görebilir.</p>
        <Link to="/panel" className="text-indigo-300 underline text-sm">
          Panele dön
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/panel" className="text-sm text-slate-400 hover:text-white">
          ← Panel
        </Link>
        <h1 className="text-xl font-extrabold">👥 Hocalar</h1>
      </div>

      <section className="cam-panel rounded-3xl p-6 space-y-4">
        <h2 className="font-bold">Hoca davet et</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Eklediğin adres siteye e-posta bağlantısıyla girip hoca olur. Her hocanın dersleri, öğrencileri ve yoklamaları
          kendisine özeldir; sen dahil kimse başkasının dersini görmez. Çıkardığın hoca siteye girebilir ama panele erişemez.
        </p>
        <form onSubmit={ekle} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            required
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            className="giris-kutusu"
            placeholder="hoca@universite.edu.tr"
            aria-label="Hocanın e-posta adresi"
          />
          <input
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            className="giris-kutusu"
            placeholder="Ad soyad (isteğe bağlı)"
            aria-label="Hocanın adı"
          />
          <button disabled={mesgul} className="parlak-buton rounded-xl px-5 py-2.5 font-bold disabled:opacity-60">
            Ekle
          </button>
        </form>
        {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
        {bilgi && <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-xl p-3">{bilgi}</p>}
        <p className="text-xs text-slate-500">
          Ücretsiz planda giriş e-postası saatte 2 ile sınırlıdır; birden çok hocayı aynı saatte davet edersen girişleri
          arayla yapmalarını söyle. Şifre belirleyen hoca e-posta beklemez.
        </p>
      </section>

      <section className="cam-panel rounded-3xl p-6 space-y-3">
        <h2 className="font-bold">Kayıtlı hocalar ({liste.length})</h2>
        <ul className="divide-y divide-white/10">
          {liste.map((h) => (
            <li key={h.eposta} className="py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {h.ad_soyad || h.eposta} {h.sahip && <span className="text-xs text-amber-300 font-bold">sahip</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {h.ad_soyad ? h.eposta + ' · ' : ''}
                  {h.giris_yapti ? `${h.ders_sayisi} şube` : 'henüz giriş yapmadı'}
                </p>
              </div>
              {!h.sahip && (
                <>
                  {!h.giris_yapti && (
                    <button className="ikincil-buton text-xs" onClick={() => kopyala(h)}>
                      Davet metnini kopyala
                    </button>
                  )}
                  <button className="text-xs text-rose-300 hover:text-rose-200" onClick={() => cikar(h)}>
                    Çıkar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
