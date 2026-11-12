import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sikildiSayisi, sikildiUyarisi, type SinifDurumu, type SinifKomutu, type SinifOlayi } from '../lib/sinif'

/**
 * Sınıf etkileşiminin hoca tarafı durumu. Sahne giriş yapmış hoca olarak anahtarsız çağırır ve veritabanı
 * değişikliklerini canlı izler; kumanda anahtarıyla çağırır ve birkaç saniyede bir sorar.
 */
export function useSinifDurumu(oturum: string, anahtar: string | null, etkin: boolean, canli: boolean) {
  const [d, setD] = useState<SinifDurumu | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const sonIstek = useRef(0)

  const yenile = useCallback(async () => {
    const n = ++sonIstek.current
    const { data, error } = await supabase.rpc('sinif_goster', { p_session: oturum, p_anahtar: anahtar })
    if (n !== sonIstek.current) return
    if (error || !data || (data as { hata?: string }).hata) return
    setD(data as SinifDurumu)
  }, [oturum, anahtar])

  useEffect(() => {
    if (!etkin) return
    yenile()
    const t = setInterval(yenile, canli ? 15000 : 4000)
    const kanal = canli
      ? supabase
          .channel(`sinif:${oturum}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sinif_olaylari', filter: `session_id=eq.${oturum}` }, () => yenile())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sinif_durum', filter: `session_id=eq.${oturum}` }, () => yenile())
          .subscribe()
      : null
    return () => {
      clearInterval(t)
      if (kanal) supabase.removeChannel(kanal)
    }
  }, [oturum, etkin, canli, yenile])

  const komut = useCallback(
    async (k: SinifKomutu, id?: string): Promise<{ secilen?: string; hata?: string }> => {
      setHata(null)
      const { data, error } = await supabase.rpc('sinif_komut', { p_session: oturum, p_anahtar: anahtar, p_komut: k, p_id: id ?? null })
      await yenile()
      const sonuc = (data ?? {}) as { secilen?: string; hata?: string }
      if (error || sonuc.hata === 'yetki_yok') setHata('Komut gönderilemedi.')
      else if (sonuc.hata === 'kimse_yok') setHata('Çekilecek kimse kalmadı.')
      else if (sonuc.hata === 'sinir') setHata('En fazla 3 çekiliş yapılabilir.')
      return sonuc
    },
    [oturum, anahtar, yenile],
  )

  return { d, komut, hata }
}

/** Seçilen kişi: çekilişte "cekildi" durumundaki sıkıldım kaydı */
function secilenKisi(d: SinifDurumu): SinifOlayi | undefined {
  return d.olaylar.find((o) => o.tur === 'sikildim' && o.durum === 'cekildi')
}

/**
 * Hocanın görüp yönettiği sınıf etkileşimi. mod 'perde': perdenin üstünde kenarlarda yüzen parmaklar, zarflar,
 * sıkıldım göstergesi ve tam ekran uyarı ile mola. mod 'kumanda': telefonda sıradan bir kart.
 */
export default function SinifPaneli({
  d,
  komut,
  hata,
  mod,
}: {
  d: SinifDurumu | null
  komut: (k: SinifKomutu, id?: string) => Promise<unknown>
  hata: string | null
  mod: 'perde' | 'kumanda'
}) {
  const [acikSoru, setAcikSoru] = useState<string | null>(null)
  const [susturulan, setSusturulan] = useState(false)
  const uyari = d ? sikildiUyarisi(d) : false

  // Uyarı yeniden çıkabilsin: sıkıldım sayısı eşiğin altına düşünce susturma kalkar
  useEffect(() => {
    if (!uyari) setSusturulan(false)
  }, [uyari])

  if (!d) return null
  const eller = d.olaylar.filter((o) => o.tur === 'el')
  const sorular = d.olaylar.filter((o) => o.tur === 'soru')
  const sikilan = sikildiSayisi(d)
  const secilen = secilenKisi(d)
  const soru = sorular.find((s) => s.id === acikSoru)
  const perde = mod === 'perde'

  const molaPaneli = d.mola && (
    <div className={perde ? 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-6' : ''}>
      <div className="cam-panel rounded-3xl p-6 sm:p-10 text-center space-y-4 max-w-2xl w-full girdi">
        <p className={`${perde ? 'text-8xl' : 'text-5xl'} suzul`} aria-hidden>
          {secilen ? '🎤' : '⏸️'}
        </p>
        <p className="text-sm font-mono uppercase tracking-widest text-slate-400">Mola · çekiliş {d.cekilis} / 3</p>
        {secilen ? (
          <>
            <p className={`${perde ? 'text-5xl sm:text-6xl' : 'text-3xl'} font-display font-extrabold renkli-yazi pb-2`}>{secilen.ad}</p>
            <p className="text-lg text-slate-200">fıkra anlatacak!</p>
          </>
        ) : (
          <p className="text-xl font-bold">Ders durdu. Sıkıldım diyenler arasından çekiliş yapılacak.</p>
        )}
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          {secilen && (
            <button className="parlak-buton rounded-xl px-5 py-3 font-bold" onClick={() => komut('cekilis_anlatti')}>
              Anlattı, derse dön
            </button>
          )}
          <button className="ikincil-buton" disabled={d.cekilis >= 3} onClick={() => komut('cekilis')}>
            {secilen ? `Kabul etmedi, yeniden çek (${d.cekilis}/3)` : '🎲 Çekiliş yap'}
          </button>
          <button className="ikincil-buton" onClick={() => komut('derse_don')}>
            Derse dön
          </button>
        </div>
        {hata && <p className="text-sm text-rose-300">{hata}</p>}
      </div>
    </div>
  )

  const uyariPaneli = uyari && !susturulan && (
    <div className={perde ? 'fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6' : ''}>
      <div className="cam-panel rounded-3xl p-6 sm:p-10 text-center space-y-4 max-w-xl w-full pop">
        <p className={`${perde ? 'text-9xl' : 'text-6xl'} nabiz`} aria-hidden>
          😵
        </p>
        <p className="text-2xl sm:text-3xl font-display font-extrabold">Sınıf sıkıldı!</p>
        <p className="text-slate-300">
          {d.katilan > 0 ? `${sikilan} / ${d.katilan} kişi` : `${sikilan} kişi`} sıkıldım dedi.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            className="parlak-buton rounded-xl px-5 py-3 font-bold"
            onClick={async () => {
              await komut('mola_ac')
              await komut('cekilis')
            }}
          >
            ⏸ Dersi durdur, çekiliş yap
          </button>
          <button className="ikincil-buton" onClick={() => setSusturulan(true)}>
            Devam et
          </button>
        </div>
      </div>
    </div>
  )

  const sorularPaneli = sorular.length > 0 && (
    <div className={perde ? 'fixed left-4 bottom-4 z-30 flex flex-col gap-2 items-start max-w-[40vw]' : 'space-y-2'}>
      {sorular.map((s) => (
        <button
          key={s.id}
          onClick={() => setAcikSoru(s.id)}
          className="pop flex items-center gap-2 rounded-2xl bg-sky-500/20 border border-sky-300/40 px-4 py-2 text-left hover:bg-sky-500/30"
        >
          <span className={perde ? 'text-3xl' : 'text-xl'} aria-hidden>
            ✉️
          </span>
          <span className="font-bold truncate">{s.ad}</span>
          {!perde && <span className="text-xs text-slate-300 truncate">{s.metin}</span>}
        </button>
      ))}
    </div>
  )

  const ellerPaneli = eller.length > 0 && (
    <div className={perde ? 'fixed right-4 top-24 z-30 flex flex-col gap-2 items-end' : 'space-y-2'}>
      {eller.map((o, i) => (
        <button
          key={o.id}
          onClick={() => komut('el_indir', o.id)}
          title="Söz verdim: eli indir"
          className="pop flex items-center gap-2 rounded-2xl bg-amber-400/20 border border-amber-300/50 px-4 py-2 hover:bg-amber-400/30"
        >
          <span className="text-xs font-mono text-amber-200">{i + 1}</span>
          <span className={perde ? 'text-3xl' : 'text-xl'} aria-hidden>
            ✋
          </span>
          <span className="font-bold">{o.ad}</span>
        </button>
      ))}
      {eller.length > 1 && (
        <button className="text-xs text-slate-400 hover:text-white" onClick={() => komut('eller_indir')}>
          Hepsini indir
        </button>
      )}
    </div>
  )

  const soruAyrinti = soru && (
    <div className={perde ? 'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-6' : 'cam-panel rounded-2xl p-4'}>
      <div className="cam-panel rounded-3xl p-6 sm:p-10 max-w-3xl w-full space-y-5 pop">
        <p className="text-sm text-sky-300 font-bold">✉️ {soru.ad} soruyor</p>
        <p className={`${perde ? 'text-3xl sm:text-4xl' : 'text-lg'} font-display font-extrabold leading-snug`}>{soru.metin}</p>
        <div className="flex gap-3">
          <button
            className="parlak-buton rounded-xl px-5 py-3 font-bold"
            onClick={() => {
              setAcikSoru(null)
              komut('soru_tamam', soru.id)
            }}
          >
            Cevaplandı
          </button>
          <button className="ikincil-buton" onClick={() => setAcikSoru(null)}>
            Sonra bakarım
          </button>
        </div>
      </div>
    </div>
  )

  const gosterge = (sikilan > 0 || d.mola) && !d.mola && (
    <div
      className={
        perde
          ? 'fixed left-1/2 -translate-x-1/2 bottom-4 z-30 rounded-full bg-fuchsia-500/20 border border-fuchsia-300/40 px-4 py-1.5 text-sm font-bold'
          : 'text-sm font-bold text-fuchsia-200'
      }
    >
      😮‍💨 {sikilan}
      {d.katilan > 0 ? ` / ${d.katilan}` : ''} sıkıldı
    </div>
  )

  if (!perde) {
    const bos = !eller.length && !sorular.length && !sikilan && !d.mola
    if (bos) return null
    return (
      <section className="cam-panel rounded-2xl p-4 space-y-3">
        <h2 className="font-bold text-sm">🙋 Sınıf</h2>
        {ellerPaneli}
        {sorularPaneli}
        {gosterge}
        {sikilan > 0 && !d.mola && (
          <button
            className="ikincil-buton !py-2 text-sm"
            onClick={async () => {
              await komut('mola_ac')
              await komut('cekilis')
            }}
          >
            ⏸ Durdur ve çekiliş yap
          </button>
        )}
        {molaPaneli}
        {uyariPaneli}
        {soruAyrinti}
        {hata && !d.mola && <p className="text-xs text-rose-300">{hata}</p>}
      </section>
    )
  }

  return (
    <>
      {ellerPaneli}
      {sorularPaneli}
      {gosterge}
      {uyariPaneli}
      {molaPaneli}
      {soruAyrinti}
    </>
  )
}
