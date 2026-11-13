import { useEffect, useState } from 'react'
import type { Adim, Soru } from '../lib/tipler'
import { SIKLAR } from '../lib/yarisma'

export type SimDurum = 'bekliyor' | 'acik' | 'kapandi' | 'sonuc'

export interface Sim {
  durum: SimDurum
  /** Kalan saniye; süresiz etkinlikte null */
  kalan: number | null
  /** Öğrencinin (sizin) yazdığı cevaplar */
  metinler: string[]
  secim: number | null
  taraf: number | null
  gerekce: string
}

export function etkilesimli(adim: Adim): boolean {
  return adim.tur === 'soru' || adim.tur === 'fikir' || adim.tur === 'oylama'
}

/** Etkinliğin cevap süresi (saniye): sorunun kendi süresi ya da etkinliğe verilen süre; yoksa null (hoca bitirir). */
export function simSuresi(adim: Adim, soru: Soru | undefined): number | null {
  if (adim.tur === 'soru') return soru?.sure_sn ?? 20
  return adim.ayar.sure_sn ?? null
}

export function ilkSim(): Sim {
  return { durum: 'bekliyor', kalan: null, metinler: [], secim: null, taraf: null, gerekce: '' }
}

/** Şıkları sabit sırayla dizer (perde ve telefon aynı sırayı görsün). */
export function siklariDiz(s: Soru): string[] {
  const k = [s.dogru, ...s.yanlislar]
  let h = 0
  for (let i = 0; i < s.id.length; i++) h = (h * 31 + s.id.charCodeAt(i)) >>> 0
  for (let i = k.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[k[i], k[j]] = [k[j], k[i]]
  }
  return k
}

/** Sınıfın yaklaşık dağılımı (önizleme için uydurma): doğru şık ~%55, kalan yanlışlara bölünür; sizin seçiminiz de eklenir. */
function dagilim(s: Soru, secim: number | null): number[] {
  const siklar = siklariDiz(s)
  const sinif = 24
  const dogruSayi = Math.round(sinif * 0.55)
  const yanlis = siklar.length - 1
  const sayilar = siklar.map((x) => (x === s.dogru ? dogruSayi : Math.floor((sinif - dogruSayi) / yanlis) + 1))
  if (secim !== null) sayilar[secim] += 1
  return sayilar
}

const ORNEK_CEVAPLAR = [
  'Akıl ve vahiy birbirini tamamlar bence.',
  'Bu konuda emin değilim, biraz daha okumalıyım.',
  'Felsefe soruyu sorar, din cevabı verir diye düşünüyorum.',
  'Örnek: günlük hayatta iman ve şüphe iç içe geçiyor.',
]
const ORNEK_KELIMELER = ['akıl', 'iman', 'vahiy', 'özgürlük', 'hakikat', 'şüphe']

/** Hoca kontrol çubuğu: etkinliği aç, süreyi bitir, cevapları yansıt, yeniden dene. */
export function SimKontrol({ adim, sim, ac, bitir, yansit, sifirla }: { adim: Adim; sim: Sim; ac: () => void; bitir: () => void; yansit: () => void; sifirla: () => void }) {
  const soruMu = adim.tur === 'soru'
  return (
    <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="font-bold text-fuchsia-200">🎬 Ders gibi dene</span>
      <span className="text-xs text-slate-300">
        {sim.durum === 'bekliyor' && 'Hoca olarak etkinliği aç; sağdaki telefondan öğrenci gibi cevap ver.'}
        {sim.durum === 'acik' && (sim.kalan !== null ? `Cevap alınıyor · ${sim.kalan} sn kaldı` : 'Cevap alınıyor · süre yok, sen bitirirsin')}
        {sim.durum === 'kapandi' && 'Süre doldu, cevap alınmıyor. Perdeye yansıtmak için düğmeye bas.'}
        {sim.durum === 'sonuc' && 'Cevaplar perdeye yansıtıldı.'}
      </span>
      <span className="ml-auto flex gap-2">
        {sim.durum === 'bekliyor' && (
          <button className="parlak-buton rounded-xl px-4 py-1.5 font-bold" onClick={ac}>
            ▶ {soruMu ? 'Soruyu aç' : 'Etkinliği aç'}
          </button>
        )}
        {sim.durum === 'acik' && (
          <button className="ikincil-buton !py-1.5" onClick={bitir}>
            ⏹ Süreyi bitir
          </button>
        )}
        {sim.durum === 'kapandi' && (
          <button className="parlak-buton rounded-xl px-4 py-1.5 font-bold" onClick={yansit}>
            📣 {soruMu ? 'Cevabı göster' : 'Cevapları yansıt'}
          </button>
        )}
        {sim.durum !== 'bekliyor' && (
          <button className="ikincil-buton !py-1.5" onClick={sifirla}>
            ↺ Baştan
          </button>
        )}
      </span>
    </div>
  )
}

