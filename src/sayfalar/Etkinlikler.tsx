import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { sorulariGetir } from '../lib/akis'
import { paketleriGrupla } from '../lib/paket'
import { oturumBaslat } from '../lib/veri'
import {
  BOLUMLER,
  etkinlikAlani,
  etkinlikEkle,
  etkinlikGuncelle,
  etkinlikleriGetir,
  etkinlikSil,
  type EtkinlikBolumu,
  type EtkinlikSatiri,
} from '../lib/etkinlik'
import SoruBankasi from './SoruBankasi'

const ZORLUKLAR = [
  { anahtar: 'kolay', ad: 'Kolay' },
  { anahtar: 'orta', ad: 'Orta' },
  { anahtar: 'zor', ad: 'Zor' },
] as const

/** Bölümün oyun modu seçenekleri. Quizde mod yoktur. */
function modSecenekleri(bolum: EtkinlikBolumu): { anahtar: string; ad: string }[] {
  if (bolum === 'quiz') return []
  if (bolum === 'zapoot') return [{ anahtar: 'oneri', ad: '✨ Paketin önerilen modu' }, { anahtar: 'bireysel', ad: '🧑 Bireysel' }]
  return [
    { anahtar: 'oneri', ad: '✨ Paketin önerilen modu' },
    ...(Object.keys(OYUNLAR) as OyunAnahtari[]).map((k) => ({ anahtar: k, ad: `${OYUNLAR[k].emoji} ${OYUNLAR[k].ad}` })),
  ]
}

/**
 * Hocanın etkinlik alanı (Zapoot / Oyunlar / Quiz): derse bağlı olmayan, yoklamasız, yalnızca kodla girilen oturumlar.
 * Her satır bir etkinliktir: adı, soru paketi, oyun modu, soru sayısı ve zorluğu. Satıra basınca perde açılır ve etkinlik kendiliğinden başlar.
 */
export default function Etkinlikler() {
  const { bolum = '' } = useParams()
  if (!(bolum in BOLUMLER)) return <Navigate to="/panel" replace />
  return <EtkinlikAlani key={bolum} bolum={bolum as EtkinlikBolumu} />
}

