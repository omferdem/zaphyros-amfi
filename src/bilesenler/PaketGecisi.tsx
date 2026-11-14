import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sorulariGetir, sorulariGetirIdIle } from '../lib/akis'
import { paketleriGrupla } from '../lib/paket'
import { onerilenQuizSuresi, paketleriSirala } from '../lib/gecis'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { GRUPLU_OYUNLAR, GRUP_SAYILARI } from '../lib/oyunAc'
import type { Soru } from '../lib/tipler'
import {
  maddeAnalizi,
  quizCevaplari,
  quizDenemeleri,
  quizKapat,
  quizleriGetir,
  quizOlustur,
  quizSoruBaglari,
  type MaddeAnalizi,
  type Quiz,
  type QuizDeneme,
} from '../lib/quiz'

/** Perde üstünde açılan tam ekran kutu. */
function Kutu({ baslik, kapat, children }: { baslik: string; kapat?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4 girdi">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-display font-extrabold flex-1">{baslik}</h2>
          {kapat && (
            <button className="ikincil-buton !py-1" onClick={kapat}>
              Kapat
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  )
}

function useSorular(icerikId: string) {
  const [sorular, setSorular] = useState<Soru[] | null>(null)
  const [hata, setHata] = useState(false)
  useEffect(() => {
    sorulariGetir(icerikId)
      .then(setSorular)
      .catch(() => setHata(true))
  }, [icerikId])
  return { sorular, hata }
}

/** "Zapoot'a git": hafta hafta hazırlanmış paketlerden birini seç; seçilince canlı yarışma başlar. */
export function KahootSecici({
  icerikId,
  hafta,
  sec,
  kapat,
}: {
  icerikId: string
  hafta: number | null
  sec: (paketAdi: string, sorular: Soru[], mod: OyunAnahtari | null, grup: number | null) => Promise<void>
  kapat: () => void
}) {
  const { sorular, hata } = useSorular(icerikId)
  const [mesgul, setMesgul] = useState<string | null>(null)
  // undefined = her paketin önerilen modu (paketin ek bilgisindeki "mod"); yoksa bireysel
  const [mod, setMod] = useState<OyunAnahtari | null | undefined>(undefined)
  const [grup, setGrup] = useState<number>(3)
  const liste = useMemo(() => (sorular ? paketleriSirala(paketleriGrupla(sorular), 'kahoot', hafta) : []), [sorular, hafta])

  function onerilenMod(l: Soru[]): OyunAnahtari | null {
    const m = l[0]?.ek?.mod
    return m && m in OYUNLAR ? (m as OyunAnahtari) : null
  }
  function modu(l: Soru[]): OyunAnahtari | null {
    return mod === undefined ? onerilenMod(l) : mod
  }

  async function baslat(ad: string, l: Soru[]) {
    setMesgul(ad)
    try {
      await sec(ad, l, modu(l), GRUPLU_OYUNLAR.includes(modu(l) as OyunAnahtari) ? grup : null)
    } catch {
      window.alert('Zapoot açılamadı. Bağlantını kontrol edip tekrar dene.')
      setMesgul(null)
    }
  }

  return (
    <Kutu baslik="🎮 Zapoot'a git" kapat={kapat}>
      <p className="text-sm text-slate-300">Bir paket seç: sorular tek tek perdeye gelir, puan tablosu tutulur. Bitince “Derse dön” ile kaldığın slayttan devam edersin.</p>
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold text-slate-300">Nasıl oynansın?</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMod(undefined)}
            className={`rounded-full border px-3 py-1.5 text-sm ${mod === undefined ? 'border-emerald-300 bg-emerald-500/25 font-bold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            title="Her paket için hazırlanmış önerilen oyun modu kullanılır"
          >
            ✨ Önerilen
          </button>
          {([null, 'takim', 'halat', 'hoca', 'zombi', 'roket', 'ejderha', 'arena', 'kule', 'merdiven'] as (OyunAnahtari | null)[]).map((k) => (
            <button
              key={k ?? 'bireysel'}
              onClick={() => setMod(k)}
              className={`rounded-full border px-3 py-1.5 text-sm ${mod === k ? 'border-indigo-300 bg-indigo-500/25 font-bold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              title={k ? OYUNLAR[k].nasil : 'Herkes kendi adına yarışır; bireysel puan tablosu tutulur.'}
            >
              {k ? `${OYUNLAR[k].emoji} ${OYUNLAR[k].ad}` : '🧑 Bireysel'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {mod === undefined ? 'Her paket kendi önerilen modunda açılır (kartta yazar); istersen yukarıdan değiştir.' : mod ? OYUNLAR[mod].nasil : 'Herkes kendi adına yarışır; bireysel puan tablosu tutulur.'}
        </p>
        {mod && GRUPLU_OYUNLAR.includes(mod) && (
          <div className="space-y-1.5 pt-1">
            <h3 className="text-xs font-bold text-slate-300">Kaç grup olsun?</h3>
            <div className="flex flex-wrap gap-2">
              {GRUP_SAYILARI.map((n) => (
                <button
                  key={n}
                  onClick={() => setGrup(n)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${grup === n ? 'border-emerald-300 bg-emerald-500/25 font-bold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  {n} grup
                </button>
              ))}
              <button onClick={() => setMod(null)} className="rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm">
                🧑 Herkes bireysel
              </button>
            </div>
            <p className="text-xs text-slate-400">Öğrenciler telefonlarından grubunu seçer; puanlar grup bazında toplanır.</p>
          </div>
        )}
        {mod === 'halat' && <p className="text-xs text-slate-400">Halat çekme her zaman 2 takımdır.</p>}
      </div>
      {hata && <p className="text-rose-300 text-sm">Paketler yüklenemedi.</p>}
      {!sorular && !hata && <p className="text-slate-400 text-sm">Yükleniyor…</p>}
      {sorular && liste.length === 0 && <p className="text-slate-400 text-sm">Bu içerikte Zapoot paketi yok. Ders düzenleme sayfasından soru paketi ekleyebilirsin.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {liste.map((p) => (
          <li key={p.ad}>
            <button
              disabled={mesgul !== null}
              onClick={() => baslat(p.ad, p.sorular)}
              className={`w-full text-left rounded-2xl border p-3 transition ${p.onerilen ? 'border-emerald-300/60 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              <b className="block text-sm">{p.ad}</b>
              <span className="text-xs text-slate-400">
                {p.sorular.length} soru {p.onerilen && <span className="text-emerald-300 font-bold">· bu haftanın paketi</span>}
              </span>
              <span className="block text-xs text-fuchsia-300">{modu(p.sorular) ? `${OYUNLAR[modu(p.sorular) as OyunAnahtari].emoji} ${OYUNLAR[modu(p.sorular) as OyunAnahtari].ad}` : '🧑 Bireysel'}</span>
              {mesgul === p.ad && <span className="block text-xs text-indigo-300">Açılıyor…</span>}
            </button>
          </li>
        ))}
      </ul>
    </Kutu>
  )
}

function yuzde(o: number | null): string {
  return o === null ? '–' : `%${Math.round(o * 100)}`
}

function dakikaSn(ms: number): string {
  const sn = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`
}

/**
 * "Quize git": paket seç, süre ver, başlat. Derse girmiş öğrencilerin telefonunda "Quiz başladı" bandı çıkar (kod gerekmez).
 * Hoca bitirince sınıf sonuçları (katılım, ortalama, en zor sorular) perdede gösterilir; sonra ders akışına dönülür.
 */
export function QuizPaneli({
  dersId,
  icerikId,
  hafta,
  katilan,
  bitirSinyali = 0,
  kapat,
}: {
  dersId: string
  icerikId: string
  hafta: number | null
  katilan: number
  /** Her artışta açık quiz (onay sormadan) bitirilir; telefon kumandasından gelir. */
  bitirSinyali?: number
  kapat: () => void
}) {
  const { sorular, hata } = useSorular(icerikId)
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined)
  const [sonuc, setSonuc] = useState<{ quiz: Quiz; baslayan: number; bitiren: number; ortalama: number | null; maddeler: MaddeAnalizi[]; toplam: number } | null>(null)
  const [denemeler, setDenemeler] = useState<QuizDeneme[]>([])
  const [paket, setPaket] = useState<string>('')
  const [sure, setSure] = useState(10)
  const [mesgul, setMesgul] = useState(false)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [simdi, setSimdi] = useState(Date.now())

  const liste = useMemo(() => (sorular ? paketleriSirala(paketleriGrupla(sorular), 'quiz', hafta) : []), [sorular, hafta])
  const secili = liste.find((p) => p.ad === paket)

  // Açık quiz var mı? (sayfa yenilense de panel kaldığı yerden sürer)
  useEffect(() => {
    quizleriGetir(dersId)
      .then((q) => setQuiz(q.find((x) => x.durum === 'acik') ?? null))
      .catch(() => setQuiz(null))
  }, [dersId])

  useEffect(() => {
    if (!paket && liste.length > 0) {
      setPaket(liste[0].ad)
      setSure(onerilenQuizSuresi(liste[0].sorular.length))
    }
  }, [liste, paket])

  // Çalışırken ilerleme (3 saniyede bir)
  const ilerleme = useCallback(async () => {
    if (!quiz) return
    try {
      setDenemeler(await quizDenemeleri([quiz.id]))
    } catch {
      /* sonraki turda yeniden denenir */
    }
  }, [quiz])
  useEffect(() => {
    if (!quiz || quiz.durum !== 'acik') return
    ilerleme()
    const t = setInterval(ilerleme, 3000)
    const s = setInterval(() => setSimdi(Date.now()), 1000)
    return () => {
      clearInterval(t)
      clearInterval(s)
    }
  }, [quiz, ilerleme])

  async function baslat() {
    if (!secili) return
    setMesgul(true)
    setMesaj(null)
    try {
      const { id } = await quizOlustur(dersId, secili.ad.slice(0, 200), Math.max(1, Math.min(240, Math.floor(sure) || 10)), secili.sorular.map((s) => s.id), false)
      const q = (await quizleriGetir(dersId)).find((x) => x.id === id) ?? null
      setQuiz(q)
    } catch {
      setMesaj('Quiz başlatılamadı. Bağlantını kontrol edip tekrar dene.')
    }
    setMesgul(false)
  }

  async function bitir(onay = true) {
    if (!quiz) return
    if (onay && !window.confirm('Quiz bitirilsin mi? Çözmeyi bitirmeyenlerin cevapları da kapanır.')) return
    setMesgul(true)
    try {
      await quizKapat(quiz.id)
      const [d, c, b] = await Promise.all([quizDenemeleri([quiz.id]), quizCevaplari([quiz.id]), quizSoruBaglari([quiz.id])])
      const sorularQ = await sorulariGetirIdIle(b.map((x) => x.question_id))
      const toplam = sorularQ.length
      const dogruSayisi = new Map<string, number>()
      for (const x of c) if (x.dogru) dogruSayisi.set(x.student_id, (dogruSayisi.get(x.student_id) ?? 0) + 1)
      const oranlar = d.map((x) => (toplam ? (dogruSayisi.get(x.student_id) ?? 0) / toplam : 0))
      setSonuc({
        quiz,
        baslayan: d.length,
        bitiren: d.filter((x) => x.bitti).length,
        ortalama: oranlar.length ? oranlar.reduce((a, b2) => a + b2, 0) / oranlar.length : null,
        maddeler: maddeAnalizi(c, sorularQ),
        toplam,
      })
      setQuiz({ ...quiz, durum: 'kapali' })
    } catch {
      setMesaj('Quiz kapatılamadı. Bağlantını kontrol edip tekrar dene.')
    }
    setMesgul(false)
  }

  // Telefon kumandası "Quizi bitir" dediğinde (sinyal artınca) açık quiz bitirilir
  const sonSinyal = useRef(bitirSinyali)
  useEffect(() => {
    if (bitirSinyali !== sonSinyal.current) {
      sonSinyal.current = bitirSinyali
      if (quiz && quiz.durum === 'acik') void bitir(false)
    }
  })

  if (sonuc) {
    const zor = sonuc.maddeler.filter((m) => m.oran !== null).slice(0, 3)
    return (
      <Kutu baslik="📊 Quiz sonuçları" kapat={kapat}>
        <p className="text-sm text-slate-300">{sonuc.quiz.baslik}</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/5 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">{sonuc.baslayan}</b>
            <span className="block text-xs text-slate-400">katıldı</span>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">{sonuc.bitiren}</b>
            <span className="block text-xs text-slate-400">bitirdi</span>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">{yuzde(sonuc.ortalama)}</b>
            <span className="block text-xs text-slate-400">sınıf ortalaması</span>
          </div>
        </div>
        {zor.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-amber-200">En çok zorlanılan sorular</h3>
            <ul className="space-y-1.5">
              {zor.map((m) => (
                <li key={m.soru} className="rounded-xl bg-white/5 p-3 text-sm flex gap-3">
                  <b className="tabular-nums text-rose-200 w-12 shrink-0">{yuzde(m.oran)}</b>
                  <span>{m.soru.length > 220 ? `${m.soru.slice(0, 219)}…` : m.soru}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-slate-500">Öğrenci bazında sonuçlar ders sayfasındaki Quiz sekmesinde. Perdede isim gösterilmez.</p>
        <button className="parlak-buton rounded-xl px-6 py-2.5 font-bold" onClick={kapat}>
          Derse devam et
        </button>
      </Kutu>
    )
  }

  if (quiz === undefined) return <Kutu baslik="📝 Quize git" kapat={kapat}><p className="text-slate-400 text-sm">Yükleniyor…</p></Kutu>

  if (quiz && quiz.durum === 'acik') {
    const bitisMs = new Date(quiz.basladi).getTime() + quiz.sure_dk * 60000
    const baslayan = denemeler.length
    const bitiren = denemeler.filter((d) => d.bitti).length
    return (
      <Kutu baslik={`📝 ${quiz.baslik}`}>
        <p className="text-slate-300 text-sm">Derse girmiş öğrencilerin telefonunda “Quiz başladı” bandı çıktı; dokunup başlıyorlar. Yoklaması olmayanlar kodla girer.</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/5 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">{dakikaSn(bitisMs - simdi)}</b>
            <span className="block text-xs text-slate-400">kalan süre</span>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">
              {baslayan}
              {katilan > 0 && <span className="text-lg text-slate-400"> / {katilan}</span>}
            </b>
            <span className="block text-xs text-slate-400">başladı</span>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-4">
            <b className="text-4xl font-display font-extrabold tabular-nums">{bitiren}</b>
            <span className="block text-xs text-slate-400">bitirdi</span>
          </div>
        </div>
        <p className="text-center text-sm text-slate-300">
          Kod: <b className="font-mono text-2xl tracking-widest text-amber-200">{quiz.kod.slice(0, 3)} {quiz.kod.slice(3)}</b>
        </p>
        {mesaj && <p className="text-rose-300 text-sm">{mesaj}</p>}
        <div className="flex gap-3 flex-wrap">
          <button disabled={mesgul} className="parlak-buton rounded-xl px-6 py-2.5 font-bold" onClick={() => bitir()}>
            Quizi bitir ve sonuçları göster
          </button>
          <button className="ikincil-buton" onClick={kapat} title="Quiz arka planda sürer; ders slaytına dönebilirsin">
            Gizle (quiz sürsün)
          </button>
        </div>
      </Kutu>
    )
  }

  return (
    <Kutu baslik="📝 Quize git" kapat={kapat}>
      <p className="text-sm text-slate-300">Konu bitince ciddi quizi aç: her öğrenci kendi hızında çözer, doğru cevaplar telefonlara gitmez. Bitince sınıf sonuçları perdede açıklanır.</p>
      {hata && <p className="text-rose-300 text-sm">Paketler yüklenemedi.</p>}
      {sorular && liste.length === 0 && <p className="text-slate-400 text-sm">Bu içerikte soru paketi yok.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {liste.map((p) => (
          <li key={p.ad}>
            <button
              onClick={() => {
                setPaket(p.ad)
                setSure(onerilenQuizSuresi(p.sorular.length))
              }}
              className={`w-full text-left rounded-2xl border p-3 transition ${
                paket === p.ad ? 'border-indigo-300/70 bg-indigo-500/15' : p.onerilen ? 'border-emerald-300/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <b className="block text-sm">{p.ad}</b>
              <span className="text-xs text-slate-400">
                {p.sorular.length} soru {p.onerilen && <span className="text-emerald-300 font-bold">· bu haftanın paketi</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {mesaj && <p className="text-rose-300 text-sm">{mesaj}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-300 space-y-1">
          <span className="block">Süre (dakika)</span>
          <input className="giris-kutusu !py-1.5 !w-24 text-sm" type="number" min={1} max={240} value={sure} onChange={(e) => setSure(Number(e.target.value))} />
        </label>
        <button disabled={!secili || mesgul} className="parlak-buton rounded-xl px-6 py-2.5 font-bold" onClick={baslat}>
          {mesgul ? 'Başlatılıyor…' : 'Quizi başlat'}
        </button>
      </div>
    </Kutu>
  )
}
