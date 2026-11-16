import { useMemo } from 'react'
import { useOyunSesi } from '../lib/ses'
import Gorsel, { adIndeksi, arkaPlan } from './Gorsel'
import Konfeti from './Konfeti'
import type { SeritOyuncusu } from './EnerjiSeridi'

const STIL = `
@keyframes hy-vur-hoca { 0% { transform: translateX(-30vw) scale(.6) rotate(0); opacity: 0 } 40% { transform: translateX(0) scale(1.6) rotate(-12deg); opacity: 1 } 100% { transform: translateX(6vw) scale(1) ; opacity: 0 } }
@keyframes hy-vur-sinif { 0% { transform: translateX(30vw) scale(.6) rotate(0); opacity: 0 } 40% { transform: translateX(0) scale(1.6) rotate(12deg); opacity: 1 } 100% { transform: translateX(-6vw) scale(1); opacity: 0 } }
@keyframes hy-sars { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-12px) rotate(-3deg) } 60% { transform: translateX(10px) rotate(2deg) } }
@keyframes hy-don { 0% { transform: rotateX(90deg) scale(1.7); opacity: 0 } 100% { transform: none; opacity: 1 } }
`

/** En çok doğru cevabı olan beş öğrenci (hocayla yarışta sınıfın katkısı). */
export function enCokKatkiVerenler(oyuncular: SeritOyuncusu[], adet = 5): { ad: string; dogru: number; acilan: number }[] {
  return oyuncular
    .map((o) => ({ ad: o.ad, dogru: o.sonuc.filter((s) => s === 1).length, acilan: o.sonuc.filter((s) => s !== null).length }))
    .filter((o) => o.dogru > 0)
    .sort((a, b) => b.dogru - a.dogru || a.ad.localeCompare(b.ad, 'tr'))
    .slice(0, adet)
}

/**
 * Hocayla yarış büyük sahnesi: iki rakip, büyük skor, yumruk animasyonu. Yarış bitince "Sınıf hocayı yendi!" ya da
 * "Hoca bu sefer kazandı" ile sınıfa en çok katkı veren 5 öğrenci gösterilir.
 */
