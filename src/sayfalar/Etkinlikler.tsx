import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { akisOlustur, sorulariGetir } from '../lib/akis'
import { supabase } from '../lib/supabase'
import { metniIndir, soruMetniYaz } from '../lib/soruBicimi'
import type { Soru } from '../lib/tipler'
import { paketleriGrupla } from '../lib/paket'
import { oturumBaslat } from '../lib/veri'
import {
  BOLUMLER,
  etkinlikAlani,
  etkinlikEkle,
  etkinlikGuncelle,
  etkinlikleriGetir,
  etkinlikKopyala,
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
  return (Object.keys(OYUNLAR) as OyunAnahtari[]).map((k) => ({ anahtar: k, ad: `${OYUNLAR[k].emoji} ${OYUNLAR[k].ad}` }))
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
  const [paketModlari, setPaketModlari] = useState<Record<string, string>>({})
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState<string | null>(null)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniPaket, setYeniPaket] = useState('')
  const [arsivde, setArsivde] = useState(false)
  const [arsivSayisi, setArsivSayisi] = useState(0)
  const [tumSorular, setTumSorular] = useState<Soru[]>([])
  const [yeniAkisAd, setYeniAkisAd] = useState('')
  const [bilgi, setBilgi] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    try {
      const a = await etkinlikAlani(bolum)
      setAlan(a)
      const [l, sorular, digerleri] = await Promise.all([etkinlikleriGetir(a.courseId, arsivde), sorulariGetir(a.icerikId), etkinlikleriGetir(a.courseId, !arsivde)])
      setSatirlar(l)
      setArsivSayisi(arsivde ? l.length : digerleri.length)
      setTumSorular(sorular)
      const gruplar = paketleriGrupla(sorular).filter((g) => g.ad)
      setPaketAdlari(gruplar.map((g) => g.ad))
      setPaketModlari(Object.fromEntries(gruplar.map((g) => [g.ad, String(g.sorular[0]?.ek?.mod ?? '')])))
    } catch {
      setHata('Etkinlikler yüklenemedi. Sayfayı yenileyip tekrar dene.')
    }
  }, [bolum, arsivde])

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

  /** Yeni paket yüklenince, o paketi kullanan bir etkinlik yoksa paketin adıyla etkinlik satırı açar. */
  async function paketYuklendi(paketAdi: string, sayi: number) {
    if (!alan) return
    try {
      const mevcut = await etkinlikleriGetir(alan.courseId)
      if (!mevcut.some((e) => e.paket === paketAdi)) {
        await etkinlikEkle(alan.courseId, { ad: paketAdi, paket: paketAdi, mod: modlar[0]?.anahtar ?? 'bireysel', adet: Math.min(20, sayi), zorluk: 'orta' }, mevcut.length + 1)
      }
      await yukle()
    } catch {
      setHata('Etkinlik satırı açılamadı; paket bankaya eklendi.')
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

  async function arsivle(e: EtkinlikSatiri, arsiv: boolean) {
    try {
      await etkinlikGuncelle(e.id, { arsiv })
      await yukle()
    } catch {
      setHata('Arşiv işlemi yapılamadı.')
    }
  }

  async function kopyala(e: EtkinlikSatiri, hedef: EtkinlikBolumu) {
    if (!alan) return
    setHata(null)
    setBilgi(null)
    try {
      await etkinlikKopyala(e, alan.icerikId, hedef)
      setBilgi(`"${e.ad}" ${BOLUMLER[hedef].ad} bölümüne kopyalandı (sorularıyla birlikte).`)
    } catch {
      setHata('Etkinlik kopyalanamadı.')
    }
  }

  function disaAktar(e: EtkinlikSatiri) {
    const sorular = tumSorular.filter((q) => (q.ek?.paket ?? '') === e.paket)
    if (sorular.length === 0) return setHata('Bu etkinliğin paketinde soru yok.')
    metniIndir(soruMetniYaz(sorular, 'zomr'), e.paket || e.ad)
  }

  async function akisliEtkinlikEkle() {
    if (!alan || !yeniAkisAd.trim()) return
    setHata(null)
    try {
      const akis = await akisOlustur(alan.icerikId, yeniAkisAd.trim())
      await etkinlikEkle(alan.courseId, { ad: yeniAkisAd.trim(), paket: '', mod: 'bireysel', adet: 20, zorluk: 'orta', akis_id: akis.id }, (satirlar?.length ?? 0) + 1)
      setYeniAkisAd('')
      await yukle()
    } catch {
      setHata('Slaytlı etkinlik eklenemedi.')
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
    if (!e.akis_id && !e.paket) return setHata('Önce bu etkinliğe bir soru paketi seç.')
    setMesgul(e.id)
    setHata(null)
    try {
      const oturum = await oturumBaslat(alan.courseId, e.ad, null, false)
      if (e.akis_id) {
        // Slaytlı etkinlik: önce giriş ekranı (kod ve karekod); hoca "Derse geç" ile akışı açar. Yoklama alınmaz.
        await supabase.from('sessions').update({ lesson_id: e.akis_id }).eq('id', oturum)
        navigate(`/sahne/${oturum}`)
      } else navigate(`/sahne/${oturum}?etkinlik=${e.id}`)
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
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{arsivde ? 'Arşiv' : 'Etkinliklerim'}</h2>
          <button className="text-xs text-slate-300 underline hover:text-white" onClick={() => setArsivde((a) => !a)}>
            {arsivde ? '← Etkinliklerime dön' : `📦 Arşiv (${arsivSayisi})`}
          </button>
        </div>
        {bilgi && <p className="text-sm text-emerald-300">{bilgi}</p>}
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
                {e.akis_id && (
                  <Link to={`/panel/akis/${e.akis_id}`} className="ikincil-buton !py-1.5 text-sm" title="Slayt, video ve soru adımlarını düzenle">
                    🎞 Akışı düzenle (slayt ekle)
                  </Link>
                )}
                {!e.akis_id && <select className="giris-kutusu !w-auto !py-1.5 text-sm max-w-56" value={e.paket} onChange={(ev) => degistir(e, { paket: ev.target.value })} aria-label="Soru paketi">
                  <option value="">Paket seç…</option>
                  {paketAdlari.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>}
                {!e.akis_id && modlar.length > 0 && (
                  <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={e.mod} onChange={(ev) => degistir(e, { mod: ev.target.value })} aria-label="Oyun modu">
                    {!modlar.some((m) => m.anahtar === e.mod) && <option value={e.mod}>✨ Paketin önerilen modu</option>}
                    {modlar.map((m) => (
                      <option key={m.anahtar} value={m.anahtar}>
                        {m.ad}
                      </option>
                    ))}
                  </select>
                )}
                {!e.akis_id && e.mod === 'oneri' && (
                  <span className="text-xs text-amber-200" title="Paketin hazırlanmış oyun modu; yoksa bireysel oynanır">
                    Önerilen: {paketModlari[e.paket] && paketModlari[e.paket] in OYUNLAR ? OYUNLAR[paketModlari[e.paket] as OyunAnahtari].ad : 'yok (bireysel)'}
                  </span>
                )}
                {!e.akis_id && <label className="flex items-center gap-1 text-xs text-slate-300">
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
                </label>}
                {!e.akis_id && bolum !== 'quiz' && (
                  <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={e.zorluk} onChange={(ev) => degistir(e, { zorluk: ev.target.value as EtkinlikSatiri['zorluk'] })} aria-label="Zorluk">
                    {ZORLUKLAR.map((z) => (
                      <option key={z.anahtar} value={z.anahtar}>
                        {z.ad}
                      </option>
                    ))}
                  </select>
                )}
                <span className="flex-1" />
                {!arsivde && (
                  <button className="dugme-birincil !py-1.5" disabled={mesgul === e.id} onClick={() => baslat(e)}>
                    {mesgul === e.id ? 'Açılıyor…' : '▶ Başlat'}
                  </button>
                )}
                {!e.akis_id && e.paket && (
                  <button className="text-xs text-slate-300 hover:text-white px-2" onClick={() => disaAktar(e)} title="Paketin sorularını .txt (ZOMR) olarak indir">
                    ⬇ Dışa aktar
                  </button>
                )}
                {!e.akis_id && (
                  <select
                    className="giris-kutusu !w-auto !py-1 text-xs"
                    value=""
                    aria-label="Başka bölüme kopyala"
                    onChange={(ev) => ev.target.value && void kopyala(e, ev.target.value as EtkinlikBolumu)}
                  >
                    <option value="">Kopyala…</option>
                    {(Object.keys(BOLUMLER) as EtkinlikBolumu[])
                      .filter((k) => k !== bolum)
                      .map((k) => (
                        <option key={k} value={k}>
                          → {BOLUMLER[k].ad}
                        </option>
                      ))}
                  </select>
                )}
                <button className="text-xs text-amber-200 hover:text-amber-100 px-2" onClick={() => arsivle(e, !arsivde)} title={arsivde ? 'Arşivden çıkar' : 'Silmeden sakla'}>
                  {arsivde ? '↩ Arşivden çıkar' : '📦 Arşive kaldır'}
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
        {!arsivde && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input className="giris-kutusu !w-56" placeholder="Slaytlı etkinlik adı (ders gibi işlenir)" value={yeniAkisAd} onChange={(e) => setYeniAkisAd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void akisliEtkinlikEkle()} />
            <button className="dugme-ikincil" disabled={!yeniAkisAd.trim() || !alan} onClick={() => void akisliEtkinlikEkle()} title="Slayt, video ve soru adımlarından oluşan bir akış kurar; yoklama aranmaz, kod ve karekodla girilir">
              + Slaytlı etkinlik ekle
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{b.ad} soru bankası</h2>
        <p className="text-sm text-slate-400">Bu bölümün soru paketleri. Etkinlik satırları buradaki paketlerden seçer.</p>
        {alan && <SoruBankasi icerikId={alan.icerikId} yuklendi={paketYuklendi} />}
      </section>
    </div>
  )
}

