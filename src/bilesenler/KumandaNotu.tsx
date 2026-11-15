import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Telefon kumandasından hızlı not: şubenin not defterine yeni bir kart olarak kaydedilir (kumanda anahtarıyla, hoca girişi gerekmez). */
export default function KumandaNotu({ oturum, anahtar }: { oturum: string; anahtar: string }) {
  const [metin, setMetin] = useState('')
  const [durum, setDurum] = useState<'bos' | 'kaydediliyor' | 'kayitli' | 'hata'>('bos')

  async function kaydet() {
    if (metin.trim() === '') return
    setDurum('kaydediliyor')
    const { data, error } = await supabase.rpc('kumanda_not_ekle', { p_session: oturum, p_anahtar: anahtar, p_metin: `${new Date().toLocaleString('tr-TR')}\n${metin}` })
    if (error || !(data as { durum?: string } | null)?.durum) {
      setDurum('hata')
      return
    }
    setMetin('')
    setDurum('kayitli')
  }

  return (
    <section className="cam-panel rounded-2xl p-4 space-y-2">
      <h3 className="text-xs font-bold text-slate-300">📓 Hızlı not</h3>
      <textarea className="ze-input p-3 text-sm w-full" rows={3} placeholder="Notunu yaz; şubenin not defterine eklenir…" value={metin} onChange={(e) => { setMetin(e.target.value); setDurum('bos') }} />
      <div className="flex items-center gap-2">
        <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" disabled={durum === 'kaydediliyor' || metin.trim() === ''} onClick={kaydet}>
          Kaydet
        </button>
        <span className="text-xs text-slate-400">{durum === 'kayitli' ? '✓ Not defterine eklendi' : durum === 'hata' ? 'Kaydedilemedi, tekrar dene' : ''}</span>
      </div>
    </section>
  )
}
