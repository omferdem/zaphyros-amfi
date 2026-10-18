import { useEffect, useState } from 'react'
import { baglantiyiDene } from '../lib/supabase'

type Durum = 'kontrol' | 'tamam' | 'hata'

export default function BaglantiGostergesi() {
  const [durum, setDurum] = useState<Durum>('kontrol')

  useEffect(() => {
    baglantiyiDene()
      .then((ok) => setDurum(ok ? 'tamam' : 'hata'))
      .catch(() => setDurum('hata'))
  }, [])

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title="Sunucu bağlantısı">
      <span
        className={`w-2 h-2 rounded-full ${
          durum === 'tamam' ? 'bg-emerald-400' : durum === 'hata' ? 'bg-rose-400' : 'bg-slate-500'
        }`}
      />
      <span className="text-slate-400">
        {durum === 'kontrol' && 'kontrol ediliyor…'}
        {durum === 'tamam' && 'sunucu bağlı'}
        {durum === 'hata' && 'sunucuya bağlanamadı'}
      </span>
    </span>
  )
}
