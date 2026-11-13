import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adimlariGetir, akisGetir, sorulariGetir, sunumlariGetir } from '../lib/akis'
import type { Adim, Akis, Soru, Sunum } from '../lib/tipler'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { SIKLAR } from '../lib/yarisma'
import { youtubeGomme } from '../lib/video'
import { SlaytCizimi, usePdfBelgeleri } from '../bilesenler/Slayt'

type Gorunum = 'perde' | 'telefon' | 'ikisi'

const ORNEK_KELIMELER = ['akıl', 'iman', 'vahiy', 'özgürlük', 'ahlak', 'hakikat', 'şüphe', 'Tanrı']

/** Soru şıklarını sabit ve tekrarlanabilir sırayla dizer (önizlemede kararlı görünsün). */
function siklar(s: Soru): string[] {
  const hepsi = [s.dogru, ...s.yanlislar]
  const k = [...hepsi]
  let h = 0
  for (let i = 0; i < s.id.length; i++) h = (h * 31 + s.id.charCodeAt(i)) >>> 0
  for (let i = k.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[k[i], k[j]] = [k[j], k[i]]
  }
  return k
}

function etiketAdi(a: Adim): string {
  if (a.tur === 'slayt') return 'Slayt'
  if (a.tur === 'soru') return 'Soru'
  if (a.tur === 'fikir') return a.ayar.mod === 'acik' ? 'Açık uçlu' : a.ayar.mod === 'firtina' ? 'Beyin fırtınası' : 'Kelime bulutu'
  if (a.tur === 'oylama') return 'Oylama'
  if (a.tur === 'video') return 'Video'
  if (a.tur === 'oyun') return 'Oyun'
  return 'Yoklama'
}

/**
 * Akış önizlemesi: dersi başlatmadan akışı adım adım, perde (projeksiyon), öğrenci telefonu ya da ikisi yan yana görürsün.
 * Hiçbir şey kaydedilmez; öğrencilere ya da veritabanındaki oturumlara dokunulmaz.
 */
