import { useMemo, useState } from 'react'
import type { Soru } from '../lib/tipler'
import { karistir, paketleriGrupla } from '../lib/paket'
import { sorulariEkle } from '../lib/akis'
import { zomrOku } from '../lib/zomr'

/**
 * Akışa soru paketi ekleme: pakette kaç soru olursa olsun tek seferde, sona, başa ya da seçilen adımın
 * (ör. bir slaytın) arkasına. İsteğe bağlı karıştırma ve soru sayısı sınırı. Yeni paket de buradan yüklenebilir.
 */
export default function SoruPaketiEkle({
  akisAdi,
  icerikId,
  sorular,
  adimEtiketleri,
  konum,
  setKonum,
  ekle,
  disabled,
}: {
  akisAdi: string
  icerikId: string
  sorular: Soru[]
  /** Akıştaki adımlar sırasıyla: konum seçimi için etiketleri */
  adimEtiketleri: { id: string; etiket: string }[]
  konum: string
  setKonum: (k: string) => void
  /** Soruları (id listesi) seçili konuma ekler */
  ekle: (idler: string[]) => Promise<void>
  disabled?: boolean
}) {
  const paketler = useMemo(() => {
    const l = paketleriGrupla(sorular).filter((g) => g.ad)
    const bu = akisAdi.trim().toLocaleLowerCase('tr')
    // Adı akışın adıyla aynı olan paket ("bu haftanın paketi") en üstte
    return [...l.filter((g) => g.ad.toLocaleLowerCase('tr') === bu), ...l.filter((g) => g.ad.toLocaleLowerCase('tr') !== bu)]
  }, [sorular, akisAdi])
  const [secili, setSecili] = useState('')
  const [karisik, setKarisik] = useState(false)
  const [adet, setAdet] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [metin, setMetin] = useState('')
  const [yeniAd, setYeniAd] = useState('')
  const [sure, setSure] = useState(20)
  const [yuklemeHata, setYuklemeHata] = useState<string | null>(null)

  const grup = paketler.find((g) => g.ad === (secili || paketler[0]?.ad))
  const sinir = Math.max(0, Math.floor(Number(adet) || 0))
  const eklenecek = grup ? (sinir > 0 ? Math.min(sinir, grup.sorular.length) : grup.sorular.length) : 0
  const onizleme = useMemo(() => (metin.trim() ? zomrOku(metin) : null), [metin])

  async function paketiEkle() {
    if (!grup) return
    setMesgul(true)
    let idler = grup.sorular.map((s) => s.id)
    if (karisik) idler = karistir(idler)
    if (sinir > 0) idler = idler.slice(0, sinir)
    await ekle(idler)
    setMesgul(false)
  }

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    setMetin(await dosya.text())
    if (!yeniAd.trim()) setYeniAd(akisAdi.trim() || dosya.name.replace(/\.[^.]+$/, ''))
  }

  async function yukleVeEkle() {
    if (!onizleme?.sorular.length) return
    setMesgul(true)
    setYuklemeHata(null)
    try {
      const idler = await sorulariEkle(icerikId, onizleme.sorular, sure, yeniAd || akisAdi)
      await ekle(idler)
      setMetin('')
      setYeniAd('')
    } catch {
      setYuklemeHata('Sorular yüklenemedi. Dosyayı ve internet bağlantını kontrol et.')
    }
    setMesgul(false)
  }

  return (
    <div className="rounded-2xl bg-slate-950/60 border border-white/10 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold">🎯 Soru paketi ekle (Kahoot tarzı yarışma)</p>
        <p className="text-xs text-slate-400 mt-1">
          Pakette ne kadar soru varsa hepsi arka arkaya perdeye gelir: her soru için süre, cevap dağılımı ve puan tablosu.
          Paketi akışın sonuna ya da bir slaytın arasına koyabilirsin.
        </p>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-slate-300">Nereye eklensin?</span>
        <select className="giris-kutusu !py-2 text-sm" value={konum} onChange={(e) => setKonum(e.target.value)} aria-label="Ekleme konumu">
          <option value="son">Akışın sonuna</option>
          <option value="bas">Akışın başına</option>
          {adimEtiketleri.map((a) => (
            <option key={a.id} value={`sonra:${a.id}`}>
              Şunun arkasına: {a.etiket}
            </option>
          ))}
        </select>
      </label>

      {paketler.length === 0 ? (
        <p className="text-sm text-slate-400">Henüz soru paketin yok. Aşağıdan bir ZOMR dosyası yükle; paket olarak kaydedilir ve akışa eklenir.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm space-y-1 flex-1 min-w-56">
              <span className="text-slate-300">Paket</span>
              <select className="giris-kutusu !py-2 text-sm" value={grup?.ad ?? ''} onChange={(e) => setSecili(e.target.value)} aria-label="Soru paketi">
                {paketler.map((g) => (
                  <option key={g.ad} value={g.ad}>
                    {g.ad} ({g.sorular.length} soru)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 w-32">
              <span className="text-slate-300">Soru sayısı</span>
              <input
                className="giris-kutusu !py-2 text-sm"
                inputMode="numeric"
                placeholder="hepsi"
                value={adet}
                onChange={(e) => setAdet(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
            </label>
            <label className="text-sm flex items-center gap-2 pb-2.5 cursor-pointer">
              <input type="checkbox" className="accent-pink-500" checked={karisik} onChange={(e) => setKarisik(e.target.checked)} />
              Sırayı karıştır
            </label>
          </div>
          <button
            className="parlak-buton rounded-full px-5 py-2.5 text-sm disabled:opacity-60"
            disabled={disabled || mesgul || !grup}
            onClick={paketiEkle}
          >
            {mesgul ? 'Ekleniyor…' : `${eklenecek} soruyu akışa ekle`}
          </button>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-slate-300 font-semibold">Yeni paket yükle ve doğrudan ekle</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="ikincil-buton cursor-pointer">
              ZOMR .txt dosyası seç
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={dosyaSecildi} />
            </label>
            <span className="text-xs text-slate-500">ya da yapıştır</span>
          </div>
          <textarea
            rows={4}
            className="giris-kutusu font-mono text-xs"
            placeholder={'#QUESTION:Sorunun metni?\n#CORRECT:Doğru cevap\n#WRONG:Yanlış cevap'}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
          />
          {onizleme && (
            <div className="space-y-3">
              <p>
                <b>{onizleme.sorular.length}</b> soru okundu
                {onizleme.hatalar.length > 0 && <span className="text-amber-300">, {onizleme.hatalar.length} soru alınamadı</span>}.
              </p>
              {onizleme.sorular.length > 0 && (
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="space-y-1 flex-1 min-w-48">
                    <span className="text-slate-300">Paket adı</span>
                    <input className="giris-kutusu !py-2 text-sm" maxLength={80} placeholder={akisAdi} value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-slate-300 block">Süre</span>
                    <select className="giris-kutusu !w-auto !py-2 text-sm" value={sure} onChange={(e) => setSure(Number(e.target.value))}>
                      {[10, 15, 20, 30, 45, 60, 90, 120].map((s) => (
                        <option key={s} value={s}>
                          {s} sn
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="parlak-buton rounded-full px-5 py-2.5 text-sm disabled:opacity-60" disabled={disabled || mesgul} onClick={yukleVeEkle}>
                    Yükle ve akışa ekle
                  </button>
                </div>
              )}
            </div>
          )}
          {yuklemeHata && <p className="text-rose-300">{yuklemeHata}</p>}
        </div>
      </details>
    </div>
  )
}
