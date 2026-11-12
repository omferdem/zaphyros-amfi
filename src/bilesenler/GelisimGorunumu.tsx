import { useMemo, useState } from 'react'
import { AZ_VERI, GUCLU_ESIK, ZAYIF_ESIK, guclüVeZayif, oranHesapla, type GelisimSonucu, type Olcut, type OgrenciGelisim } from '../lib/gelisim'

export const OLCUTLER: [Olcut, string][] = [
  ['otomatik', 'Otomatik (kazanım, yoksa paket)'],
  ['paket', 'Soru paketi (hafta/konu)'],
  ['kazanim', 'Kazanım (#OUTCOME)'],
  ['bloom', 'Bloom düzeyi (#BLOOM)'],
]

type Siralama = 'zayif' | 'guclu' | 'egilim' | 'no' | 'ad'

function yuzde(o: number | null): string {
  return o === null ? '–' : `%${Math.round(o * 100)}`
}

function renk(o: number | null): string {
  if (o === null) return 'bg-white/5 text-slate-500'
  if (o >= GUCLU_ESIK) return 'bg-emerald-500/20 text-emerald-200'
  if (o >= ZAYIF_ESIK) return 'bg-amber-500/20 text-amber-200'
  return 'bg-rose-500/20 text-rose-200'
}

function Rozet({ oran, ipucu }: { oran: number | null; ipucu?: string }) {
  return (
    <span title={ipucu} className={`inline-block min-w-12 text-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${renk(oran)}`}>
      {yuzde(oran)}
    </span>
  )
}

function Egilim({ deger }: { deger: number | null }) {
  if (deger === null) return <span className="text-slate-600">–</span>
  if (deger === 0) return <span className="text-slate-400">=</span>
  return (
    <span className={`font-bold tabular-nums ${deger > 0 ? 'text-emerald-300' : 'text-rose-300'}`} title="İlk yarı oturumlara göre son yarı oturumların başarı farkı (yüzde puan)">
      {deger > 0 ? '▲' : '▼'} {Math.abs(deger)}
    </span>
  )
}

/** Oturum oturum başarı: küçük çizgi grafiği. */
function Cizgi({ oranlar }: { oranlar: number[] }) {
  if (oranlar.length < 2) return <span className="text-xs text-slate-500">En az 2 oturum gerekir</span>
  const en = 160
  const boy = 36
  const nokta = oranlar.map((o, i) => `${(i / (oranlar.length - 1)) * en},${boy - 4 - o * (boy - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${en} ${boy}`} className="w-40 h-9" role="img" aria-label={`Oturum oturum başarı: ${oranlar.map((o) => yuzde(o)).join(', ')}`}>
      <line x1="0" x2={en} y1={boy - 4 - ZAYIF_ESIK * (boy - 8)} y2={boy - 4 - ZAYIF_ESIK * (boy - 8)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
      <polyline points={nokta} fill="none" stroke="#22e3d2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {oranlar.map((o, i) => (
        <circle key={i} cx={(i / (oranlar.length - 1)) * en} cy={boy - 4 - o * (boy - 8)} r="3" fill="#ff4d9d" />
      ))}
    </svg>
  )
}

