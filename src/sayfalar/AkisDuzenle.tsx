import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Adim, Akis, Soru, Sunum } from '../lib/tipler'
import { adimlarEkle, adimlariGetir, akisGetir, akisSirala, sorulariGetir, sunumYukle, sunumlariGetir } from '../lib/akis'
import { SlaytCizimi, usePdfBelgeleri } from '../bilesenler/Slayt'

/** Dosya adından sunum adı: uzantı ve alt çizgiler atılır. */
function dosyadanAd(ad: string): string {
  return ad.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
}

/** Slayt metninin ilk satırı, adım listesinde başlık olarak gösterilir. */
function ilkSatir(metin: string | undefined): string {
  return (metin ?? '').split('\n')[0]?.slice(0, 120) ?? ''
}

/** Bir ders akışını düzenler: sunum yükleme, adım ekleme, sıralama ve silme. */
export default function AkisDuzenle() {
  const { akisId = '' } = useParams()
  const navigate = useNavigate()
  const [akis, setAkis] = useState<Akis | null | undefined>(undefined)
  const [adimlar, setAdimlar] = useState<Adim[]>([])
  const [sunumlar, setSunumlar] = useState<Sunum[]>([])
  const [sorular, setSorular] = useState<Soru[]>([])
  const [soruSecimi, setSoruSecimi] = useState<Set<string> | null>(null)
  const [ad, setAd] = useState('')
  const [yukleme, setYukleme] = useState<string | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [eklenecekSunum, setEklenecekSunum] = useState('')
  const [suruklenen, setSuruklenen] = useState<number | null>(null)

  const yukle = useCallback(async () => {
    try {
      const a = await akisGetir(akisId)
      setAkis(a)
      if (!a) return
      setAd(a.ad)
      const [ad2, s, q] = await Promise.all([adimlariGetir(a.id), sunumlariGetir(a.subject_id), sorulariGetir(a.subject_id)])
      setAdimlar(ad2)
      setSunumlar(s)
      setSorular(q)
    } catch {
      setHata('Akış yüklenemedi.')
    }
  }, [akisId])

  useEffect(() => {
    yukle()
  }, [yukle])

  const sunumHaritasi = useMemo(() => new Map(sunumlar.map((s) => [s.id, s])), [sunumlar])
  const soruHaritasi = useMemo(() => new Map(sorular.map((s) => [s.id, s])), [sorular])
  const kullanilanSunumlar = useMemo(
    () => adimlar.flatMap((a) => (a.presentation_id ? [a.presentation_id] : [])),
    [adimlar],
  )
  const { belgeler } = usePdfBelgeleri(akis?.subject_id, kullanilanSunumlar)

  async function adiKaydet() {
    if (!akis || !ad.trim() || ad.trim() === akis.ad) return
    const { error } = await supabase.from('lessons').update({ ad: ad.trim().slice(0, 200) }).eq('id', akis.id)
    if (error) setHata('Ad kaydedilemedi.')
    else setAkis({ ...akis, ad: ad.trim() })
  }

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya || !akis) return
    setHata(null)
    if (!/\.pdf$/i.test(dosya.name)) {
      setHata(
        'Şimdilik yalnızca PDF yüklenebiliyor. PowerPoint dosyası için PowerPoint\'te Dosya > Farklı Kaydet > PDF ile kaydedip onu yükle. PPTX desteği sonraki sürümde gelecek.',
      )
      return
    }
    if (dosya.size > 50 * 1024 * 1024) {
      setHata('Dosya 50 MB\'tan büyük. PowerPoint\'te PDF olarak kaydederken "En küçük boyut" seçeneğini dene.')
      return
    }
    try {
      const sunum = await sunumYukle(akis.subject_id, dosya, dosyadanAd(dosya.name), setYukleme)
      setYukleme('Slaytlar akışa ekleniyor…')
      await adimlarEkle(
        akis.id,
        adimlar.length,
        Array.from({ length: sunum.sayfa_sayisi }, (_, i) => ({ tur: 'slayt' as const, presentation_id: sunum.id, sayfa_no: i + 1 })),
      )
    } catch {
      setHata('Sunum yüklenemedi. Dosyanın bozuk olmadığından ve internet bağlantından emin ol.')
    }
    setYukleme(null)
    yukle()
  }

  async function kayitliSunumuEkle() {
    const sunum = sunumHaritasi.get(eklenecekSunum)
    if (!sunum || !akis) return
    try {
      await adimlarEkle(
        akis.id,
        adimlar.length,
        Array.from({ length: sunum.sayfa_sayisi }, (_, i) => ({ tur: 'slayt' as const, presentation_id: sunum.id, sayfa_no: i + 1 })),
      )
    } catch {
      setHata('Slaytlar eklenemedi.')
    }
    setEklenecekSunum('')
    yukle()
  }

  async function sorulariAkisaEkle(idler: string[]) {
    if (!akis || idler.length === 0) return
    try {
      await adimlarEkle(
        akis.id,
        adimlar.length,
        idler.map((id) => ({ tur: 'soru' as const, question_id: id })),
      )
    } catch {
      setHata('Sorular eklenemedi.')
    }
    setSoruSecimi(null)
    yukle()
  }

  async function yoklamaEkle() {
    if (!akis) return
    try {
      await adimlarEkle(akis.id, adimlar.length, [{ tur: 'yoklama' }])
    } catch {
      setHata('Adım eklenemedi.')
    }
    yukle()
  }

  async function sirala(yeni: Adim[]) {
    if (!akis) return
    setAdimlar(yeni)
    try {
      await akisSirala(
        akis.id,
        yeni.map((a) => a.id),
      )
    } catch {
      setHata('Yeni sıra kaydedilemedi.')
      yukle()
    }
  }

  function tasi(kaynak: number, hedef: number) {
    if (hedef < 0 || hedef >= adimlar.length || kaynak === hedef) return
    const yeni = [...adimlar]
    const [a] = yeni.splice(kaynak, 1)
    yeni.splice(hedef, 0, a)
    sirala(yeni)
  }

  async function sil(a: Adim) {
    const { error } = await supabase.from('lesson_steps').delete().eq('id', a.id)
    if (error) setHata('Adım silinemedi.')
    setAdimlar((l) => l.filter((x) => x.id !== a.id))
  }

  if (akis === undefined) return <p className="text-sm text-slate-400">{hata ?? 'Yükleniyor…'}</p>
  if (akis === null)
    return (
      <p className="text-sm text-slate-400">
        Akış bulunamadı. <Link to="/panel" className="underline">Derslerime dön</Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/panel'))}
          className="text-xs text-slate-400 hover:text-white"
        >
          ← Geri
        </button>
        <input
          className="mt-3 w-full bg-transparent text-2xl font-extrabold outline-none border-b border-transparent focus:border-indigo-400"
          value={ad}
          maxLength={200}
          onChange={(e) => setAd(e.target.value)}
          onBlur={adiKaydet}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Akışın adı"
        />
        <p className="text-xs text-slate-500 mt-1">
          {adimlar.length} adım. Derste bu sırayla ilerlersin. Bu akış ders içeriğine aittir; içeriğe bağlı bütün
          dönemlerde aynı görünür.
        </p>
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <section className="cam-panel rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">Adım ekle</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <label className={`parlak-buton rounded-xl px-4 py-2 text-sm font-bold cursor-pointer ${yukleme ? 'opacity-60 pointer-events-none' : ''}`}>
            Sunum yükle (PDF)
            <input type="file" accept=".pdf,application/pdf,.ppt,.pptx" className="hidden" onChange={dosyaSecildi} />
          </label>
          <button className="ikincil-buton" onClick={yoklamaEkle} disabled={!!yukleme}>
            Yoklama adımı
          </button>
          {sunumlar.length > 0 && (
            <div className="flex gap-2 items-center">
              <select
                className="giris-kutusu !w-auto !py-2 text-sm"
                value={eklenecekSunum}
                onChange={(e) => setEklenecekSunum(e.target.value)}
              >
                <option value="">Kayıtlı sunumdan ekle…</option>
                {sunumlar.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad} ({s.sayfa_sayisi} sayfa)
                  </option>
                ))}
              </select>
              {eklenecekSunum && (
                <button className="ikincil-buton" onClick={kayitliSunumuEkle}>
                  Sayfalarını ekle
                </button>
              )}
            </div>
          )}
        </div>
        {sorular.length > 0 && !soruSecimi && (
          <button className="ikincil-buton" onClick={() => setSoruSecimi(new Set())} disabled={!!yukleme}>
            Soru ekle ({sorular.length} soru bankada)
          </button>
        )}
        {sorular.length === 0 && (
          <p className="text-xs text-slate-500">
            Bilgi yarışması sorusu eklemek için önce ders sayfasındaki "Ders akışları" sekmesinden soru bankasına soru aktar.
          </p>
        )}
        {soruSecimi && (
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <p className="text-sm font-semibold flex-1">Eklenecek soruları seç</p>
              <button className="ikincil-buton !py-1 text-xs" onClick={() => setSoruSecimi(new Set(sorular.map((q) => q.id)))}>
                Hepsini seç
              </button>
              <button className="ikincil-buton !py-1 text-xs" onClick={() => setSoruSecimi(null)}>
                Vazgeç
              </button>
            </div>
            <ul className="max-h-72 overflow-auto divide-y divide-white/5">
              {sorular.map((q) => (
                <li key={q.id}>
                  <label className="flex gap-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 mt-1"
                      checked={soruSecimi.has(q.id)}
                      onChange={(e) => {
                        const yeni = new Set(soruSecimi)
                        if (e.target.checked) yeni.add(q.id)
                        else yeni.delete(q.id)
                        setSoruSecimi(yeni)
                      }}
                    />
                    <span className="flex-1">
                      {q.soru}
                      {adimlar.some((a) => a.question_id === q.id) && <span className="text-xs text-slate-500"> (bu akışta var)</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              disabled={soruSecimi.size === 0}
              className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
              onClick={() => sorulariAkisaEkle(sorular.filter((q) => soruSecimi.has(q.id)).map((q) => q.id))}
            >
              Seçilen {soruSecimi.size} soruyu ekle
            </button>
          </div>
        )}
        {yukleme && <p className="text-sm text-indigo-300">{yukleme}</p>}
        <p className="text-xs text-slate-500">
          Sunumun her sayfası ayrı bir adım olur. Sırayı satırları sürükleyerek ya da oklarla değiştirebilirsin.
        </p>
      </section>

      {adimlar.length === 0 ? (
        <p className="text-sm text-slate-400">Akış boş. Bir sunum yükleyerek ya da yoklama adımı ekleyerek başla.</p>
      ) : (
        <ol className="space-y-2">
          {adimlar.map((a, i) => {
            const sunum = a.presentation_id ? sunumHaritasi.get(a.presentation_id) : undefined
            return (
              <li
                key={a.id}
                draggable
                onDragStart={() => setSuruklenen(i)}
                onDragEnd={() => setSuruklenen(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (suruklenen !== null) tasi(suruklenen, i)
                  setSuruklenen(null)
                }}
                className={`cam-panel rounded-2xl p-3 flex items-center gap-3 cursor-grab ${suruklenen === i ? 'opacity-40' : ''}`}
              >
                <span className="w-7 text-right font-mono text-xs text-slate-500">{i + 1}</span>
                {a.tur === 'slayt' ? (
                  <SlaytCizimi
                    belge={a.presentation_id ? belgeler.get(a.presentation_id) : undefined}
                    sayfaNo={a.sayfa_no ?? 1}
                    className="w-28 h-16 shrink-0 rounded bg-slate-900"
                  />
                ) : a.tur === 'soru' ? (
                  <div className="w-28 h-16 shrink-0 rounded bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-300 text-xs font-bold">
                    SORU
                  </div>
                ) : (
                  <div className="w-28 h-16 shrink-0 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-300 text-xs font-bold">
                    YOKLAMA
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {a.tur === 'slayt' ? (
                    <>
                      <p className="text-sm font-semibold truncate">{ilkSatir(sunum?.metinler[(a.sayfa_no ?? 1) - 1]) || `Slayt ${a.sayfa_no}`}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {sunum?.ad} · sayfa {a.sayfa_no}
                      </p>
                    </>
                  ) : a.tur === 'soru' ? (
                    <>
                      <p className="text-sm font-semibold truncate">{soruHaritasi.get(a.question_id ?? '')?.soru ?? 'Soru'}</p>
                      <p className="text-xs text-slate-400 truncate">
                        Bilgi yarışması · {soruHaritasi.get(a.question_id ?? '')?.sure_sn ?? 20} saniye
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Yoklama</p>
                      <p className="text-xs text-slate-400">Perdede QR kod ve katılım sayacı</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className="ikincil-buton !px-2 !py-1" onClick={() => tasi(i, i - 1)} disabled={i === 0} aria-label="Yukarı taşı">
                    ↑
                  </button>
                  <button
                    className="ikincil-buton !px-2 !py-1"
                    onClick={() => tasi(i, i + 1)}
                    disabled={i === adimlar.length - 1}
                    aria-label="Aşağı taşı"
                  >
                    ↓
                  </button>
                  <button className="tehlike-buton !px-2 !py-1" onClick={() => sil(a)} aria-label="Adımı sil">
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
