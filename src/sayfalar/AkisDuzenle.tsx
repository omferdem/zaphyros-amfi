import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Adim, AdimAyari, Akis, Soru, Sunum } from '../lib/tipler'
import { videoAdresi } from '../lib/video'
import { adimlarEkle, adimlariGetir, akisGetir, akisSirala, sorulariAkisaYerlestir, sorulariGetir, sunumYukle, sunumlariGetir } from '../lib/akis'
import { adimSirasi, konumuCoz } from '../lib/paket'
import SoruPaketiEkle from '../bilesenler/SoruPaketiEkle'
import SunumSurukle from '../bilesenler/SunumSurukle'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { SlaytCizimi, usePdfBelgeleri } from '../bilesenler/Slayt'
import SlaytOnizleme from '../bilesenler/SlaytOnizleme'

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
  const [konum, setKonum] = useState('son')
  const [bilgi, setBilgi] = useState<string | null>(null)
  const soruPaneli = useRef<HTMLDivElement>(null)
  const [etkinlikTuru, setEtkinlikTuru] = useState<'bulut' | 'firtina' | 'acik' | 'oylama' | 'video' | 'oyun'>('bulut')
  const [oyunSecimi, setOyunSecimi] = useState<OyunAnahtari>('takim')
  const [etkinlikSorusu, setEtkinlikSorusu] = useState('')
  const [etiketSol, setEtiketSol] = useState('')
  const [etiketSag, setEtiketSag] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoBaslik, setVideoBaslik] = useState('')

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
  const [onizleme, setOnizleme] = useState<number | null>(null)

  /** Slayt notunu adımın ayarına yazar (öğrenciye ve perdeye gitmez). */
  async function notKaydet(adimId: string, metin: string) {
    const a = adimlar.find((x) => x.id === adimId)
    if (!a) return
    const ayar = { ...a.ayar }
    if (metin) ayar.not = metin
    else delete ayar.not
    const { error } = await supabase.from('lesson_steps').update({ ayar }).eq('id', adimId)
    if (error) throw error
    setAdimlar((l) => l.map((x) => (x.id === adimId ? { ...x, ayar } : x)))
  }

  async function adiKaydet() {
    if (!akis || !ad.trim() || ad.trim() === akis.ad) return
    const { error } = await supabase.from('lessons').update({ ad: ad.trim().slice(0, 200) }).eq('id', akis.id)
    if (error) setHata('Ad kaydedilemedi.')
    else setAkis({ ...akis, ad: ad.trim() })
  }

  /** Bırakılan ya da seçilen PDF'leri sırayla yükler ve slaytlarını akışın sonuna ekler. */
  async function dosyalarSecildi(liste: File[]) {
    if (!akis) return
    setHata(null)
    setBilgi(null)
    const pdfler = liste.filter((d) => /\.pdf$/i.test(d.name))
    if (pdfler.length < liste.length) {
      setHata("Şimdilik yalnızca PDF yüklenebiliyor. PowerPoint dosyası için PowerPoint'te Dosya > Farklı Kaydet > PDF ile kaydedip onu yükle.")
      if (pdfler.length === 0) return
    }
    let eklenen = 0
    // Adım sırası birbirini ezmesin diye dosyalar ada göre sıralanıp sırayla işlenir
    const sirali = [...pdfler].sort((x, y) => x.name.localeCompare(y.name, 'tr', { numeric: true }))
    for (const [i, dosya] of sirali.entries()) {
      if (dosya.size > 50 * 1024 * 1024) {
        setHata(`"${dosya.name}" 50 MB'tan büyük. PowerPoint'te PDF olarak kaydederken "En küçük boyut" seçeneğini dene.`)
        continue
      }
      try {
        const sunum = await sunumYukle(akis.subject_id, dosya, dosyadanAd(dosya.name), (m) => setYukleme(`(${i + 1}/${sirali.length}) ${m}`))
        setYukleme('Slaytlar akışa ekleniyor…')
        await adimlarEkle(
          akis.id,
          0,
          Array.from({ length: sunum.sayfa_sayisi }, (_, k) => ({ tur: 'slayt' as const, presentation_id: sunum.id, sayfa_no: k + 1 })),
        )
        eklenen++
      } catch {
        setHata(`"${dosya.name}" yüklenemedi. Dosyanın bozuk olmadığından ve internet bağlantından emin ol.`)
      }
    }
    if (eklenen > 0) setBilgi(`${eklenen} sunum yüklendi ve slaytları akışa eklendi.`)
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
    setHata(null)
    setBilgi(null)
    try {
      await sorulariAkisaYerlestir(akis.id, adimlar, idler, konumuCoz(konum))
      setBilgi(`${idler.length} soru akışa eklendi.`)
    } catch {
      setHata('Sorular eklenemedi.')
    }
    setSoruSecimi(null)
    await yukle()
  }

  /** Adım satırındaki "+ Soru" düğmesi: ekleme konumunu o adımın arkasına alıp paneli gösterir. */
  function buraya(adimId: string) {
    setKonum(`sonra:${adimId}`)
    setBilgi('Ekleme konumu bu adımın arkası olarak seçildi. Aşağıdan bir soru paketi ya da etkinlik (açık uçlu soru, kelime bulutu, oyun…) ekleyebilirsin.')
    soruPaneli.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  /** Konum seçiminde ve listede adımı tanıtan kısa etiket: "5. Kötülük problemi". */
  function adimEtiketi(a: Adim, i: number): string {
    const ad =
      a.tur === 'slayt'
        ? ilkSatir(sunumHaritasi.get(a.presentation_id ?? '')?.metinler[(a.sayfa_no ?? 1) - 1]) || `Slayt ${a.sayfa_no}`
        : a.tur === 'soru'
          ? `Soru: ${soruHaritasi.get(a.question_id ?? '')?.soru ?? ''}`
          : a.tur === 'yoklama'
            ? 'Yoklama'
            : a.tur === 'oyun'
              ? `Oyun: ${OYUNLAR[(a.ayar.oyun ?? 'takim') as OyunAnahtari]?.ad ?? 'Oyun'}`
              : a.ayar.soru || a.ayar.baslik || (a.tur === 'video' ? 'Video' : 'Etkinlik')
    const metin = `${i + 1}. ${ad.replace(/\s+/g, ' ')}`
    return metin.length > 64 ? `${metin.slice(0, 63)}…` : metin
  }

  async function etkinlikEkle(e: React.FormEvent) {
    e.preventDefault()
    if (!akis) return
    setHata(null)
    let ayar: AdimAyari
    if (etkinlikTuru === 'oyun') {
      ayar = { oyun: oyunSecimi }
    } else if (etkinlikTuru === 'video') {
      const url = videoAdresi(videoUrl)
      if (!url) {
        setHata('Video adresi https:// ile başlamalı (örneğin YouTube bağlantısı).')
        return
      }
      ayar = { url, ...(videoBaslik.trim() ? { baslik: videoBaslik.trim().slice(0, 120) } : {}) }
    } else {
      const soru = etkinlikSorusu.trim().slice(0, 300)
      if (!soru) {
        setHata(etkinlikTuru === 'oylama' ? 'Oylanacak önermeyi yaz.' : 'Soruyu yaz.')
        return
      }
      ayar = { soru }
      if (etkinlikTuru === 'firtina' || etkinlikTuru === 'acik') ayar.mod = etkinlikTuru
      if (etkinlikTuru === 'oylama' && (etiketSol.trim() || etiketSag.trim())) {
        ayar.etiketler = [etiketSol.trim().slice(0, 40) || 'Katılıyorum', etiketSag.trim().slice(0, 40) || 'Katılmıyorum']
      }
    }
    try {
      const yeniIdler = await adimlarEkle(akis.id, adimlar.length, [{ tur: etkinlikTuru === 'bulut' || etkinlikTuru === 'firtina' || etkinlikTuru === 'acik' ? 'fikir' : etkinlikTuru, ayar }])
      // Ekleme konumu seçilmişse ("+ Ekle" ya da konum kutusu) etkinlik oraya yerleşir
      if (konum !== 'son' && yeniIdler.length) await akisSirala(akis.id, adimSirasi(adimlar.map((a) => a.id), yeniIdler, konumuCoz(konum)))
      setEtkinlikSorusu('')
      setVideoUrl('')
      setVideoBaslik('')
    } catch {
      setHata('Etkinlik eklenemedi.')
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

  /** Akıştaki bir sorunun cevap süresi: soru bankasındaki kaydı günceller (soruyu kullanan bütün akışlarda geçerli olur). */
  async function soruSuresiniDegistir(soruId: string, sn: number) {
    if (!soruId) return
    setSorular((l) => l.map((q) => (q.id === soruId ? { ...q, sure_sn: sn } : q)))
    const { error } = await supabase.from('questions').update({ sure_sn: sn }).eq('id', soruId)
    if (error) setHata('Süre kaydedilemedi.')
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
        <Link to={`/panel/akis/${akisId}/onizle`} className="ml-3 text-xs rounded-lg px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-100 font-bold" title="Dersi başlatmadan perde ve öğrenci telefonu görünümüyle dene">
          👁 Önizle (hoca ve öğrenci)
        </Link>
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
        <SunumSurukle dosyalar={dosyalarSecildi} mesgul={!!yukleme} durum={yukleme} />
        <div className="flex flex-wrap gap-2 items-center">
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
        <div ref={soruPaneli}>
          <SoruPaketiEkle
            akisAdi={akis.ad}
            icerikId={akis.subject_id}
            sorular={sorular}
            adimEtiketleri={adimlar.map((a, i) => ({ id: a.id, etiket: adimEtiketi(a, i) }))}
            konum={konum}
            setKonum={setKonum}
            ekle={sorulariAkisaEkle}
            disabled={!!yukleme}
          />
        </div>
        {bilgi && <p className="text-sm text-emerald-300">{bilgi}</p>}
        {sorular.length > 0 && !soruSecimi && (
          <button className="ikincil-buton" onClick={() => setSoruSecimi(new Set())} disabled={!!yukleme}>
            Soruları tek tek seç ({sorular.length} soru bankada)
          </button>
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
        <form onSubmit={etkinlikEkle} className="rounded-xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Etkinlik ekle</p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3" role="radiogroup" aria-label="Etkinlik türü">
              {(
                [
                  ['acik', '✍️', 'Açık uçlu soru', 'Öğrenciler telefondan cevap yazar, bütün cevaplar perdede kartlarla görünür'],
                  ['bulut', '☁️', 'Kelime bulutu', 'Tek kelimelik cevaplar; çok yazılan büyür'],
                  ['firtina', '💡', 'Beyin fırtınası', 'Kısa cümlelik fikirler (en çok 3), perdede kartlar'],
                  ['oylama', '😈', 'Şeytanın avukatı', 'İki taraflı oylama; isteyen gerekçe yazar'],
                  ['video', '🎬', 'Video', 'Perdede ve telefonda oynatılır'],
                  ['oyun', '🎮', 'Oyun', 'Zombi kaçışı, takım yarışı, halat çekme, hocayla yarış, bilgi merdiveni'],
                ] as const
              ).map(([k, emoji, ad, aciklama]) => (
                <button
                  type="button"
                  key={k}
                  role="radio"
                  aria-checked={etkinlikTuru === k}
                  onClick={() => setEtkinlikTuru(k)}
                  title={aciklama}
                  className={`text-left rounded-xl border p-3 transition ${etkinlikTuru === k ? 'border-indigo-300 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <span className="text-xl mr-1.5">{emoji}</span>
                  <b className="text-sm">{ad}</b>
                  <span className="block text-xs text-slate-400 mt-0.5">{aciklama}</span>
                </button>
              ))}
            </div>
          </div>
          {etkinlikTuru === 'oyun' ? (
            <div className="space-y-2">
              <select className="giris-kutusu text-sm" value={oyunSecimi} onChange={(e) => setOyunSecimi(e.target.value as OyunAnahtari)} aria-label="Oyun">
                {(Object.keys(OYUNLAR) as OyunAnahtari[]).map((k) => (
                  <option key={k} value={k}>
                    {OYUNLAR[k].emoji} {OYUNLAR[k].ad}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">{OYUNLAR[oyunSecimi].nasil}</p>
            </div>
          ) : etkinlikTuru === 'video' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="giris-kutusu text-sm"
                placeholder="Video adresi (https://...)"
                value={videoUrl}
                maxLength={255}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <input
                className="giris-kutusu text-sm"
                placeholder="Başlık (isteğe bağlı)"
                value={videoBaslik}
                maxLength={120}
                onChange={(e) => setVideoBaslik(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="giris-kutusu text-sm"
                placeholder={
                  etkinlikTuru === 'oylama'
                    ? 'Önerme: Tanrı kötülüğü engellemeye mecburdur.'
                    : etkinlikTuru === 'acik'
                      ? 'Soru: Sence Tanrı kötülüğe neden izin veriyor? Gerekçeni yaz.'
                      : 'Soru: Kötülük problemi deyince aklına ne geliyor?'
                }
                value={etkinlikSorusu}
                maxLength={300}
                onChange={(e) => setEtkinlikSorusu(e.target.value)}
              />
              {etkinlikTuru === 'oylama' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="giris-kutusu text-sm" placeholder="Sol seçenek (Katılıyorum)" value={etiketSol} maxLength={40} onChange={(e) => setEtiketSol(e.target.value)} />
                  <input className="giris-kutusu text-sm" placeholder="Sağ seçenek (Katılmıyorum)" value={etiketSag} maxLength={40} onChange={(e) => setEtiketSag(e.target.value)} />
                </div>
              )}
            </div>
          )}
          <button className="ikincil-buton" disabled={!!yukleme}>
            Akışa ekle
          </button>
        </form>
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
                  <button
                    type="button"
                    className="relative shrink-0 rounded focus:outline-2 focus:outline-indigo-300 cursor-zoom-in"
                    onClick={() => setOnizleme(i)}
                    title="Büyük önizleme ve not"
                    aria-label="Slaytı büyüt"
                  >
                    <SlaytCizimi
                      belge={a.presentation_id ? belgeler.get(a.presentation_id) : undefined}
                      sayfaNo={a.sayfa_no ?? 1}
                      className="w-28 h-16 rounded bg-slate-900"
                    />
                    {a.ayar.not && <span className="absolute -top-1 -right-1 text-xs" title="Notu var">📝</span>}
                  </button>
                ) : a.tur === 'soru' ? (
                  <div className="w-28 h-16 shrink-0 rounded bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-300 text-xs font-bold">
                    SORU
                  </div>
                ) : a.tur === 'fikir' || a.tur === 'oylama' || a.tur === 'video' ? (
                  <div className="w-28 h-16 shrink-0 rounded bg-amber-500/10 flex items-center justify-center text-amber-300 text-xs font-bold text-center leading-tight">
                    {a.tur === 'fikir' ? (a.ayar.mod === 'acik' ? 'AÇIK UÇLU' : a.ayar.mod === 'firtina' ? 'BEYİN FIRTINASI' : 'KELİME BULUTU') : a.tur === 'oylama' ? 'OYLAMA' : 'VİDEO'}
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
                      <p className="text-xs text-slate-400 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                        Bilgi yarışması ·
                        <select
                          aria-label="Cevap süresi"
                          className="giris-kutusu !w-auto !py-0.5 !px-1.5 text-xs"
                          value={soruHaritasi.get(a.question_id ?? '')?.sure_sn ?? 20}
                          onChange={(e) => soruSuresiniDegistir(a.question_id ?? '', Number(e.target.value))}
                        >
                          {[...new Set([10, 15, 20, 30, 45, 60, 90, 120, soruHaritasi.get(a.question_id ?? '')?.sure_sn ?? 20])].sort((x, y) => x - y).map((x) => (
                            <option key={x} value={x}>
                              {x} sn
                            </option>
                          ))}
                        </select>
                      </p>
                    </>
                  ) : a.tur === 'fikir' || a.tur === 'oylama' ? (
                    <>
                      <p className="text-sm font-semibold truncate">{a.ayar.soru}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {a.tur === 'fikir'
                          ? a.ayar.mod === 'acik'
                            ? 'Açık uçlu soru · cevaplar perdede kart olarak'
                            : a.ayar.mod === 'firtina'
                              ? 'Beyin fırtınası · fikirler perdede kart olarak'
                              : 'Kelime bulutu · perdede bulut'
                          : `Şeytanın avukatı · ${(a.ayar.etiketler ?? ['Katılıyorum', 'Katılmıyorum']).join(' / ')}`}
                      </p>
                    </>
                  ) : a.tur === 'video' ? (
                    <>
                      <p className="text-sm font-semibold truncate">{a.ayar.baslik || 'Video'}</p>
                      <p className="text-xs text-slate-400 truncate">{a.ayar.url}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Yoklama</p>
                      <p className="text-xs text-slate-400">Perdede QR kod ve katılım sayacı</p>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className="ikincil-buton !px-2 !py-1" onClick={() => buraya(a.id)} title="Bu adımın arkasına soru paketi ya da etkinlik ekle">
                    + Ekle
                  </button>
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
      {onizleme !== null && (
        <SlaytOnizleme adimlar={adimlar} baslangic={onizleme} belgeler={belgeler} sunumlar={sunumHaritasi} notKaydet={notKaydet} kapat={() => setOnizleme(null)} />
      )}
    </div>
  )
}
