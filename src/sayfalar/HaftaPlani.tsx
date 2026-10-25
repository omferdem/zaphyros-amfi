import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Akis, Donem, PlanSatiri } from '../lib/tipler'
import { akisOlustur, akislariGetir } from '../lib/akis'
import { akislariSirala, haftaPlaniGetir, subeEtiketi, subeleriGetir, type DersSatiri } from '../lib/plan'
import { tarih } from '../lib/bicim'

/**
 * Bir dersin bir dönemdeki hafta planı: satırlar haftalar (akışlar), sütunlar şubeler.
 * Hangi şubede hangi hafta işlendi, yoklamaya kaç kişi katıldı; işlenmemiş haftayı oradan başlatabilirsin.
 */
export default function HaftaPlani() {
  const { donemId = '', icerikId = '' } = useParams()
  const [donem, setDonem] = useState<Donem | null | undefined>(undefined)
  const [icerikAdi, setIcerikAdi] = useState('')
  const [subeler, setSubeler] = useState<DersSatiri[]>([])
  const [akislar, setAkislar] = useState<Akis[]>([])
  const [plan, setPlan] = useState<PlanSatiri[]>([])
  const [yeniAd, setYeniAd] = useState('')
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    try {
      const [d, i, s, a, p] = await Promise.all([
        supabase.from('terms').select('id, ad, baslangic').eq('id', donemId).maybeSingle(),
        supabase.from('subjects').select('ad').eq('id', icerikId).maybeSingle(),
        subeleriGetir(donemId, icerikId),
        akislariGetir(icerikId),
        haftaPlaniGetir(donemId, icerikId),
      ])
      setDonem((d.data as Donem | null) ?? null)
      setIcerikAdi((i.data as { ad: string } | null)?.ad ?? '')
      setSubeler(s)
      setAkislar(a)
      setPlan(p)
    } catch {
      setHata('Hafta planı yüklenemedi.')
      setDonem(null)
    }
  }, [donemId, icerikId])

  useEffect(() => {
    yukle()
  }, [yukle])

  // (şube, akış) -> oturumlar, en yeni önce
  const oturumlar = useMemo(() => {
    const m = new Map<string, PlanSatiri[]>()
    for (const r of plan) {
      const k = `${r.course_id}:${r.lesson_id}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return m
  }, [plan])

  async function tasi(i: number, yon: -1 | 1) {
    const j = i + yon
    if (j < 0 || j >= akislar.length) return
    const yeni = [...akislar]
    ;[yeni[i], yeni[j]] = [yeni[j], yeni[i]]
    setAkislar(yeni)
    try {
      await akislariSirala(
        icerikId,
        yeni.map((a) => a.id),
      )
    } catch {
      setHata('Yeni sıra kaydedilemedi.')
      yukle()
    }
  }

  async function haftaEkle(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    try {
      await akisOlustur(icerikId, yeniAd || `${akislar.length + 1}. hafta`)
      setYeniAd('')
      yukle()
    } catch {
      setHata('Hafta eklenemedi.')
    }
  }

  if (donem === undefined) return <p className="text-sm text-slate-400">{hata ?? 'Yükleniyor…'}</p>
  if (donem === null || subeler.length === 0)
    return (
      <p className="text-sm text-slate-400">
        {hata ?? 'Bu dönemde bu dersin şubesi yok.'} <Link to="/panel" className="underline">Derslerime dön</Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <div>
        <Link to="/panel" className="text-xs text-slate-400 hover:text-white">
          ← Derslerim
        </Link>
        <p className="text-xs font-mono text-indigo-300 mt-3">{donem.ad}</p>
        <h1 className="text-2xl font-extrabold">{icerikAdi || subeler[0].ad} · hafta planı</h1>
        <p className="text-sm text-slate-400 mt-1">
          Satırlar haftalardır ve içerik her dönem ortaktır; sütunlar bu dönemdeki şubelerdir. Sırayı okla değiştirebilirsin.
        </p>
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <div className="cam-panel rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="p-3 w-10">#</th>
              <th className="p-3 min-w-56">Hafta</th>
              {subeler.map((s) => {
                const yapilan = akislar.filter((a) => oturumlar.has(`${s.id}:${a.id}`)).length
                return (
                  <th key={s.id} className="p-3 min-w-36">
                    <Link to={`/panel/ders/${s.id}`} className="font-bold text-slate-100 hover:underline">
                      {subeEtiketi(s.sube, subeler.length)}
                    </Link>
                    <div className="font-normal">
                      {s.students[0]?.count ?? 0} öğrenci · {yapilan}/{akislar.length}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {akislar.map((a, i) => (
              <tr key={a.id} className="border-t border-white/5 align-top">
                <td className="p-3 font-mono text-slate-500">{i + 1}</td>
                <td className="p-3">
                  <div className="flex items-start gap-2">
                    <Link to={`/panel/akis/${a.id}`} className="font-semibold hover:underline flex-1">
                      {a.ad}
                    </Link>
                    <span className="flex gap-1 shrink-0">
                      <button className="ikincil-buton !px-2 !py-0.5 text-xs" disabled={i === 0} onClick={() => tasi(i, -1)} aria-label="Yukarı taşı">
                        ↑
                      </button>
                      <button
                        className="ikincil-buton !px-2 !py-0.5 text-xs"
                        disabled={i === akislar.length - 1}
                        onClick={() => tasi(i, 1)}
                        aria-label="Aşağı taşı"
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                </td>
                {subeler.map((s) => {
                  const liste = oturumlar.get(`${s.id}:${a.id}`)
                  const son = liste?.[0]
                  return (
                    <td key={s.id} className="p-3">
                      {son ? (
                        <div className="space-y-1">
                          <Link to={`/panel/oturum/${son.oturum_id}`} className="block rounded-lg bg-emerald-500/10 text-emerald-200 px-2 py-1 hover:bg-emerald-500/20">
                            ✓ {tarih(son.basladi)}
                            <span className="text-xs text-emerald-300/80">
                              {' '}
                              · {son.katilan}/{son.mevcut}
                            </span>
                          </Link>
                          <Link to={`/panel/ders/${s.id}?akis=${a.id}`} className="text-xs text-slate-400 hover:text-white">
                            {liste.length > 1 ? `${liste.length} oturum · ` : ''}tekrar başlat
                          </Link>
                        </div>
                      ) : (
                        <Link to={`/panel/ders/${s.id}?akis=${a.id}`} className="ikincil-buton !py-1 text-xs inline-block">
                          Başlat
                        </Link>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {akislar.length === 0 && (
              <tr>
                <td colSpan={2 + subeler.length} className="p-4 text-slate-400">
                  Bu içerikte henüz hafta yok. Aşağıdan ilk haftayı ekle.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={haftaEkle} className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Hafta ekle</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            maxLength={200}
            className="giris-kutusu"
            placeholder={`${akislar.length + 1}. hafta: konu adı`}
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
          />
          <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold whitespace-nowrap">Hafta ekle</button>
        </div>
        <p className="text-xs text-slate-500">
          Haftanın adına tıklayarak sunumunu, slaytlarını ve sorularını düzenlersin. Yaptığın değişiklik dersin bütün şubelerinde ve gelecek
          dönemlerde de geçerlidir.
        </p>
      </form>
    </div>
  )
}
