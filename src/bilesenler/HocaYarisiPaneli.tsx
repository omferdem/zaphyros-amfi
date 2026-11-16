import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Gorsel from './Gorsel'
import { HocaYarisSahnesi } from './HocaYarisSahnesi'
import type { SeritOyuncusu } from './EnerjiSeridi'

interface Yaris {
  acik: boolean
  hoca: number
  sinif: number
  soru: number
  cevapladi: boolean
  son: { hoca_dogru: boolean; sinif_orani: number | null } | null
}

interface Soru {
  id: string
  secenekler: string[]
  acik: boolean
}

const HARFLER = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * Hocayla yarış: sınıf hocaya karşı oynar. Hoca soru açıkken kendi cevabını gizlice verir; sonuç açılınca
 * hocanın doğru bilip bilmediği ve sınıfın başarısı skora yazılır. Perdede şıklar yalnızca harfle gösterilir.
 */
export default function HocaYarisiPaneli({ oturum, anahtar, mod, dugme = true }: { oturum: string; anahtar: string | null; mod: 'perde' | 'kumanda'; dugme?: boolean }) {
  const [y, setY] = useState<Yaris | null>(null)
  const [soru, setSoru] = useState<Soru | null>(null)
  const [secilen, setSecilen] = useState<{ adim: string; metin: string } | null>(null)
  const [acikPicker, setAcikPicker] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  // Büyük sahne: yarış bitince kendiliğinden açılır, istenirse "Büyüt" ile de açılır
  const [buyuk, setBuyuk] = useState(false)
  const [kapatildi, setKapatildi] = useState(false)
  const [sinifVerisi, setSinifVerisi] = useState<{ toplam: number; oyuncular: SeritOyuncusu[] }>({ toplam: 0, oyuncular: [] })

  const yenile = useCallback(async () => {
    const [{ data }, { data: durum }] = await Promise.all([
      supabase.rpc('hoca_yaris_goster', { p_session: oturum, p_anahtar: anahtar }),
      supabase.rpc('ders_durumu', { p_session: oturum }),
    ])
    if (data && !(data as { hata?: string }).hata) {
      const yeni = data as Yaris
      setY(yeni)
      if (mod === 'perde' && yeni.acik) {
        const { data: z } = await supabase.rpc('zombi_goster', { p_session: oturum, p_anahtar: null })
        const v = z as { sorular?: unknown[]; oyuncular?: SeritOyuncusu[] } | null
        if (v?.sorular && v.oyuncular) setSinifVerisi({ toplam: v.sorular.length, oyuncular: v.oyuncular })
      }
    }
    const adim = (durum as { adim?: { id: string; tur: string; secenekler?: string[]; soru_durum?: string | null } | null } | null)?.adim
    setSoru(adim && adim.tur === 'soru' && adim.secenekler ? { id: adim.id, secenekler: adim.secenekler, acik: adim.soru_durum === 'acik' } : null)
  }, [oturum, anahtar, mod])

  useEffect(() => {
    yenile()
    const t = setInterval(yenile, 3000)
    return () => clearInterval(t)
  }, [yenile])

  async function ayarla(acik: boolean) {
    setHata(null)
    await supabase.rpc('hoca_yaris_ayarla', { p_session: oturum, p_anahtar: anahtar, p_acik: acik })
    await yenile()
  }

  async function cevapla(metin: string) {
    if (!soru) return
    setHata(null)
    const { data, error } = await supabase.rpc('hoca_cevapla', { p_session: oturum, p_anahtar: anahtar, p_adim: soru.id, p_secim: metin })
    if (error || (data as { hata?: string })?.hata) setHata('Cevap kaydedilemedi (soru kapanmış olabilir).')
    else setSecilen({ adim: soru.id, metin })
    setAcikPicker(false)
    await yenile()
  }

  if (!y) return null
  const perde = mod === 'perde'
  const benim = secilen && soru && secilen.adim === soru.id ? secilen.metin : null
  const bitti = perde && y.acik && sinifVerisi.toplam > 0 && y.soru >= sinifVerisi.toplam
  // Büyük sahne oyun açılır açılmaz çizilir (eskiden yalnızca bitince ya da ⛶ ile açılıyordu); hoca kapatabilir
  const sahneAcik = perde && y.acik && (buyuk || !kapatildi)

  if (!y.acik) {
    if (!dugme) return null
    return (
      <div className={perde ? 'fixed left-1/2 -translate-x-1/2 bottom-14 z-30' : ''}>
        <button className="ikincil-buton !py-1.5 text-sm" onClick={() => ayarla(true)}>
          🥊 Hocayla yarış
        </button>
      </div>
    )
  }

  return (
    <div className={perde ? `fixed left-1/2 -translate-x-1/2 ${sahneAcik ? 'top-3' : 'bottom-14'} z-30 flex flex-col items-center gap-2 max-w-[22rem]` : 'cam-panel rounded-2xl p-4 space-y-3'}>
      {sahneAcik && (
        <HocaYarisSahnesi
          hoca={y.hoca}
          sinif={y.sinif}
          son={y.son}
          oynanan={y.soru}
          toplam={sinifVerisi.toplam}
          oyuncular={sinifVerisi.oyuncular}
          bitti={bitti}
          kapat={() => {
            setBuyuk(false)
            setKapatildi(true)
          }}
        />
      )}
      <div className="relative z-50 cam-panel rounded-2xl px-4 py-2 flex items-center gap-3">
        <Gorsel ad="hoca-yaris.webp" emoji="🥊" className="w-12 h-12" emojiClass="text-xl" />
        <span className="font-display font-extrabold tabular-nums text-lg relative">
          Hoca <span key={`h${y.hoca}`} className="skor-don inline-block">{y.hoca}</span> <span className="text-slate-500">–</span> <span key={`s${y.sinif}`} className="skor-don inline-block">{y.sinif}</span> Sınıf
          {y.son && (
            <span key={`b${y.hoca}-${y.sinif}`} className={`absolute top-1/2 -translate-y-1/2 text-2xl ${y.son.hoca_dogru ? 'boks-hoca' : 'boks-sinif'}`} aria-hidden>
              🥊
            </span>
          )}
        </span>
        <Gorsel ad="ogrenci-sinif.webp" emoji="" className="w-12 h-12" />
        {perde && (
          <button className="text-xs text-slate-300 hover:text-white" onClick={() => { setKapatildi(false); setBuyuk(true) }} title="Büyük sahneyi aç">
            ⛶
          </button>
        )}
        <button className="text-xs text-slate-500 hover:text-white" onClick={() => ayarla(false)} title="Hocayla yarışı kapat">
          ✕
        </button>
      </div>

      {y.son && (
        <div className="relative z-50 cam-panel rounded-2xl px-4 py-2 text-sm pop">
          Hoca: <b className={y.son.hoca_dogru ? 'text-emerald-300' : 'text-rose-300'}>{y.son.hoca_dogru ? '✔ doğru bildi' : '✘ yanıldı'}</b>
          {y.son.sinif_orani !== null && (
            <>
              {' · '}Sınıf: <b>%{y.son.sinif_orani}</b>
            </>
          )}
        </div>
      )}

      {soru?.acik && !y.son && (
        <div className="relative z-50 cam-panel rounded-2xl px-4 py-2 space-y-2">
          {y.cevapladi && !acikPicker ? (
            <p className="text-sm text-emerald-300">
              ✓ Hoca cevabını verdi{benim && !perde ? `: ${benim}` : ''}{' '}
              <button className="text-xs text-slate-400 underline" onClick={() => setAcikPicker(true)}>
                değiştir
              </button>
            </p>
          ) : acikPicker || !y.cevapladi ? (
            <>
              <p className="text-xs text-slate-400">Hoca cevabını seç (gizli):</p>
              <div className={perde ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}>
                {soru.secenekler.map((s, i) =>
                  perde ? (
                    <button key={i} className="ikincil-buton !px-3 !py-1 font-bold" onClick={() => cevapla(s)}>
                      {HARFLER[i]}
                    </button>
                  ) : (
                    <button key={i} className="ikincil-buton w-full text-left !py-2" onClick={() => cevapla(s)}>
                      <b>{HARFLER[i]}</b> {s}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : null}
          {hata && <p className="text-xs text-rose-300">{hata}</p>}
        </div>
      )}
    </div>
  )
}
