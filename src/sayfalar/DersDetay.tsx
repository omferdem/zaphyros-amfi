import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Akis, Ders, Ogrenci, Oturum, Yoklama } from '../lib/tipler'
import { DERSI_BITIR_SORUSU, dersGetir, dersYoklamalari, misafirKatilimlari, ogrencileriGetir, oturumBaslat, oturumlariGetir, oturumuBitir } from '../lib/veri'
import { dosyadanAyristir, metindenAyristir, type AyristirmaSonucu } from '../lib/sinifListesi'
import { misafirYoklamalari, raporHesapla, raporuExceleAktar } from '../lib/rapor'
import { oturumAdi, tarihSaat } from '../lib/bicim'
import { akislariGetir, icerikSil } from '../lib/akis'
import { dersiDuzenle, subeEtiketi, subeleriAc, subeleriGetir, type DersSatiri } from '../lib/plan'
import { icerigiDisaAktar } from '../lib/icerikAktar'
import { subeleriYedekle, yedegiIndir } from '../lib/subeYedegi'
import DersAkislari from './DersAkislari'
import YoklamaHaftalari from './YoklamaHaftalari'
import Gelisim from './Gelisim'
import QuizSekmesi from './QuizSekmesi'
import DonemOzeti from './DonemOzeti'

type Sekme = 'oturumlar' | 'akislar' | 'liste' | 'rapor' | 'quiz' | 'gelisim' | 'ozet'

