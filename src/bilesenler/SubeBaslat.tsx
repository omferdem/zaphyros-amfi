import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { haftaYoklamasiAc } from '../lib/veri'

interface Durum {
  acikOturum: string | null
  acikHafta: number | null
  siradaki: number | null
  birim: 'hafta' | 'ders'
}

/**
 * Şube satırındaki tek dokunuşluk "Derse başla": açık bir ders varsa sahneye döner; yoksa şubenin sıradaki
 * yoklama haftasını açar (daha önce yoklaması alınmamış ilk hafta). Ayrıntılı yönetim için şube sayfası durur.
 */
export default function SubeBaslat({ dersId, sayi, birim }: { dersId: string; sayi: number; birim: 'hafta' | 'ders' }) {
  const gezin = useNavigate()
  const [durum, setDurum] = useState<Durum | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    let iptal = false
    supabase
      .from('sessions')
      .select('id, hafta_no, bitti, basladi')
      .eq('course_id', dersId)
      .order('basladi', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (iptal || !data) return
        const kullanilan = new Set(data.filter((o) => o.hafta_no != null).map((o) => o.hafta_no as number))
        const acik = data.find((o) => !o.bitti)
        let siradaki: number | null = null
        for (let n = 1; n <= sayi; n++) if (!kullanilan.has(n)) { siradaki = n; break }
        setDurum({ acikOturum: (acik?.id as string | undefined) ?? null, acikHafta: (acik?.hafta_no as number | null | undefined) ?? null, siradaki, birim })
      })
    return () => {
      iptal = true
    }
  }, [dersId, sayi, birim])

  async function basla() {
    if (!durum) return
    if (durum.acikOturum) return gezin(`/sahne/${durum.acikOturum}`)
    if (durum.siradaki === null) return setHata('Bütün yoklama haftaları alınmış. Şube sayfasından sayıyı artırabilir ya da bir haftayı yeniden açabilirsin.')
    if (!window.confirm(`${durum.siradaki}. ${birim} yoklaması açılsın mı?`)) return
    setMesgul(true)
    setHata(null)
    try {
      const id = await haftaYoklamasiAc(dersId, durum.siradaki, birim, false)
      gezin(`/sahne/${id}`)
    } catch {
      setHata('Yoklama açılamadı. Bağlantını kontrol et.')
      setMesgul(false)
    }
  }

  if (!durum) return null
  const etiket = durum.acikOturum ? `▶ Devam${durum.acikHafta ? ` (${durum.acikHafta}. ${birim})` : ''}` : durum.siradaki !== null ? `▶ ${durum.siradaki}. ${birim}i başlat` : null
  if (!etiket) return null
  return (
    <>
      <button
        className="rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-300/40 px-3 py-2 text-sm font-bold text-emerald-100 disabled:opacity-50"
        onClick={basla}
        disabled={mesgul}
        title={durum.acikOturum ? 'Açık dersin sahnesine dön' : 'Sıradaki yoklamayı aç ve sahneye geç'}
      >
        {mesgul ? 'Açılıyor…' : etiket}
      </button>
      {hata && <span className="text-xs text-rose-300 ml-2">{hata}</span>}
    </>
  )
}
