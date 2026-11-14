import { useState } from 'react'
import type { Donem, Icerik } from '../lib/tipler'
import { yedegiGeriYukle, yedegiOku, yedekOzeti, type SubeYedegi } from '../lib/subeYedegi'

/** Panelde: bir şube yedeği dosyasını (.amfi-yedek) seçilen döneme yeni şubeler olarak geri yükler. Var olan veriye dokunmaz. */
export default function YedektenYukle({ donemler, secili, icerikler, tamam }: { donemler: Donem[]; secili: string | null; icerikler: Icerik[]; tamam: () => void }) {
  const [yedek, setYedek] = useState<SubeYedegi | null>(null)
  const [donemId, setDonemId] = useState(secili ?? donemler[0]?.id ?? '')
  const [icerikId, setIcerikId] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function dosyaSecildi(d: File | undefined) {
    setHata(null)
    setBilgi(null)
    setYedek(null)
    if (!d) return
    try {
      const y = await yedegiOku(d)
      setYedek(y)
      const ad = y.subeler[0]?.ad
      setIcerikId(icerikler.find((i) => i.ad === ad)?.id ?? '')
      const donemAdi = y.subeler[0]?.donem
      const eslesen = donemler.find((x) => x.ad === donemAdi)
      if (eslesen) setDonemId(eslesen.id)
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Dosya okunamadı.')
    }
  }

  async function yukle() {
    if (!yedek || !donemId) return
    const o = yedekOzeti(yedek)
    if (!window.confirm(`${o.sube} şube, ${o.ogrenci} öğrenci, ${o.oturum} oturum ve ${o.yoklama} yoklama kaydı yeni şubeler olarak yüklenecek. Var olan hiçbir şey değişmez. Devam edilsin mi?`)) return
    setMesgul(true)
    setHata(null)
    try {
      const s = await yedegiGeriYukle(yedek, donemId, icerikId || null)
      setBilgi(`Yüklendi: ${s.sube} şube, ${s.ogrenci} öğrenci, ${s.oturum} oturum, ${s.yoklama} yoklama kaydı.`)
      setYedek(null)
      tamam()
    } catch {
      setHata('Yedek yüklenemedi. Bir kısmı yazılmış olabilir; dersler listesini kontrol edip tekrar dene.')
    }
    setMesgul(false)
  }

  if (donemler.length === 0) return null
  const o = yedek ? yedekOzeti(yedek) : null
  return (
    <details className="group">
      <summary className="ikincil-buton cursor-pointer list-none inline-block select-none">📥 Şube yedeğini geri yükle</summary>
      <section className="cam-panel rounded-2xl p-5 space-y-3 mt-3">
        <p className="text-sm text-slate-300">
          Daha önce aldığın ya da ders silerken kendiliğinden inen <b>.amfi-yedek</b> dosyasını seç. Sınıf listesi, oturumlar ve yoklamalar yeni şube olarak geri gelir.
          Ders içeriği (akış, sunum, soru) için "İçeriği paylaş, İçe aktar" ile .amfi paketini yükle.
        </p>
        <input type="file" accept=".amfi-yedek,.json,application/json" className="giris-kutusu text-sm" onChange={(e) => dosyaSecildi(e.target.files?.[0])} aria-label="Yedek dosyası" />
        {o && (
          <div className="space-y-3">
            <p className="text-sm">
              Dosyada: <b>{o.sube}</b> şube, <b>{o.ogrenci}</b> öğrenci, <b>{o.oturum}</b> oturum, <b>{o.yoklama}</b> yoklama kaydı.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300 space-y-1">
                <span className="block">Hangi döneme?</span>
                <select className="giris-kutusu text-sm" value={donemId} onChange={(e) => setDonemId(e.target.value)}>
                  {donemler.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.ad}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300 space-y-1">
                <span className="block">Ders içeriği</span>
                <select className="giris-kutusu text-sm" value={icerikId} onChange={(e) => setIcerikId(e.target.value)}>
                  <option value="">Yeni (boş) içerik aç</option>
                  {icerikler.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.ad}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold disabled:opacity-60" disabled={mesgul} onClick={yukle}>
              {mesgul ? 'Yükleniyor…' : 'Yedeği yükle'}
            </button>
          </div>
        )}
        {hata && <p className="text-sm text-rose-300">{hata}</p>}
        {bilgi && <p className="text-sm text-emerald-300">{bilgi}</p>}
      </section>
    </details>
  )
}
