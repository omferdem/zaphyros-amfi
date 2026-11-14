import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { GRUPLU_OYUNLAR, GRUP_SAYILARI } from '../lib/oyunAc'
import { adaGoreHafta, onerilenQuizSuresi, paketTuru } from '../lib/gecis'

interface Paket {
  ad: string
  sayi: number
  mod: string
}

type Bolum = null | 'oyun' | 'quiz'

const MODLAR: { anahtar: string; ad: string; nasil: string }[] = [
  { anahtar: 'oneri', ad: '✨ Önerilen', nasil: 'Her paketin hazırlanmış oyun modu kullanılır.' },
  { anahtar: '', ad: '🧑 Bireysel', nasil: 'Herkes kendi adına yarışır.' },
  ...(Object.keys(OYUNLAR) as OyunAnahtari[]).map((k) => ({ anahtar: k, ad: `${OYUNLAR[k].emoji} ${OYUNLAR[k].ad}`, nasil: OYUNLAR[k].nasil })),
]

/**
 * Kumandadan "Oyun / Zapoot başlat" ve "Quiz başlat". Telefonun hoca girişi yoktur; kumanda bir istek bırakır,
 * perdedeki sahne ekranı (hoca girişli) bunu uygular. Bu yüzden sahne ekranı açık olmalıdır.
 */
export default function KumandaBaslat({ oturum, anahtar }: { oturum: string; anahtar: string }) {
  const [bolum, setBolum] = useState<Bolum>(null)
  const [paketler, setPaketler] = useState<Paket[] | null>(null)
  const [mod, setMod] = useState('oneri')
  const [grup, setGrup] = useState(3)
  const [bilgi, setBilgi] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  async function ac(b: Exclude<Bolum, null>) {
    setBilgi(null)
    if (bolum === b) return setBolum(null)
    setBolum(b)
    if (!paketler) {
      const { data } = await supabase.rpc('kumanda_paketler', { p_session: oturum, p_anahtar: anahtar })
      const l = (data as { paketler?: Paket[] } | null)?.paketler
      setPaketler(l ?? [])
    }
  }

  async function istekGonder(istek: Record<string, unknown>, mesaj: string) {
    setMesgul(true)
    setBilgi(null)
    const { data, error } = await supabase.rpc('kumanda_istek', { p_session: oturum, p_anahtar: anahtar, p_istek: istek })
    setMesgul(false)
    if (error || (data as { hata?: string } | null)?.hata) {
      setBilgi('Gönderilemedi. Bağlantını kontrol edip tekrar dene.')
      return
    }
    setBilgi(`${mesaj} Perde (sahne) ekranı açık olmalı.`)
    setBolum(null)
  }

  const kahootlar = (paketler ?? []).filter((p) => paketTuru(p.ad) === 'kahoot').sort((a, b) => (adaGoreHafta(a.ad) ?? 99) - (adaGoreHafta(b.ad) ?? 99))
  const quizler = (paketler ?? []).slice().sort((a, b) => (adaGoreHafta(a.ad) ?? 99) - (adaGoreHafta(b.ad) ?? 99))

  return (
    <section className="cam-panel rounded-3xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button className={bolum === 'oyun' ? 'parlak-buton rounded-xl py-3 font-bold' : 'ikincil-buton !py-3'} onClick={() => ac('oyun')}>
          🎮 Oyun / Zapoot başlat
        </button>
        <button className={bolum === 'quiz' ? 'parlak-buton rounded-xl py-3 font-bold' : 'ikincil-buton !py-3'} onClick={() => ac('quiz')}>
          📝 Quiz başlat
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="ikincil-buton !py-2 text-sm" disabled={mesgul} onClick={() => istekGonder({ tur: 'derse_don' }, 'Derse dönülüyor.')}>
          ↩ Derse dön
        </button>
        <button className="ikincil-buton !py-2 text-sm" disabled={mesgul} onClick={() => istekGonder({ tur: 'quiz_bitir' }, 'Quiz bitiriliyor.')}>
          ⏹ Quizi bitir
        </button>
      </div>

      {bolum === 'oyun' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">Nasıl oynansın?</p>
            <div className="flex flex-wrap gap-1.5">
              {MODLAR.map((m) => (
                <button
                  key={m.anahtar || 'bireysel'}
                  onClick={() => setMod(m.anahtar)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${mod === m.anahtar ? 'border-indigo-300 bg-indigo-500/25 font-bold' : 'border-white/10 bg-white/5'}`}
                >
                  {m.ad}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">{MODLAR.find((m) => m.anahtar === mod)?.nasil}</p>
            {GRUPLU_OYUNLAR.includes(mod as OyunAnahtari) && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-300">Kaç grup?</p>
                <div className="flex flex-wrap gap-1.5">
                  {GRUP_SAYILARI.map((n) => (
                    <button key={n} onClick={() => setGrup(n)} className={`rounded-full border px-2.5 py-1 text-xs ${grup === n ? 'border-emerald-300 bg-emerald-500/25 font-bold' : 'border-white/10 bg-white/5'}`}>
                      {n} grup
                    </button>
                  ))}
                  <button onClick={() => setMod('')} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
                    🧑 Herkes bireysel
                  </button>
                </div>
              </div>
            )}
          </div>
          {!paketler && <p className="text-sm text-slate-400">Paketler yükleniyor…</p>}
          {paketler && kahootlar.length === 0 && <p className="text-sm text-slate-400">Bu içerikte Zapoot paketi yok.</p>}
          <ul className="space-y-1.5">
            {kahootlar.map((p) => (
              <li key={p.ad}>
                <button
                  disabled={mesgul}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 active:scale-[0.99]"
                  onClick={() => istekGonder({ tur: 'kahoot', paket: p.ad, mod, sure: GRUPLU_OYUNLAR.includes(mod as OyunAnahtari) ? grup : 0 }, `"${p.ad}" başlatılıyor.`)}
                >
                  <b className="block text-sm">{p.ad}</b>
                  <span className="text-xs text-slate-400">{p.sayi} soru</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bolum === 'quiz' && (
        <div className="space-y-2">
          {!paketler && <p className="text-sm text-slate-400">Paketler yükleniyor…</p>}
          {paketler && quizler.length === 0 && <p className="text-sm text-slate-400">Bu içerikte soru paketi yok.</p>}
          <ul className="space-y-1.5">
            {quizler.map((p) => (
              <li key={p.ad}>
                <button
                  disabled={mesgul}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-3 active:scale-[0.99]"
                  onClick={() => istekGonder({ tur: 'quiz', paket: p.ad, sure: onerilenQuizSuresi(p.sayi) }, `"${p.ad}" quizi başlatılıyor (${onerilenQuizSuresi(p.sayi)} dk).`)}
                >
                  <b className="block text-sm">{p.ad}</b>
                  <span className="text-xs text-slate-400">
                    {p.sayi} soru · {onerilenQuizSuresi(p.sayi)} dk
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bilgi && <p className="text-sm text-emerald-300">{bilgi}</p>}
    </section>
  )
}
