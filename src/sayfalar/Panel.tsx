import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Ders, Icerik } from '../lib/tipler'
import { icerikSil } from '../lib/akis'

type DersSatiri = Ders & { students: { count: number }[] }

/** Hocanın ders listesi ve yeni ders formu */
export default function Panel() {
  const [dersler, setDersler] = useState<DersSatiri[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [form, setForm] = useState({ ad: '', kod: '', donem: '', icerik: '' })
  const [icerikler, setIcerikler] = useState<Icerik[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  async function yukle() {
    const { data, error } = await supabase
      .from('courses')
      .select('id, subject_id, ad, kod, donem, olusturuldu, students(count)')
      .order('olusturuldu', { ascending: false })
    if (error) setHata('Dersler yüklenemedi.')
    else setDersler(data as DersSatiri[])
    const { data: ic } = await supabase.from('subjects').select('id, ad').order('ad')
    setIcerikler((ic ?? []) as Icerik[])
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
      // Boşsa veritabanı dersin adıyla yeni bir içerik açar.
      subject_id: form.icerik || null,
    })
    setKaydediliyor(false)
    if (error) {
      setHata('Ders kaydedilemedi.')
      return
    }
    setForm({ ad: '', kod: '', donem: '', icerik: '' })
    yukle()
  }

  // Hiçbir döneme bağlı olmayan içerikler (dönemleri silinmiş ya da kullanılmamış)
  const kullanilmayan = icerikler.filter((i) => !dersler?.some((d) => d.subject_id === i.id))

  async function icerigiSil(i: Icerik) {
    if (!window.confirm(`"${i.ad}" içeriği, bütün akışları ve sunumlarıyla silinecek. Emin misin?`)) return
    setHata(null)
    try {
      await icerikSil(i.id)
    } catch {
      setHata('İçerik silinemedi.')
    }
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
                  {i.ad} içeriğini kullan (önceki dönemlerin akışları ve sunumları)
                </option>
              ))}
            </select>
          </label>
        )}
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

      {kullanilmayan.length > 0 && (
        <section className="cam-panel rounded-2xl p-5 space-y-2">
          <h2 className="font-bold">Hiçbir döneme bağlı olmayan içerikler</h2>
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
