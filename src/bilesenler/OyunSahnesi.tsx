import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import type { Adim } from '../lib/tipler'
import OyunOnizleme from './OyunOnizleme'
import { AltSerit } from './PerdeKabugu'

/**
 * Akıştaki "oyun" adımının perde görünümü: oyunun gerçek sahnesi, örnek oyuncularla kendi kendine oynar
 * (derse katılan öğrencilerin adları varsa onlarla). Altta oyunun nasıl oynandığı ve "Oyunu başlat" düğmesi vardır.
 */
export default function OyunSahnesi({ adim, ac, adlar }: { adim: Adim; ac: (oyun: OyunAnahtari) => void; adlar: string[] }) {
  const anahtar = (adim.ayar.oyun ?? 'takim') as OyunAnahtari
  const o = OYUNLAR[anahtar] ?? OYUNLAR.takim

  return (
    <>
      <OyunOnizleme oyun={anahtar} adlar={adlar} demo />
      <AltSerit>
      <div className="cam-panel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-center gap-4 max-w-[96vw] w-[min(60rem,96vw)]">
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-xs font-mono uppercase tracking-widest text-fuchsia-300">🎮 Bugünün oyunu · örnek oynuyor</p>
          <p className="text-xl font-display font-extrabold truncate">
            {o.emoji} {adim.ayar.baslik || o.ad}
          </p>
          <p className="text-sm text-slate-300 leading-snug">{adim.ayar.aciklama || o.nasil}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button className="parlak-buton rounded-2xl px-7 py-3 text-lg font-bold" onClick={() => ac(anahtar)}>
            🚀 Oyunu başlat
          </button>
          <p className="text-[11px] text-slate-500">Paket, biçim ve soru sayısını seçersin.</p>
        </div>
      </div>
      </AltSerit>
    </>
  )
}