function EtkinlikAlani({ bolum }: { bolum: EtkinlikBolumu }) {
  const navigate = useNavigate()
  const b = BOLUMLER[bolum]
  const [alan, setAlan] = useState<{ courseId: string; icerikId: string } | null>(null)
  const [satirlar, setSatirlar] = useState<EtkinlikSatiri[] | null>(null)
  const [paketAdlari, setPaketAdlari] = useState<string[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniPaket, setYeniPaket] = useState('')

  const yukle = useCallback(async () => {
    try {
      const a = await etkinlikAlani(bolum)
      setAlan(a)
      const [l, sorular] = await Promise.all([etkinlikleriGetir(a.courseId), sorulariGetir(a.icerikId)])
      setSatirlar(l)
      setPaketAdlari(paketleriGrupla(sorular).filter((g) => g.ad).map((g) => g.ad))
    } catch {
      setHata('Etkinlikler yüklenemedi. Sayfayı yenileyip tekrar dene.')
    }
  }, [bolum])

  useEffect(() => {
    yukle()
  }, [yukle])

  const modlar = modSecenekleri(bolum)

  async function ekle() {
    if (!alan || !yeniAd.trim()) return
    setHata(null)
    try {
      await etkinlikEkle(
        alan.courseId,
        { ad: yeniAd.trim(), paket: yeniPaket, mod: modlar[0]?.anahtar ?? 'bireysel', adet: 20, zorluk: 'orta' },
        (satirlar?.length ?? 0) + 1,
      )
      setYeniAd('')
      setYeniPaket('')
      await yukle()
    } catch {
      setHata('Etkinlik eklenemedi.')
    }
  }

  async function degistir(e: EtkinlikSatiri, alanlar: Partial<EtkinlikSatiri>) {
    setSatirlar((l) => l?.map((x) => (x.id === e.id ? { ...x, ...alanlar } : x)) ?? l)
    try {
      await etkinlikGuncelle(e.id, alanlar)
    } catch {
      setHata('Değişiklik kaydedilemedi.')
      yukle()
    }
  }

  async function sil(e: EtkinlikSatiri) {
    if (!window.confirm(`"${e.ad}" etkinliği silinsin mi? (Soru paketi bankada kalır.)`)) return
    try {
      await etkinlikSil(e.id)
      await yukle()
    } catch {
      setHata('Etkinlik silinemedi.')
    }
  }

  async function baslat(e: EtkinlikSatiri) {
    if (!alan) return
    if (!e.paket) return setHata('Önce bu etkinliğe bir soru paketi seç.')
    setMesgul(e.id)
    setHata(null)
    try {
      const oturum = await oturumBaslat(alan.courseId, e.ad, null, false)
      navigate(`/sahne/${oturum}?etkinlik=${e.id}`)
    } catch {
      setHata('Etkinlik başlatılamadı.')
      setMesgul(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/panel" className="text-sm text-slate-400 hover:text-white">
          ← Derslerim
        </Link>
        <h1 className="text-3xl font-extrabold">
          {b.emoji} {b.ad}
        </h1>
      </div>
      <p className="text-sm text-slate-300">
        {b.aciklama} Yoklama alınmaz ve şube listelerine yazılmaz; öğrenciler perdedeki kodu girer ve bir takma adla katılır.
      </p>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Etkinliklerim</h2>
        {satirlar === null ? (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        ) : satirlar.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz etkinlik yok. Aşağıdan ekle; önce soru bankasına bir paket yüklemen gerekir.</p>
        ) : (
          <ul className="space-y-2">
            {satirlar.map((e) => (
              <li key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-2">
                <input
                  className="giris-kutusu !w-48 !py-1.5 font-semibold"
                  defaultValue={e.ad}
                  aria-label="Etkinlik adı"
                  onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.ad && degistir(e, { ad: ev.target.value.trim() })}
                />
                <select className="giris-kutusu !w-auto !py-1.5 text-sm max-w-56" value={e.paket} onChange={(ev) => degistir(e, { paket: ev.target.value })} aria-label="Soru paketi">
                  <option value="">Paket seç…</option>
                  {paketAdlari.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {modlar.length > 0 && (
                  <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={e.mod} onChange={(ev) => degistir(e, { mod: ev.target.value })} aria-label="Oyun modu">
                    {modlar.map((m) => (
                      <option key={m.anahtar} value={m.anahtar}>
                        {m.ad}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-1 text-xs text-slate-300">
                  Soru
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="giris-kutusu !w-16 !py-1.5 text-sm"
                    defaultValue={e.adet}
                    onBlur={(ev) => {
                      const n = Math.min(100, Math.max(1, Number(ev.target.value) || 20))
                      if (n !== e.adet) degistir(e, { adet: n })
                    }}
                  />
                </label>
                {bolum !== 'quiz' && (
                  <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={e.zorluk} onChange={(ev) => degistir(e, { zorluk: ev.target.value as EtkinlikSatiri['zorluk'] })} aria-label="Zorluk">
                    {ZORLUKLAR.map((z) => (
                      <option key={z.anahtar} value={z.anahtar}>
                        {z.ad}
                      </option>
                    ))}
                  </select>
                )}
                <span className="flex-1" />
                <button className="dugme-birincil !py-1.5" disabled={mesgul === e.id} onClick={() => baslat(e)}>
                  {mesgul === e.id ? 'Açılıyor…' : '▶ Başlat'}
                </button>
                <button className="text-xs text-rose-300 hover:text-rose-200 px-2" onClick={() => sil(e)}>
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input className="giris-kutusu !w-56" placeholder="Yeni etkinlik adı (ör. Hafta 3 ısınma)" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ekle()} />
          <select className="giris-kutusu !w-auto text-sm max-w-56" value={yeniPaket} onChange={(e) => setYeniPaket(e.target.value)} aria-label="Yeni etkinliğin paketi">
            <option value="">Paket (sonra da seçilir)</option>
            {paketAdlari.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button className="dugme-ikincil" disabled={!yeniAd.trim() || !alan} onClick={ekle}>
            + Etkinlik ekle
          </button>
          <button className="text-xs text-slate-400 hover:text-white px-2" onClick={yukle} title="Soru bankasına yeni paket yükledinse listeyi tazele">
            ↻ Paketleri yenile
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{b.ad} soru bankası</h2>
        <p className="text-sm text-slate-400">Bu bölümün soru paketleri. Etkinlik satırları buradaki paketlerden seçer.</p>
        {alan && <SoruBankasi icerikId={alan.icerikId} />}
      </section>
    </div>
  )
}

