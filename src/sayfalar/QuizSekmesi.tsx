import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ders, Ogrenci, Soru } from '../lib/tipler'
import { sorulariGetir } from '../lib/akis'
import { karistir, paketleriGrupla } from '../lib/paket'
import { tarihSaat } from '../lib/bicim'
import { quizSonucunuExceleAktar } from '../lib/rapor'
import {
  denemeSil,
  maddeAnalizi,
  quizCevaplari,
  quizDenemeleri,
  quizKapat,
  quizleriGetir,
  quizOlustur,
  quizSil,
  quizSoruBaglari,
  quizSonuclari,
  type Quiz,
  type QuizCevap,
  type QuizDeneme,
  type QuizSoruBagi,
} from '../lib/quiz'

function kodBicimle(kod: string): string {
  return `${kod.slice(0, 3)} ${kod.slice(3)}`
}

function kisaAdres(): string {
  return (window.location.host + window.location.pathname).replace(/\/$/, '')
}

function yuzde(o: number | null): string {
  return o === null ? '–' : `%${Math.round(o * 100)}`
}

function renk(o: number | null): string {
  if (o === null) return 'bg-white/5 text-slate-500'
  if (o >= 0.8) return 'bg-emerald-500/20 text-emerald-200'
  if (o >= 0.5) return 'bg-amber-500/20 text-amber-200'
  return 'bg-rose-500/20 text-rose-200'
}

