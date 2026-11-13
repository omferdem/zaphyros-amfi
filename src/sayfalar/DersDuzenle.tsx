import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Ders } from '../lib/tipler'
import { dersGetir } from '../lib/veri'
import DersAkislari from './DersAkislari'

/**
 * Ders içeriğini düzenleme merkezi (ders adının yanındaki "Düzenle" düğmesi): akışlar, sunum kitaplığı, soru
 * paketleri ve içerik paylaşımı bir arada. İçerik dönemden bağımsızdır; burada yapılan değişiklik dersin bütün
 * şubelerinde ve dönemlerinde geçerlidir. Sınıfa özel işler (oturum, liste, yoklama, quiz sonuçları) şube sayfasında kalır.
 */
export default function DersDuzenle() {
  const { dersId = '' } = useParams()
  const [ders, setDers] = useState<Ders | null | undefined>(undefined)

  useEffect(() => {
    dersGetir(dersId)
      .then(setDers)
      .catch(() => setDers(null))
  }, [dersId])

  if (ders === undefined) return <p className="text-sm text-slate-400">Yükleniyor…</p>
  if (ders === null)
    return (
      <p className="text-sm text-slate-400">
        Ders bulunamadı. <Link to="/panel" className="underline">Derslerime dön</Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to={`/panel/ders/${ders.id}`} className="text-xs text-slate-400 hover:text-white">
          ← {ders.ad}
          {ders.sube?.trim() ? ` · ${ders.sube.trim()}` : ''}
        </Link>
        <h1 className="text-2xl font-extrabold">✏️ {ders.ad}: ders içeriği</h1>
        <p className="text-sm text-slate-400">
          Akışlar, sunumlar, soru paketleri ve quiz soruları burada, bir arada. Buradaki değişiklik dersin bütün şubelerinde ve dönemlerinde
          geçerlidir.
        </p>
      </div>
      <DersAkislari ders={ders} />
    </div>
  )
}
