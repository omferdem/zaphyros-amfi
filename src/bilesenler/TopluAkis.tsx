import { useState } from 'react'
import { akislariTopluOlustur, haftaSatirlari } from '../lib/akis'

/**
 * Haftalık planı topluca akışa çevirir: her dolu satır bir akış olur (14 satır = 14 hafta). Akış eklenebilen
 * her yerde (ders düzenleme, hafta planı) aynı kutu kullanılır.
 */
export default function TopluAkis({ icerikId, mevcutSayi, eklendi }: { icerikId: string; mevcutSayi: number; eklendi: (n: number) => void }) {
  const [plan, setPlan] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const adlar = haftaSatirlari(plan, mevcutSayi + 1)

  async function olustur(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    if (adlar.length === 0) return
    if (adlar.length > 60) return setHata('Bir seferde en fazla 60 satır eklenebilir.')
    setMesgul(true)
    try {
      const n = await akislariTopluOlustur(icerikId, adlar)
      setPlan('')
      eklendi(n)
    } catch {
      setHata('Akışlar oluşturulamadı.')
    }
    setMesgul(false)
  }

  return (
    <form onSubmit={olustur} className="cam-panel rounded-2xl p-5 space-y-3">
      <h2 className="font-bold">Haftalık planı topluca ekle</h2>
      <p className="text-sm text-slate-400">
        Ders bilgi paketindeki hafta konularını satır satır yapıştır; her satır bir akış olur. Örneğin 14 satır yapıştırırsan 14 hafta
        açılır. Satır başındaki "1." ya da "Hafta 1:" gibi numaralar otomatik atılır.
      </p>
      <textarea
        className="giris-kutusu min-h-28"
        placeholder={"Giriş: dinin tanımı\nTanrı'nın varlığı delilleri\nKötülük problemi"}
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
      />
      {plan.trim() && (
        <p className="text-xs text-slate-400">
          Açılacak: {adlar.slice(0, 3).join(' · ')}
          {adlar.length > 3 && ` … (toplam ${adlar.length} akış)`}
        </p>
      )}
      {hata && <p className="text-sm text-rose-300">{hata}</p>}
      <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold" disabled={!plan.trim() || mesgul}>
        {mesgul ? 'Açılıyor…' : 'Akışları aç'}
      </button>
    </form>
  )
}
