import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Ders } from '../lib/tipler'

type DersSatiri = Ders & { students: { count: number }[] }

/** Hocanın ders listesi ve yeni ders formu */
export default function Panel() {
  const [dersler, setDersler] = useState<DersSatiri[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [form, setForm] = useState({ ad: '', kod: '', donem: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  async function yukle() {
    const { data, error } = await supabase
      .from('courses')
      .select('id, ad, kod, donem, olusturuldu, students(count)')
      .order('olusturuldu', { ascending: false })
    if (error) setHata('Dersler yüklenemedi.')
    else setDersler(data as DersSatiri[])
  }

  useEffect(() => {
    yukle()
  }, [])

  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    setKaydediliyor(true)
    setHata(null)
    const { error } = await supabase.from('courses').insert({
      ad: form.ad.trim(),
      kod: form.kod.trim() || null,
      donem: form.donem.trim() || null,
    })
    setKaydediliyor(false)
    if (error) {
      setHata('Ders kaydedilemedi.')
      return
    }
    setForm({ ad: '', kod: '', donem: '' })
    yukle()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Derslerim</h1>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      {dersler === null ? (
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      ) : dersler.length === 0 ? (
        <p className="text-sm text-slate-400">Henüz ders yok. Aşağıdan ilk dersini ekle.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {dersler.map((d) => (
            <li key={d.id}>
              <Link
                to={`/panel/ders/${d.id}`}
                className="cam-panel rounded-2xl p-5 block hover:border-indigo-400/40 transition-colors"
              >
                <p className="text-xs font-mono text-indigo-300">{[d.kod, d.donem].filter(Boolean).join(' · ') || ' '}</p>
                <p className="text-lg font-bold mt-1">{d.ad}</p>
                <p className="text-xs text-slate-400 mt-2">{d.students[0]?.count ?? 0} öğrenci</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={ekle} className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Yeni ders</h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
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
          <input
            maxLength={40}
            className="giris-kutusu"
            placeholder="Dönem (ör. 2026 Güz)"
            value={form.donem}
            onChange={(e) => setForm({ ...form, donem: e.target.value })}
          />
        </div>
        <button disabled={kaydediliyor} className="parlak-buton rounded-xl px-5 py-2.5 font-bold disabled:opacity-60">
          Dersi ekle
        </button>
      </form>
    </div>
  )
}
