import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Ders, Ogrenci, Oturum, Yoklama } from '../lib/tipler'
import { haftaYoklamasiAc } from '../lib/veri'

/**
 * Şubenin yoklama haftaları: hoca kaç yoklama (hafta ya da ders) alacağını belirler; derse girdiği haftanın yoklamasını açar,
 * öğrenciler karekodu okutur, sonra hoca akışa geçer. Yoklama akıştan bağımsızdır: bir akış iki hafta sürebilir.
 * Aynı haftanın yoklaması yeniden açılırsa yeni gelenler aynı yoklamaya yazılır.
 */
export default function YoklamaHaftalari({
  ders,
  ogrenciler,
  oturumlar,
  yoklamalar,
  yenile,
}: {
  ders: Ders
  ogrenciler: Ogrenci[]
  oturumlar: Oturum[]
  yoklamalar: Yoklama[]
  yenile: () => Promise<void>
}) {
  const navigate = useNavigate()
  const sayi = ders.yoklama_sayisi ?? 15
  const birim = ders.yoklama_birimi ?? 'hafta'
  const [yeniSayi, setYeniSayi] = useState(String(sayi))
  const [yeniBirim, setYeniBirim] = useState<'hafta' | 'ders'>(birim)
  const [telefonModu, setTelefonModu] = useState(false)
  const [mesgul, setMesgul] = useState<number | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [ayarAcik, setAyarAcik] = useState(false)

  const haftaOturumu = useMemo(() => new Map(oturumlar.filter((o) => o.hafta_no != null).map((o) => [o.hafta_no as number, o])), [oturumlar])
  const katilan = useMemo(() => {
    const m = new Map<string, number>()
    for (const y of yoklamalar) if (!y.baska_sube) m.set(y.session_id, (m.get(y.session_id) ?? 0) + 1)
    return m
  }, [yoklamalar])
  // Sıradaki hafta: yoklaması henüz açılmamış ilk hafta
  const siradaki = useMemo(() => {
    for (let n = 1; n <= sayi; n++) if (!haftaOturumu.has(n)) return n
    return null
  }, [sayi, haftaOturumu])

  async function ac(n: number) {
    if (ogrenciler.length === 0 && !window.confirm('Sınıf listesi boş; listede olmayan numaralar yoklamaya giremez. Yine de açılsın mı?')) return
    setMesgul(n)
    setHata(null)
    try {
      const id = await haftaYoklamasiAc(ders.id, n, birim, telefonModu)
      navigate(telefonModu ? `/kumanda?s=${id}` : `/sahne/${id}`)
    } catch {
      setHata('Yoklama açılamadı. Bağlantını kontrol edip tekrar dene.')
      setMesgul(null)
    }
  }

  async function ayarKaydet(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    const n = Math.round(Number(yeniSayi))
    if (!Number.isFinite(n) || n < 1 || n > 60) return setHata('Yoklama sayısı 1 ile 60 arasında olmalı.')
    const fazla = [...haftaOturumu.keys()].filter((h) => h > n)
    if (fazla.length > 0) return setHata(`${fazla.join(', ')}. ${birim} için yoklama alınmış; sayıyı bunların altına indiremezsin.`)
    const { error } = await supabase.from('courses').update({ yoklama_sayisi: n, yoklama_birimi: yeniBirim }).eq('id', ders.id)
    if (error) return setHata('Ayar kaydedilemedi.')
    setAyarAcik(false)
    await yenile()
  }

  const hafta = Array.from({ length: sayi }, (_, i) => i + 1)

  return (
    <section className="cam-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold flex-1">
          Yoklama {birim === 'ders' ? 'dersleri' : 'haftaları'} ({sayi})
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" className="accent-indigo-500" checked={telefonModu} onChange={(e) => setTelefonModu(e.target.checked)} />
          Projeksiyon yok (telefondan yönet)
        </label>
        <button className="ikincil-buton !py-1 text-xs" onClick={() => setAyarAcik((a) => !a)}>
          ⚙ Sayıyı ayarla
        </button>
      </div>
      <p className="text-sm text-slate-400">
        Derse girdiğin {birim === 'ders' ? 'dersin' : 'haftanın'} yoklamasını aç; öğrenciler karekodu okutup katılır, sonra sahneden akışı seçip derse
        geçersin. Yoklama akıştan bağımsızdır: bir akış iki hafta sürebilir. Aynı yoklamayı sonradan yeniden açarsan yeni gelenler de var yazılır.
      </p>
      {ayarAcik && (
        <form onSubmit={ayarKaydet} className="rounded-xl bg-slate-950/60 border border-white/5 p-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-300 space-y-1">
            <span className="block">Kaç yoklama?</span>
            <input className="giris-kutusu !py-1.5 !w-24 text-sm" type="number" min={1} max={60} value={yeniSayi} onChange={(e) => setYeniSayi(e.target.value)} />
          </label>
          <label className="text-xs text-slate-300 space-y-1">
            <span className="block">Birim</span>
            <select className="giris-kutusu !py-1.5 !w-auto text-sm" value={yeniBirim} onChange={(e) => setYeniBirim(e.target.value as 'hafta' | 'ders')}>
              <option value="hafta">Hafta (ör. 15 hafta)</option>
              <option value="ders">Ders (ör. 30 ders)</option>
            </select>
          </label>
          <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold">Kaydet</button>
        </form>
      )}
      {hata && <p className="text-sm text-rose-300">{hata}</p>}
      <ul className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {hafta.map((n) => {
          const o = haftaOturumu.get(n)
          const k = o ? (katilan.get(o.id) ?? 0) : 0
          const acik = !!o && o.yoklama_acik && !o.bitti
          return (
            <li
              key={n}
              className={`rounded-xl border p-3 space-y-2 ${
                acik ? 'border-emerald-300/50 bg-emerald-500/10' : n === siradaki ? 'border-indigo-300/60 bg-indigo-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-lg">{n}.</span>
                <span className="text-xs text-slate-400 flex-1">{birim === 'ders' ? 'ders' : 'hafta'}</span>
                {acik && <span className="text-[10px] font-bold text-emerald-300 nabiz">AÇIK</span>}
                {!o && n === siradaki && <span className="text-[10px] font-bold text-indigo-300">SIRADAKİ</span>}
              </div>
              {o ? (
                <p className="text-xs text-slate-300">
                  <b className="text-emerald-300">{k}</b> / {ogrenciler.length} katıldı
                </p>
              ) : (
                <p className="text-xs text-slate-500">Yoklama alınmadı</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button className={o ? 'ikincil-buton !py-1 !px-2 text-xs' : 'parlak-buton rounded-lg px-3 py-1 text-xs font-bold'} disabled={mesgul === n} onClick={() => ac(n)}>
                  {mesgul === n ? 'Açılıyor…' : o ? (acik ? 'Sahneye git' : 'Yeniden aç') : 'Yoklamayı aç'}
                </button>
                {o && (
                  <Link to={`/panel/oturum/${o.id}`} className="ikincil-buton !py-1 !px-2 text-xs">
                    Liste
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
