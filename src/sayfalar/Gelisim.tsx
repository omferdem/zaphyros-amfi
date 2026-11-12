import { useEffect, useMemo, useState } from 'react'
import type { Ders, Ogrenci, Oturum, Soru } from '../lib/tipler'
import { sorulariGetir } from '../lib/akis'
import { oturumCevaplari, oturumKatilimlari } from '../lib/veri'
import { quizCevaplari, quizleriGetir, type Quiz, type QuizCevap } from '../lib/quiz'
import { gelisimHesapla, type CevapKaydi, type KatilimKaydi, type Olcut } from '../lib/gelisim'
import { gelisimiExceleAktar } from '../lib/rapor'
import GelisimGorunumu, { OLCUTLER } from '../bilesenler/GelisimGorunumu'

type Kaynak = 'hepsi' | 'yarisma' | 'quiz'

/** Ders sayfasındaki "Gelişim" sekmesi: bilgi yarışması ve quiz cevaplarından öğrenci x konu başarısı. */
export default function Gelisim({ ders, ogrenciler, oturumlar }: { ders: Ders; ogrenciler: Ogrenci[]; oturumlar: Oturum[] }) {
  const [veri, setVeri] = useState<{ cevaplar: CevapKaydi[]; katilimlar: KatilimKaydi[]; sorular: Soru[]; quizler: Quiz[]; quizCevaplari: QuizCevap[] } | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [olcut, setOlcut] = useState<Olcut>('otomatik')
  const [kaynak, setKaynak] = useState<Kaynak>('hepsi')

  const oturumKimlikleri = useMemo(() => oturumlar.map((o) => o.id), [oturumlar])

  useEffect(() => {
    let iptal = false
    setVeri(null)
    ;(async () => {
      const quizler = await quizleriGetir(ders.id)
      const [cevaplar, katilimlar, sorular, qc] = await Promise.all([
        oturumCevaplari(oturumKimlikleri),
        oturumKatilimlari(oturumKimlikleri),
        sorulariGetir(ders.subject_id),
        quizCevaplari(quizler.map((q) => q.id)),
      ])
      if (!iptal) setVeri({ cevaplar, katilimlar, sorular, quizler, quizCevaplari: qc })
    })().catch(() => !iptal && setHata('Gelişim verisi yüklenemedi.'))
    return () => {
      iptal = true
    }
  }, [oturumKimlikleri, ders.id, ders.subject_id])

  const sonuc = useMemo(() => {
    if (!veri) return null
    const yarisma = kaynak !== 'quiz' ? veri.cevaplar.map((c) => ({ ...c, kaynak: 'yarisma' as const })) : []
    const quiz: CevapKaydi[] =
      kaynak !== 'yarisma'
        ? veri.quizCevaplari.map((c) => ({
            session_id: c.quiz_id,
            question_id: c.question_id,
            cihaz_id: '',
            student_id: c.student_id,
            dogru: c.dogru,
            puan: 0,
            sure_ms: 0,
            kaynak: 'quiz' as const,
          }))
        : []
    const zamanlar = [...oturumlar.map((o) => ({ id: o.id, basladi: o.basladi })), ...veri.quizler.map((q) => ({ id: q.id, basladi: q.basladi }))]
    return gelisimHesapla(ogrenciler, [...yarisma, ...quiz], veri.katilimlar, veri.sorular, zamanlar, olcut)
  }, [veri, ogrenciler, oturumlar, olcut, kaynak])

  if (hata) return <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>
  if (!sonuc) return <p className="text-sm text-slate-400">Yükleniyor…</p>

  const kaynakSecici = (
    <label className="text-sm space-y-1">
      <span className="text-slate-300 block">Kaynak</span>
      <select className="giris-kutusu !w-auto !py-2 text-sm" value={kaynak} onChange={(e) => setKaynak(e.target.value as Kaynak)}>
        <option value="hepsi">Yarışma ve quiz</option>
        <option value="yarisma">Yalnızca bilgi yarışması</option>
        <option value="quiz">Yalnızca habersiz quiz</option>
      </select>
    </label>
  )

  if (sonuc.toplamCevap === 0)
    return (
      <div className="space-y-4">
        {(veri?.cevaplar.length || veri?.quizCevaplari.length) ? kaynakSecici : null}
        <div className="cam-panel rounded-3xl p-6 space-y-3">
          <h2 className="text-lg font-extrabold">📈 Henüz izlenecek bir cevap yok</h2>
          <p className="text-sm text-slate-300">
            Bu şubede <b>habersiz quiz</b> yaptıkça ya da <b>yoklamalı</b> (öğrenci numarasıyla girilen) bir derste bilgi yarışması
            oynadıkça öğrencilerin konu konu başarısı burada görünür. Quiz öğrenci numarasıyla girildiği için her zaman izlenir;
            yarışmada takma adla oynayanlar izlenemez.
          </p>
          <p className="text-sm text-slate-400">Konu, sorudaki #OUTCOME (kazanım) ya da soru paketinin adından alınır.</p>
        </div>
      </div>
    )

  return (
    <GelisimGorunumu
      sonuc={sonuc}
      olcut={olcut}
      setOlcut={setOlcut}
      ustte={kaynakSecici}
      excel={() => gelisimiExceleAktar(ders, sonuc, OLCUTLER.find(([k]) => k === olcut)?.[1].split(' (')[0] ?? '')}
    />
  )
}
