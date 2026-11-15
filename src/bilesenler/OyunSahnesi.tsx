import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import type { Adim } from '../lib/tipler'

/**
 * Akıştaki "oyun" adımının perde görünümü: oyunun adı, nasıl oynandığı ve "Oyunu başlat" düğmesi. Düğme ilgili
 * modu açar; oyun, sonraki soru adımlarında kendiliğinden işler.
 */
export default function OyunSahnesi({ adim, araclar, ac }: { adim: Adim; araclar: React.ReactNode; ac: (oyun: OyunAnahtari) => void }) {
  const anahtar = (adim.ayar.oyun ?? 'takim') as OyunAnahtari
  const o = OYUNLAR[anahtar] ?? OYUNLAR.takim

  return (
    <main className="min-h-screen p-6 flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="cam-panel rounded-2xl p-2">{araclar}</div>
      </div>
      <section className="flex-1 flex items-center justify-center">
        <div className="cam-panel rounded-[2rem] p-8 sm:p-12 max-w-3xl w-full text-center space-y-6 girdi">
          <p className="text-sm font-mono uppercase tracking-widest text-fuchsia-300">🎮 Bugünün oyunu</p>
          <p className="text-8xl suzul" aria-hidden>
            {o.emoji}
          </p>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold renkli-yazi pb-1">{adim.ayar.baslik || o.ad}</h1>
          <p className="text-lg text-slate-200 leading-relaxed">{adim.ayar.aciklama || o.nasil}</p>
          <div className="flex flex-col items-center gap-2">
            <button className="parlak-buton rounded-2xl px-8 py-4 text-xl font-bold" onClick={() => ac(anahtar)}>
              🚀 Oyunu başlat
            </button>
            <p className="text-xs text-slate-500">Paket ve soru sayısını seçersin; sorular oyunla birlikte kendiliğinden gelir.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
