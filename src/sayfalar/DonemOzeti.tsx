import { useEffect, useMemo, useState } from 'react'
import type { Ders, Ogrenci, Oturum, Yoklama } from '../lib/tipler'
import { quizCevaplari, quizDenemeleri, quizleriGetir, quizSoruBaglari, type Quiz, type QuizCevap, type QuizDeneme, type QuizSoruBagi } from '../lib/quiz'
import { ozetHesapla, sampiyonlariHesapla, RISK_ESIGI } from '../lib/ozet'
import { oturumCevaplari, oturumKatilimlari } from '../lib/veri'
import type { CevapKaydi, KatilimKaydi } from '../lib/gelisim'
import { ozetiExceleAktar } from '../lib/rapor'
import { oturumAdi, tarih } from '../lib/bicim'

function yuzde(o: number | null): string {
  return o === null ? '–' : `%${Math.round(o * 100)}`
}

/** Şubenin dönem sonu özeti: hafta hafta katılım, öğrenci bazında devam (risk uyarısıyla) ve quiz sonuçları; Excel'e aktarılır. */
export default function DonemOzeti({ ders, ogrenciler, oturumlar, yoklamalar }: { ders: Ders; ogrenciler: Ogrenci[]; oturumlar: Oturum[]; yoklamalar: Yoklama[] }) {
  const [quizler, setQuizler] = useState<Quiz[]>([])
  const [denemeler, setDenemeler] = useState<QuizDeneme[]>([])
  const [cevaplar, setCevaplar] = useState<QuizCevap[]>([])
  const [baglar, setBaglar] = useState<QuizSoruBagi[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [yarisma, setYarisma] = useState<{ cevaplar: CevapKaydi[]; katilimlar: KatilimKaydi[] }>({ cevaplar: [], katilimlar: [] })
  const [sadeceRisk, setSadeceRisk] = useState(false)

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const q = await quizleriGetir(ders.id)
        const idler = q.map((x) => x.id)
        const [d, c, b] = await Promise.all([quizDenemeleri(idler), quizCevaplari(idler), quizSoruBaglari(idler)])
        if (iptal) return
        setQuizler(q)
        setDenemeler(d)
        setCevaplar(c)
        setBaglar(b)
      } catch {
        if (!iptal) setHata('Quiz sonuçları yüklenemedi; yoklama özeti yine de gösteriliyor.')
      }
    })()
    return () => {
      iptal = true
    }
  }, [ders.id])

  // Yarışma puanları şampiyonlar listesi için ayrıca yüklenir (başarısız olursa liste boş kalır)
  useEffect(() => {
    let iptal = false
    const idler = oturumlar.map((o) => o.id)
    if (idler.length === 0) return
    Promise.all([oturumCevaplari(idler), oturumKatilimlari(idler)])
      .then(([cevaplar, katilimlar]) => !iptal && setYarisma({ cevaplar, katilimlar }))
      .catch(() => {})
    return () => {
      iptal = true
    }
  }, [oturumlar])

  const ozet = useMemo(() => ozetHesapla(ogrenciler, oturumlar, yoklamalar, quizler, denemeler, cevaplar, baglar), [ogrenciler, oturumlar, yoklamalar, quizler, denemeler, cevaplar, baglar])
  const sampiyonlar = useMemo(() => sampiyonlariHesapla(ogrenciler, oturumlar, yarisma.cevaplar, yarisma.katilimlar), [ogrenciler, oturumlar, yarisma])
  const liste = useMemo(
    () => [...ozet.ogrenciler].filter((o) => !sadeceRisk || o.risk || o.sonDevamsiz).sort((a, b) => a.oran - b.oran || a.ogrenci.ogrenci_no.localeCompare(b.ogrenci.ogrenci_no, 'tr', { numeric: true })),
    [ozet.ogrenciler, sadeceRisk],
  )

  if (ozet.haftalar.length === 0) return <p className="text-sm text-slate-400">Henüz yoklaması alınmış bir ders yok. İlk yoklama alınınca özet burada görünür.</p>

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Yapılan ders', String(ozet.haftalar.length)],
          ['Ortalama katılım', yuzde(ozet.ortalamaKatilim)],
          ['Sınıf mevcudu', String(ogrenciler.length)],
          [`Risk altında (<%${Math.round(RISK_ESIGI * 100)})`, String(ozet.riskli)],
        ].map(([ad, deger]) => (
          <div key={ad} className="cam-panel rounded-2xl p-4 text-center">
            <p className="text-3xl font-display font-extrabold tabular-nums">{deger}</p>
            <p className="text-xs text-slate-400">{ad}</p>
          </div>
        ))}
      </div>

      <section className="cam-panel rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-bold flex-1">Hafta hafta katılım</h2>
          <button className="ikincil-buton !py-1.5 text-sm" onClick={() => ozetiExceleAktar(ders, ozet)}>
            📥 Excel'e aktar
          </button>
        </div>
        <ul className="space-y-1.5">
          {ozet.haftalar.map((h) => (
            <li key={h.oturum.id} className="flex items-center gap-3 text-sm">
              <span className="w-40 truncate text-slate-300">
                {tarih(h.oturum.basladi)} · {oturumAdi(h.oturum)}
              </span>
              <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${h.oran >= 0.8 ? 'bg-emerald-400' : h.oran >= 0.5 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.round(h.oran * 100)}%` }} />
              </div>
              <span className="w-24 text-right tabular-nums text-xs">
                {h.katilan} / {h.mevcut} ({yuzde(h.oran)})
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cam-panel rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-bold flex-1">Öğrenci devamı</h2>
          <label className="text-xs flex items-center gap-1.5">
            <input type="checkbox" className="accent-indigo-500" checked={sadeceRisk} onChange={(e) => setSadeceRisk(e.target.checked)} />
            Yalnızca dikkat gerekenler (risk ya da son iki derse gelmeyen)
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1 pr-3">No</th>
                <th className="pr-3">Ad Soyad</th>
                <th className="pr-3 text-right">Katıldığı</th>
                <th className="pr-3 text-right">Devam</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((o) => (
                <tr key={o.ogrenci.id} className="border-t border-white/5">
                  <td className="py-1 pr-3 font-mono text-xs">{o.ogrenci.ogrenci_no}</td>
                  <td className="pr-3">{o.ogrenci.ad_soyad}</td>
                  <td className="pr-3 text-right tabular-nums">
                    {o.katildigi} / {ozet.haftalar.length}
                  </td>
                  <td className="pr-3 text-right tabular-nums">{yuzde(o.oran)}</td>
                  <td className="text-xs">
                    {o.risk && <span className="text-rose-300 font-bold">⚠ risk </span>}
                    {o.sonDevamsiz && <span className="text-amber-300">son 2 derse gelmedi</span>}
                  </td>
                </tr>
              ))}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-400">
                    Dikkat gerektiren öğrenci yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {sampiyonlar.siralama.length > 0 && (
        <section className="cam-panel rounded-2xl p-4 space-y-3">
          <h2 className="font-bold">🏆 Dönemin şampiyonları</h2>
          <ol className="space-y-1 text-sm">
            {sampiyonlar.siralama.slice(0, 10).map((s, i) => (
              <li key={s.ogrenci.id} className="flex items-center gap-3">
                <span className="w-8 text-center">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <span className="flex-1 truncate">{s.ogrenci.ad_soyad}</span>
                <span className="text-xs text-slate-400">{s.ders} derste yarıştı · {s.dogru} doğru</span>
                <b className="w-20 text-right tabular-nums">{s.puan}</b>
              </li>
            ))}
          </ol>
          {sampiyonlar.haftalar.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300">Hafta hafta birinciler</h3>
              <ul className="flex flex-wrap gap-2 text-xs">
                {sampiyonlar.haftalar.map((h) => (
                  <li key={h.oturum.id} className="rounded-full bg-white/8 border border-white/10 px-3 py-1">
                    {tarih(h.oturum.basladi)} · <b>{h.ogrenci.ad_soyad}</b> ({h.puan})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-500">Puanlar yoklamada cihazı eşleşen öğrencilere bağlanır; elle var yazılan öğrencinin cevapları puana girmez.</p>
        </section>
      )}

      <section className="cam-panel rounded-2xl p-4 space-y-2">
        <h2 className="font-bold">Quizler</h2>
        {hata && <p className="text-xs text-rose-300">{hata}</p>}
        {ozet.quizler.length === 0 ? (
          <p className="text-sm text-slate-400">Bu şubede henüz quiz yapılmadı.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {ozet.quizler.map((q) => (
              <li key={q.quiz.id} className="flex items-center gap-3">
                <span className="flex-1 truncate">{q.quiz.baslik}</span>
                <span className="text-xs text-slate-400">{tarih(q.quiz.basladi)}</span>
                <span className="w-28 text-right text-xs tabular-nums">
                  {q.bitiren} / {ogrenciler.length} bitirdi
                </span>
                <b className="w-14 text-right tabular-nums">{yuzde(q.ortalama)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
