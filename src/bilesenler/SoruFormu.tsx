import { useState } from 'react'
import type { Soru } from '../lib/tipler'

export interface SoruDegisikligi {
  soru: string
  dogru: string
  yanlislar: string[]
  sure_sn: number
  paket: string
}

/** Soru metni, doğru cevap ve yanlışlar için denetim; hata varsa nedenini, yoksa null döndürür. */
export function soruDenetle(d: SoruDegisikligi): string | null {
  if (!d.soru.trim()) return 'Soru metni boş olamaz.'
  if (d.soru.trim().length > 1000) return 'Soru metni en fazla 1000 harf olabilir.'
  if (!d.dogru.trim()) return 'Doğru cevabı yaz.'
  if (d.dogru.trim().length > 300) return 'Doğru cevap en fazla 300 harf olabilir.'
  const y = d.yanlislar.map((x) => x.trim()).filter(Boolean)
  if (y.length < 1) return 'En az bir yanlış şık yaz.'
  if (y.length > 5) return 'En fazla 5 yanlış şık olabilir.'
  if (y.some((x) => x.length > 300)) return 'Şıklar en fazla 300 harf olabilir.'
  if (new Set(y.map((x) => x.toLocaleLowerCase('tr'))).size !== y.length) return 'Aynı yanlış şık iki kez yazılmış.'
  if (y.some((x) => x.toLocaleLowerCase('tr') === d.dogru.trim().toLocaleLowerCase('tr'))) return 'Doğru cevap yanlışlar arasında da yazılmış.'
  if (d.sure_sn < 5 || d.sure_sn > 300) return 'Süre 5 ile 300 saniye arasında olmalı.'
  return null
}

const SURELER = [10, 15, 20, 30, 45, 60, 90, 120]

/** Bir soruyu düzenleme formu: metin, doğru cevap, yanlış şıklar (her satır bir şık), süre ve paket. */
export default function SoruFormu({
  soru,
  paket,
  paketAdlari,
  kaydet,
  vazgec,
}: {
  soru: Soru
  paket: string
  paketAdlari: string[]
  kaydet: (d: SoruDegisikligi) => Promise<void>
  vazgec: () => void
}) {
  const [d, setD] = useState({ soru: soru.soru, dogru: soru.dogru, yanlislar: soru.yanlislar.join('\n'), sure_sn: soru.sure_sn, paket })
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function gonder(e: React.FormEvent) {
    e.preventDefault()
    const degisiklik: SoruDegisikligi = { ...d, soru: d.soru.trim(), dogru: d.dogru.trim(), yanlislar: d.yanlislar.split('\n').map((x) => x.trim()).filter(Boolean), paket: d.paket.trim() }
    const h = soruDenetle(degisiklik)
    if (h) return setHata(h)
    setMesgul(true)
    setHata(null)
    try {
      await kaydet(degisiklik)
    } catch {
      setHata('Soru kaydedilemedi.')
      setMesgul(false)
    }
  }

  return (
    <form onSubmit={gonder} className="basis-full rounded-xl bg-slate-950/60 border border-white/10 p-3 space-y-2">
      <label className="block text-xs text-slate-300 space-y-1">
        <span>Soru metni</span>
        <textarea className="giris-kutusu text-sm" rows={3} value={d.soru} onChange={(e) => setD({ ...d, soru: e.target.value })} />
      </label>
      <label className="block text-xs text-slate-300 space-y-1">
        <span>Doğru cevap</span>
        <input className="giris-kutusu text-sm" value={d.dogru} onChange={(e) => setD({ ...d, dogru: e.target.value })} />
      </label>
      <label className="block text-xs text-slate-300 space-y-1">
        <span>Yanlış şıklar (her satıra bir şık, en fazla 5)</span>
        <textarea className="giris-kutusu text-sm" rows={4} value={d.yanlislar} onChange={(e) => setD({ ...d, yanlislar: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-slate-300 space-y-1">
          <span className="block">Cevap süresi</span>
          <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={d.sure_sn} onChange={(e) => setD({ ...d, sure_sn: Number(e.target.value) })}>
            {[...new Set([...SURELER, d.sure_sn])].sort((a, b) => a - b).map((x) => (
              <option key={x} value={x}>
                {x} sn
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-300 space-y-1 flex-1 min-w-48">
          <span className="block">Paket</span>
          <input className="giris-kutusu !py-1.5 text-sm" list="soru-paketleri" value={d.paket} onChange={(e) => setD({ ...d, paket: e.target.value })} placeholder="Paketsiz" />
          <datalist id="soru-paketleri">
            {paketAdlari.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <button disabled={mesgul} className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold">
          Kaydet
        </button>
        <button type="button" className="ikincil-buton !py-1.5 text-sm" onClick={vazgec}>
          Vazgeç
        </button>
      </div>
      {hata && <p className="text-xs text-rose-300">{hata}</p>}
    </form>
  )
}