export function HocaYarisSahnesi({
  hoca,
  sinif,
  son,
  oynanan,
  toplam,
  oyuncular,
  bitti,
  kapat,
}: {
  hoca: number
  sinif: number
  son: { hoca_dogru: boolean; sinif_orani: number | null } | null
  oynanan: number
  toplam: number
  oyuncular: SeritOyuncusu[]
  bitti: boolean
  kapat: () => void
}) {
  useOyunSesi(oynanan, bitti, sinif >= hoca)
  const katki = useMemo(() => enCokKatkiVerenler(oyuncular), [oyuncular])
  const sonuc = sinif > hoca ? 'sinif' : sinif < hoca ? 'hoca' : 'berabere'
  const solVurdu = son && son.hoca_dogru
  const sinifPuanladi = !!son && son.sinif_orani !== null && son.sinif_orani >= 60
  const sagVurdu = sinifPuanladi

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={arkaPlan('arka-sahne.webp', 'linear-gradient(#1e1b4b, #0f172a)')}>
      <style>{STIL}</style>
      {bitti && sonuc === 'sinif' && <Konfeti />}
      <div className="flex items-center gap-3 px-5 pt-4">
        <h2 className="text-2xl font-display font-extrabold">🥊 Hocayla yarış</h2>
        <span className="text-sm text-slate-300 tabular-nums">
          Soru {oynanan} / {toplam}
        </span>
        <button className="ikincil-buton ml-auto !py-1.5 kucult-dugmesi" onClick={kapat}>
          {bitti ? 'Kapat' : 'Küçült'}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center gap-[3vw] px-6">
        <div className="text-center" style={{ animation: son && !son.hoca_dogru ? 'hy-sars 0.7s ease-in-out' : undefined }} key={`h-${hoca}-${sinif}-l`}>
          <Gorsel ad="hoca-yaris.webp" emoji="👨‍🏫" className="h-[30vh] max-w-[30vw] mx-auto" emojiClass="text-[10rem]" alt="Hoca" />
          <p className="font-display font-extrabold text-3xl mt-2">Hoca</p>
          <p key={`hs-${hoca}`} className="font-display font-extrabold tabular-nums text-[clamp(3rem,min(14vw,17vh),10rem)] leading-none text-amber-300" style={{ animation: 'hy-don 0.7s ease-out' }}>
            {hoca}
          </p>
        </div>
        <div className="relative w-[10vw] flex items-center justify-center">
          <span className="text-7xl opacity-80">⚡</span>
          {son && (
            <>
              {solVurdu && (
                <span key={`vl-${hoca}-${sinif}`} className="absolute text-7xl" style={{ animation: 'hy-vur-hoca 1.1s ease-out forwards' }} aria-hidden>
                  🥊
                </span>
              )}
              {sagVurdu && (
                <span key={`vr-${hoca}-${sinif}`} className="absolute text-7xl" style={{ animation: 'hy-vur-sinif 1.1s ease-out forwards' }} aria-hidden>
                  🥊
                </span>
              )}
            </>
          )}
        </div>
        <div className="text-center" style={{ animation: son && !sinifPuanladi ? 'hy-sars 0.7s ease-in-out' : undefined }} key={`s-${hoca}-${sinif}-r`}>
          <Gorsel ad="ogrenci-sinif.webp" emoji="🧑‍🎓" className="h-[30vh] max-w-[30vw] mx-auto" emojiClass="text-[10rem]" alt="Sınıf" />
          <p className="font-display font-extrabold text-3xl mt-2">Sınıf</p>
          <p key={`ss-${sinif}`} className="font-display font-extrabold tabular-nums text-[clamp(3rem,min(14vw,17vh),10rem)] leading-none text-emerald-300" style={{ animation: 'hy-don 0.7s ease-out' }}>
            {sinif}
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 text-center min-h-[5rem]">
        {son && !bitti && (
          <p className="text-xl">
            Hoca: <b className={son.hoca_dogru ? 'text-emerald-300' : 'text-rose-300'}>{son.hoca_dogru ? '✔ doğru bildi' : '✘ yanıldı'}</b>
            {son.sinif_orani !== null && (
              <>
                {' · '}Sınıf: <b>%{son.sinif_orani}</b>
              </>
            )}
          </p>
        )}
        {!son && !bitti && <p className="text-slate-400">Sonuç açılınca skor ve yumruk burada görünür.</p>}
      </div>

      {bitti && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
          <div className="cam-panel rounded-[2rem] p-8 text-center space-y-4 girdi w-[min(40rem,92vw)]">
            <p className="text-7xl">{sonuc === 'sinif' ? '🏆' : sonuc === 'hoca' ? '🥊' : '🤝'}</p>
            <p className="text-4xl font-display font-extrabold">{sonuc === 'sinif' ? 'Sınıf hocayı yendi!' : sonuc === 'hoca' ? 'Hoca bu sefer kazandı' : 'Berabere'}</p>
            <p className="text-3xl font-display font-extrabold tabular-nums">
              Hoca {hoca} <span className="text-slate-500">–</span> {sinif} Sınıf
            </p>
            {katki.length > 0 && (
              <div className="text-left space-y-1.5">
                <p className="text-sm font-bold text-slate-300 text-center">Sınıfa en çok katkı verenler</p>
                {katki.map((k, i) => (
                  <div key={`${k.ad}-${i}`} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5">
                    <span className="w-7 text-center text-lg">{['🥇', '🥈', '🥉', '4', '5'][i]}</span>
                    <Gorsel ad={`ogrenci-${adIndeksi(k.ad, 8)}.webp`} emoji="🧑" className="w-9 h-9" emojiClass="text-2xl" />
                    <span className="flex-1 font-bold truncate">{k.ad}</span>
                    <span className="tabular-nums text-emerald-300 font-bold">
                      {k.dogru} / {k.acilan} doğru
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
