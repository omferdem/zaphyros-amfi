import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Soru } from '../lib/tipler'
import { sorulariEkle, sorulariGetir } from '../lib/akis'
import { zomrOku } from '../lib/zomr'

const SURELER = [10, 15, 20, 30, 45, 60, 90, 120]

/** Ders içeriğinin soru bankası: ZOMR biçiminden içe aktarma, süre ayarı, silme. */
export default function SoruBankasi({ icerikId }: { icerikId: string }) {
  const [sorular, setSorular] = useState<Soru[] | null>(null)
  const [metin, setMetin] = useState('')
  const [sure, setSure] = useState(20)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
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

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]
    e.target.value = ''
    if (!dosya) return
    setMetin(await dosya.text())
  }

  async function ekle() {
    if (!onizleme?.sorular.length) return
    setMesgul(true)
    setHata(null)
    try {
      await sorulariEkle(icerikId, onizleme.sorular, sure)
      setMesaj(`${onizleme.sorular.length} soru bankaya eklendi.`)
      setMetin('')
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

  async function sil(s: Soru) {
    if (!window.confirm('Bu soru bankadan ve onu kullanan bütün akışlardan silinecek. Emin misin?')) return
    const { error } = await supabase.from('questions').delete().eq('id', s.id)
    if (error) setHata('Soru silinemedi.')
    yukle()
  }

  const gorunen = (sorular ?? []).filter((s) => !arama || s.soru.toLocaleLowerCase('tr').includes(arama.toLocaleLowerCase('tr')))

  return (
    <section className="cam-panel rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-bold">Soru bankası {sorular && <span className="text-slate-400 font-normal">({sorular.length})</span>}</h2>
        <p className="text-sm text-slate-400">
          Sorular ders içeriğine aittir, her yıl kullanılır. Bir akışa eklediğinde derste bilgi yarışması sorusu olarak
          çıkar; yalnızca sorulardan oluşan bir akışla slaytsız yarışma da yapabilirsin.
        </p>
      </div>

      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
      {mesaj && <p className="text-sm text-emerald-300">{mesaj}</p>}

      <div className="space-y-2">
        <p className="text-sm font-semibold">ZOMR biçiminden içe aktar</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="ikincil-buton cursor-pointer">
            .txt dosyası seç
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={dosyaSecildi} />
          </label>
          <span className="text-xs text-slate-500">ya da aşağıya yapıştır</span>
        </div>
        <textarea
          rows={5}
          className="giris-kutusu font-mono text-xs"
          placeholder={'#QUESTION:Sorunun metni?\n#CORRECT:Doğru cevap\n#WRONG:Yanlış cevap 1\n#WRONG:Yanlış cevap 2'}
          value={metin}
          onChange={(e) => {
            setMetin(e.target.value)
            setMesaj(null)
          }}
        />
        {onizleme && (
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
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
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  Cevap süresi
                  <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={sure} onChange={(e) => setSure(Number(e.target.value))}>
                    {SURELER.map((s) => (
                      <option key={s} value={s}>
                        {s} saniye
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={mesgul} className="parlak-buton rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60" onClick={ekle}>
                  Bankaya ekle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {sorular && sorular.length > 0 && (
        <div className="space-y-2">
          {sorular.length > 8 && (
            <input className="giris-kutusu" placeholder="Soruda ara" value={arama} onChange={(e) => setArama(e.target.value)} />
          )}
          <ol className="divide-y divide-white/5">
            {gorunen.map((s) => (
              <li key={s.id} className="py-2.5 flex gap-3 items-start text-sm">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{s.soru}</p>
                  <p className="text-xs mt-1">
                    <span className="text-emerald-300">✓ {s.dogru}</span>
                    <span className="text-slate-500"> · {s.yanlislar.join(' · ')}</span>
                  </p>
                </div>
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
                <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={() => sil(s)}>
                  Sil
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
