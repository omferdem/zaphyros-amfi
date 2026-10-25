import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Donem, Icerik } from '../lib/tipler'
import { icerikSil } from '../lib/akis'
import { oku, sakla } from '../lib/cihaz'
import {
  bosDonemiSil,
  donemAdiniDegistir,
  donemDersleri,
  donemiPlanla,
  donemleriGetir,
  subeEtiketi,
  subeleriAc,
  type DersSatiri,
} from '../lib/plan'

const SECILI_DONEM = 'amfi_secili_donem'

/** Bugüne göre varsayılan dönem: başlamış dönemlerin en yenisi; hiçbiri başlamadıysa en yakın gelecek dönem. */
function varsayilanDonem(donemler: Donem[]): string {
  const bugun = new Date().toISOString().slice(0, 10)
  const baslamis = donemler.find((d) => d.baslangic <= bugun)
  return (baslamis ?? donemler[donemler.length - 1]).id
}

function virguleBol(metin: string): string[] {
  return [...new Set(metin.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))]
}

/** Hocanın ana sayfası: dönem seçici, dönemdeki dersler ve şubeleri, yeni ders ve yeni dönem planlama. */
export default function Panel() {
  const [donemler, setDonemler] = useState<Donem[] | null>(null)
  const [secili, setSecili] = useState<string | null>(null)
  const [dersler, setDersler] = useState<DersSatiri[] | null>(null)
  const [icerikler, setIcerikler] = useState<Icerik[]>([])
  const [hata, setHata] = useState<string | null>(null)

  const donemleriYukle = useCallback(async (secilecek?: string) => {
    try {
      const d = await donemleriGetir()
      setDonemler(d)
      const kayitli = secilecek ?? oku(SECILI_DONEM)
      if (d.length) setSecili(d.some((x) => x.id === kayitli) ? (kayitli as string) : varsayilanDonem(d))
      else setSecili(null)
      const { data } = await supabase.from('subjects').select('id, ad').order('ad')
      setIcerikler((data ?? []) as Icerik[])
    } catch {
      setHata('Dönemler yüklenemedi.')
    }
  }, [])

  const dersleriYukle = useCallback(async (donemId: string) => {
    try {
      setDersler(await donemDersleri(donemId))
    } catch {
      setHata('Dersler yüklenemedi.')
    }
  }, [])

  useEffect(() => {
    donemleriYukle()
  }, [donemleriYukle])

  useEffect(() => {
    if (!secili) {
      setDersler(donemler ? [] : null)
      return
    }
    sakla(SECILI_DONEM, secili)
    setDersler(null)
    dersleriYukle(secili)
  }, [secili, donemler, dersleriYukle])

  const donem = donemler?.find((d) => d.id === secili) ?? null

  // Derslere göre gruplama: aynı içeriğin şubeleri bir arada
  const gruplar = useMemo(() => {
    const m = new Map<string, DersSatiri[]>()
    for (const d of dersler ?? []) m.set(d.subject_id, [...(m.get(d.subject_id) ?? []), d])
    return [...m.values()]
  }, [dersler])

  // Hiçbir dönemde dersi olmayan içerikler (dönemleri silinmiş ya da kullanılmamış)
  const [kullanilanIcerikler, setKullanilanIcerikler] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase
      .from('courses')
      .select('subject_id')
      .then(({ data }) => setKullanilanIcerikler(new Set(((data ?? []) as { subject_id: string }[]).map((r) => r.subject_id))))
  }, [dersler])
  const kullanilmayan = icerikler.filter((i) => !kullanilanIcerikler.has(i.id))

  async function icerigiSil(i: Icerik) {
    if (!window.confirm(`"${i.ad}" içeriği, bütün akışları ve sunumlarıyla silinecek. Emin misin?`)) return
    setHata(null)
    try {
      await icerikSil(i.id)
    } catch {
      setHata('İçerik silinemedi.')
    }
    donemleriYukle(secili ?? undefined)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">Derslerim</h1>
        {donemler && donemler.length > 0 && (
          <select
            aria-label="Dönem"
            className="giris-kutusu !w-auto !py-2 font-semibold"
            value={secili ?? ''}
            onChange={(e) => setSecili(e.target.value)}
          >
            {donemler.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        )}
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      {donem && (
        <DonemAraclari
          donem={donem}
          bosMu={dersler?.length === 0}
          degisti={(yeniId) => donemleriYukle(yeniId ?? donem.id)}
          hataVer={setHata}
        />
      )}

      {donemler === null || (secili && dersler === null) ? (
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      ) : donemler.length === 0 ? (
        <p className="text-sm text-slate-400">Henüz dönem yok. Aşağıdan ilk dönemini aç.</p>
      ) : gruplar.length === 0 ? (
        <p className="text-sm text-slate-400">Bu dönemde henüz ders yok. Aşağıdan ekle ya da bir önceki dönemin yapısını kopyala.</p>
      ) : (
        <div className="space-y-3">
          {gruplar.map((g) => (
            <DersKarti key={g[0].subject_id} subeler={g} donem={donem!} degisti={() => secili && dersleriYukle(secili)} hataVer={setHata} />
          ))}
        </div>
      )}

      {donem ? (
        <YeniDers
          donem={donem}
          icerikler={icerikler}
          tamam={() => {
            dersleriYukle(donem.id)
            donemleriYukle(donem.id)
          }}
          hataVer={setHata}
        />
      ) : (
        donemler?.length === 0 && <YeniDonem donemler={[]} secili={null} tamam={(id) => donemleriYukle(id)} hataVer={setHata} acik />
      )}

      {donemler && donemler.length > 0 && <YeniDonem donemler={donemler} secili={secili} tamam={(id) => donemleriYukle(id)} hataVer={setHata} />}

      {kullanilmayan.length > 0 && (
        <section className="cam-panel rounded-2xl p-5 space-y-2">
          <h2 className="font-bold">Hiçbir dönemde dersi olmayan içerikler</h2>
          <p className="text-sm text-slate-400">
            Bu içeriklerin akışları ve sunumları duruyor. Yeni bir ders açarken "Ders içeriği" listesinden seçerek yeniden
            kullanabilir ya da silebilirsin.
          </p>
          <ul className="divide-y divide-white/5">
            {kullanilmayan.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1">{i.ad}</span>
                <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={() => icerigiSil(i)}>
                  Sil
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Seçili dönemin adını değiştirme ve boşsa silme. */
function DonemAraclari({
  donem,
  bosMu,
  degisti,
  hataVer,
}: {
  donem: Donem
  bosMu: boolean
  degisti: (yeniId?: string) => void
  hataVer: (m: string | null) => void
}) {
  const [duzenle, setDuzenle] = useState(false)
  const [ad, setAd] = useState(donem.ad)

  useEffect(() => {
    setAd(donem.ad)
    setDuzenle(false)
  }, [donem.id, donem.ad])

  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    hataVer(null)
    try {
      await donemAdiniDegistir(donem.id, ad)
      setDuzenle(false)
      degisti()
    } catch {
      hataVer('Dönem adı değiştirilemedi. Aynı adda başka bir dönem olabilir.')
    }
  }

  async function sil() {
    if (!window.confirm(`"${donem.ad}" dönemi silinecek. Emin misin?`)) return
    hataVer(null)
    try {
      await bosDonemiSil(donem.id)
      degisti('')
    } catch {
      hataVer('Dönem silinemedi.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
      <span>Başlangıç: {new Date(donem.baslangic).toLocaleDateString('tr-TR')}</span>
      {duzenle ? (
        <form onSubmit={kaydet} className="flex gap-2">
          <input autoFocus required maxLength={40} className="giris-kutusu !py-1.5 !w-56" value={ad} onChange={(e) => setAd(e.target.value)} />
          <button className="ikincil-buton !py-1.5">Kaydet</button>
          <button type="button" className="ikincil-buton !py-1.5" onClick={() => setDuzenle(false)}>
            Vazgeç
          </button>
        </form>
      ) : (
        <button className="underline hover:text-white" onClick={() => setDuzenle(true)}>
          Dönemin adını değiştir
        </button>
      )}
      {bosMu && (
        <button className="underline hover:text-rose-300" onClick={sil}>
          Boş dönemi sil
        </button>
      )}
    </div>
  )
}

/** Bir dersin dönemdeki şubeleri: her şube kendi sınıf listesi ve yoklamasıyla ayrı bir ders sayfasıdır. */
function DersKarti({
  subeler,
  donem,
  degisti,
  hataVer,
}: {
  subeler: DersSatiri[]
  donem: Donem
  degisti: () => void
  hataVer: (m: string | null) => void
}) {
  const ilk = subeler[0]
  const [ekle, setEkle] = useState(false)
  const [yeni, setYeni] = useState('')
  const toplam = subeler.reduce((t, s) => t + (s.students[0]?.count ?? 0), 0)

  async function subeEkle(e: React.FormEvent) {
    e.preventDefault()
    hataVer(null)
    try {
      await subeleriAc({ donemId: donem.id, ad: ilk.ad, kod: ilk.kod, icerikId: ilk.subject_id, subeler: virguleBol(yeni) })
      setYeni('')
      setEkle(false)
      degisti()
    } catch {
      hataVer('Şube eklenemedi. Aynı adda başka bir şube olabilir.')
    }
  }

  return (
    <section className="cam-panel rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {ilk.kod && <p className="text-xs font-mono text-indigo-300">{ilk.kod}</p>}
          <h2 className="text-lg font-bold">{ilk.ad}</h2>
          <p className="text-xs text-slate-400">
            {subeler.length > 1 || ilk.sube ? `${subeler.length} şube · ` : ''}
            {toplam} öğrenci
          </p>
        </div>
        <Link to={`/panel/plan/${donem.id}/${ilk.subject_id}`} className="ikincil-buton">
          Hafta planı
        </Link>
        <button className="ikincil-buton" onClick={() => setEkle(!ekle)}>
          + Şube
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {subeler.map((s) => (
          <li key={s.id}>
            <Link
              to={`/panel/ders/${s.id}`}
              className="block rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/10 px-4 py-2 transition-colors"
            >
              <span className="font-semibold">{subeEtiketi(s.sube, subeler.length)}</span>
              <span className="text-xs text-slate-400"> · {s.students[0]?.count ?? 0} öğrenci</span>
            </Link>
          </li>
        ))}
      </ul>

      {ekle && (
        <form onSubmit={subeEkle} className="flex flex-wrap gap-2 items-center">
          <input
            autoFocus
            required
            maxLength={120}
            className="giris-kutusu !w-72"
            placeholder="Şube adı ya da virgülle birden çok: A, B, C"
            value={yeni}
            onChange={(e) => setYeni(e.target.value)}
          />
          <button className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold">Şube aç</button>
          <button type="button" className="ikincil-buton" onClick={() => setEkle(false)}>
            Vazgeç
          </button>
        </form>
      )}
    </section>
  )
}

/** Dönemde yeni ders: yeni içerikle ya da önceden hazırlanmış bir içerikle; şubeleri tek seferde açar. */
function YeniDers({
  donem,
  icerikler,
  tamam,
  hataVer,
}: {
  donem: Donem
  icerikler: Icerik[]
  tamam: () => void
  hataVer: (m: string | null) => void
}) {
  const [form, setForm] = useState({ ad: '', kod: '', subeler: '', icerik: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    setKaydediliyor(true)
    hataVer(null)
    try {
      await subeleriAc({ donemId: donem.id, ad: form.ad, kod: form.kod, icerikId: form.icerik || null, subeler: virguleBol(form.subeler) })
      setForm({ ad: '', kod: '', subeler: '', icerik: '' })
      tamam()
    } catch {
      hataVer('Ders kaydedilemedi. Bu içeriğin aynı adlı şubesi bu dönemde zaten olabilir.')
    }
    setKaydediliyor(false)
  }

  return (
    <form onSubmit={ekle} className="cam-panel rounded-2xl p-5 space-y-3">
      <h2 className="font-bold">{donem.ad} dönemine ders ekle</h2>
      {icerikler.length > 0 && (
        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Ders içeriği</span>
          <select
            className="giris-kutusu"
            value={form.icerik}
            onChange={(e) => {
              const ic = icerikler.find((i) => i.id === e.target.value)
              setForm({ ...form, icerik: e.target.value, ad: ic && !form.ad ? ic.ad : form.ad })
            }}
          >
            <option value="">Yeni içerik (akışlar ve sunumlar sıfırdan)</option>
            {icerikler.map((i) => (
              <option key={i.id} value={i.id}>
                {i.ad} içeriğini kullan (önceki dönemlerin akışları, sunumları ve soruları)
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <input
          required
          maxLength={200}
          className="giris-kutusu"
          placeholder="Ders adı (ör. Din Felsefesi)"
          value={form.ad}
          onChange={(e) => setForm({ ...form, ad: e.target.value })}
        />
        <input
          maxLength={40}
          className="giris-kutusu"
          placeholder="Kod (isteğe bağlı)"
          value={form.kod}
          onChange={(e) => setForm({ ...form, kod: e.target.value })}
        />
      </div>
      <input
        maxLength={300}
        className="giris-kutusu"
        placeholder="Şubeler: A, B, C (boş bırakırsan şubesiz tek ders açılır)"
        value={form.subeler}
        onChange={(e) => setForm({ ...form, subeler: e.target.value })}
      />
      <p className="text-xs text-slate-500">Her şubenin sınıf listesi, oturumları ve yoklaması ayrıdır; akışlar, sunumlar ve sorular şubeler arasında ortaktır.</p>
      <button disabled={kaydediliyor} className="parlak-buton rounded-xl px-5 py-2.5 font-bold disabled:opacity-60">
        Dersi ekle
      </button>
    </form>
  )
}

/** Yeni dönem planla: istersen bir önceki dönemin ders ve şube yapısını (boş listelerle) kopyalar. */
function YeniDonem({
  donemler,
  secili,
  tamam,
  hataVer,
  acik: baslangicta = false,
}: {
  donemler: Donem[]
  secili: string | null
  tamam: (yeniId: string) => void
  hataVer: (m: string | null) => void
  acik?: boolean
}) {
  const [acik, setAcik] = useState(baslangicta)
  const [ad, setAd] = useState('')
  const [baslangic, setBaslangic] = useState(() => new Date().toISOString().slice(0, 10))
  const [kaynak, setKaynak] = useState<string>(secili ?? '')
  const [mesgul, setMesgul] = useState(false)

  useEffect(() => {
    setKaynak(secili ?? '')
    // Varsayılan başlangıç: seçili dönemin bir yıl sonrası (gelecek yılın aynı dönemi); istersen değiştir.
    const d = donemler.find((x) => x.id === secili)
    if (d) {
      const t = new Date(d.baslangic)
      t.setFullYear(t.getFullYear() + 1)
      setBaslangic(t.toISOString().slice(0, 10))
    }
  }, [secili, donemler])

  async function planla(e: React.FormEvent) {
    e.preventDefault()
    setMesgul(true)
    hataVer(null)
    try {
      const id = await donemiPlanla(ad, baslangic, kaynak || null)
      setAd('')
      setAcik(false)
      tamam(id)
    } catch {
      hataVer('Dönem açılamadı. Aynı adda başka bir dönem olabilir.')
    }
    setMesgul(false)
  }

  if (!acik)
    return (
      <button className="ikincil-buton" onClick={() => setAcik(true)}>
        + Yeni dönem planla
      </button>
    )

  return (
    <form onSubmit={planla} className="cam-panel rounded-2xl p-5 space-y-3">
      <h2 className="font-bold">Yeni dönem planla</h2>
      <p className="text-sm text-slate-400">
        Gelecek dönemleri önceden açabilirsin. İçerik (akışlar, sunumlar, sorular) zaten ortaktır; dönemi bir öncekinin ders ve şube
        yapısıyla başlatırsan yalnızca sınıf listeleri boş başlar.
      </p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <input
          required
          autoFocus
          maxLength={40}
          className="giris-kutusu"
          placeholder="Dönem adı (ör. 2027-2028 Güz)"
          value={ad}
          onChange={(e) => setAd(e.target.value)}
        />
        <input
          required
          type="date"
          aria-label="Başlangıç tarihi"
          className="giris-kutusu"
          value={baslangic}
          onChange={(e) => setBaslangic(e.target.value)}
        />
      </div>
      {donemler.length > 0 && (
        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Ders ve şube yapısı</span>
          <select className="giris-kutusu" value={kaynak} onChange={(e) => setKaynak(e.target.value)}>
            <option value="">Boş dönem aç</option>
            {donemler.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad} dönemindeki ders ve şubeleri kopyala
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button disabled={mesgul} className="parlak-buton rounded-xl px-5 py-2.5 font-bold disabled:opacity-60">
          Dönemi aç
        </button>
        <button type="button" className="ikincil-buton" onClick={() => setAcik(false)}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
