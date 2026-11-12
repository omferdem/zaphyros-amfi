import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cihazKimligi } from '../lib/cihaz'

interface Durumum {
  el: boolean
  sikildim: boolean
  secildim: boolean
  mola: boolean
  sorular: { metin: string; durum: 'bekliyor' | 'cekildi' | 'tamam' }[]
}

const HATALAR: Record<string, string> = {
  katilmadin: 'Düğmeleri kullanmak için yoklama vermiş ya da takma ad almış olmalısın.',
  metin_kisa: 'Sorun çok kısa. Birkaç kelimeyle yaz.',
  metin_uzun: 'Sorun çok uzun (en fazla 280 harf).',
  sinir: 'Cevap bekleyen 3 sorun var. Birinin cevaplanmasını bekle.',
  ders_yok: 'Ders bitmiş görünüyor.',
  dolu: 'Şu an yeni istek alınamıyor.',
}

/** Derse katılmış öğrencinin düğmeleri: parmak kaldır, soru sor, sıkıldım. Mola ve çekiliş durumu da burada görünür. */
export default function SinifDugmeleri({ oturum }: { oturum: string }) {
  const [d, setD] = useState<Durumum | null>(null)
  const [soruAcik, setSoruAcik] = useState(false)
  const [metin, setMetin] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<{ tur: 'iyi' | 'kotu'; metin: string } | null>(null)

  const sor = useCallback(async () => {
    const { data } = await supabase.rpc('sinif_durumum', { p_session: oturum, p_cihaz: cihazKimligi() })
    if (data && !(data as { hata?: string }).hata) setD(data as Durumum)
  }, [oturum])

  useEffect(() => {
    sor()
    // Mola sırasında çekilişin sonucu çabuk görünsün
    const t = setInterval(sor, d?.mola ? 3000 : 8000)
    return () => clearInterval(t)
  }, [sor, d?.mola])

  async function gonder(tur: string, m?: string): Promise<boolean> {
    setMesgul(true)
    setMesaj(null)
    const { data, error } = await supabase.rpc('sinif_gonder', { p_session: oturum, p_cihaz: cihazKimligi(), p_tur: tur, p_metin: m ?? null })
    setMesgul(false)
    const hata = (data as { hata?: string } | null)?.hata
    if (error || hata) {
      setMesaj({ tur: 'kotu', metin: (hata && HATALAR[hata]) || 'Gönderilemedi. İnternet bağlantını kontrol et.' })
      return false
    }
    await sor()
    return true
  }

  async function soruGonder(e: React.FormEvent) {
    e.preventDefault()
    if (await gonder('soru', metin)) {
      setMetin('')
      setSoruAcik(false)
      setMesaj({ tur: 'iyi', metin: 'Sorun hocaya iletildi. Müsait olunca cevaplayacak.' })
    }
  }

  if (d?.mola) {
    return (
      <section className="cam-panel rounded-3xl p-5 text-center space-y-2 girdi">
        {d.secildim ? (
          <>
            <p className="text-6xl suzul" aria-hidden>
              🎤
            </p>
            <p className="text-2xl font-display font-extrabold renkli-yazi pb-1">Sıra sende!</p>
            <p className="text-slate-200">Çekilişte sen çıktın. Sınıfa bir fıkra anlat; istemezsen hoca yeniden çekecek.</p>
          </>
        ) : (
          <>
            <p className="text-5xl suzul" aria-hidden>
              ⏸️
            </p>
            <p className="text-xl font-display font-extrabold">Ders kısa bir mola verdi</p>
            <p className="text-slate-300 text-sm">Çekilişle biri fıkra anlatacak. Perdeye bak.</p>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          disabled={mesgul}
          onClick={() => gonder(d?.el ? 'el_indir' : 'el')}
          className={`rounded-2xl py-3 px-1 text-sm font-bold border transition active:scale-95 ${
            d?.el ? 'bg-amber-400/25 border-amber-300/60 text-amber-100 nabiz' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <span className="block text-2xl" aria-hidden>
            ✋
          </span>
          {d?.el ? 'Elini indir' : 'Parmak kaldır'}
        </button>
        <button
          disabled={mesgul}
          onClick={() => setSoruAcik((a) => !a)}
          className={`rounded-2xl py-3 px-1 text-sm font-bold border transition active:scale-95 ${
            soruAcik ? 'bg-sky-400/25 border-sky-300/60' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <span className="block text-2xl" aria-hidden>
            ❓
          </span>
          Soru sor
        </button>
        <button
          disabled={mesgul}
          onClick={() => gonder(d?.sikildim ? 'sikildim_geri' : 'sikildim')}
          className={`rounded-2xl py-3 px-1 text-sm font-bold border transition active:scale-95 ${
            d?.sikildim ? 'bg-fuchsia-400/25 border-fuchsia-300/60 text-fuchsia-100' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <span className="block text-2xl" aria-hidden>
            😮‍💨
          </span>
          {d?.sikildim ? 'Vazgeçtim' : 'Sıkıldım'}
        </button>
      </div>

      {soruAcik && (
        <form onSubmit={soruGonder} className="cam-panel rounded-2xl p-3 space-y-2 girdi">
          <textarea
            autoFocus
            rows={3}
            maxLength={280}
            placeholder="Sorunu yaz. Adınla birlikte perdede zarf olarak görünür."
            className="giris-kutusu"
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex-1">{metin.length} / 280</span>
            <button type="button" className="ikincil-buton !py-2" onClick={() => setSoruAcik(false)}>
              Vazgeç
            </button>
            <button disabled={mesgul || metin.trim().length < 3} className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold">
              Gönder
            </button>
          </div>
        </form>
      )}

      {mesaj && <p className={`text-sm rounded-xl p-3 ${mesaj.tur === 'iyi' ? 'text-emerald-200 bg-emerald-500/10' : 'text-rose-200 bg-rose-500/10'}`}>{mesaj.metin}</p>}

      {d && d.sorular.length > 0 && (
        <ul className="text-xs text-slate-400 space-y-1">
          {d.sorular.slice(0, 3).map((s, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>{s.durum === 'tamam' ? '✅' : '✉️'}</span>
              <span className="truncate flex-1">{s.metin}</span>
              <span>{s.durum === 'tamam' ? 'cevaplandı' : 'bekliyor'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