/** Süre işleyen sayaç: acik durumunda her saniye azalır, 0'da kapanır. */
export function useSimSayaci(sim: Sim, setSim: (f: (s: Sim) => Sim) => void) {
  useEffect(() => {
    if (sim.durum !== 'acik' || sim.kalan === null) return
    const t = setTimeout(() => {
      setSim((s) => (s.durum !== 'acik' || s.kalan === null ? s : s.kalan <= 1 ? { ...s, kalan: 0, durum: 'kapandi' } : { ...s, kalan: s.kalan - 1 }))
    }, 1000)
    return () => clearTimeout(t)
  }, [sim.durum, sim.kalan, setSim])
}

export function SimPerde({ adim, soru, sim }: { adim: Adim; soru: Soru | undefined; sim: Sim }) {
  const kapali = sim.durum === 'bekliyor'
  const mod = adim.ayar.mod ?? 'bulut'
  const ust = (
    <div className="relative">
      {kapali && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 rounded-2xl">
          <p className="text-xl font-bold text-slate-200">⏳ Hoca etkinliği açınca başlar</p>
        </div>
      )}
    </div>
  )
  if (adim.tur === 'soru') {
    if (!soru) return <p className="m-auto text-slate-400">Soru bulunamadı.</p>
    const siklar = siklariDiz(soru)
    const sayilar = dagilim(soru, sim.secim)
    const en = Math.max(...sayilar)
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0 relative">
        {ust}
        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
          <h2 className="flex-1 text-2xl lg:text-3xl font-extrabold leading-tight">{soru.soru}</h2>
          <div className="text-center shrink-0">
            <p className="text-5xl font-extrabold tabular-nums">{sim.kalan ?? soru.sure_sn}</p>
            <p className="text-xs text-slate-400">saniye</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          {siklar.map((x, k) => {
            const dogru = x === soru.dogru
            const sonuc = sim.durum === 'sonuc'
            return (
              <div key={k} className={`${SIKLAR[k % SIKLAR.length].renk} rounded-2xl px-4 flex items-center gap-3 text-xl font-bold relative overflow-hidden ${sonuc && !dogru ? 'opacity-35' : ''}`}>
                <span className="w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center shrink-0">{SIKLAR[k % SIKLAR.length].harf}</span>
                <span className="flex-1">{x}</span>
                {sonuc && (
                  <span className="shrink-0 text-lg tabular-nums">
                    {dogru ? '✓ ' : ''}
                    {sayilar[k]} kişi
                  </span>
                )}
                {sonuc && <span className="absolute left-0 bottom-0 h-1.5 bg-white/70" style={{ width: `${(sayilar[k] / en) * 100}%` }} />}
              </div>
            )
          })}
        </div>
        {sim.durum !== 'bekliyor' && <p className="text-xs text-slate-500">Cevaplayan: {sim.durum === 'sonuc' ? sayilar.reduce((a, b) => a + b, 0) : sim.secim !== null ? 1 : 0} kişi (örnek sınıf)</p>}
      </div>
    )
  }
  if (adim.tur === 'fikir') {
    const gizli = mod === 'acik' && sim.durum !== 'sonuc'
    const hepsi = [...sim.metinler, ...(sim.durum === 'sonuc' ? (mod === 'bulut' ? ORNEK_KELIMELER : ORNEK_CEVAPLAR) : [])]
    return (
      <div className="flex-1 flex flex-col gap-4 relative">
        {ust}
        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
          <h2 className="flex-1 text-2xl lg:text-3xl font-extrabold leading-tight">{adim.ayar.soru}</h2>
          {sim.kalan !== null && <p className="text-5xl font-extrabold tabular-nums">{sim.kalan}</p>}
          <div className="text-center">
            <p className="text-5xl font-extrabold tabular-nums">{sim.metinler.length + (sim.durum === 'sonuc' ? 4 : 0)}</p>
            <p className="text-xs text-slate-400">kişi yazdı</p>
          </div>
        </div>
        {gizli ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-5xl">{sim.durum === 'kapandi' ? '🔒' : '✍️'}</p>
            <p className="text-2xl font-extrabold">{sim.durum === 'kapandi' ? 'Süre doldu' : sim.durum === 'bekliyor' ? 'Hazır' : 'Öğrenciler yazıyor…'}</p>
            <p className="text-slate-300">Cevaplar “Cevapları yansıt” diyene kadar perdede görünmez.</p>
          </div>
        ) : mod === 'bulut' ? (
          <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 content-center">
            {hepsi.length === 0 && <p className="text-slate-400">Henüz fikir yok.</p>}
            {hepsi.map((k, n) => (
              <span key={`${k}${n}`} className="font-display font-extrabold text-amber-200" style={{ fontSize: `${1.3 + ((n * 7) % 5) * 0.5}rem` }}>
                {k}
              </span>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 content-start">
            {hepsi.length === 0 && <p className="text-slate-400">Henüz cevap yok.</p>}
            {hepsi.map((m, n) => (
              <div key={`${m}${n}`} className="rounded-2xl border border-white/10 bg-white/7 p-3 text-lg leading-snug">
                <span className={`mr-2 ${n < sim.metinler.length ? 'text-emerald-300' : 'text-slate-500'}`}>●</span>
                {m}
                {n >= sim.metinler.length && <span className="ml-2 text-xs text-slate-500">(örnek)</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  // oylama
  const e = adim.ayar.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
  const sol = 11 + (sim.taraf === 0 ? 1 : 0)
  const sag = 9 + (sim.taraf === 1 ? 1 : 0)
  const yuzde = Math.round((sol / (sol + sag)) * 100)
  return (
    <div className="flex-1 flex flex-col gap-4 justify-center relative">
      {ust}
      <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight text-center">{adim.ayar.soru}</h2>
      {sim.kalan !== null && <p className="text-center text-4xl font-extrabold tabular-nums">{sim.kalan}</p>}
      <div className="flex items-center justify-center gap-6 text-3xl font-extrabold">
        <span className="text-sky-300">{e[0]}</span>
        <span className="text-slate-500 text-xl">ya da</span>
        <span className="text-rose-300">{e[1]}</span>
      </div>
      {sim.durum === 'sonuc' ? (
        <>
          <div className="h-6 rounded-full bg-white/10 overflow-hidden flex">
            <div className="bg-sky-400 transition-all duration-700" style={{ width: `${yuzde}%` }} />
            <div className="bg-rose-400 flex-1" />
          </div>
          <p className="text-center text-xl tabular-nums">
            {sol} · {sag} <span className="text-slate-400 text-sm">(örnek sınıf)</span>
          </p>
          {sim.gerekce && <p className="text-center text-lg">“{sim.gerekce}”</p>}
        </>
      ) : (
        <p className="text-center text-slate-300 text-lg">Telefonundan oyunu ver. Sayılar sen yansıtana kadar gizli.</p>
      )}
    </div>
  )
}

export function SimTelefon({ adim, soru, sim, degistir }: { adim: Adim; soru: Soru | undefined; sim: Sim; degistir: (f: (s: Sim) => Sim) => void }) {
  const [taslak, setTaslak] = useState('')
  const acik = sim.durum === 'acik'
  const mod = adim.ayar.mod ?? 'bulut'
  const hak = mod === 'acik' ? 1 : 3
  const kapaliMesaj =
    sim.durum === 'bekliyor' ? 'Hocanın ekranını izle. Etkinlik açılınca burada görünür.' : sim.durum === 'kapandi' ? 'Süre doldu. Perdeye bak.' : 'Sonuç perdede.'

  if (adim.tur === 'soru') {
    if (!soru) return <p className="text-slate-400">Soru bulunamadı.</p>
    const siklar = siklariDiz(soru)
    if (sim.durum === 'bekliyor') return <p className="text-slate-300 m-auto text-center">{kapaliMesaj}</p>
    const dogruIndex = siklar.indexOf(soru.dogru)
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-fuchsia-300">🎯 Soru {sim.kalan !== null && <span className="ml-2 tabular-nums text-amber-200">⏱ {sim.kalan}</span>}</p>
        <h2 className="text-lg font-extrabold leading-snug">{soru.soru}</h2>
        <div className="grid gap-2">
          {siklar.map((x, k) => {
            const secili = sim.secim === k
            const sonuc = sim.durum === 'sonuc'
            return (
              <button
                key={k}
                type="button"
                disabled={!acik || sim.secim !== null}
                onClick={() => degistir((s) => ({ ...s, secim: k }))}
                className={`${SIKLAR[k % SIKLAR.length].renk} rounded-2xl px-4 py-3 font-bold flex gap-3 text-left transition ${secili ? 'ring-4 ring-white' : ''} ${sonuc && k !== dogruIndex ? 'opacity-40' : ''} disabled:cursor-default`}
              >
                <span className="opacity-80">{SIKLAR[k % SIKLAR.length].harf}</span>
                <span className="flex-1">{x}</span>
                {sonuc && k === dogruIndex && <span>✓</span>}
              </button>
            )
          })}
        </div>
        {sim.secim !== null && sim.durum !== 'sonuc' && <p className="text-emerald-300 text-sm font-bold">Cevabın alındı. Sonucu bekle.</p>}
        {sim.durum === 'sonuc' && (
          <p className={`font-bold ${sim.secim === dogruIndex ? 'text-emerald-300' : 'text-rose-300'}`}>
            {sim.secim === null ? 'Cevap vermedin.' : sim.secim === dogruIndex ? '🎉 Doğru bildin!' : 'Bu sefer olmadı. Doğru şık işaretli.'}
          </p>
        )}
      </div>
    )
  }

  if (adim.tur === 'fikir') {
    if (sim.durum === 'bekliyor') return <p className="text-slate-300 m-auto text-center">{kapaliMesaj}</p>
    const bitti = sim.metinler.length >= hak
    function gonder(e: React.FormEvent) {
      e.preventDefault()
      const m = taslak.trim()
      if (m.length < 2) return
      degistir((s) => ({ ...s, metinler: [...s.metinler, m] }))
      setTaslak('')
    }
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold leading-snug">{adim.ayar.soru}</h2>
        {sim.kalan !== null && <p className={`text-sm font-bold tabular-nums ${sim.kalan <= 10 ? 'text-rose-300' : 'text-amber-200'}`}>⏱ {sim.kalan} sn kaldı</p>}
        {acik && !bitti ? (
          <form onSubmit={gonder} className="space-y-2">
            {mod === 'bulut' ? (
              <input className="giris-kutusu text-base" placeholder="Bir kelime ya da kısa bir ifade" maxLength={40} value={taslak} onChange={(e) => setTaslak(e.target.value)} />
            ) : (
              <textarea className="giris-kutusu text-base" rows={mod === 'acik' ? 5 : 3} maxLength={mod === 'acik' ? 300 : 120} placeholder={mod === 'acik' ? 'Cevabını yaz' : 'Fikrini bir iki cümleyle yaz'} value={taslak} onChange={(e) => setTaslak(e.target.value)} />
            )}
            <button className="parlak-buton w-full rounded-xl py-3 font-bold disabled:opacity-50" disabled={taslak.trim().length < 2}>
              {mod === 'acik' ? 'Cevabı gönder' : `Gönder (${hak - sim.metinler.length} hakkın var)`}
            </button>
          </form>
        ) : acik && bitti ? (
          <p className="text-emerald-300 font-bold">{mod === 'acik' ? 'Cevabın gönderildi. Perdeye bak.' : 'Hakkını kullandın. Perdeye bak.'}</p>
        ) : (
          <p className="text-slate-400">{sim.durum === 'kapandi' ? 'Süre doldu. Hocan yansıtınca perdede görünecek.' : 'Cevaplar perdede.'}</p>
        )}
        {sim.metinler.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {sim.metinler.map((m, n) => (
              <li key={n} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // oylama
  if (sim.durum === 'bekliyor') return <p className="text-slate-300 m-auto text-center">{kapaliMesaj}</p>
  const e = adim.ayar.etiketler ?? ['Katılıyorum', 'Katılmıyorum']
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold leading-snug">{adim.ayar.soru}</h2>
      {sim.kalan !== null && <p className="text-sm font-bold tabular-nums text-amber-200">⏱ {sim.kalan} sn kaldı</p>}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((t) => (
          <button
            key={t}
            type="button"
            disabled={!acik}
            onClick={() => degistir((s) => ({ ...s, taraf: t }))}
            className={`rounded-2xl py-4 text-center font-bold bg-linear-to-br ${t === 0 ? 'from-sky-400 to-blue-600' : 'from-rose-500 to-pink-600'} ${sim.taraf === t ? 'ring-4 ring-white' : ''} disabled:cursor-default`}
          >
            {e[t]}
          </button>
        ))}
      </div>
      {acik && (
        <input className="giris-kutusu text-sm" maxLength={200} placeholder="İstersen kısa bir gerekçe yaz" value={sim.gerekce} onChange={(ev) => degistir((s) => ({ ...s, gerekce: ev.target.value }))} />
      )}
      {sim.taraf !== null && acik && <p className="text-xs text-slate-400">Sonuç açıklanana kadar fikrini değiştirebilirsin.</p>}
      {!acik && <p className="text-slate-400">{kapaliMesaj}</p>}
    </div>
  )
}
