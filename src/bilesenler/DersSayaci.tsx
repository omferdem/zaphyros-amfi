import { useEffect, useState } from 'react'
import {
  SAYAC_BOS,
  bitisSaatindenSure,
  kalanSure,
  sayaciBaslat,
  sayaciDurdur,
  sayaciSifirla,
  sureEkle,
  sureMetni,
  type SayacDurumu,
} from '../lib/sayac'

const ANAHTAR = (oturum: string) => `amfi_sayac_${oturum}`
const HAZIR_SURELER = [10, 20, 30, 45, 50, 60]

function oku(oturum: string): SayacDurumu {
  try {
    const h = JSON.parse(localStorage.getItem(ANAHTAR(oturum)) ?? 'null') as SayacDurumu | null
    if (h && typeof h.toplamMs === 'number' && ['hazir', 'calisiyor', 'durdu', 'bitti'].includes(h.durum)) return h
  } catch {
    // Depolama kapalıysa varsayılan sayaçla başlanır
  }
  return SAYAC_BOS
}

/** Üç kısa uyarı sesi (kullanıcı sayfayla etkileşmişse çalar; çalmazsa görsel uyarı yeter). */
function uyariCal() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[0, 0.35, 0.7].forEach((gecikme) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.value = 0.2
      o.connect(g)
      g.connect(ctx.destination)
      o.start(ctx.currentTime + gecikme)
      o.stop(ctx.currentTime + gecikme + 0.22)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // Ses desteklenmiyorsa yalnızca görsel uyarı
  }
}

/**
 * Sahnenin araç çubuğundaki ders sayacı. Hoca süreyi dakika ya da bitiş saati olarak ayarlar; geri sayım
 * ders sonuna kadar sürer, bitince tam ekran uyarı çıkar ve ses çalar. Durum tarayıcıda saklanır.
 */
export default function DersSayaci({ oturum }: { oturum: string }) {
  const [s, setS] = useState<SayacDurumu>(() => oku(oturum))
  const [simdi, setSimdi] = useState(() => Date.now())
  const [acik, setAcik] = useState(false)
  const [dakika, setDakika] = useState('')
  const [saat, setSaat] = useState('')
  const [hata, setHata] = useState<string | null>(null)

  function guncelle(y: SayacDurumu) {
    setS(y)
    try {
      localStorage.setItem(ANAHTAR(oturum), JSON.stringify(y))
    } catch {
      // Depolama kapalıysa durum yalnızca bu açılışta tutulur
    }
  }

  useEffect(() => {
    const t = setInterval(() => setSimdi(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const kalan = kalanSure(s, simdi)

  // Çalışan sayaç sıfıra inince bitti olur ve uyarı sesi çalar
  useEffect(() => {
    if (s.durum === 'calisiyor' && kalan <= 0) {
      guncelle({ durum: 'bitti', toplamMs: s.toplamMs })
      uyariCal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.durum, kalan])

  function sureAyarla(ms: number) {
    setHata(null)
    guncelle({ durum: 'hazir', toplamMs: ms })
  }

  function dakikadanAyarla() {
    const n = Number(dakika.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0 || n > 600) return setHata('1 ile 600 arasında dakika yaz.')
    sureAyarla(Math.round(n * 60_000))
    setDakika('')
  }

  function saattenAyarla() {
    const ms = bitisSaatindenSure(saat, new Date())
    if (ms === null) return setHata('Bitiş saatini 10:40 gibi yaz; saat şimdiden sonra olmalı.')
    guncelle(sayaciBaslat({ durum: 'hazir', toplamMs: ms }, Date.now()))
    setSaat('')
    setAcik(false)
  }

  const calisiyor = s.durum === 'calisiyor'
  const ton = s.durum === 'bitti' || (calisiyor && kalan < 60_000) ? 'text-rose-300 animate-pulse' : calisiyor && kalan < 5 * 60_000 ? 'text-amber-300' : ''

  return (
    <>
      <div className="relative">
        <button className={`ikincil-buton tabular-nums ${ton}`} onClick={() => setAcik((a) => !a)} title="Ders sayacı">
          ⏱ {sureMetni(kalan)}
          {s.durum === 'durdu' && ' ⏸'}
        </button>
        {acik && (
          <div className="absolute right-0 top-full mt-2 z-50 w-72 cam-panel rounded-2xl p-4 space-y-3 text-left pop">
            <p className="text-sm font-bold">⏱ Ders sayacı</p>
            <div className="flex flex-wrap gap-1.5">
              {HAZIR_SURELER.map((d) => (
                <button key={d} className={`ikincil-buton !px-3 !py-1 text-xs ${s.toplamMs === d * 60_000 && !calisiyor ? 'ring-1 ring-indigo-300' : ''}`} onClick={() => sureAyarla(d * 60_000)} disabled={calisiyor}>
                  {d} dk
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="giris-kutusu !py-1.5 text-sm" inputMode="decimal" placeholder="dakika" value={dakika} onChange={(e) => setDakika(e.target.value)} disabled={calisiyor} />
              <button className="ikincil-buton !py-1.5 text-xs whitespace-nowrap" onClick={dakikadanAyarla} disabled={calisiyor || !dakika}>
                Ayarla
              </button>
            </div>
            <div className="flex gap-2">
              <input className="giris-kutusu !py-1.5 text-sm" placeholder="bitiş saati 10:40" value={saat} onChange={(e) => setSaat(e.target.value)} />
              <button className="ikincil-buton !py-1.5 text-xs whitespace-nowrap" onClick={saattenAyarla} disabled={!saat}>
                Başlat
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {calisiyor ? (
                <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" onClick={() => guncelle(sayaciDurdur(s, Date.now()))}>
                  Durdur
                </button>
              ) : (
                <button className="parlak-buton rounded-xl px-4 py-1.5 text-sm font-bold" onClick={() => guncelle(sayaciBaslat(s, Date.now()))}>
                  {s.durum === 'durdu' ? 'Devam' : 'Başlat'}
                </button>
              )}
              <button className="ikincil-buton !py-1.5 text-sm" onClick={() => guncelle(sureEkle(s, 5, Date.now()))}>
                +5 dk
              </button>
              <button className="ikincil-buton !py-1.5 text-sm" onClick={() => guncelle(sayaciSifirla(s))}>
                Sıfırla
              </button>
            </div>
            {hata && <p className="text-xs text-rose-300">{hata}</p>}
            <p className="text-[11px] text-slate-500">Süre bitince perdede uyarı çıkar ve ses çalar.</p>
          </div>
        )}
      </div>

      {s.durum === 'bitti' && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur flex items-center justify-center p-6">
          <div className="cam-panel rounded-[2rem] p-8 sm:p-12 text-center space-y-5 max-w-xl w-full pop">
            <p className="text-8xl nabiz" aria-hidden>
              ⏰
            </p>
            <p className="text-4xl font-display font-extrabold renkli-yazi pb-1">Süre doldu!</p>
            <p className="text-slate-300">Ders için ayrılan süre bitti.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                className="parlak-buton rounded-xl px-5 py-3 font-bold"
                onClick={() => guncelle(sureEkle(s, 5, Date.now()))}
              >
                +5 dakika
              </button>
              <button className="ikincil-buton" onClick={() => guncelle(sayaciSifirla(s))}>
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
