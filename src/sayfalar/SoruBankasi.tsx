import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Soru } from '../lib/tipler'
import { adimlarEkle, akisOlustur, paketiSil, paketiYenidenAdlandir, soruPaketiniDegistir, sorulariEkle, sorulariGetir } from '../lib/akis'
import { otomatikSure, paketleriGrupla, type PaketGrubu } from '../lib/paket'
import SoruFormu, { type SoruDegisikligi } from '../bilesenler/SoruFormu'
import { zomrOku } from '../lib/zomr'

const SURELER = [10, 15, 20, 30, 45, 60, 90, 120]

/** "3. hafta sorulari.txt" -> "3. hafta sorulari" */
function dosyadanPaketAdi(ad: string): string {
  return ad.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()
}

function toplamSure(sorular: Soru[]): string {
  const sn = sorular.reduce((t, s) => t + s.sure_sn, 0)
  return sn >= 60 ? `yaklaşık ${Math.round(sn / 60)} dk` : `${sn} sn`
}

/** Ders içeriğinin soru bankası: soru paketleri (hafta ya da konu başına), ZOMR içe aktarma, yarışma akışı. */
export default function SoruBankasi({ icerikId }: { icerikId: string }) {
  const navigate = useNavigate()
  const [sorular, setSorular] = useState<Soru[] | null>(null)
  const [metin, setMetin] = useState('')
  const [paketAdi, setPaketAdi] = useState('')
  const [sure, setSure] = useState(20)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null)
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    try {
      setSorular(await sorulariGetir(icerikId))
    } catch {
      setHata('Sorular yüklenemedi.')
    }
  }, [icerikId])

  useEffect(() => {
    yukle()
  }, [yukle])

  const onizleme = useMemo(() => (metin.trim() ? zomrOku(metin) : null), [metin])
  const gruplar = useMemo(() => paketleriGrupla(sorular ?? []), [sorular])
  const paketAdlari = gruplar.filter((g) => g.ad).map((g) => g.ad)
  // Dosyada #PAKET satırı olan sorular kendi paketlerine girer (paket adı kutusu boşsa)
  const dosyadakiPaketler = useMemo(() => [...new Set((onizleme?.sorular ?? []).map((s) => s.ek.paket).filter(Boolean))], [onizleme])

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    setMetin(await dosya.text())
    if (!paketAdi.trim()) setPaketAdi(dosyadanPaketAdi(dosya.name))
  }

  async function ekle() {
    if (!onizleme?.sorular.length) return
    setMesgul(true)
    setHata(null)
    try {
      await sorulariEkle(icerikId, onizleme.sorular, sure, paketAdi)
      setMesaj(`${onizleme.sorular.length} soru ${paketAdi.trim() ? `"${paketAdi.trim()}" paketine` : 'bankaya'} eklendi.`)
      setMetin('')
      setPaketAdi('')
      await yukle()
    } catch {
      setHata('Sorular kaydedilemedi.')
    }
    setMesgul(false)
  }

  async function sureDegistir(s: Soru, yeni: number) {
    setSorular((l) => l?.map((x) => (x.id === s.id ? { ...x, sure_sn: yeni } : x)) ?? l)
    const { error } = await supabase.from('questions').update({ sure_sn: yeni }).eq('id', s.id)
    if (error) setHata('Süre kaydedilemedi.')
  }

  /** Düzenlenen sorunun metnini, şıklarını, süresini ve paketini kaydeder (diğer ek bilgiler korunur). */
  async function soruKaydet(s: Soru, d: SoruDegisikligi) {
    const { paket: _eski, ...kalan } = s.ek
    const { error } = await supabase
      .from('questions')
      .update({ soru: d.soru, dogru: d.dogru, yanlislar: d.yanlislar, sure_sn: d.sure_sn, ek: d.paket ? { ...kalan, paket: d.paket.slice(0, 80) } : kalan })
      .eq('id', s.id)
    if (error) throw error
    setDuzenlenen(null)
    await yukle()
  }

  /** Paketteki bütün sorulara aynı süreyi (sn) ya da her soruya uzunluğuna göre otomatik süre verir. */
  async function paketSuresi(g: PaketGrubu, sn: number | 'otomatik') {
    setMesgul(true)
    setHata(null)
    try {
      if (sn === 'otomatik') {
        for (const s of g.sorular) {
          const yeni = otomatikSure(s)
          if (yeni !== s.sure_sn) {
            const { error } = await supabase.from('questions').update({ sure_sn: yeni }).eq('id', s.id)
            if (error) throw error
          }
        }
      } else {
        const { error } = await supabase.from('questions').update({ sure_sn: sn }).in('id', g.sorular.map((s) => s.id))
        if (error) throw error
      }
      setMesaj(`${g.ad || 'Paketsiz'} paketindeki ${g.sorular.length} sorunun süresi ayarlandı.`)
    } catch {
      setHata('Süreler kaydedilemedi.')
    }
    setMesgul(false)
    yukle()
  }

  async function paketeTasi(s: Soru, ad: string) {
    try {
      await soruPaketiniDegistir(s, ad)
    } catch {
      setHata('Soru taşınamadı.')
    }
    yukle()
  }

  async function sil(s: Soru) {
    if (!window.confirm('Bu soru bankadan ve onu kullanan bütün akışlardan silinecek. Emin misin?')) return
    const { error } = await supabase.from('questions').delete().eq('id', s.id)
    if (error) setHata('Soru silinemedi.')
    yukle()
  }

  async function yenidenAdlandir(g: PaketGrubu) {
    const yeni = window.prompt('Paketin yeni adı:', g.ad)
    if (yeni === null || yeni.trim() === g.ad) return
    setMesgul(true)
    try {
      await paketiYenidenAdlandir(g.sorular, yeni)
    } catch {
      setHata('Paket yeniden adlandırılamadı.')
    }
    setMesgul(false)
    yukle()
  }

  async function paketiKaldir(g: PaketGrubu) {
    if (!window.confirm(`"${g.ad || 'Paketsiz'}" içindeki ${g.sorular.length} soru bankadan ve onları kullanan akışlardan silinecek. Emin misin?`)) return
    try {
      await paketiSil(g.sorular)
    } catch {
      setHata('Paket silinemedi.')
    }
    yukle()
  }

  /** Paketle yalnızca sorulardan oluşan yeni bir akış açar: slaytsız, Zapoot tarzı seri yarışma. */
  async function yarismaAkisiOlustur(g: PaketGrubu) {
    setMesgul(true)
    setHata(null)
    try {
      const akis = await akisOlustur(icerikId, `Yarışma: ${g.ad || 'Sorular'}`)
      await adimlarEkle(akis.id, 0, g.sorular.map((s) => ({ tur: 'soru' as const, question_id: s.id })))
      navigate(`/panel/akis/${akis.id}`)
    } catch {
      setHata('Yarışma akışı oluşturulamadı.')
      setMesgul(false)
    }
  }

  const aranan = arama.toLocaleLowerCase('tr')
  const gorunenGruplar = gruplar
    .map((g) => ({ ...g, sorular: g.sorular.filter((s) => !aranan || s.soru.toLocaleLowerCase('tr').includes(aranan)) }))
    .filter((g) => g.sorular.length > 0)

  return (
    <section className="cam-panel rounded-3xl p-5 space-y-5">
      <div>
        <h2 className="text-xl font-extrabold">🎯 Soru paketleri {sorular && <span className="text-slate-400 font-normal text-base">({sorular.length} soru)</span>}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Sorular ders içeriğine aittir, her yıl kullanılır. Her hafta ya da konu için bir <b>paket</b> yükle; paketi bir akışın
          sonuna ya da slaytların arasına tek tıkla ekleyebilir, istersen yalnızca paketten oluşan bir yarışma akışı açabilirsin.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3 text-sm">
        {[
          ['1', 'Paketi yükle', 'ZOMR dosyasını seç, paketine "3. hafta" gibi bir ad ver.'],
          ['2', 'Akışa ekle', 'Akış düzenleyicide paketi seç; sona ya da bir slaytın arkasına ekle.'],
          ['3', 'Derste oyna', 'Sorular perdede çıkar, öğrenciler telefondan cevaplar, puan hıza göre verilir.'],
        ].map(([no, baslik, acik]) => (
          <li key={no} className="rounded-2xl bg-white/5 border border-white/10 p-3 flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-linear-to-br from-pink-500 to-violet-500 flex items-center justify-center font-extrabold text-sm">
              {no}
            </span>
            <span>
              <b>{baslik}</b>
              <span className="block text-slate-400 text-xs mt-0.5">{acik}</span>
            </span>
          </li>
        ))}
      </ol>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
      {mesaj && <p className="text-sm text-emerald-300">{mesaj}</p>}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Yeni paket yükle (ZOMR biçimi)</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="ikincil-buton cursor-pointer">
            .txt dosyası seç
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={dosyaSecildi} />
          </label>
          <span className="text-xs text-slate-500">ya da aşağıya yapıştır</span>
        </div>
        <textarea
          rows={4}
          className="giris-kutusu font-mono text-xs"
          placeholder={'#QUESTION:Sorunun metni?\n#CORRECT:Doğru cevap\n#WRONG:Yanlış cevap 1\n#WRONG:Yanlış cevap 2'}
          value={metin}
          onChange={(e) => {
            setMetin(e.target.value)
            setMesaj(null)
          }}
        />
        {onizleme && (
          <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
            <p className="text-sm">
              <b>{onizleme.sorular.length}</b> soru okundu
              {onizleme.hatalar.length > 0 && <span className="text-amber-300">, {onizleme.hatalar.length} soru alınamadı</span>}.
            </p>
            {onizleme.hatalar.length > 0 && (
              <ul className="text-xs text-amber-300 list-disc pl-5">
                {onizleme.hatalar.slice(0, 10).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {onizleme.sorular.length > 0 && (
              <div className="flex flex-wrap gap-3 items-end">
                <label className="text-sm text-slate-300 space-y-1 flex-1 min-w-56">
                  <span className="block">Paket adı</span>
                  <input
                    list="paket-adlari"
                    className="giris-kutusu !py-2"
                    maxLength={80}
                    placeholder={dosyadakiPaketler.length ? `Boş bırakırsan dosyadaki: ${dosyadakiPaketler.join(', ')}` : 'ör. 3. hafta: Kötülük problemi'}
                    value={paketAdi}
                    onChange={(e) => setPaketAdi(e.target.value)}
                  />
                  <datalist id="paket-adlari">
                    {paketAdlari.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </label>
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  Cevap süresi
                  <select className="giris-kutusu !w-auto !py-2 text-sm" value={sure} onChange={(e) => setSure(Number(e.target.value))}>
                    {SURELER.map((s) => (
                      <option key={s} value={s}>
                        {s} saniye
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={mesgul} className="parlak-buton rounded-full px-5 py-2.5 text-sm disabled:opacity-60" onClick={ekle}>
                  Paketi yükle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {sorular && sorular.length > 0 && (
        <div className="space-y-3">
          {sorular.length > 8 && (
            <input className="giris-kutusu" placeholder="Sorularda ara" value={arama} onChange={(e) => setArama(e.target.value)} />
          )}
          {gorunenGruplar.map((g) => (
            <details key={g.ad || '__paketsiz'} open={gruplar.length <= 3 || !!arama} className="rounded-2xl bg-white/5 border border-white/10">
              <summary className="cursor-pointer list-none p-4 flex flex-wrap items-center gap-3">
                <span className="text-lg" aria-hidden>
                  {g.ad ? '📦' : '🗂️'}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="font-display text-lg">{g.ad || 'Paketsiz sorular'}</b>
                  <span className="block text-xs text-slate-400">
                    {g.sorular.length} soru · {toplamSure(g.sorular)}
                  </span>
                </span>
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button className="parlak-buton rounded-full px-4 py-2 text-sm disabled:opacity-60" disabled={mesgul} onClick={() => yarismaAkisiOlustur(g)}>
                    🚀 Yarışma akışı oluştur
                  </button>
                  {g.ad && (
                    <button className="ikincil-buton" disabled={mesgul} onClick={() => yenidenAdlandir(g)}>
                      Yeniden adlandır
                    </button>
                  )}
                  <select
                    aria-label="Paketteki bütün soruların süresi"
                    className="giris-kutusu !w-auto !py-1.5 !px-2 text-xs"
                    value=""
                    disabled={mesgul}
                    onChange={(e) => e.target.value && paketSuresi(g, e.target.value === 'otomatik' ? 'otomatik' : Number(e.target.value))}
                  >
                    <option value="">⏱ Süreleri ayarla…</option>
                    <option value="otomatik">Otomatik (soru uzunluğuna göre)</option>
                    {SURELER.map((x) => (
                      <option key={x} value={x}>
                        Hepsi {x} sn
                      </option>
                    ))}
                  </select>
                  <button className="tehlike-buton" disabled={mesgul} onClick={() => paketiKaldir(g)}>
                    Paketi sil
                  </button>
                </div>
                <ol className="divide-y divide-white/5">
                  {g.sorular.map((s) => (
                    <li key={s.id} className="py-2.5 flex flex-wrap gap-3 items-start text-sm">
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="whitespace-pre-line">{s.soru}</p>
                        <p className="text-xs mt-1">
                          <span className="text-emerald-300">✓ {s.dogru}</span>
                          <span className="text-slate-500"> · {s.yanlislar.join(' · ')}</span>
                        </p>
                      </div>
                      <select
                        aria-label="Paket"
                        className="giris-kutusu !w-auto !py-1 !px-2 text-xs max-w-40"
                        value={g.ad}
                        onChange={(e) => paketeTasi(s, e.target.value)}
                      >
                        <option value="">Paketsiz</option>
                        {paketAdlari.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Cevap süresi"
                        className="giris-kutusu !w-auto !py-1 !px-2 text-xs"
                        value={s.sure_sn}
                        onChange={(e) => sureDegistir(s, Number(e.target.value))}
                      >
                        {[...new Set([...SURELER, s.sure_sn])].sort((a, b) => a - b).map((x) => (
                          <option key={x} value={x}>
                            {x} sn
                          </option>
                        ))}
                      </select>
                      <button className="ikincil-buton !py-1 !px-2 text-xs" onClick={() => setDuzenlenen(duzenlenen === s.id ? null : s.id)}>
                        Düzenle
                      </button>
                      <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={() => sil(s)}>
                        Sil
                      </button>
                      {duzenlenen === s.id && (
                        <SoruFormu soru={s} paket={g.ad} paketAdlari={paketAdlari} kaydet={(d) => soruKaydet(s, d)} vazgec={() => setDuzenlenen(null)} />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
