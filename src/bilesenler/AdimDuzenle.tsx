import { useState } from 'react'
import type { Adim, AdimAyari, Soru } from '../lib/tipler'
import { videoAdresi } from '../lib/video'
import { gorselMi } from '../lib/foto'

export interface SoruDegisikligi {
  soru: string
  dogru: string
  yanlislar: string[]
  sure_sn: number
}

interface Props {
  adim: Adim
  soru?: Soru
  /** Akıştaki adımın ayarını kaydeder (fikir, oylama, video, fotoğraf). */
  ayarKaydet: (ayar: AdimAyari) => Promise<void>
  /** Soru bankasındaki kaydı günceller (bilgi yarışması sorusu). */
  soruKaydet: (degisiklik: SoruDegisikligi) => Promise<void>
  kapat: () => void
}

const SURELER = [0, 30, 45, 60, 90, 120, 180, 300]

/** Akıştaki bir kartın içeriğini yerinde düzenler: soru ve şıklar, kelime bulutu sorusu, oylama etiketleri, video/fotoğraf başlığı. */
export default function AdimDuzenle({ adim, soru, ayarKaydet, soruKaydet, kapat }: Props) {
  const a = adim.ayar
  const [metin, setMetin] = useState(adim.tur === 'soru' ? (soru?.soru ?? '') : (a.soru ?? ''))
  const [dogru, setDogru] = useState(soru?.dogru ?? '')
  const [yanlislar, setYanlislar] = useState<string[]>(soru?.yanlislar ?? [])
  const [sure, setSure] = useState(adim.tur === 'soru' ? (soru?.sure_sn ?? 20) : (a.sure_sn ?? 0))
  const [mod, setMod] = useState<'bulut' | 'firtina' | 'acik'>(a.mod ?? 'bulut')
  const [sol, setSol] = useState(a.etiketler?.[0] ?? '')
  const [sag, setSag] = useState(a.etiketler?.[1] ?? '')
  const [baslik, setBaslik] = useState(a.baslik ?? '')
  const [url, setUrl] = useState(a.url ?? '')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  const foto = adim.tur === 'video' && !!a.url && gorselMi(a.url)

  async function kaydet() {
    setHata(null)
    try {
      setMesgul(true)
      if (adim.tur === 'soru') {
        const d = dogru.trim()
        const y = yanlislar.map((x) => x.trim()).filter(Boolean)
        if (!metin.trim()) return setHata('Soru metni boş olamaz.')
        if (!d) return setHata('Doğru şık boş olamaz.')
        if (y.length < 1 || y.length > 5) return setHata('1 ile 5 arasında yanlış şık olmalı.')
        if (new Set([d, ...y]).size !== y.length + 1) return setHata('Şıklar birbirinden farklı olmalı.')
        await soruKaydet({ soru: metin.trim().slice(0, 1000), dogru: d.slice(0, 300), yanlislar: y.map((x) => x.slice(0, 300)), sure_sn: sure })
      } else {
        const yeni: AdimAyari = { ...a }
        if (adim.tur === 'fikir' || adim.tur === 'oylama') {
          if (!metin.trim()) return setHata(adim.tur === 'oylama' ? 'Önerme boş olamaz.' : 'Soru boş olamaz.')
          yeni.soru = metin.trim().slice(0, 300)
          if (sure > 0) yeni.sure_sn = sure
          else delete yeni.sure_sn
        }
        if (adim.tur === 'fikir') yeni.mod = mod
        if (adim.tur === 'oylama') {
          if (sol.trim() || sag.trim()) yeni.etiketler = [sol.trim().slice(0, 40) || 'Katılıyorum', sag.trim().slice(0, 40) || 'Katılmıyorum']
          else delete yeni.etiketler
        }
        if (adim.tur === 'video') {
          if (!foto) {
            const u = videoAdresi(url)
            if (!u) return setHata('Video adresi https:// ile başlamalı.')
            yeni.url = u
          }
          if (baslik.trim()) yeni.baslik = baslik.trim().slice(0, 120)
          else delete yeni.baslik
        }
        await ayarKaydet(yeni)
      }
      kapat()
    } catch {
      setHata('Kaydedilemedi. Bağlantını kontrol edip tekrar dene.')
    } finally {
      setMesgul(false)
    }
  }

  const desteklenir = adim.tur === 'soru' || adim.tur === 'fikir' || adim.tur === 'oylama' || adim.tur === 'video'
  if (!desteklenir) return null

  return (
    <div className="basis-full rounded-xl bg-slate-950/60 border border-indigo-400/30 p-4 space-y-3 cursor-auto">
      {(adim.tur === 'soru' || adim.tur === 'fikir' || adim.tur === 'oylama') && (
        <label className="block space-y-1">
          <span className="text-xs text-slate-300">{adim.tur === 'oylama' ? 'Önerme' : 'Soru'}</span>
          <textarea className="giris-kutusu text-sm" rows={adim.tur === 'soru' ? 3 : 2} value={metin} maxLength={adim.tur === 'soru' ? 1000 : 300} onChange={(e) => setMetin(e.target.value)} />
        </label>
      )}

      {adim.tur === 'soru' && (
        <>
          <label className="block space-y-1">
            <span className="text-xs text-emerald-300">Doğru şık</span>
            <input className="giris-kutusu text-sm" value={dogru} maxLength={300} onChange={(e) => setDogru(e.target.value)} />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs text-rose-300">Yanlış şıklar</span>
            {yanlislar.map((y, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="giris-kutusu text-sm"
                  value={y}
                  maxLength={300}
                  onChange={(e) => setYanlislar((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                  aria-label={`Yanlış şık ${i + 1}`}
                />
                <button type="button" className="ikincil-buton !px-2 !py-1" disabled={yanlislar.length <= 1} onClick={() => setYanlislar((l) => l.filter((_, j) => j !== i))} aria-label="Şıkkı sil">
                  ✕
                </button>
              </div>
            ))}
            {yanlislar.length < 5 && (
              <button type="button" className="ikincil-buton !py-1 text-xs" onClick={() => setYanlislar((l) => [...l, ''])}>
                + Yanlış şık ekle
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Cevap süresi
            <select className="giris-kutusu !w-auto !py-1 text-sm" value={sure} onChange={(e) => setSure(Number(e.target.value))}>
              {[...new Set([10, 15, 20, 30, 45, 60, 90, 120, 180, 300, sure])].sort((x, y) => x - y).map((x) => (
                <option key={x} value={x}>
                  {x} sn
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-amber-300/80">Bu soru soru bankasındadır; aynı soruyu kullanan başka akışlarda ve soru paketinde de değişir.</p>
        </>
      )}

      {adim.tur === 'fikir' && (
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Tür
            <select className="giris-kutusu !w-auto !py-1 text-sm" value={mod} onChange={(e) => setMod(e.target.value as 'bulut' | 'firtina' | 'acik')}>
              <option value="bulut">Kelime bulutu</option>
              <option value="firtina">Beyin fırtınası</option>
              <option value="acik">Açık uçlu soru</option>
            </select>
          </label>
        </div>
      )}

      {(adim.tur === 'fikir' || adim.tur === 'oylama') && (
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Cevap süresi
          <select className="giris-kutusu !w-auto !py-1 text-sm" value={sure} onChange={(e) => setSure(Number(e.target.value))}>
            {[...new Set([...SURELER, sure])].sort((x, y) => x - y).map((x) => (
              <option key={x} value={x}>
                {x === 0 ? 'Süresiz' : x >= 60 ? `${x / 60} dk` : `${x} sn`}
              </option>
            ))}
          </select>
        </label>
      )}

      {adim.tur === 'oylama' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="giris-kutusu text-sm" placeholder="Sol seçenek (Katılıyorum)" value={sol} maxLength={40} onChange={(e) => setSol(e.target.value)} />
          <input className="giris-kutusu text-sm" placeholder="Sağ seçenek (Katılmıyorum)" value={sag} maxLength={40} onChange={(e) => setSag(e.target.value)} />
        </div>
      )}

      {adim.tur === 'video' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {foto ? (
            <img src={a.url} alt="" className="max-h-32 rounded-lg" />
          ) : (
            <input className="giris-kutusu text-sm" placeholder="Video adresi (https://...)" value={url} maxLength={255} onChange={(e) => setUrl(e.target.value)} />
          )}
          <input className="giris-kutusu text-sm" placeholder="Başlık (isteğe bağlı)" value={baslik} maxLength={120} onChange={(e) => setBaslik(e.target.value)} />
        </div>
      )}

      {hata && <p className="text-sm text-rose-300">{hata}</p>}
      <div className="flex gap-2">
        <button type="button" className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold disabled:opacity-60" disabled={mesgul} onClick={kaydet}>
          {mesgul ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" className="ikincil-buton !py-1.5 text-sm" onClick={kapat}>
          Vazgeç
        </button>
      </div>
    </div>
  )
}