export default function AkisOnizleme() {
  const { akisId = '' } = useParams()
  const gezin = useNavigate()
  const [akis, setAkis] = useState<Akis | null | undefined>(undefined)
  const [adimlar, setAdimlar] = useState<Adim[]>([])
  const [sunumlar, setSunumlar] = useState<Sunum[]>([])
  const [sorular, setSorular] = useState<Soru[]>([])
  const [i, setI] = useState(0)
  const [gorunum, setGorunum] = useState<Gorunum>('ikisi')
  const [cevapGoster, setCevapGoster] = useState(false)

  const yukle = useCallback(async () => {
    try {
      const a = await akisGetir(akisId)
      setAkis(a)
      if (!a) return
      const [ad, s, q] = await Promise.all([adimlariGetir(a.id), sunumlariGetir(a.subject_id), sorulariGetir(a.subject_id)])
      setAdimlar(ad)
      setSunumlar(s)
      setSorular(q)
    } catch {
      setAkis(null)
    }
  }, [akisId])
  useEffect(() => {
    yukle()
  }, [yukle])

  const sunumHaritasi = useMemo(() => new Map(sunumlar.map((s) => [s.id, s])), [sunumlar])
  const soruHaritasi = useMemo(() => new Map(sorular.map((s) => [s.id, s])), [sorular])
  const kullanilan = useMemo(() => adimlar.flatMap((a) => (a.presentation_id ? [a.presentation_id] : [])), [adimlar])
  const { belgeler } = usePdfBelgeleri(akis?.subject_id, kullanilan)

  const adim = adimlar[i]
  const ileri = useCallback(() => setI((k) => Math.min(adimlar.length - 1, k + 1)), [adimlar.length])
  const geri = useCallback(() => setI((k) => Math.max(0, k - 1)), [])

  useEffect(() => {
    setCevapGoster(false)
  }, [i])

  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        ileri()
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        geri()
      } else if (e.key === 'Escape') gezin(`/panel/akis/${akisId}`)
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [ileri, geri, gezin, akisId])

  if (akis === undefined) return <p className="p-6 text-slate-300">Yükleniyor…</p>
  if (akis === null) return <p className="p-6 text-slate-300">Akış bulunamadı.</p>

  const soru = adim?.tur === 'soru' ? soruHaritasi.get(adim.question_id ?? '') : undefined
  const sunum = adim?.presentation_id ? sunumHaritasi.get(adim.presentation_id) : undefined
  const slaytMetni = sunum?.metinler[(adim?.sayfa_no ?? 1) - 1] ?? ''

  const perde = adim ? <PerdeIcerigi adim={adim} soru={soru} cevapGoster={cevapGoster} belge={adim.presentation_id ? belgeler.get(adim.presentation_id) : undefined} /> : null
  const telefon = adim ? <TelefonIcerigi adim={adim} soru={soru} metin={slaytMetni} belge={adim.presentation_id ? belgeler.get(adim.presentation_id) : undefined} /> : null

  return (
    <main className="min-h-screen p-3 sm:p-5 max-w-7xl mx-auto space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <Link to={`/panel/akis/${akisId}`} className="ikincil-buton !py-1.5 text-sm">
          ← Düzenlemeye dön
        </Link>
        <h1 className="font-display font-extrabold text-lg flex-1 min-w-0 truncate">👁 Önizleme: {akis.ad}</h1>
        <div className="flex rounded-xl overflow-hidden border border-white/10" role="group" aria-label="Görünüm">
          {(
            [
              ['perde', '🖥 Perde (hoca)'],
              ['telefon', '📱 Öğrenci telefonu'],
              ['ikisi', '🖥📱 İkisi'],
            ] as [Gorunum, string][]
          ).map(([k, ad]) => (
            <button key={k} onClick={() => setGorunum(k)} className={`px-3 py-1.5 text-sm ${gorunum === k ? 'bg-indigo-500/40 font-bold' : 'bg-white/5 hover:bg-white/10'}`}>
              {ad}
            </button>
          ))}
        </div>
      </header>

      {adimlar.length === 0 ? (
        <p className="text-slate-400">Bu akışta henüz adım yok.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
          <aside className="cam-panel rounded-2xl p-2 max-h-[70vh] overflow-y-auto order-2 lg:order-1" aria-label="Adımlar">
            <ol className="space-y-1">
              {adimlar.map((a, k) => (
                <li key={a.id}>
                  <button
                    onClick={() => setI(k)}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-xs flex gap-2 ${k === i ? 'bg-indigo-500/30 font-bold' : 'hover:bg-white/10 text-slate-300'}`}
                  >
                    <span className="w-6 text-right font-mono text-slate-500">{k + 1}</span>
                    <span className="truncate">
                      {etiketAdi(a)}
                      {a.tur === 'soru' && soruHaritasi.get(a.question_id ?? '') ? `: ${soruHaritasi.get(a.question_id ?? '')?.soru.slice(0, 28)}` : ''}
                      {(a.tur === 'fikir' || a.tur === 'oylama') && a.ayar.soru ? `: ${a.ayar.soru.slice(0, 28)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <section className="space-y-3 order-1 lg:order-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button className="ikincil-buton !py-1.5" onClick={geri} disabled={i === 0} aria-label="Önceki adım">
                ◀
              </button>
              <span className="font-mono text-sm tabular-nums">
                {i + 1} / {adimlar.length}
              </span>
              <button className="ikincil-buton !py-1.5" onClick={ileri} disabled={i >= adimlar.length - 1} aria-label="Sonraki adım">
                ▶
              </button>
              <span className="text-xs text-slate-400">{adim ? etiketAdi(adim) : ''} · ok tuşları ve boşluk da çalışır</span>
              {adim?.tur === 'soru' && (
                <label className="ml-auto text-xs flex items-center gap-1.5">
                  <input type="checkbox" className="accent-indigo-500" checked={cevapGoster} onChange={(e) => setCevapGoster(e.target.checked)} />
                  Doğru cevabı göster
                </label>
              )}
            </div>
            <div className={`grid gap-4 ${gorunum === 'ikisi' ? 'xl:grid-cols-[1fr_20rem]' : ''} items-start`}>
              {gorunum !== 'telefon' && (
                <PerdeCercevesi>{perde}</PerdeCercevesi>
              )}
              {gorunum !== 'perde' && (
                <div className={`mx-auto w-[20rem] max-w-full ${gorunum === 'telefon' ? 'xl:w-[24rem]' : ''}`}>
                  <div className="rounded-[2.2rem] border-[6px] border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
                    <div className="h-5 bg-slate-800 flex justify-center items-center">
                      <span className="w-14 h-1.5 rounded-full bg-slate-950" />
                    </div>
                    <div className="min-h-[34rem] max-h-[40rem] overflow-y-auto p-4 flex flex-col">{telefon}</div>
                  </div>
                  <p className="text-center text-[10px] font-mono text-slate-500 mt-1">ÖĞRENCİ TELEFONU</p>
                </div>
              )}
            </div>
            {adim?.ayar.not && (
              <p className="text-sm rounded-xl bg-amber-500/10 border border-amber-300/20 p-3">
                📝 <b>Hoca notu:</b> {adim.ayar.not}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function PerdeIcerigi({ adim, soru, cevapGoster, belge }: { adim: Adim; soru: Soru | undefined; cevapGoster: boolean; belge: ReturnType<typeof usePdfBelgeleri>['belgeler'] extends Map<string, infer B> ? B | undefined : never }) {
  if (adim.tur === 'slayt') {
    return <SlaytCizimi belge={belge} sayfaNo={adim.sayfa_no ?? 1} className="w-full h-full rounded-xl bg-slate-900" />
  }
  if (adim.tur === 'soru') {
    if (!soru) return <p className="m-auto text-slate-400">Soru bulunamadı.</p>
    const s = siklar(soru)
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
          <h2 className="flex-1 text-2xl lg:text-3xl font-extrabold leading-tight">{soru.soru}</h2>
          <div className="text-center shrink-0">
            <p className="text-4xl font-extrabold tabular-nums">{soru.sure_sn}</p>
            <p className="text-xs text-slate-400">saniye</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          {s.map((x, k) => (
            <div key={k} className={`${SIKLAR[k % SIKLAR.length].renk} rounded-2xl px-4 flex items-center gap-3 text-lg lg:text-xl font-bold ${cevapGoster && x !== soru.dogru ? 'opacity-30' : ''}`}>
              <span className="w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center shrink-0">{SIKLAR[k % SIKLAR.length].harf}</span>
              <span>{x}</span>
              {cevapGoster && x === soru.dogru && <span className="ml-auto">✓</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (adim.tur === 'fikir') {
    const mod = adim.ayar.mod ?? 'bulut'
    return (
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-2xl lg:text-4xl font-extrabold leading-tight">{adim.ayar.soru}</h2>
        {mod === 'bulut' ? (
          <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 content-center opacity-60">
            {ORNEK_KELIMELER.map((k, n) => (
              <span key={k} className="font-display font-extrabold" style={{ fontSize: `${1.2 + ((n * 7) % 5) * 0.55}rem` }}>
                {k}
              </span>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 opacity-60">
            {['Örnek cevap: öğrencinin yazdığı metin burada kart olarak görünür.', 'Örnek cevap: hoca uygunsuz olanı gizleyebilir.', 'Örnek cevap: aynı cevaplar birleşir.'].map((m) => (
              <div key={m} className="rounded-2xl border border-white/10 bg-white/7 p-3 text-sm">
                {m}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Örnek görünüm: gerçek derste öğrencilerin yazdıkları burada akar.</p>
      </div>
    )
  }
  if (adim.tur === 'oylama') {
    const e = adim.ayar.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
    return (
      <div className="flex-1 flex flex-col gap-4 justify-center">
        <h2 className="text-2xl lg:text-4xl font-extrabold leading-tight text-center">{adim.ayar.soru}</h2>
        <div className="flex items-center justify-center gap-6 text-3xl font-extrabold">
          <span className="text-sky-300">{e[0]}</span>
          <span className="text-slate-500 text-xl">ya da</span>
          <span className="text-rose-300">{e[1]}</span>
        </div>
        <div className="h-5 rounded-full bg-white/10 overflow-hidden flex opacity-60">
          <div className="bg-sky-400 w-[58%]" />
          <div className="bg-rose-400 flex-1" />
        </div>
        <p className="text-xs text-slate-500 text-center">Örnek görünüm: sonuç ve gerekçeler oylama kapanınca açıklanır.</p>
      </div>
    )
  }
  if (adim.tur === 'video') {
    const gomme = adim.ayar.url ? youtubeGomme(adim.ayar.url) : null
    return gomme ? (
      <iframe title={adim.ayar.baslik ?? 'Video'} src={gomme} className="w-full h-full rounded-xl" allow="encrypted-media; picture-in-picture" allowFullScreen />
    ) : (
      <div className="m-auto text-center space-y-2">
        <p className="text-5xl">🎬</p>
        <p className="text-xl font-bold">{adim.ayar.baslik ?? 'Video'}</p>
        <a className="underline text-indigo-300 text-sm break-all" href={adim.ayar.url} target="_blank" rel="noreferrer">
          {adim.ayar.url}
        </a>
      </div>
    )
  }
  if (adim.tur === 'oyun') {
    const o = OYUNLAR[(adim.ayar.oyun ?? 'takim') as OyunAnahtari] ?? OYUNLAR.takim
    return (
      <div className="m-auto text-center space-y-3 max-w-2xl">
        <p className="text-sm font-mono uppercase tracking-widest text-fuchsia-300">🎮 Bugünün oyunu</p>
        <p className="text-7xl">{o.emoji}</p>
        <h2 className="text-3xl font-display font-extrabold">{adim.ayar.baslik || o.ad}</h2>
        <p className="text-slate-200">{adim.ayar.aciklama || o.nasil}</p>
      </div>
    )
  }
  return (
    <div className="m-auto text-center space-y-2">
      <p className="text-5xl">📋</p>
      <p className="text-2xl font-bold">Yoklama</p>
      <p className="text-slate-400 text-sm">Perdede karekod, ders kodu ve katılım sayacı görünür.</p>
    </div>
  )
}

function TelefonIcerigi({ adim, soru, metin, belge }: { adim: Adim; soru: Soru | undefined; metin: string; belge: ReturnType<typeof usePdfBelgeleri>['belgeler'] extends Map<string, infer B> ? B | undefined : never }) {
  if (adim.tur === 'slayt') {
    const satirlar = metin.split('\n').filter(Boolean)
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Slayt {adim.sayfa_no}</p>
        <SlaytCizimi belge={belge} sayfaNo={adim.sayfa_no ?? 1} className="w-full aspect-video rounded-xl bg-slate-900" />
        {satirlar.length > 0 && (
          <details className="text-sm text-slate-300">
            <summary className="cursor-pointer text-slate-400">Slaytın metni</summary>
            <div className="mt-2 space-y-2">
              {satirlar.map((s, k) => (
                <p key={k}>{s}</p>
              ))}
            </div>
          </details>
        )}
        <p className="text-[11px] text-slate-500">Telefon modunda slayt resmi böyle görünür; modu kapalıysa öğrenci yalnızca metni görür ve perdeye bakar.</p>
      </div>
    )
  }
  if (adim.tur === 'soru') {
    if (!soru) return <p className="text-slate-400">Soru bulunamadı.</p>
    const s = siklar(soru)
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-fuchsia-300">🎯 Soru</p>
        <h2 className="text-lg font-extrabold leading-snug">{soru.soru}</h2>
        <div className="grid gap-2">
          {s.map((x, k) => (
            <div key={k} className={`${SIKLAR[k % SIKLAR.length].renk} rounded-2xl px-4 py-3 font-bold flex gap-3`}>
              <span className="opacity-80">{SIKLAR[k % SIKLAR.length].harf}</span>
              <span>{x}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">Öğrenci şıkka dokunur; {soru.sure_sn} saniye içinde cevaplar. Doğru cevap öğrenciye süre bitince gösterilir.</p>
      </div>
    )
  }
  if (adim.tur === 'fikir') {
    const mod = adim.ayar.mod ?? 'bulut'
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold leading-snug">{adim.ayar.soru}</h2>
        {mod === 'bulut' ? <div className="giris-kutusu text-base text-slate-500">Bir kelime ya da kısa bir ifade</div> : <div className={`giris-kutusu text-slate-500 ${mod === 'acik' ? 'h-28' : 'h-20'}`}>{mod === 'acik' ? 'Cevabını yaz' : 'Fikrini bir iki cümleyle yaz'}</div>}
        <div className="parlak-buton w-full rounded-xl py-3 font-bold text-center">{mod === 'acik' ? 'Cevabı gönder' : 'Gönder (3 hakkın var)'}</div>
      </div>
    )
  }
  if (adim.tur === 'oylama') {
    const e = adim.ayar.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold leading-snug">{adim.ayar.soru}</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-linear-to-br from-sky-400 to-blue-600 py-4 text-center font-bold">{e[0]}</div>
          <div className="rounded-2xl bg-linear-to-br from-rose-500 to-pink-600 py-4 text-center font-bold">{e[1]}</div>
        </div>
        <div className="giris-kutusu text-sm text-slate-500 h-16">İstersen kısa bir gerekçe yaz</div>
      </div>
    )
  }
  if (adim.tur === 'video') return <p className="text-slate-300 m-auto text-center">Perdedeki videoyu izle.{adim.ayar.baslik ? ` (${adim.ayar.baslik})` : ''}</p>
  if (adim.tur === 'oyun') {
    const o = OYUNLAR[(adim.ayar.oyun ?? 'takim') as OyunAnahtari] ?? OYUNLAR.takim
    return (
      <div className="m-auto text-center space-y-2">
        <p className="text-5xl">{o.emoji}</p>
        <p className="font-bold">{o.ad}</p>
        <p className="text-sm text-slate-300">Oyun perdede. Sorular gelince telefonundan cevap vereceksin.</p>
      </div>
    )
  }
  return <p className="text-slate-300 m-auto text-center">Yoklama alınıyor. Perdeye bak.</p>
}

/** Perde içeriğini gerçek bir projeksiyon ekranı gibi 1280x720 üzerinde çizer ve kutuya sığacak şekilde küçültür. */
function PerdeCercevesi({ children }: { children: React.ReactNode }) {
  const kutu = useRef<HTMLDivElement>(null)
  const [olcek, setOlcek] = useState(0.5)
  useEffect(() => {
    const el = kutu.current
    if (!el) return
    const hesapla = () => setOlcek(el.clientWidth / 1280)
    hesapla()
    const g = new ResizeObserver(hesapla)
    g.observe(el)
    return () => g.disconnect()
  }, [])
  return (
    <div ref={kutu} className="rounded-3xl border border-white/10 overflow-hidden bg-slate-950 aspect-video relative w-full">
      <div className="absolute left-0 top-0 p-8 flex flex-col overflow-hidden" style={{ width: 1280, height: 720, transform: `scale(${olcek})`, transformOrigin: 'top left' }}>
        {children}
      </div>
      <span className="absolute left-3 top-2 text-[10px] font-mono text-slate-500">PERDE</span>
    </div>
  )
}