/** Öğrenci gelişim raporunun görünümü: sınıfın konuları ve öğrenci tablosu. Veriyi dışarıdan alır. */
export default function GelisimGorunumu({
  sonuc,
  olcut,
  setOlcut,
  excel,
  ustte,
}: {
  sonuc: GelisimSonucu
  olcut: Olcut
  setOlcut: (o: Olcut) => void
  excel: () => void
  /** Ölçüt seçicinin yanında gösterilecek ek denetimler (ör. kaynak filtresi) */
  ustte?: React.ReactNode
}) {
  const [arama, setArama] = useState('')
  const [siralama, setSiralama] = useState<Siralama>('zayif')
  const [acik, setAcik] = useState<string | null>(null)

  const satirlar = useMemo(() => {
    const aranan = arama.toLocaleLowerCase('tr')
    const l = sonuc.ogrenciler.filter(
      (g) => !aranan || g.ogrenci.ad_soyad.toLocaleLowerCase('tr').includes(aranan) || g.ogrenci.ogrenci_no.includes(aranan),
    )
    const verili = (g: OgrenciGelisim) => g.oran !== null
    const kiyas: Record<Siralama, (a: OgrenciGelisim, b: OgrenciGelisim) => number> = {
      zayif: (a, b) => (a.oran ?? 2) - (b.oran ?? 2),
      guclu: (a, b) => (b.oran ?? -1) - (a.oran ?? -1),
      egilim: (a, b) => (a.egilim ?? 999) - (b.egilim ?? 999),
      no: (a, b) => a.ogrenci.ogrenci_no.localeCompare(b.ogrenci.ogrenci_no, 'tr', { numeric: true }),
      ad: (a, b) => a.ogrenci.ad_soyad.localeCompare(b.ogrenci.ad_soyad, 'tr'),
    }
    // Verisi olmayanlar (hiç cevap vermemiş) her sıralamada sonda
    return [...l].sort((a, b) => Number(verili(b)) - Number(verili(a)) || kiyas[siralama](a, b))
  }, [sonuc, arama, siralama])

  const izlenen = sonuc.ogrenciler.filter((g) => g.cevap > 0)
  const ortBasari = sonuc.izlenenCevap > 0 ? izlenen.reduce((t, g) => t + g.dogru, 0) / sonuc.izlenenCevap : null
  const zayifOgrenci = izlenen.filter((g) => g.cevap >= AZ_VERI && (g.oran ?? 1) < ZAYIF_ESIK).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm space-y-1">
          <span className="text-slate-300 block">Konu ölçütü</span>
          <select className="giris-kutusu !w-auto !py-2 text-sm" value={olcut} onChange={(e) => setOlcut(e.target.value as Olcut)}>
            {OLCUTLER.map(([k, ad]) => (
              <option key={k} value={k}>
                {ad}
              </option>
            ))}
          </select>
        </label>
        {ustte}
        <button className="ikincil-buton ml-auto" onClick={excel}>
          Excel'e aktar
        </button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          ['Cevap', String(sonuc.toplamCevap), `${sonuc.oturumSayisi} oturum`],
          ['İzlenen öğrenci', `${izlenen.length} / ${sonuc.ogrenciler.length}`, 'numarasıyla girenler'],
          ['Sınıf başarısı', yuzde(ortBasari), 'doğru cevap oranı'],
          ['Desteğe ihtiyacı olan', String(zayifOgrenci), `başarısı %${Math.round(ZAYIF_ESIK * 100)} altı`],
        ].map(([baslik, deger, alt]) => (
          <div key={baslik} className="cam-panel rounded-2xl p-4">
            <p className="text-xs text-slate-400">{baslik}</p>
            <p className="text-3xl font-display font-extrabold tabular-nums renkli-yazi pb-0.5">{deger}</p>
            <p className="text-[11px] text-slate-500">{alt}</p>
          </div>
        ))}
      </div>

      {sonuc.izlenemeyen > 0 && (
        <p className="text-sm text-amber-300 bg-amber-500/10 rounded-xl p-3">
          {sonuc.izlenemeyen} cevap öğrenciye bağlanamadı (takma adla oynayanlar ya da yoklaması elle girilenler). Öğrencinin
          gelişimi izlenebilsin diye yarışmayı yoklamalı, yani öğrenci numarasıyla girilen bir derste oynat.
        </p>
      )}

      <section className="cam-panel rounded-3xl p-5 space-y-3">
        <h2 className="text-lg font-extrabold">Sınıfın konuları</h2>
        <p className="text-xs text-slate-400">En zayıf konu üstte. Çubuk, o konudaki doğru cevap oranıdır.</p>
        <ul className="space-y-2.5">
          {sonuc.konular.map((k) => (
            <li key={k.konu} className="space-y-1">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold flex-1 min-w-0 truncate" title={k.konu}>
                  {k.konu}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {k.toplam} cevap{k.ogrenci > 0 && ` · ${k.zayif}/${k.ogrenci} öğrenci zayıf`}
                </span>
                <Rozet oran={k.toplam >= AZ_VERI ? k.oran : null} />
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${(k.oran ?? 0) >= GUCLU_ESIK ? 'bg-linear-to-r from-emerald-400 to-cyan-400' : (k.oran ?? 0) >= ZAYIF_ESIK ? 'bg-linear-to-r from-amber-400 to-orange-400' : 'bg-linear-to-r from-rose-500 to-pink-500'}`}
                  style={{ width: `${Math.round((k.oran ?? 0) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cam-panel rounded-3xl p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold flex-1">Öğrenciler</h2>
          <input className="giris-kutusu !w-52 !py-1.5 text-sm" placeholder="Ad ya da numara ara" value={arama} onChange={(e) => setArama(e.target.value)} />
          <select className="giris-kutusu !w-auto !py-1.5 text-sm" value={siralama} onChange={(e) => setSiralama(e.target.value as Siralama)} aria-label="Sıralama">
            <option value="zayif">Önce zayıf olanlar</option>
            <option value="guclu">Önce başarılı olanlar</option>
            <option value="egilim">Önce gerileyenler</option>
            <option value="no">Numaraya göre</option>
            <option value="ad">Ada göre</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-2 pr-3 font-semibold">Öğrenci</th>
                <th className="py-2 pr-3 font-semibold text-right">Cevap</th>
                <th className="py-2 pr-3 font-semibold text-center">Başarı</th>
                <th className="py-2 pr-3 font-semibold text-center">Eğilim</th>
                <th className="py-2 pr-3 font-semibold">Güçlü</th>
                <th className="py-2 font-semibold">Zayıf</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((g) => {
                const { guclu, zayif } = guclüVeZayif(g)
                const a = acik === g.ogrenci.id
                return (
                  <FragmentSatir key={g.ogrenci.id}>
                    <tr className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setAcik(a ? null : g.ogrenci.id)}>
                      <td className="py-2 pr-3">
                        <span className="font-semibold">{g.ogrenci.ad_soyad}</span>
                        <span className="block text-xs font-mono text-slate-500">{g.ogrenci.ogrenci_no}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-300">{g.cevap || '–'}</td>
                      <td className="py-2 pr-3 text-center">
                        <Rozet oran={g.oran} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <Egilim deger={g.egilim} />
                      </td>
                      <td className="py-2 pr-3 text-emerald-300 max-w-40 truncate" title={guclu ?? ''}>
                        {guclu ?? <span className="text-slate-600">–</span>}
                      </td>
                      <td className="py-2 text-rose-300 max-w-40 truncate" title={zayif ?? ''}>
                        {zayif ?? <span className="text-slate-600">–</span>}
                      </td>
                    </tr>
                    {a && (
                      <tr className="bg-white/5">
                        <td colSpan={6} className="p-4">
                          {g.cevap === 0 ? (
                            <p className="text-slate-400">Bu öğrencinin izlenen bir yarışma cevabı yok.</p>
                          ) : (
                            <div className="flex flex-wrap gap-6">
                              <div className="space-y-1">
                                <p className="text-xs text-slate-400">Oturum oturum başarı</p>
                                <Cizgi oranlar={g.oturumlar.map((o) => o.oran)} />
                                <p className="text-xs text-slate-500">
                                  Ort. süre {g.sureOrt?.toFixed(1)} sn · {g.puan} puan
                                </p>
                              </div>
                              <div className="flex-1 min-w-60 space-y-1">
                                <p className="text-xs text-slate-400">Konulara göre</p>
                                <div className="flex flex-wrap gap-2">
                                  {[...g.konular.entries()]
                                    .sort((x, y) => (oranHesapla(x[1]) ?? 0) - (oranHesapla(y[1]) ?? 0))
                                    .map(([konu, o]) => (
                                      <span key={konu} className={`rounded-full px-3 py-1 text-xs ${renk(o.toplam >= AZ_VERI ? oranHesapla(o) : null)}`}>
                                        {konu} <b>{o.toplam >= AZ_VERI ? yuzde(oranHesapla(o)) : `${o.dogru}/${o.toplam}`}</b>
                                      </span>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500">Yorum için bir konuda en az {AZ_VERI} cevap gerekir; daha azında doğru/toplam gösterilir.</p>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </FragmentSatir>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function FragmentSatir({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
