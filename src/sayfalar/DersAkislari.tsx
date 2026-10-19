import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Akis, Ders, Sunum } from '../lib/tipler'
import { akisOlustur, akislariGetir, sunumSil, sunumlariGetir } from '../lib/akis'
import { tarihSaat } from '../lib/bicim'

/** Ders sayfasındaki "Ders akışları" sekmesi: akışlar ve dersin sunum kitaplığı. */
export default function DersAkislari({ ders }: { ders: Ders }) {
  const navigate = useNavigate()
  const [akislar, setAkislar] = useState<Akis[] | null>(null)
  const [sunumlar, setSunumlar] = useState<Sunum[]>([])
  const [yeniAd, setYeniAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([akislariGetir(ders.id), sunumlariGetir(ders.id)])
      setAkislar(a)
      setSunumlar(s)
    } catch {
      setHata('Akışlar yüklenemedi.')
    }
  }, [ders.id])

  useEffect(() => {
    yukle()
  }, [yukle])

  async function olustur(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    try {
      const akis = await akisOlustur(ders.id, yeniAd || `${(akislar?.length ?? 0) + 1}. hafta`)
      navigate(`/panel/akis/${akis.id}`)
    } catch {
      setHata('Akış oluşturulamadı.')
    }
  }

  async function akisSil(a: Akis) {
    if (!window.confirm(`"${a.ad}" akışı silinecek. Sunum dosyaları kitaplıkta kalır. Emin misin?`)) return
    const { error } = await supabase.from('lessons').delete().eq('id', a.id)
    if (error) setHata('Akış silinemedi.')
    yukle()
  }

  async function sunumuSil(s: Sunum) {
    if (!window.confirm(`"${s.ad}" sunumu silinecek. Bu sunumun slaytları bütün akışlardan da çıkar. Emin misin?`)) return
    try {
      await sunumSil(s)
    } catch {
      setHata('Sunum silinemedi.')
    }
    yukle()
  }

  return (
    <div className="space-y-6">
      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <form onSubmit={olustur} className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Yeni ders akışı</h2>
        <p className="text-sm text-slate-400">
          Akış, derste perdede sırayla göstereceğin adımlardır: yoklama ve sunum slaytları. Sonraki sürümlerde video,
          beyin fırtınası ve quiz de araya eklenebilecek.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            maxLength={200}
            className="giris-kutusu"
            placeholder={`Akışın adı (ör. ${(akislar?.length ?? 0) + 1}. hafta: Tanrı'nın varlığı)`}
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
          />
          <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold whitespace-nowrap">Oluştur</button>
        </div>
      </form>

      {akislar === null ? (
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      ) : akislar.length === 0 ? (
        <p className="text-sm text-slate-400">Bu derste henüz akış yok.</p>
      ) : (
        <ul className="space-y-2">
          {akislar.map((a) => (
            <li key={a.id} className="cam-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.ad}</p>
                <p className="text-xs text-slate-400">{tarihSaat(a.olusturuldu)}</p>
              </div>
              <Link to={`/panel/akis/${a.id}`} className="ikincil-buton">
                Düzenle
              </Link>
              <button className="tehlike-buton" onClick={() => akisSil(a)}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Sunum kitaplığı</h2>
        <p className="text-sm text-slate-400">
          Yüklediğin sunumlar burada durur; aynı sunumu birden fazla akışta kullanabilirsin. Sunum yüklemek için bir akışı
          aç.
        </p>
        {sunumlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz sunum yok.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {sunumlar.map((s) => (
              <li key={s.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate">{s.ad}</span>
                <span className="text-xs text-slate-400">{s.sayfa_sayisi} sayfa</span>
                <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={() => sunumuSil(s)}>
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
