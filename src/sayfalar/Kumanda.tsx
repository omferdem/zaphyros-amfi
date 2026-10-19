import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { DersDurumu } from '../lib/tipler'
import { oku, sakla } from '../lib/cihaz'

interface KumandaDurumu extends DersDurumu {
  katilan: number
  mevcut: number
  kod: { kod: string; kalan_ms: number } | null
  adimlar: { id: string; tur: 'yoklama' | 'slayt'; sunum: string | null; sayfa_no: number | null; ozet: string | null }[]
}

function anahtarYeri(oturum: string) {
  return `amfi_kumanda_${oturum}`
}

function ilkSatir(metin: string | null | undefined): string {
  return (metin ?? '').split('\n')[0] ?? ''
}

/**
 * Hocanın telefonundaki kumanda. Sahnedeki kumanda QR'ı okutularak açılır (giriş gerekmez);
 * telefonda hoca girişi yapılmışsa anahtar sunucudan da alınabilir.
 */
export default function Kumanda() {
  const [parametreler, setParametreler] = useSearchParams()
  const oturum = parametreler.get('s') ?? ''
  const [anahtar, setAnahtar] = useState<string | null | undefined>(undefined)
  const [durum, setDurum] = useState<KumandaDurumu | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)
  const [listeAcik, setListeAcik] = useState(false)

  // Anahtar: adresten gelir ve saklanır (adres çubuğundan silinir); yoksa saklanandan ya da hoca girişinden.
  useEffect(() => {
    if (!oturum) {
      setAnahtar(null)
      return
    }
    const adrestenGelen = parametreler.get('k')
    if (adrestenGelen) {
      sakla(anahtarYeri(oturum), adrestenGelen)
      setParametreler({ s: oturum }, { replace: true })
      setAnahtar(adrestenGelen)
      return
    }
    const kayitli = oku(anahtarYeri(oturum))
    if (kayitli) {
      setAnahtar(kayitli)
      return
    }
    supabase.rpc('kumanda_anahtari', { p_session: oturum }).then(({ data, error }) => {
      if (!error && typeof data === 'string') {
        sakla(anahtarYeri(oturum), data)
        setAnahtar(data)
      } else setAnahtar(null)
    })
  }, [oturum, parametreler, setParametreler])

  const yenile = useCallback(async () => {
    if (!anahtar) return
    const { data, error } = await supabase.rpc('kumanda_durumu', { p_session: oturum, p_anahtar: anahtar })
    if (error || !data) {
      setHata('Sunucuya ulaşılamadı.')
      return
    }
    const d = data as KumandaDurumu & { hata?: string }
    if (d.hata) {
      setHata('Bu kumanda kodu geçersiz. Sahnedeki Kumanda düğmesine basıp QR kodu yeniden okut.')
      setDurum(null)
      return
    }
    setHata(null)
    setDurum(d)
  }, [oturum, anahtar])

  // Durum: adım değişince veritabanının yayınından, ayrıca 5 saniyede bir (katılım sayısı ve kod için).
  useEffect(() => {
    if (!anahtar) return
    yenile()
    const kanal = supabase
      .channel(`oturum:${oturum}`)
      .on('broadcast', { event: 'durum' }, () => yenile())
      .subscribe()
    const t = setInterval(yenile, 5000)
    return () => {
      clearInterval(t)
      supabase.removeChannel(kanal)
    }
  }, [anahtar, oturum, yenile])

  async function komut(k: 'git' | 'yoklama_ac' | 'yoklama_kapat', adim?: string) {
    if (!anahtar || mesgul) return
    setMesgul(true)
    const { data, error } = await supabase.rpc('kumanda_komut', {
      p_session: oturum,
      p_anahtar: anahtar,
      p_komut: k,
      p_adim: adim ?? null,
    })
    setMesgul(false)
    if (error || (data as { hata?: string })?.hata) setHata('Komut gönderilemedi. Tekrar dene.')
    await yenile()
  }

  if (anahtar === undefined) return <Kabuk>Yükleniyor…</Kabuk>
  if (!oturum || anahtar === null)
    return (
      <Kabuk>
        <h1 className="text-xl font-extrabold">Kumanda</h1>
        <p className="text-sm text-slate-300">
          Sahne ekranındaki <b>Kumanda</b> düğmesine bas ve çıkan QR kodu bu telefonla okut.
        </p>
      </Kabuk>
    )
  if (!durum) return <Kabuk>{hata ?? 'Bağlanıyor…'}</Kabuk>

  const adimlar = durum.adimlar
  const sira = durum.adim ? durum.adim.sira - 1 : -1
  const onceki = adimlar[sira - 1]
  const sonraki = adimlar[sira + 1] ?? (sira < 0 ? adimlar[0] : undefined)

  return (
    <main className="min-h-screen p-4 flex flex-col gap-4 max-w-md mx-auto">
      <header>
        <p className="text-xs font-mono text-indigo-300">{durum.ders}</p>
        <h1 className="text-lg font-extrabold">{durum.baslik ?? 'Ders'}</h1>
      </header>

      {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}

      <section className="cam-panel rounded-3xl p-5 space-y-2 min-h-40">
        {durum.adim ? (
          <>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Adım {durum.adim.sira} / {durum.adim.toplam}
              {durum.adim.tur === 'slayt' && ` · ${durum.adim.sunum ?? ''} s. ${durum.adim.sayfa_no}`}
            </p>
            {durum.adim.tur === 'slayt' ? (
              <p className="text-sm whitespace-pre-line text-slate-200 max-h-48 overflow-auto">
                {durum.adim.metin?.trim() || 'Bu slaytta metin yok.'}
              </p>
            ) : (
              <p className="text-2xl font-extrabold">Yoklama</p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-300">{adimlar.length ? 'Henüz bir adım seçilmedi.' : 'Bu oturumda akış yok.'}</p>
        )}
      </section>

      {adimlar.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={!onceki || mesgul}
            onClick={() => komut('git', onceki?.id)}
            className="ikincil-buton !py-6 !text-lg disabled:opacity-40"
          >
            ◀ Önceki
          </button>
          <button
            disabled={!sonraki || mesgul}
            onClick={() => komut('git', sonraki?.id)}
            className="parlak-buton rounded-xl py-6 text-lg font-bold disabled:opacity-40"
          >
            Sonraki ▶
          </button>
        </div>
      )}

      <section className="cam-panel rounded-2xl p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-2xl font-extrabold tabular-nums">
            {durum.katilan}
            <span className="text-base text-slate-400 font-semibold"> / {durum.mevcut}</span>
          </p>
          <p className="text-xs text-slate-400">{durum.yoklama_acik ? 'Yoklama açık' : 'Yoklama kapalı'}</p>
        </div>
        <button className="ikincil-buton" disabled={mesgul} onClick={() => komut(durum.yoklama_acik ? 'yoklama_kapat' : 'yoklama_ac')}>
          {durum.yoklama_acik ? 'Yoklamayı kapat' : 'Yoklamayı aç'}
        </button>
      </section>

      {durum.kod && (
        <section className="cam-panel rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-400">Geç gelenler için ders kodu (dakikada bir değişir)</p>
          <p className="text-3xl font-mono font-extrabold tracking-widest">
            {durum.kod.kod.slice(0, 3)} {durum.kod.kod.slice(3)}
          </p>
        </section>
      )}

      {adimlar.length > 0 && (
        <section className="cam-panel rounded-2xl p-4 space-y-2">
          <button className="text-sm font-semibold w-full text-left" onClick={() => setListeAcik(!listeAcik)}>
            {listeAcik ? '▾' : '▸'} Bütün adımlar ({adimlar.length})
          </button>
          {listeAcik && (
            <ol className="divide-y divide-white/5">
              {adimlar.map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={() => komut('git', a.id)}
                    className={`w-full text-left py-2 flex gap-3 text-sm ${i === sira ? 'text-indigo-300 font-bold' : 'text-slate-300'}`}
                  >
                    <span className="w-6 text-right font-mono text-xs text-slate-500">{i + 1}</span>
                    <span className="truncate">
                      {a.tur === 'yoklama' ? 'Yoklama' : ilkSatir(a.ozet) || `${a.sunum ?? 'Slayt'} s. ${a.sayfa_no}`}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  )
}

function Kabuk({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-sm space-y-3 text-center text-slate-300">{children}</section>
    </main>
  )
}
