import { useEffect, useState } from 'react'
import { SlaytCizimi } from './Slayt'
import type { PdfBelgesi } from '../lib/pdf'
import type { Adim, Sunum } from '../lib/tipler'

/**
 * Akış düzenlemede bir slayda tıklayınca açılan büyük önizleme: slayt, sayfanın metni ve yalnızca hocanın gördüğü not.
 * Ok tuşları ve düğmelerle akıştaki diğer slaytlara geçilir; Esc kapatır. Not, adımın ayarında (ayar.not) saklanır ve
 * öğrenci telefonlarına ya da perdeye gitmez.
 */
export default function SlaytOnizleme({
  adimlar,
  baslangic,
  belgeler,
  sunumlar,
  notKaydet,
  kapat,
}: {
  adimlar: Adim[]
  /** Açılışta gösterilecek adımın akıştaki sırası */
  baslangic: number
  belgeler: Map<string, PdfBelgesi>
  sunumlar: Map<string, Sunum>
  notKaydet: (adimId: string, metin: string) => Promise<void>
  kapat: () => void
}) {
  const slaytlar = adimlar.map((a, i) => ({ a, i })).filter((x) => x.a.tur === 'slayt')
  const [konum, setKonum] = useState(Math.max(0, slaytlar.findIndex((x) => x.i === baslangic)))
  const simdiki = slaytlar[konum]?.a
  const [not, setNot] = useState(simdiki?.ayar.not ?? '')
  const [durum, setDurum] = useState<'' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('')

  // Başka slayda geçilince o slaydın notu yüklenir
  useEffect(() => {
    setNot(simdiki?.ayar.not ?? '')
    setDurum('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simdiki?.id])

  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') kapat()
      else if (e.key === 'ArrowRight') setKonum((k) => Math.min(slaytlar.length - 1, k + 1))
      else if (e.key === 'ArrowLeft') setKonum((k) => Math.max(0, k - 1))
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [kapat, slaytlar.length])

  if (!simdiki) return null
  const sunum = simdiki.presentation_id ? sunumlar.get(simdiki.presentation_id) : undefined
  const metin = sunum?.metinler[(simdiki.sayfa_no ?? 1) - 1] ?? ''

  async function kaydet() {
    if (!simdiki) return
    setDurum('kaydediliyor')
    try {
      await notKaydet(simdiki.id, not.trim())
      setDurum('kaydedildi')
    } catch {
      setDurum('hata')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur flex items-center justify-center p-3 sm:p-6" onClick={kapat}>
      <section className="cam-panel rounded-3xl p-4 sm:p-5 w-full max-w-5xl max-h-[94vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="ikincil-buton !py-1" onClick={() => setKonum((k) => Math.max(0, k - 1))} disabled={konum === 0} aria-label="Önceki slayt">
            ◀
          </button>
          <span className="text-sm font-mono text-slate-300 tabular-nums">
            {konum + 1} / {slaytlar.length}
          </span>
          <button className="ikincil-buton !py-1" onClick={() => setKonum((k) => Math.min(slaytlar.length - 1, k + 1))} disabled={konum >= slaytlar.length - 1} aria-label="Sonraki slayt">
            ▶
          </button>
          <span className="text-xs text-slate-400 truncate flex-1">
            {sunum?.ad} · sayfa {simdiki.sayfa_no} · akışta {slaytlar[konum].i + 1}. adım
          </span>
          <button className="ikincil-buton !py-1" onClick={kapat}>
            Kapat (Esc)
          </button>
        </div>
        <SlaytCizimi
          belge={simdiki.presentation_id ? belgeler.get(simdiki.presentation_id) : undefined}
          sayfaNo={simdiki.sayfa_no ?? 1}
          className="w-full aspect-video rounded-xl bg-slate-900"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-300">Slaytın metni</h3>
            <p className="text-sm text-slate-300 whitespace-pre-line max-h-40 overflow-y-auto rounded-xl bg-slate-950/60 border border-white/10 p-3">{metin || 'Bu sayfada metin yok (görsel olabilir).'}</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-300">Hoca notu (yalnızca sen görürsün)</h3>
            <textarea
              className="giris-kutusu text-sm"
              rows={4}
              maxLength={600}
              value={not}
              onChange={(e) => setNot(e.target.value)}
              placeholder="Bu slaytta anlatacağın örnek, soru ya da hatırlatma…"
            />
            <div className="flex items-center gap-3">
              <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" onClick={kaydet} disabled={durum === 'kaydediliyor'}>
                Notu kaydet
              </button>
              {durum === 'kaydedildi' && <span className="text-xs text-emerald-300">Kaydedildi</span>}
              {durum === 'hata' && <span className="text-xs text-rose-300">Kaydedilemedi</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
