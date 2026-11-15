import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Perdeden hızlı not: yazdıkça kendiliğinden şubenin not defterine kaydedilir (yeni bir not kartı olur).
 * Projeksiyonda öğrenciler görmesin diye "Perdeyi karart" seçilebilir: perde kararır, not kutusu görünür kalır;
 * telefonlardaki ders görüntüsü değişmez (öğrenciler son görüntüyü görmeye devam eder).
 */
export default function PerdeNotu({ dersId, baglam, kapat }: { dersId: string; baglam: string; kapat: () => void }) {
  const [metin, setMetin] = useState('')
  const [karart, setKarart] = useState(false)
  const [durum, setDurum] = useState<'bos' | 'kaydediliyor' | 'kayitli' | 'hata'>('bos')
  const notId = useRef<string | null>(null)
  const sayac = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sonMetin = useRef('')

  async function kaydet(m: string) {
    if (m.trim() === '') return
    setDurum('kaydediliyor')
    const icerik = notId.current ? m : `${baglam}\n${m}`.slice(0, 20000)
    if (notId.current) {
      const { error } = await supabase.from('notlar').update({ metin: `${baglam}\n${m}`.slice(0, 20000) }).eq('id', notId.current)
      setDurum(error ? 'hata' : 'kayitli')
      return
    }
    const { data, error } = await supabase.from('notlar').insert({ course_id: dersId, metin: icerik }).select('id').single()
    if (error || !data) {
      setDurum('hata')
      return
    }
    notId.current = data.id as string
    setDurum('kayitli')
  }

  useEffect(() => {
    if (metin === sonMetin.current) return
    sonMetin.current = metin
    if (sayac.current) clearTimeout(sayac.current)
    sayac.current = setTimeout(() => void kaydet(metin), 700)
    return () => {
      if (sayac.current) clearTimeout(sayac.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metin])

  return (
    <>
      {karart && <div className="fixed inset-0 z-[44] bg-black" aria-hidden />}
      <div className="fixed right-4 bottom-4 z-[45] w-[min(28rem,92vw)] cam-panel rounded-2xl p-3 space-y-2 shadow-2xl">
        <div className="flex items-center gap-2">
          <b className="text-sm flex-1">📓 Not</b>
          <label className="text-xs flex items-center gap-1 text-slate-300">
            <input type="checkbox" checked={karart} onChange={(e) => setKarart(e.target.checked)} /> Perdeyi karart
          </label>
          <button className="ikincil-buton !py-1 !px-2 text-xs" onClick={kapat}>
            Kapat
          </button>
        </div>
        <textarea
          autoFocus
          className="ze-input p-3 text-sm w-full"
          rows={5}
          placeholder="Notunu yaz; şubenin not defterine kendiliğinden kaydedilir…"
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
        />
        <p className="text-[11px] text-slate-400">{durum === 'kaydediliyor' ? 'Kaydediliyor…' : durum === 'kayitli' ? '✓ Not defterine kaydedildi' : durum === 'hata' ? 'Kaydedilemedi (internet?)' : baglam}</p>
      </div>
    </>
  )
}
