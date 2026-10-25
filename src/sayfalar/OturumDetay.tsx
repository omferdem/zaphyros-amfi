import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Ders, Ogrenci, Oturum, PuanSatiri, Yoklama } from '../lib/tipler'
import { ogrencileriGetir, oturumGetir, oturumYoklamalari } from '../lib/veri'
import { oturumuExceleAktar, yarismayiExceleAktar } from '../lib/rapor'
import { dersEtiketi, oturumAdi, saat, tarihSaat } from '../lib/bicim'

/** Bir oturumun yoklama listesi: kim var, kim yok; hoca elle düzeltebilir. */
export default function OturumDetay() {
  const { oturumId = '' } = useParams()
  const [oturum, setOturum] = useState<(Oturum & { courses: Ders }) | null | undefined>(undefined)
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [yoklamalar, setYoklamalar] = useState<Yoklama[]>([])
  const [filtre, setFiltre] = useState<'hepsi' | 'var' | 'yok'>('hepsi')
  const [hata, setHata] = useState<string | null>(null)
  const [puanlar, setPuanlar] = useState<PuanSatiri[]>([])

  const yukle = useCallback(async () => {
    try {
      const o = await oturumGetir(oturumId)
      setOturum(o)
      if (!o) return
      const [og, y] = await Promise.all([ogrencileriGetir(o.course_id), oturumYoklamalari(o.id)])
      setOgrenciler(og)
      setYoklamalar(y)
      const { data: p } = await supabase.rpc('puan_tablosu', { p_session: o.id, p_limit: 1000 })
      setPuanlar((p as PuanSatiri[] | null) ?? [])
    } catch {
      setHata('Yoklama listesi yüklenemedi.')
    }
  }, [oturumId])

  useEffect(() => {
    yukle()
  }, [yukle])

  const kayit = useMemo(() => new Map(yoklamalar.map((y) => [y.student_id, y])), [yoklamalar])

  async function degistir(o: Ogrenci) {
    setHata(null)
    const { error } = kayit.has(o.id)
      ? await supabase.from('attendance').delete().eq('session_id', oturumId).eq('student_id', o.id)
      : await supabase.from('attendance').insert({ session_id: oturumId, student_id: o.id, yontem: 'elle' })
    if (error) setHata('Değişiklik kaydedilemedi.')
    yukle()
  }

  async function yoklamaDurumu(acik: boolean) {
    const { error } = await supabase
      .from('sessions')
      .update(acik ? { yoklama_acik: true, bitti: null } : { yoklama_acik: false })
      .eq('id', oturumId)
    if (error) setHata('Oturum güncellenemedi.')
    yukle()
  }

  if (oturum === undefined) return <p className="text-sm text-slate-400">{hata ?? 'Yükleniyor…'}</p>
  if (oturum === null)
    return (
      <p className="text-sm text-slate-400">
        Oturum bulunamadı. <Link to="/panel" className="underline">Derslerime dön</Link>
      </p>
    )

  const gorunen = ogrenciler.filter((o) => filtre === 'hepsi' || (filtre === 'var') === kayit.has(o.id))
  const acik = oturum.yoklama_acik && !oturum.bitti

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/panel/ders/${oturum.course_id}`} className="text-xs text-slate-400 hover:text-white">
          ← {dersEtiketi(oturum.courses)}{oturum.courses.donem ? ` · ${oturum.courses.donem}` : ''}
        </Link>
        <h1 className="text-2xl font-extrabold mt-3">{oturumAdi(oturum)}</h1>
        <p className="text-xs text-slate-400">{tarihSaat(oturum.basladi)}</p>
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <section className="cam-panel rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <p className="text-3xl font-extrabold">
          {yoklamalar.length}
          <span className="text-lg text-slate-400 font-semibold"> / {ogrenciler.length}</span>
        </p>
        <p className="text-sm text-slate-400 flex-1">
          {acik ? 'Yoklama açık, öğrenciler QR ile katılabilir.' : 'Yoklama kapalı.'}
        </p>
        <Link to={`/sahne/${oturum.id}`} className="ikincil-buton">
          Sahneyi aç
        </Link>
        <button className="ikincil-buton" onClick={() => yoklamaDurumu(!acik)}>
          {acik ? 'Yoklamayı kapat' : 'Yoklamayı yeniden aç'}
        </button>
        <button className="ikincil-buton" onClick={() => oturumuExceleAktar(oturum.courses, oturum, ogrenciler, yoklamalar)}>
          Excel'e aktar
        </button>
      </section>

      {puanlar.length > 0 && (
        <section className="cam-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-bold flex-1">Bilgi yarışması ({puanlar.length} kişi)</h2>
            <button className="ikincil-buton" onClick={() => yarismayiExceleAktar(oturum.courses, oturum, puanlar)}>
              Excel'e aktar
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {puanlar.map((p, i) => (
                <tr key={`${p.ad}-${i}`} className="border-t border-white/5">
                  <td className="py-1.5 w-10 font-mono text-slate-400">{p.sira}</td>
                  <td className="py-1.5">{p.ad}</td>
                  <td className="py-1.5 w-24 text-right font-mono">{p.puan}</td>
                  <td className="py-1.5 w-24 text-right text-xs text-slate-400">{p.dogru} doğru</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="cam-panel rounded-2xl p-5 space-y-3">
        <div className="flex gap-2 text-sm">
          {(['hepsi', 'var', 'yok'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`rounded-full px-3 py-1 ${filtre === f ? 'bg-indigo-500/30 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {f === 'hepsi' ? 'Hepsi' : f === 'var' ? 'Gelenler' : 'Gelmeyenler'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Telefonu olmayan ya da QR okutamayan öğrenciyi satırdaki düğmeyle elle ekleyebilirsin.</p>
        <table className="w-full text-sm">
          <tbody>
            {gorunen.map((o) => {
              const y = kayit.get(o.id)
              return (
                <tr key={o.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 font-mono text-slate-300 w-32">{o.ogrenci_no}</td>
                  <td className="py-1.5">{o.ad_soyad}</td>
                  <td className="py-1.5 text-xs text-slate-400 w-28">
                    {y && `${saat(y.zaman)} ${y.yontem === 'elle' ? '(elle)' : ''}`}
                  </td>
                  <td className="py-1.5 text-right w-24">
                    <button
                      onClick={() => degistir(o)}
                      className={`rounded-lg px-3 py-1 text-xs font-bold ${
                        y ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {y ? 'Var' : 'Yok'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
