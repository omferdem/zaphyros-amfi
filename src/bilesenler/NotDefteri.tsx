import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tarihSaat } from '../lib/bicim'

interface Not {
  id: string
  metin: string
  guncellendi: string
}

/**
 * Not defteri: dersId verilirse o şubenin notları, verilmezse genel notlar. Her not ayrı bir kart; yazdıkça kendiliğinden
 * kaydedilir (durak: yazmayı bırakınca yarım saniye sonra). Yeni notlar en üstte görünür.
 */
export default function NotDefteri({ dersId = null, baslik }: { dersId?: string | null; baslik: string }) {
  const [notlar, setNotlar] = useState<Not[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [durum, setDurum] = useState<Record<string, 'kaydediliyor' | 'kayitli'>>({})
  const zamanlayici = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const yukle = useCallback(async () => {
    let q = supabase.from('notlar').select('id, metin, guncellendi').order('guncellendi', { ascending: false }).limit(300)
    q = dersId ? q.eq('course_id', dersId) : q.is('course_id', null)
    const { data, error } = await q
    if (error) {
      setHata('Notlar yüklenemedi. (Veritabanı güncellemesi henüz yapılmamış olabilir.)')
      setNotlar([])
      return
    }
    setNotlar(data as Not[])
  }, [dersId])

  useEffect(() => {
    void yukle()
    const t = zamanlayici.current
    return () => {
      for (const z of t.values()) clearTimeout(z)
    }
  }, [yukle])

  async function ekle() {
    setHata(null)
    const { data, error } = await supabase.from('notlar').insert({ course_id: dersId, metin: '' }).select('id, metin, guncellendi').single()
    if (error || !data) {
      setHata('Not eklenemedi.')
      return
    }
    setNotlar((l) => [data as Not, ...(l ?? [])])
  }

  function degisti(id: string, metin: string) {
    setNotlar((l) => (l ?? []).map((n) => (n.id === id ? { ...n, metin } : n)))
    setDurum((d) => ({ ...d, [id]: 'kaydediliyor' }))
    const eski = zamanlayici.current.get(id)
    if (eski) clearTimeout(eski)
    zamanlayici.current.set(
      id,
      setTimeout(async () => {
        const { data, error } = await supabase.from('notlar').update({ metin }).eq('id', id).select('guncellendi').single()
        if (error) setHata('Not kaydedilemedi. Bağlantını kontrol et.')
        else {
          setHata(null)
          setDurum((d) => ({ ...d, [id]: 'kayitli' }))
          setNotlar((l) => (l ?? []).map((n) => (n.id === id ? { ...n, guncellendi: (data as { guncellendi: string }).guncellendi } : n)))
        }
      }, 600),
    )
  }

  async function sil(n: Not) {
    if (n.metin.trim() && !window.confirm('Bu not silinsin mi?')) return
    const { error } = await supabase.from('notlar').delete().eq('id', n.id)
    if (error) return setHata('Not silinemedi.')
    setNotlar((l) => (l ?? []).filter((x) => x.id !== n.id))
  }

  return (
    <section className="cam-panel rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="font-bold flex-1">📓 {baslik}</h2>
        <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" onClick={ekle}>
          + Yeni not
        </button>
      </div>
      {hata && <p className="text-sm text-rose-300">{hata}</p>}
      {notlar === null && <p className="text-sm text-slate-400">Yükleniyor…</p>}
      {notlar && notlar.length === 0 && !hata && <p className="text-sm text-slate-400">Henüz not yok. "+ Yeni not" ile başla; yazdıkça kendiliğinden kaydedilir.</p>}
      <ul className="space-y-3">
        {(notlar ?? []).map((n) => (
          <li key={n.id} className="rounded-xl bg-slate-950/50 border border-white/10 p-3 space-y-2">
            <textarea
              className="giris-kutusu text-sm"
              rows={Math.min(14, Math.max(3, n.metin.split('\n').length + 1))}
              maxLength={20000}
              value={n.metin}
              placeholder="Notunu yaz…"
              onChange={(e) => degisti(n.id, e.target.value)}
              aria-label="Not metni"
            />
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{tarihSaat(n.guncellendi)}</span>
              <span className={durum[n.id] === 'kaydediliyor' ? 'text-amber-300' : 'text-emerald-400'}>{durum[n.id] === 'kaydediliyor' ? 'kaydediliyor…' : durum[n.id] === 'kayitli' ? '✓ kaydedildi' : ''}</span>
              <button className="ml-auto text-rose-300 hover:text-rose-200" onClick={() => sil(n)}>
                Sil
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