export default function DersDetay() {
  const { dersId = '' } = useParams()
  const navigate = useNavigate()
  const [ders, setDers] = useState<Ders | null | undefined>(undefined)
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [oturumlar, setOturumlar] = useState<Oturum[]>([])
  const [yoklamalar, setYoklamalar] = useState<Yoklama[]>([])
  const [sekme, setSekme] = useState<Sekme>('oturumlar')
  const [hata, setHata] = useState<string | null>(null)
  const ilkYukleme = useRef(true)
  const [parametreler] = useSearchParams()
  // Hafta planından gelindiyse (?akis=) seçili akışla oturum başlatma formu açılır.
  const baslangicAkis = useRef(parametreler.get('akis'))

  const yukle = useCallback(async () => {
    try {
      const [d, og, ot] = await Promise.all([dersGetir(dersId), ogrencileriGetir(dersId), oturumlariGetir(dersId)])
      // Listesi boş derste ilk iş liste yüklemek olduğu için o sekmeyle açılır.
      if (ilkYukleme.current && og.length === 0 && !baslangicAkis.current) setSekme('liste')
      ilkYukleme.current = false
      setDers(d)
      setOgrenciler(og)
      setOturumlar(ot)
      const [gercek, misafir] = await Promise.all([dersYoklamalari(ot.map((o) => o.id)), misafirKatilimlari(og)])
      // Başka şubede misafir olarak derse giren öğrenci, kendi şubesinin aynı hafta oturumunda var sayılır.
      setYoklamalar([...gercek, ...misafirYoklamalari(ot, misafir)])
    } catch {
      setHata('Ders bilgileri yüklenemedi.')
    }
  }, [dersId])

  useEffect(() => {
    yukle()
  }, [yukle])

  /** Bu şubenin yedeğini dosya olarak indirir (sınıf listesi, oturumlar, yoklamalar). */
  async function subeyiYedekle() {
    if (!ders) return
    setHata(null)
    try {
      yedegiIndir(await subeleriYedekle([ders.id]), [ders.ad, ders.sube].filter(Boolean).join(' '))
    } catch {
      setHata('Yedek alınamadı. Bağlantını kontrol edip tekrar dene.')
    }
  }

  async function dersiSil() {
    if (!ders) return
    if (
      !window.confirm(
        `"${[ders.ad, ders.donem].filter(Boolean).join(', ')}" sınıf listesi ve bütün yoklama kayıtlarıyla birlikte silinecek. Ders içeriği (akışlar ve sunumlar) silinmez, başka dönemlerde kullanılmaya devam eder.\n\nSilmeden önce bir yedek dosyası (.amfi-yedek) indirilecek; Panel > "Şube yedeğini geri yükle" ile geri alabilirsin. Devam edilsin mi?`,
      )
    )
      return
    try {
      yedegiIndir(await subeleriYedekle([ders.id]), [ders.ad, ders.sube].filter(Boolean).join(' '))
    } catch {
      setHata('Yedek alınamadığı için şube silinmedi. Bağlantını kontrol edip tekrar dene.')
      return
    }
    const { error } = await supabase.from('courses').delete().eq('id', ders.id)
    if (error) setHata('Şube silinemedi.')
    else navigate('/panel')
  }

  /** Dersin bütün şubelerini, bütün dönemlerdeki listelerini ve içeriğini (akış, sunum, soru) siler. */
  async function dersiTamamenSil() {
    if (!ders) return
    const { data: subeler } = await supabase.from('courses').select('id').eq('subject_id', ders.subject_id)
    const sayi = subeler?.length ?? 1
    const yazilan = window.prompt(
      `"${ders.ad}" dersi TAMAMEN silinecek: ${sayi} şube (bütün dönemler), bütün sınıf listeleri, yoklamalar, quizler ve ders içeriği (akışlar, sunumlar, soru bankası). Bu geri alınamaz.\n\nOnaylamak için dersin adını aynen yaz:`,
    )
    if (yazilan === null) return
    if (yazilan.trim() !== ders.ad.trim()) {
      setHata('Yazdığın ad dersin adıyla aynı değil; hiçbir şey silinmedi.')
      return
    }
    try {
      // Silmeden önce geri alınabilsin diye şubelerin yedeği ve içerik paketi indirilir
      const kimlikler = ((subeler ?? []) as { id: string }[]).map((s) => s.id)
      yedegiIndir(await subeleriYedekle(kimlikler), ders.ad)
      await icerigiDisaAktar(ders.subject_id, ders.ad, () => {})
    } catch {
      setHata('Yedek alınamadığı için ders silinmedi. Bağlantını kontrol edip tekrar dene.')
      return
    }
    try {
      const { error } = await supabase.from('courses').delete().eq('subject_id', ders.subject_id)
      if (error) throw error
      await icerikSil(ders.subject_id)
      navigate('/panel')
    } catch {
      setHata('Ders tamamen silinemedi. Bir kısmı silinmiş olabilir; Derslerim sayfasından kontrol et.')
    }
  }

  if (ders === undefined) return <p className="text-sm text-slate-400">{hata ?? 'Yükleniyor…'}</p>
  if (ders === null)
    return (
      <p className="text-sm text-slate-400">
        Ders bulunamadı. <Link to="/panel" className="underline">Derslerime dön</Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to="/panel" className="text-xs text-slate-400 hover:text-white">
          ← Derslerim
        </Link>
        <p className="text-xs font-mono text-indigo-300 mt-3">{[ders.kod, ders.donem].filter(Boolean).join(' · ')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">
            {ders.ad}
            {ders.sube?.trim() && <span className="text-indigo-300"> · {ders.sube.trim()}</span>}
          </h1>
          <Link to={`/panel/ders/${ders.id}/duzenle`} className="ikincil-buton !py-1.5" title="Akışlar, sunumlar, soru paketleri ve quizler">
            ✏️ Düzenle
          </Link>
        </div>
        <SubeAraci ders={ders} ogrenciSayisi={ogrenciler.length} yenile={yukle} hataVer={setHata} />
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <nav className="flex gap-1 border-b border-white/10">
        {(
          [
            ['oturumlar', `Oturumlar (${oturumlar.length})`],
            ['liste', `Sınıf listesi (${ogrenciler.length})`],
            ['rapor', 'Yoklama raporu'],
            ['quiz', '📝 Quiz'],
            ['gelisim', '📈 Gelişim'],
            ['ozet', '📊 Dönem özeti'],
          ] as [Sekme, string][]
        ).map(([k, ad]) => (
          <button
            key={k}
            onClick={() => setSekme(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              sekme === k ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {ad}
          </button>
        ))}
      </nav>

      {sekme === 'oturumlar' && (
        <Oturumlar
          ders={ders}
          ogrenciler={ogrenciler}
          oturumlar={oturumlar}
          yoklamalar={yoklamalar}
          yenile={yukle}
          baslangicAkis={baslangicAkis.current}
        />
      )}
      {sekme === 'akislar' && <DersAkislari ders={ders} />}
      {sekme === 'liste' && <SinifListesi ders={ders} ogrenciler={ogrenciler} yenile={yukle} />}
      {sekme === 'rapor' && <Rapor ders={ders} ogrenciler={ogrenciler} oturumlar={oturumlar} yoklamalar={yoklamalar} yenile={yukle} />}
      {sekme === 'quiz' && <QuizSekmesi ders={ders} ogrenciler={ogrenciler} />}
      {sekme === 'ozet' && <DonemOzeti ders={ders} ogrenciler={ogrenciler} oturumlar={oturumlar} yoklamalar={yoklamalar} />}
      {sekme === 'gelisim' &&<Gelisim ders={ders} ogrenciler={ogrenciler} oturumlar={oturumlar} />}

      <div className="pt-6 border-t border-white/5 flex flex-wrap gap-3 items-center">
        <button className="ikincil-buton" onClick={subeyiYedekle} title="Sınıf listesi, oturumlar ve yoklamalar tek dosyaya indirilir">
          💾 Şubeyi yedekle
        </button>
        <button className="tehlike-buton" onClick={dersiSil}>
          Bu şubeyi sil
        </button>
        <button className="tehlike-buton" onClick={dersiTamamenSil}>
          Dersi tamamen sil
        </button>
        <p className="text-xs text-slate-500 basis-full">
          "Bu şubeyi sil" yalnızca bu şubenin listesini ve yoklamasını siler; içerik kalır. "Dersi tamamen sil" bütün şubeleri ve içeriği kaldırır.
          İkisinde de silmeden önce yedek dosyası kendiliğinden iner; geri almak için Panel'deki "📥 Şube yedeğini geri yükle" ve dersin "İçeriği paylaş" bölümündeki "İçe aktar" düğmesini kullan.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Oturumlar(props: {
  ders: Ders
  ogrenciler: Ogrenci[]
  oturumlar: Oturum[]
  yoklamalar: Yoklama[]
  yenile: () => Promise<void>
  baslangicAkis?: string | null
}) {
  const { ders, ogrenciler, oturumlar, yoklamalar, yenile, baslangicAkis } = props
  const navigate = useNavigate()
  const [baslik, setBaslik] = useState('')
  const [akislar, setAkislar] = useState<Akis[]>([])
  const [akisId, setAkisId] = useState(baslangicAkis ?? '')
  const [yoklamaAl, setYoklamaAl] = useState(true)
  const [telefonModu, setTelefonModu] = useState(false)
  const [gorselsiz, setGorselsiz] = useState<string[]>([])
  const [basliyor, setBasliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const sayilar = useMemo(() => {
    const m = new Map<string, number>()
    for (const y of yoklamalar) m.set(y.session_id, (m.get(y.session_id) ?? 0) + 1)
    return m
  }, [yoklamalar])

  useEffect(() => {
    akislariGetir(ders.subject_id)
      .then(setAkislar)
      .catch(() => setAkislar([]))
  }, [ders.subject_id])

  // Telefon modunda görseli hazır olmayan sunum varsa öğrenci yalnızca metni görür; başlamadan uyarılır.
  useEffect(() => {
    if (!telefonModu || !akisId) {
      setGorselsiz([])
      return
    }
    supabase
      .from('lesson_steps')
      .select('presentations(ad, gorseller_hazir)')
      .eq('lesson_id', akisId)
      .not('presentation_id', 'is', null)
      .then(({ data }) => {
        const adlar = new Set<string>()
        for (const r of (data ?? []) as unknown as { presentations: { ad: string; gorseller_hazir: boolean } | null }[]) {
          if (r.presentations && !r.presentations.gorseller_hazir) adlar.add(r.presentations.ad)
        }
        setGorselsiz([...adlar])
      })
  }, [telefonModu, akisId])

  async function baslat(e: React.FormEvent) {
    e.preventDefault()
    setBasliyor(true)
    setHata(null)
    try {
      const id = await oturumBaslat(ders.id, baslik || akislar.find((a) => a.id === akisId)?.ad || '', akisId || null, yoklamaAl, telefonModu)
      navigate(telefonModu ? `/kumanda?s=${id}` : `/sahne/${id}`)
    } catch {
      setHata('Oturum başlatılamadı.')
      setBasliyor(false)
    }
  }

  async function bitir(o: Oturum) {
    if (!window.confirm(DERSI_BITIR_SORUSU)) return
    try {
      await oturumuBitir(o.id)
    } catch {
      setHata('Ders bitirilemedi.')
    }
    yenile()
  }

  async function sil(o: Oturum) {
    if (!window.confirm(`"${oturumAdi(o)}" oturumu ve yoklama kayıtları silinecek. Emin misin?`)) return
    const { error } = await supabase.from('sessions').delete().eq('id', o.id)
    if (error) setHata('Oturum silinemedi.')
    yenile()
  }

  return (
    <div className="space-y-5">
      <YoklamaHaftalari ders={ders} ogrenciler={ogrenciler} oturumlar={oturumlar} yoklamalar={yoklamalar} yenile={yenile} />

      <form onSubmit={baslat} className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Ek ders başlat (yoklama haftasından bağımsız)</h2>
        {ogrenciler.length === 0 && yoklamaAl && (
          <p className="text-sm text-amber-300">
            Yoklama için önce sınıf listesini yükle; listede olmayan numaralar yoklamaya giremez. Yoklamasız başlatmak için
            aşağıdaki kutuyu kaldır.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="giris-kutusu sm:!w-64" value={akisId} onChange={(e) => setAkisId(e.target.value)}>
            <option value="">Akış yok</option>
            {akislar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ad}
              </option>
            ))}
          </select>
          <input
            maxLength={200}
            className="giris-kutusu"
            placeholder={`Başlık (isteğe bağlı, ör. ${oturumlar.length + 1}. hafta)`}
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
          />
          <button
            disabled={basliyor || (yoklamaAl && ogrenciler.length === 0)}
            className="parlak-buton rounded-xl px-5 py-2.5 font-bold whitespace-nowrap disabled:opacity-50"
          >
            {telefonModu ? 'Başlat ve kumandayı aç' : 'Başlat ve sahneyi aç'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 w-fit cursor-pointer">
          <input type="checkbox" checked={yoklamaAl} onChange={(e) => setYoklamaAl(e.target.checked)} className="accent-indigo-500" />
          Yoklama al (kapalıysa QR çıkmaz; gerekirse dersin içinde açabilirsin)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 w-fit cursor-pointer">
          <input type="checkbox" checked={telefonModu} onChange={(e) => setTelefonModu(e.target.checked)} className="accent-indigo-500" />
          Projeksiyon yok: telefondan yöneteceğim, slaytlar öğrencilerin telefonunda görünsün
        </label>
        {telefonModu && (
          <p className="text-xs text-slate-500">
            Ders telefondaki kumandada açılır. Öğrenciler sitenin adresine girip kumandada görünen 6 haneli kodu yazar.
            {yoklamaAl && ' Yoklama da bu kodla alınır.'}
          </p>
        )}
        {gorselsiz.length > 0 && (
          <p className="text-sm text-amber-300">
            Şu sunumların telefon görselleri hazır değil, öğrenciler yalnızca metni görür: {gorselsiz.join(', ')}. "Ders
            akışları" sekmesindeki sunum kitaplığından hazırlayabilirsin.
          </p>
        )}
        <p className="text-xs text-slate-500">
          Sahne ekranını projeksiyona yansıt. Akış seçersen perdede akışın ilk adımı açılır; ilerlemek için klavyenin ok
          tuşlarını ya da telefonundaki kumandayı kullan.
        </p>
        {hata && <p className="text-sm text-rose-300">{hata}</p>}
      </form>

      {oturumlar.length === 0 ? (
        <p className="text-sm text-slate-400">Bu derste henüz oturum yok.</p>
      ) : (
        <ul className="space-y-2">
          {oturumlar.map((o) => (
            <li key={o.id} className="cam-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{oturumAdi(o)}</p>
                <p className="text-xs text-slate-400">{tarihSaat(o.basladi)}</p>
              </div>
              <span className="text-sm">
                <b>{sayilar.get(o.id) ?? 0}</b>
                <span className="text-slate-400"> / {ogrenciler.length}</span>
              </span>
              {!o.bitti && (
                <span className="nabiz text-[11px] font-bold text-rose-200 bg-rose-500/20 rounded-full px-2.5 py-0.5">● canlı</span>
              )}
              {o.yoklama_acik && !o.bitti && (
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 rounded-full px-2 py-0.5">
                  yoklama açık
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                {!o.bitti && (
                  <button className="tehlike-buton" onClick={() => bitir(o)}>
                    ⏹ Dersi bitir
                  </button>
                )}
                <Link to={`/sahne/${o.id}`} className="ikincil-buton">
                  Sahne
                </Link>
                <Link to={`/kumanda?s=${o.id}`} className="ikincil-buton">
                  Kumanda
                </Link>
                <Link to={`/panel/oturum/${o.id}`} className="ikincil-buton">
                  Yoklama listesi
                </Link>
                <button className="tehlike-buton" onClick={() => sil(o)}>
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function SinifListesi({ ders, ogrenciler, yenile }: { ders: Ders; ogrenciler: Ogrenci[]; yenile: () => Promise<void> }) {
  const [onizleme, setOnizleme] = useState<AyristirmaSonucu | null>(null)
  const [yapistir, setYapistir] = useState('')
  const [arama, setArama] = useState('')
  const [tek, setTek] = useState({ no: '', ad: '' })
  const [mesaj, setMesaj] = useState<{ tur: 'iyi' | 'kotu'; metin: string } | null>(null)
  const [mesgul, setMesgul] = useState(false)

  const mevcut = useMemo(() => new Set(ogrenciler.map((o) => o.ogrenci_no)), [ogrenciler])

  // Toplu silme: seçili öğrenciler
  const [secili, setSecili] = useState<Set<string>>(new Set())
  useEffect(() => setSecili(new Set()), [ders.id])

  // Misafir öğrenci: başka şubede kayıtlı, bu şubede derse giren
  const [kardesler, setKardesler] = useState<DersSatiri[]>([])
  const [asilSube, setAsilSube] = useState('')
  const [asilListe, setAsilListe] = useState<Ogrenci[]>([])
  const [asilOgrenci, setAsilOgrenci] = useState('')
  const [asilAdlari, setAsilAdlari] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    subeleriGetir(ders.term_id, ders.subject_id)
      .then((s) => setKardesler(s.filter((k) => k.id !== ders.id)))
      .catch(() => setKardesler([]))
  }, [ders.term_id, ders.subject_id, ders.id])

  useEffect(() => {
    setAsilOgrenci('')
    if (!asilSube) return setAsilListe([])
    ogrencileriGetir(asilSube)
      .then((l) => setAsilListe(l.filter((o) => !o.asil_id)))
      .catch(() => setAsilListe([]))
  }, [asilSube])

  // Misafir satırların asıl şubesinin adı
  const asilKimlikleri = useMemo(() => ogrenciler.filter((o) => o.asil_id).map((o) => o.asil_id as string), [ogrenciler])
  useEffect(() => {
    if (asilKimlikleri.length === 0) return setAsilAdlari(new Map())
    supabase
      .from('students')
      .select('id, courses(sube)')
      .in('id', asilKimlikleri)
      .then(({ data }) => {
        const m = new Map<string, string>()
        for (const r of (data ?? []) as unknown as { id: string; courses: { sube: string | null } | null }[]) m.set(r.id, r.courses?.sube?.trim() || 'başka şube')
        setAsilAdlari(m)
      })
  }, [asilKimlikleri])

  async function misafirEkle(e: React.FormEvent) {
    e.preventDefault()
    const asil = asilListe.find((o) => o.id === asilOgrenci)
    if (!asil) return
    setMesgul(true)
    const { error } = await supabase
      .from('students')
      .insert({ course_id: ders.id, ogrenci_no: asil.ogrenci_no, ad_soyad: asil.ad_soyad, asil_id: asil.id })
    setMesgul(false)
    if (error) {
      setMesaj({ tur: 'kotu', metin: error.code === '23505' ? 'Bu numara bu şubenin listesinde zaten var.' : 'Misafir öğrenci eklenemedi.' })
      return
    }
    setMesaj({ tur: 'iyi', metin: `${asil.ad_soyad} misafir olarak eklendi. Yoklaması kendi şubesinin aynı hafta oturumuna da yazılır.` })
    setAsilOgrenci('')
    await yenile()
  }

  async function seciliSil(idler: string[], aciklama: string) {
    if (idler.length === 0) return
    if (!window.confirm(`${aciklama}\n\n${idler.length} öğrenci listeden ve bu dersin yoklama kayıtlarından silinecek. Geri alınamaz.`)) return
    for (let i = 0; i < idler.length; i += 100) {
      const { error } = await supabase.from('students').delete().in('id', idler.slice(i, i + 100))
      if (error) {
        setMesaj({ tur: 'kotu', metin: 'Silme sırasında hata oldu; bir kısmı silinmemiş olabilir.' })
        break
      }
    }
    setSecili(new Set())
    await yenile()
  }

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    setMesaj(null)
    try {
      setOnizleme(await dosyadanAyristir(dosya))
    } catch {
      setMesaj({ tur: 'kotu', metin: 'Dosya okunamadı. .xlsx ya da .csv biçiminde olduğundan emin ol.' })
    }
  }

  async function kaydet(kayitlar: { ogrenci_no: string; ad_soyad: string }[]) {
    setMesgul(true)
    const { error } = await supabase
      .from('students')
      .upsert(
        kayitlar.map((k) => ({ ...k, course_id: ders.id })),
        { onConflict: 'course_id,ogrenci_no' },
      )
    setMesgul(false)
    if (error) {
      setMesaj({ tur: 'kotu', metin: 'Liste kaydedilemedi.' })
      return false
    }
    await yenile()
    return true
  }

  async function onizlemeyiKaydet() {
    if (!onizleme) return
    const yeni = onizleme.kayitlar.filter((k) => !mevcut.has(k.ogrenci_no)).length
    if (await kaydet(onizleme.kayitlar)) {
      setMesaj({
        tur: 'iyi',
        metin: `${onizleme.kayitlar.length} öğrenci işlendi: ${yeni} yeni, ${onizleme.kayitlar.length - yeni} güncellendi.`,
      })
      setOnizleme(null)
      setYapistir('')
    }
  }

  async function tekEkle(e: React.FormEvent) {
    e.preventDefault()
    const sonuc = metindenAyristir(`${tek.no}\t${tek.ad}`)
    if (sonuc.kayitlar.length !== 1) {
      setMesaj({ tur: 'kotu', metin: 'Numara en az 3 rakamdan oluşmalı (yalnızca rakam); ad soyad boş olmamalı.' })
      return
    }
    if (await kaydet(sonuc.kayitlar)) setTek({ no: '', ad: '' })
  }

  async function sil(o: Ogrenci) {
    if (!window.confirm(`${o.ad_soyad} (${o.ogrenci_no}) listeden ve bu dersin yoklama kayıtlarından silinecek.`)) return
    const { error } = await supabase.from('students').delete().eq('id', o.id)
    if (error) setMesaj({ tur: 'kotu', metin: 'Öğrenci silinemedi.' })
    yenile()
  }

  const filtreli = ogrenciler.filter(
    (o) =>
      !arama ||
      o.ogrenci_no.includes(arama) ||
      o.ad_soyad.toLocaleLowerCase('tr').includes(arama.toLocaleLowerCase('tr')),
  )

  return (
    <div className="space-y-5">
      <section className="cam-panel rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">Listeyi içe aktar</h2>
        <p className="text-sm text-slate-400">
          OBS'den aldığın Excel dosyasını seç ya da Excel'de numara ve ad soyad sütunlarını kopyalayıp aşağıya yapıştır.
          Aynı numara tekrar gelirse adı güncellenir; listede olup dosyada olmayan öğrenciler silinmez.
        </p>
        <label className="ikincil-buton inline-block cursor-pointer">
          Excel / CSV dosyası seç
          <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={dosyaSecildi} />
        </label>
        <textarea
          rows={4}
          className="giris-kutusu font-mono text-xs"
          placeholder={'20260001\tAli Yılmaz\n20260002\tAyşe Kaya'}
          value={yapistir}
          onChange={(e) => {
            setYapistir(e.target.value)
            setOnizleme(e.target.value.trim() ? metindenAyristir(e.target.value) : null)
          }}
        />

        {onizleme && (
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
            <p className="text-sm">
              <b>{onizleme.kayitlar.length}</b> öğrenci bulundu
              {onizleme.atlanan > 0 && <span className="text-amber-300">, {onizleme.atlanan} satır atlandı</span>}.
            </p>
            {onizleme.bilimsel && (
              <p className="text-sm text-amber-300">
                Bazı numaralar Excel'den "2,2E+10" gibi kısaltılmış geldi. Excel'de numara sütununu genişletip ya da
                sütunu "Sayı" biçimine çevirip yeniden kopyala.
              </p>
            )}
            {onizleme.kayitlar.length === 0 && !onizleme.bilimsel && (
              <p className="text-sm text-amber-300">
                Her satırda bir öğrenci numarası ve ad soyad olmalı, örneğin: 22010101001 Ali Yılmaz
              </p>
            )}
            {onizleme.kayitlar.length > 0 && (
              <>
                <ul className="text-xs font-mono text-slate-300 max-h-40 overflow-auto">
                  {onizleme.kayitlar.slice(0, 8).map((k) => (
                    <li key={k.ogrenci_no}>
                      {k.ogrenci_no} {k.ad_soyad}
                      {mevcut.has(k.ogrenci_no) && <span className="text-slate-500"> (kayıtlı)</span>}
                    </li>
                  ))}
                  {onizleme.kayitlar.length > 8 && <li className="text-slate-500">… ve {onizleme.kayitlar.length - 8} kişi daha</li>}
                </ul>
                <div className="flex gap-2">
                  <button disabled={mesgul} className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold" onClick={onizlemeyiKaydet}>
                    Listeye kaydet
                  </button>
                  <button className="ikincil-buton" onClick={() => setOnizleme(null)}>
                    Vazgeç
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {mesaj && <p className={`text-sm ${mesaj.tur === 'iyi' ? 'text-emerald-300' : 'text-rose-300'}`}>{mesaj.metin}</p>}
      </section>

      <section className="cam-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold flex-1">Kayıtlı öğrenciler ({ogrenciler.length})</h2>
          <input className="giris-kutusu max-w-xs" placeholder="Ara" value={arama} onChange={(e) => setArama(e.target.value)} />
        </div>
        <form onSubmit={tekEkle} className="flex flex-col sm:flex-row gap-2">
          <input
            className="giris-kutusu sm:max-w-40"
            placeholder="Numara"
            value={tek.no}
            onChange={(e) => setTek({ ...tek, no: e.target.value })}
          />
          <input
            className="giris-kutusu"
            placeholder="Ad soyad"
            value={tek.ad}
            onChange={(e) => setTek({ ...tek, ad: e.target.value })}
          />
          <button disabled={mesgul || !tek.no || !tek.ad} className="ikincil-buton whitespace-nowrap">
            Tek öğrenci ekle
          </button>
        </form>
        {kardesler.length > 0 && (
          <form onSubmit={misafirEkle} className="rounded-xl bg-slate-950/40 border border-white/5 p-3 space-y-2">
            <p className="text-sm font-semibold">Başka şubeden misafir öğrenci ekle</p>
            <p className="text-xs text-slate-400">
              Öğrenci kendi şubesinde kayıtlı kalır, bu şubede derse ve etkinliklere katılır. Burada yoklaması alınınca kendi şubesinin aynı hafta
              oturumuna da yazılır.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select className="giris-kutusu sm:max-w-52" value={asilSube} onChange={(e) => setAsilSube(e.target.value)}>
                <option value="">Asıl şube…</option>
                {kardesler.map((k) => (
                  <option key={k.id} value={k.id}>
                    {subeEtiketi(k.sube, kardesler.length + 1)} ({k.students[0]?.count ?? 0})
                  </option>
                ))}
              </select>
              <select className="giris-kutusu" value={asilOgrenci} onChange={(e) => setAsilOgrenci(e.target.value)} disabled={!asilSube}>
                <option value="">Öğrenci seç…</option>
                {asilListe.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ogrenci_no} {o.ad_soyad}
                  </option>
                ))}
              </select>
              <button disabled={mesgul || !asilOgrenci} className="ikincil-buton whitespace-nowrap">
                Misafir ekle
              </button>
            </div>
          </form>
        )}
        {ogrenciler.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="checkbox"
                checked={filtreli.length > 0 && filtreli.every((o) => secili.has(o.id))}
                onChange={(e) => setSecili(e.target.checked ? new Set(filtreli.map((o) => o.id)) : new Set())}
              />
              Görünenlerin hepsini seç
            </label>
            <button
              disabled={secili.size === 0}
              className="text-rose-300 hover:text-rose-200 disabled:opacity-40"
              onClick={() => seciliSil([...secili], 'Seçili öğrenciler silinecek.')}
            >
              Seçilenleri sil ({secili.size})
            </button>
            <button
              className="text-rose-300 hover:text-rose-200 ml-auto"
              onClick={() => seciliSil(ogrenciler.map((o) => o.id), 'Bu şubenin sınıf listesinin TAMAMI silinecek.')}
            >
              Listeyi tamamen sil
            </button>
          </div>
        )}
        {filtreli.length > 0 && (
          <table className="w-full text-sm">
            <tbody>
              {filtreli.map((o) => (
                <tr key={o.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-2 w-6">
                    <input
                      type="checkbox"
                      checked={secili.has(o.id)}
                      onChange={(e) =>
                        setSecili((s) => {
                          const y = new Set(s)
                          if (e.target.checked) y.add(o.id)
                          else y.delete(o.id)
                          return y
                        })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-300 w-32">{o.ogrenci_no}</td>
                  <td className="py-1.5">
                    {o.ad_soyad}
                    {o.asil_id && (
                      <span className="ml-2 text-xs rounded-full bg-fuchsia-500/20 text-fuchsia-200 px-2 py-0.5">
                        misafir · {asilAdlari.get(o.asil_id) ?? '…'} şubesi
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <button className="text-xs text-rose-300 hover:text-rose-200" onClick={() => sil(o)}>
                      sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Rapor(props: { ders: Ders; ogrenciler: Ogrenci[]; oturumlar: Oturum[]; yoklamalar: Yoklama[]; yenile: () => Promise<void> }) {
  const { ders, ogrenciler, oturumlar, yoklamalar, yenile } = props
  const [hata, setHata] = useState<string | null>(null)
  const [islemde, setIslemde] = useState<string | null>(null)
  const sirali = useMemo(() => [...oturumlar].sort((a, b) => a.basladi.localeCompare(b.basladi)), [oturumlar])
  // Gerçek yoklama kaydı olanlar (başka şubeden sayılanlar hariç); hücre tıklanınca elle eklenir ya da kaldırılır
  const gercek = useMemo(() => new Set(yoklamalar.filter((y) => !y.baska_sube).map((y) => `${y.session_id}|${y.student_id}`)), [yoklamalar])
  const elle = useMemo(() => new Set(yoklamalar.filter((y) => !y.baska_sube && y.yontem === 'elle').map((y) => `${y.session_id}|${y.student_id}`)), [yoklamalar])

  async function hucre(o: Ogrenci, oturum: Oturum) {
    const anahtar = `${oturum.id}|${o.id}`
    if (islemde) return
    setIslemde(anahtar)
    setHata(null)
    const { error } = gercek.has(anahtar)
      ? await supabase.from('attendance').delete().eq('session_id', oturum.id).eq('student_id', o.id)
      : await supabase.from('attendance').insert({ session_id: oturum.id, student_id: o.id, yontem: 'elle' })
    if (error) setHata('Değişiklik kaydedilemedi.')
    await yenile()
    setIslemde(null)
  }
  const [aktariliyor, setAktariliyor] = useState(false)
  const satirlar = useMemo(() => raporHesapla(ogrenciler, oturumlar, yoklamalar), [ogrenciler, oturumlar, yoklamalar])

  async function aktar() {
    setAktariliyor(true)
    try {
      await raporuExceleAktar(ders, ogrenciler, oturumlar, yoklamalar)
    } finally {
      setAktariliyor(false)
    }
  }

  if (oturumlar.length === 0) return <p className="text-sm text-slate-400">Rapor için en az bir oturum gerekli.</p>

  return (
    <section className="cam-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-300 flex-1">
          {oturumlar.length} oturum, {ogrenciler.length} öğrenci. Excel dosyasında her oturum ayrı bir sütundur.
        </p>
        <button disabled={aktariliyor} className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold" onClick={aktar}>
          {aktariliyor ? 'Hazırlanıyor…' : "Excel'e aktar"}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Bir öğrenciyi bir oturumda <b>elle var yazmak</b> ya da kaldırmak için o oturumun hücresine tıkla (✓ var, boş yok; ✋ elle yazılmış, ↗ başka şubede katılmış).
      </p>
      {hata && <p className="text-sm text-rose-300">{hata}</p>}
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="py-1.5 pr-3 font-medium">Numara</th>
            <th className="py-1.5 font-medium">Ad soyad</th>
            {sirali.map((o) => (
              <th key={o.id} className="py-1.5 px-1 font-medium text-center whitespace-nowrap" title={oturumAdi(o)}>
                <Link to={`/panel/oturum/${o.id}`} className="hover:underline">
                  {new Date(o.basladi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                </Link>
              </th>
            ))}
            <th className="py-1.5 font-medium text-right">Katıldığı</th>
            <th className="py-1.5 font-medium text-right w-20">Oran</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((r) => (
            <tr key={r.ogrenci.id} className="border-t border-white/5">
              <td className="py-1.5 pr-3 font-mono text-slate-300 w-32">{r.ogrenci.ogrenci_no}</td>
              <td className="py-1.5">{r.ogrenci.ad_soyad}</td>
              {sirali.map((o) => {
                const a = `${o.id}|${r.ogrenci.id}`
                const var_ = gercek.has(a)
                const baska = !var_ && r.katildigi.has(o.id)
                return (
                  <td key={o.id} className="py-1 px-0.5 text-center">
                    {baska ? (
                      <span title="Başka şubede misafir olarak katıldı" className="text-fuchsia-300">
                        ↗
                      </span>
                    ) : (
                      <button
                        disabled={islemde === a}
                        onClick={() => hucre(r.ogrenci, o)}
                        title={var_ ? 'Var (tıkla: kaldır)' : 'Yok (tıkla: elle var yaz)'}
                        className={`w-7 h-7 rounded-md text-xs font-bold transition ${
                          var_ ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40' : 'bg-white/5 text-slate-600 hover:bg-white/15'
                        }`}
                      >
                        {var_ ? (elle.has(a) ? '✋' : '✓') : '·'}
                      </button>
                    )}
                  </td>
                )
              })}
              <td className="py-1.5 text-right">
                {r.sayi} / {oturumlar.length}
              </td>
              <td className={`py-1.5 text-right font-semibold ${r.oran < 0.7 ? 'text-amber-300' : 'text-emerald-300'}`}>
                %{Math.round(r.oran * 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="text-xs text-slate-500">%70'in altındaki oranlar sarı gösterilir.</p>
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * Şube araçları: dersin bu dönemdeki kardeş şubeleri arasında geçiş, şube ekleme ve dersi düzenleme.
 * Her şubenin sınıf listesi, oturumları ve yoklaması ayrıdır.
 */
function SubeAraci({
  ders,
  ogrenciSayisi,
  yenile,
  hataVer,
}: {
  ders: Ders
  ogrenciSayisi: number
  yenile: () => Promise<void>
  hataVer: (m: string | null) => void
}) {
  const [kardesler, setKardesler] = useState<DersSatiri[]>([])
  const [mod, setMod] = useState<'yok' | 'ekle' | 'duzenle'>('yok')
  const [yeni, setYeni] = useState('')
  const [form, setForm] = useState({ ad: ders.ad, kod: ders.kod ?? '', sube: ders.sube ?? '' })
  const [say, setSay] = useState(0)

  useEffect(() => {
    subeleriGetir(ders.term_id, ders.subject_id)
      .then(setKardesler)
      .catch(() => setKardesler([]))
  }, [ders.term_id, ders.subject_id, ders.id, ders.sube, say, ogrenciSayisi])

  useEffect(() => {
    setForm({ ad: ders.ad, kod: ders.kod ?? '', sube: ders.sube ?? '' })
    setMod('yok')
  }, [ders.id, ders.ad, ders.kod, ders.sube])

  async function subeEkle(e: React.FormEvent) {
    e.preventDefault()
    hataVer(null)
    const adlar = [...new Set(yeni.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))]
    try {
      await subeleriAc({ donemId: ders.term_id, ad: ders.ad, kod: ders.kod, icerikId: ders.subject_id, subeler: adlar })
      setYeni('')
      setMod('yok')
      setSay((n) => n + 1)
    } catch {
      hataVer('Şube eklenemedi. Aynı adda başka bir şube olabilir.')
    }
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    hataVer(null)
    try {
      await dersiDuzenle(ders.id, { ad: form.ad, kod: form.kod || null, sube: form.sube || null })
      await yenile()
    } catch {
      hataVer('Değişiklik kaydedilemedi. Aynı adda başka bir şube olabilir.')
    }
  }

  const cokSube = kardesler.length > 1 || !!ders.sube?.trim()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {cokSube &&
          kardesler.map((k) => (
            <Link
              key={k.id}
              to={`/panel/ders/${k.id}`}
              className={`rounded-xl px-3 py-1.5 text-sm border ${
                k.id === ders.id ? 'bg-indigo-500/25 border-indigo-400/50 font-bold' : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              {subeEtiketi(k.sube, kardesler.length)}
              <span className="text-xs text-slate-400"> · {k.students[0]?.count ?? 0}</span>
            </Link>
          ))}
        <button className="text-xs text-indigo-300 hover:text-indigo-200" onClick={() => setMod(mod === 'ekle' ? 'yok' : 'ekle')}>
          + Şube ekle
        </button>
        <button className="text-xs text-slate-400 hover:text-white" onClick={() => setMod(mod === 'duzenle' ? 'yok' : 'duzenle')}>
          Adı, kodu, şubeyi düzenle
        </button>
        <Link to={`/panel/plan/${ders.term_id}/${ders.subject_id}`} className="text-xs text-slate-400 hover:text-white">
          Hafta planı
        </Link>
      </div>

      {mod === 'ekle' && (
        <form onSubmit={subeEkle} className="flex flex-wrap gap-2 items-center">
          <input
            autoFocus
            required
            maxLength={120}
            className="giris-kutusu !w-72"
            placeholder="Şube adı ya da virgülle birden çok: B, C"
            value={yeni}
            onChange={(e) => setYeni(e.target.value)}
          />
          <button className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold">Şube aç</button>
        </form>
      )}

      {mod === 'duzenle' && (
        <form onSubmit={kaydet} className="cam-panel rounded-2xl p-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] items-center max-w-3xl">
          <input required maxLength={200} className="giris-kutusu" placeholder="Ders adı" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          <input maxLength={40} className="giris-kutusu" placeholder="Kod" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
          <input maxLength={40} className="giris-kutusu" placeholder="Şube" value={form.sube} onChange={(e) => setForm({ ...form, sube: e.target.value })} />
          <button className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold">Kaydet</button>
        </form>
      )}
    </div>
  )
}