/** Ders sayfasındaki "Quiz" sekmesi: habersiz quiz aç, kodu göster, ilerlemeyi izle, sonuçları incele. */
export default function QuizSekmesi({ ders, ogrenciler }: { ders: Ders; ogrenciler: Ogrenci[] }) {
  const [quizler, setQuizler] = useState<Quiz[] | null>(null)
  const [denemeler, setDenemeler] = useState<QuizDeneme[]>([])
  const [cevaplar, setCevaplar] = useState<QuizCevap[]>([])
  const [baglar, setBaglar] = useState<QuizSoruBagi[]>([])
  const [sorular, setSorular] = useState<Soru[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [acik, setAcik] = useState<string | null>(null)
  const [perde, setPerde] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([quizleriGetir(ders.id), sorulariGetir(ders.subject_id)])
      const idler = q.map((x) => x.id)
      const [d, c, b] = await Promise.all([quizDenemeleri(idler), quizCevaplari(idler), quizSoruBaglari(idler)])
      setQuizler(q)
      setSorular(s)
      setDenemeler(d)
      setCevaplar(c)
      setBaglar(b)
    } catch {
      setHata('Quizler yüklenemedi.')
    }
  }, [ders.id, ders.subject_id])

  useEffect(() => {
    yukle()
  }, [yukle])

  // Açık quiz varken öğrencilerin ilerlemesi 6 saniyede bir yenilenir.
  const acikVar = !!quizler?.some((q) => q.durum === 'acik')
  useEffect(() => {
    if (!acikVar) return
    const t = setInterval(yukle, 6000)
    return () => clearInterval(t)
  }, [acikVar, yukle])

  const soruHaritasi = useMemo(() => new Map(sorular.map((s) => [s.id, s])), [sorular])

  async function kapat(q: Quiz) {
    if (!window.confirm('Quiz bitirilsin mi? Henüz bitirmemiş öğrencilerin denemeleri o ana kadarki cevaplarla kapanır.')) return
    try {
      await quizKapat(q.id)
      setPerde(null)
    } catch {
      setHata('Quiz kapatılamadı.')
    }
    yukle()
  }

  async function sil(q: Quiz) {
    if (!window.confirm(`"${q.baslik}" quizi ve bütün öğrenci sonuçları silinecek. Emin misin?`)) return
    try {
      await quizSil(q.id)
    } catch {
      setHata('Quiz silinemedi.')
    }
    setAcik(null)
    yukle()
  }

  const perdedeki = quizler?.find((q) => q.id === perde)

  return (
    <div className="space-y-6">
      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <div className="cam-panel rounded-3xl p-5 space-y-2">
        <h2 className="text-xl font-extrabold">📝 Habersiz quiz</h2>
        <p className="text-sm text-slate-400">
          Kahoot'tan ayrı, sessiz bir ölçme: soruları paketinden seç, quizi başlat, perdedeki 6 haneli kodu öğrencilerine göster.
          Öğrenciler kodla ve öğrenci numarasıyla girer, soruları kendi hızında çözer. Canlı sıralama yoktur; sonuçlar yalnızca
          sende görünür, öğrenciye bağlı kaydedilir ve <b>Gelişim</b> sekmesindeki konu raporuna eklenir.
        </p>
      </div>

      <YeniQuiz
        ders={ders}
        sorular={sorular}
        ogrenciSayisi={ogrenciler.length}
        hataVer={setHata}
        olustu={(id) => {
          setPerde(id)
          yukle()
        }}
      />

      {quizler === null ? (
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      ) : quizler.length === 0 ? (
        <p className="text-sm text-slate-400">Bu şubede henüz quiz yok.</p>
      ) : (
        <ul className="space-y-3">
          {quizler.map((q) => {
            const d = denemeler.filter((x) => x.quiz_id === q.id)
            const toplamSoru = baglar.filter((b) => b.quiz_id === q.id).length
            const satirlar = quizSonuclari(ogrenciler, d, cevaplar.filter((c) => c.quiz_id === q.id), toplamSoru)
            const katilan = satirlar.filter((s) => s.deneme)
            const ortalama = katilan.length ? katilan.reduce((t, s) => t + (s.oran ?? 0), 0) / katilan.length : null
            const bitiren = d.filter((x) => x.bitti).length
            const acikMi = q.durum === 'acik'
            return (
              <li key={q.id} className={`cam-panel rounded-3xl p-5 space-y-3 ${acikMi ? 'ring-2 ring-pink-400/60' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold flex items-center gap-2">
                      {q.baslik}
                      {acikMi && <span className="nabiz text-[11px] font-bold text-rose-200 bg-rose-500/20 rounded-full px-2.5 py-0.5">● açık</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tarihSaat(q.basladi)} · {toplamSoru} soru · {q.sure_dk} dk
                      {q.sonuc_ogrenciye && ' · sonucu öğrenci görür'}
                    </p>
                  </div>
                  <div className="text-sm text-right">
                    <b>{bitiren}</b>
                    <span className="text-slate-400"> / {ogrenciler.length} bitirdi</span>
                    {!acikMi && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${renk(ortalama)}`} title="Girenlerin ortalaması">
                        {yuzde(ortalama)}
                      </span>
                    )}
                  </div>
                </div>

                {acikMi && (
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-950/60 border border-white/10 p-4">
                    <div>
                      <p className="text-xs text-slate-400">Öğrencilerin gireceği kod</p>
                      <p className="text-5xl font-mono font-extrabold tracking-widest renkli-yazi">{kodBicimle(q.kod)}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        <b className="text-slate-200">{kisaAdres()}</b> adresine girip kodu yazarlar.
                      </p>
                    </div>
                    <div className="text-sm text-slate-300">
                      <p>
                        <b className="text-lg text-white">{d.length}</b> başladı
                      </p>
                      <p>
                        <b className="text-lg text-white">{bitiren}</b> bitirdi
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button className="ikincil-buton" onClick={() => setPerde(q.id)}>
                        🖥️ Kodu perdede göster
                      </button>
                      <button className="parlak-buton rounded-full px-5 py-2 text-sm" onClick={() => kapat(q)}>
                        ⏹ Quizi bitir
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button className="ikincil-buton" onClick={() => setAcik(acik === q.id ? null : q.id)}>
                    {acik === q.id ? 'Sonuçları gizle' : 'Sonuçlar'}
                  </button>
                  <button className="tehlike-buton" onClick={() => sil(q)}>
                    Sil
                  </button>
                </div>

                {acik === q.id && (
                  <QuizDetay
                    ders={ders}
                    quiz={q}
                    satirlar={satirlar}
                    cevaplar={cevaplar.filter((c) => c.quiz_id === q.id)}
                    sorular={baglar.filter((b) => b.quiz_id === q.id).map((b) => soruHaritasi.get(b.question_id)).filter((s): s is Soru => !!s)}
                    yenile={yukle}
                    hataVer={setHata}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {perdedeki && perdedeki.durum === 'acik' && (
        <div className="fixed inset-0 z-50 bg-[#070a1f] flex flex-col items-center justify-center gap-6 p-6 text-center" onClick={() => setPerde(null)}>
          <p className="text-2xl text-slate-300">📝 {perdedeki.baslik}</p>
          <p className="text-[clamp(4rem,16vw,11rem)] leading-none font-mono font-extrabold tracking-widest renkli-yazi">{kodBicimle(perdedeki.kod)}</p>
          <p className="text-2xl lg:text-3xl text-slate-200">
            <b className="text-white">{kisaAdres()}</b> adresine gir, kodu ve öğrenci numaranı yaz.
          </p>
          <p className="text-lg text-slate-400">
            {denemeler.filter((x) => x.quiz_id === perdedeki.id).length} öğrenci başladı · süre {perdedeki.sure_dk} dakika
          </p>
          <p className="text-xs text-slate-600">Kapatmak için ekrana dokun</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function YeniQuiz({
  ders,
  sorular,
  ogrenciSayisi,
  hataVer,
  olustu,
}: {
  ders: Ders
  sorular: Soru[]
  ogrenciSayisi: number
  hataVer: (m: string | null) => void
  olustu: (id: string) => void
}) {
  const gruplar = useMemo(() => paketleriGrupla(sorular), [sorular])
  const [paket, setPaket] = useState('__hepsi')
  const [baslik, setBaslik] = useState('')
  const [sayi, setSayi] = useState('10')
  const [sure, setSure] = useState('10')
  const [karisik, setKarisik] = useState(true)
  const [sonuc, setSonuc] = useState(false)
  const [mesgul, setMesgul] = useState(false)

  const havuz = paket === '__hepsi' ? sorular : (gruplar.find((g) => (g.ad || '__paketsiz') === paket)?.sorular ?? [])
  const istenen = Math.max(1, Math.min(100, Math.floor(Number(sayi) || 0)))
  const secilecek = Math.min(istenen, havuz.length)

  async function baslat(e: React.FormEvent) {
    e.preventDefault()
    hataVer(null)
    if (secilecek === 0) return hataVer('Quiz için en az bir soru gerekir. Önce "Ders akışları" sekmesinden soru paketi yükle.')
    const sureDk = Math.max(1, Math.min(240, Math.floor(Number(sure) || 0)))
    let idler = havuz.map((s) => s.id)
    if (karisik) idler = karistir(idler)
    idler = idler.slice(0, secilecek)
    setMesgul(true)
    try {
      const { id } = await quizOlustur(ders.id, baslik.trim() || `Quiz ${new Date().toLocaleDateString('tr-TR')}`, sureDk, idler, sonuc)
      setBaslik('')
      olustu(id)
    } catch {
      hataVer('Quiz başlatılamadı. İnternet bağlantını kontrol edip tekrar dene.')
    }
    setMesgul(false)
  }

  return (
    <form onSubmit={baslat} className="cam-panel rounded-3xl p-5 space-y-4">
      <h2 className="font-extrabold text-lg">Yeni quiz</h2>
      {sorular.length === 0 ? (
        <p className="text-sm text-slate-400">Bu dersin soru bankası boş. "Ders akışları" sekmesinden bir ZOMR soru paketi yükle.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="text-slate-300">Başlık</span>
              <input className="giris-kutusu" maxLength={200} placeholder="ör. 3. hafta kısa quiz" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-slate-300">Sorular nereden?</span>
              <select className="giris-kutusu !py-2.5" value={paket} onChange={(e) => setPaket(e.target.value)}>
                <option value="__hepsi">Bütün sorular ({sorular.length})</option>
                {gruplar.map((g) => (
                  <option key={g.ad || '__paketsiz'} value={g.ad || '__paketsiz'}>
                    {g.ad || 'Paketsiz sorular'} ({g.sorular.length})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm space-y-1">
                <span className="text-slate-300">Soru sayısı</span>
                <input className="giris-kutusu !py-2.5" inputMode="numeric" value={sayi} onChange={(e) => setSayi(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-slate-300">Süre (dakika)</span>
                <input className="giris-kutusu !py-2.5" inputMode="numeric" value={sure} onChange={(e) => setSure(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-pink-500" checked={karisik} onChange={(e) => setKarisik(e.target.checked)} />
              Paketten rastgele seç (soru sayısı paketten azsa)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-pink-500" checked={sonuc} onChange={(e) => setSonuc(e.target.checked)} />
              Bitirince öğrenci kendi puanını görsün (kapalıysa yalnızca sen görürsün)
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={mesgul || secilecek === 0 || ogrenciSayisi === 0} className="parlak-buton rounded-full px-6 py-3 disabled:opacity-60">
              {mesgul ? 'Başlatılıyor…' : `🚀 ${secilecek} soruluk quizi başlat`}
            </button>
            {ogrenciSayisi === 0 && <span className="text-xs text-amber-300">Önce sınıf listesini yükle: öğrenciler numarasıyla girer.</span>}
          </div>
        </>
      )}
    </form>
  )
}

function QuizDetay({
  ders,
  quiz,
  satirlar,
  cevaplar,
  sorular,
  yenile,
  hataVer,
}: {
  ders: Ders
  quiz: Quiz
  satirlar: ReturnType<typeof quizSonuclari>
  cevaplar: QuizCevap[]
  sorular: Soru[]
  yenile: () => void
  hataVer: (m: string | null) => void
}) {
  const madde = useMemo(() => maddeAnalizi(cevaplar, sorular), [cevaplar, sorular])
  const sirali = useMemo(() => [...satirlar].sort((a, b) => Number(!!b.deneme) - Number(!!a.deneme) || (a.oran ?? 2) - (b.oran ?? 2)), [satirlar])

  async function hakVer(deneme: QuizDeneme) {
    if (!window.confirm('Bu öğrencinin denemesi silinecek; quiz açıksa yeniden çözebilir. Emin misin?')) return
    try {
      await denemeSil(deneme.id)
    } catch {
      hataVer('Deneme silinemedi.')
    }
    yenile()
  }

  return (
    <div className="space-y-5 pt-2 border-t border-white/10">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold flex-1">Öğrenci sonuçları</h3>
        <button className="ikincil-buton" onClick={() => quizSonucunuExceleAktar(ders, quiz, satirlar, madde)}>
          Excel'e aktar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="py-2 pr-3 font-semibold">Öğrenci</th>
              <th className="py-2 pr-3 font-semibold text-right">Doğru</th>
              <th className="py-2 pr-3 font-semibold text-center">Başarı</th>
              <th className="py-2 pr-3 font-semibold text-right">Süre</th>
              <th className="py-2 font-semibold text-right">Durum</th>
            </tr>
          </thead>
          <tbody>
            {sirali.map((s) => (
              <tr key={s.ogrenci.id} className="border-t border-white/5">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{s.ogrenci.ad_soyad}</span>
                  <span className="block text-xs font-mono text-slate-500">{s.ogrenci.ogrenci_no}</span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.deneme ? `${s.dogru} / ${s.toplam}` : '–'}</td>
                <td className="py-2 pr-3 text-center">
                  <span className={`inline-block min-w-12 rounded-full px-2 py-0.5 text-xs font-bold ${renk(s.oran)}`}>{yuzde(s.oran)}</span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-300">{s.sureDk === null ? '–' : `${s.sureDk} dk`}</td>
                <td className="py-2 text-right text-xs">
                  {!s.deneme ? (
                    <span className="text-slate-500">girmedi</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className={s.deneme.bitti ? 'text-emerald-300' : 'text-amber-300'}>{s.deneme.bitti ? 'bitirdi' : 'çözüyor'}</span>
                      <button className="text-slate-400 hover:text-white underline" onClick={() => hakVer(s.deneme as QuizDeneme)}>
                        yeniden hak ver
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Soru bazında başarı</h3>
        <p className="text-xs text-slate-400">En zor çıkan soru üstte. Çoğunun yanlış yaptığı sorular konuyu yeniden anlatmak için ipucudur.</p>
        <ul className="space-y-2">
          {madde.map((m, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate" title={m.soru}>
                  {m.soru}
                </span>
                <span className="text-xs text-slate-400">{m.cevaplayan} cevap</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${renk(m.oran)}`}>{yuzde(m.oran)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-pink-500 to-violet-500" style={{ width: `${Math.round((m.oran ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
