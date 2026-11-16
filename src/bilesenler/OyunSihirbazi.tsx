import { useEffect, useMemo, useState } from 'react'
import { sorulariGetir } from '../lib/akis'
import { paketleriSirala } from '../lib/gecis'
import { OYUNLAR, type OyunAnahtari } from '../lib/oyun'
import { GRUPLU_OYUNLAR } from '../lib/oyunAc'
import { paketleriGrupla } from '../lib/paket'
import { dengeliSec, elleSecilenler, havuzSirasinaDiz, sonSorulanlar, turuKaydet } from '../lib/soruSec'
import SoruSecici from './SoruSecici'
import type { Soru } from '../lib/tipler'

export interface TurIstegi {
  ad: string
  sorular: Soru[]
  mod: OyunAnahtari | null
  grup: number | null
  /** Süreyle bitecek oyunlarda dakika; soru sayısıyla bitenlerde boş */
  sureDk: number | null
}

type Etiket = 'bireysel' | 'takim' | 'ikisi'
const OYUN_LISTESI: { anahtar: OyunAnahtari; etiket: Etiket; kural: string }[] = [
  {
    anahtar: 'orman',
    etiket: 'bireysel',
    kural: 'Patikada yürü, kalplerini koru; kurda yakalanma.',
  },
  {
    anahtar: 'zombi',
    etiket: 'bireysel',
    kural: 'Doğru cevap bir kat çıkarır; zombiler yaklaşır.',
  },
  {
    anahtar: 'roket',
    etiket: 'bireysel',
    kural: 'Doğru cevap roketi ileri iter; ilk varan kazanır.',
  },
  {
    anahtar: 'arena',
    etiket: 'bireysel',
    kural: 'Yanlış can götürür; son kalan kazanır.',
  },
  {
    anahtar: 'ejderha',
    etiket: 'ikisi',
    kural: 'Sınıf birlikte ejderhaya vurur.',
  },
  {
    anahtar: 'merdiven',
    etiket: 'ikisi',
    kural: 'Sınıf tek yarışmacı gibi basamak çıkar.',
  },
  { anahtar: 'hoca', etiket: 'ikisi', kural: 'Sınıf hocaya karşı oynar.' },
  {
    anahtar: 'halat',
    etiket: 'takim',
    kural: 'İki takım halatı kendine çeker.',
  },
  {
    anahtar: 'kule',
    etiket: 'takim',
    kural: 'Her doğru takımın kulesine kat ekler.',
  },
  {
    anahtar: 'kale',
    etiket: 'takim',
    kural: 'Ordular rakip kaleyi kuşatır.',
  },
  {
    anahtar: 'takim',
    etiket: 'takim',
    kural: 'Takım puanı üye başına ortalamadır.',
  },
]
const ETIKET_METNI: Record<Etiket, string> = {
  bireysel: 'bireysel',
  takim: 'takım',
  ikisi: 'bireysel / takım',
}
const SORU_SAYILARI = [10, 20, 30, 40]
const SURELER = [5, 10, 15]

const RENKLER = {
  indigo: 'border-indigo-300 bg-indigo-500/25 font-bold',
  emerald: 'border-emerald-300 bg-emerald-500/25 font-bold',
}
const dugme = (acik: boolean, renk: keyof typeof RENKLER = 'indigo') =>
  `rounded-full border px-3 py-1.5 text-sm ${acik ? RENKLER[renk] : 'border-white/10 bg-white/5 hover:bg-white/10'}`

/**
 * Perdede açılan sihirbaz. "zapoot": Bireysel/Takım, paket(ler), soru sayısı. "oyun": oyun kartı, paket(ler), soru sayısı ya da süre.
 * Seçilen paketlerden dengeli ve karışık soru çekilir; son iki turda sorulmayanlar önce gelir.
 */
export function OyunSihirbazi({
  tur,
  oturumId,
  icerikId,
  hafta,
  basla,
  kapat,
  baslangicOyun,
}: {
  tur: 'zapoot' | 'oyun'
  oturumId: string
  icerikId: string
  hafta: number | null
  basla: (i: TurIstegi) => Promise<void>
  kapat: () => void
  baslangicOyun?: OyunAnahtari
}) {
  const [sorular, setSorular] = useState<Soru[] | null>(null)
  const [hata, setHata] = useState(false)
  const [takimli, setTakimli] = useState(false)
  const [grup, setGrup] = useState(3)
  const [oyun, setOyun] = useState<OyunAnahtari>(baslangicOyun ?? 'zombi')
  const [oyunTakimi, setOyunTakimi] = useState(false)
  const [secili, setSecili] = useState<string[]>([])
  const [adet, setAdet] = useState(20)
  const [sureli, setSureli] = useState(false)
  const [sureDk, setSureDk] = useState(10)
  const [mesgul, setMesgul] = useState(false)
  const [kolaydanZora, setKolaydanZora] = useState(false)
  // null: soru sayısı kadar paketlerden otomatik çekilir; küme: yalnızca elle işaretlenen sorular
  const [secim, setSecim] = useState<Set<string> | null>(null)

  useEffect(() => {
    sorulariGetir(icerikId)
      .then(setSorular)
      .catch(() => setHata(true))
  }, [icerikId])
  const liste = useMemo(() => (sorular ? paketleriSirala(paketleriGrupla(sorular), 'kahoot', hafta) : []), [sorular, hafta])
  const oneri = liste.find((p) => p.onerilen)
  useEffect(() => {
    if (secili.length === 0 && oneri) setSecili([oneri.ad])
  }, [oneri, secili.length])

  const seciliPaketler = liste.filter((p) => secili.includes(p.ad))
  const toplam = seciliPaketler.reduce((a, p) => a + p.sorular.length, 0)
  const elle = secim ? elleSecilenler(seciliPaketler, secim) : null
  const secimAnahtari = secili.join('|')
  useEffect(() => setSecim(null), [secimAnahtari])
  const bilgi = OYUN_LISTESI.find((o) => o.anahtar === oyun)
  const oyunGruplu = tur === 'oyun' && bilgi?.etiket === 'takim'
  const takimiGerekli = tur === 'zapoot' ? takimli : oyunGruplu || (bilgi?.etiket === 'ikisi' && oyunTakimi && GRUPLU_OYUNLAR.includes(oyun))
  const mod: OyunAnahtari | null = tur === 'zapoot' ? (takimli ? 'takim' : null) : oyun
  const grupSayisi = takimiGerekli && mod !== 'halat' ? grup : null

  async function baslat() {
    if (seciliPaketler.length === 0 || (elle && elle.length === 0)) return
    setMesgul(true)
    try {
      const istenen = tur === 'oyun' && sureli ? Math.min(60, toplam) : Math.min(adet, toplam)
      const secilen = elle
        ? [...elle]
        : dengeliSec(
            seciliPaketler.map((p) => ({ ad: p.ad, sorular: p.sorular })),
            istenen,
            (s) => s.id,
            sonSorulanlar(oturumId),
          )
      // Her turda havuzdan farklı sorular gelir; oynanma sırası paketin özgün sırasıdır (zorluk sırası seçilmediyse)
      if (!kolaydanZora && !elle) secilen.splice(0, secilen.length, ...havuzSirasinaDiz(secilen, seciliPaketler.flatMap((p) => p.sorular)))
      if (kolaydanZora) {
        const sira = (s: Soru) => ({ kolay: 0, orta: 1, zor: 2 })[String(s.ek?.zorluk ?? '').toLowerCase() as 'kolay'] ?? 1
        secilen.sort((a, b) => sira(a) - sira(b))
      }
      turuKaydet(
        oturumId,
        secilen.map((s) => s.id),
      )
      const ad = seciliPaketler.length === 1 ? seciliPaketler[0].ad : `${seciliPaketler[0].ad} +${seciliPaketler.length - 1}`
      await basla({
        ad,
        sorular: secilen,
        mod,
        grup: grupSayisi,
        sureDk: tur === 'oyun' && sureli ? sureDk : null,
      })
    } catch {
      window.alert('Açılamadı. Bağlantını kontrol edip tekrar dene.')
      setMesgul(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto space-y-4 girdi">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-display font-extrabold flex-1">{tur === 'zapoot' ? '🎮 Zapoot' : '🕹️ Oyunlar'}</h2>
          <button className="ikincil-buton !py-1" onClick={kapat}>
            Kapat
          </button>
        </div>

        {tur === 'zapoot' ? (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300">1. Nasıl oynansın?</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTakimli(false)} className={dugme(!takimli)}>
                🧑 Bireysel
              </button>
              <button onClick={() => setTakimli(true)} className={dugme(takimli)}>
                👥 Takım
              </button>
              {takimli &&
                [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button key={n} onClick={() => setGrup(n)} className={dugme(grup === n, 'emerald')}>
                    {n} takım
                  </button>
                ))}
            </div>
            <p className="text-xs text-slate-400">
              Doğru cevap 500 ile 1000 puan (hızlıya çok), 3'lü seride +100, 5'li seride +300 bonus. Takım puanı üye başına ortalamadır.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-300">1. Oyun seç</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {OYUN_LISTESI.map((o) => (
                <button
                  key={o.anahtar}
                  onClick={() => setOyun(o.anahtar)}
                  className={`text-left rounded-2xl border p-3 ${oyun === o.anahtar ? 'border-indigo-300 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <b className="text-sm">
                    {OYUNLAR[o.anahtar].emoji} {OYUNLAR[o.anahtar].ad}
                  </b>
                  <span className="ml-2 text-[11px] rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{ETIKET_METNI[o.etiket]}</span>
                  <span className="block text-xs text-slate-400 mt-1">{o.kural}</span>
                </button>
              ))}
            </div>
            {bilgi?.etiket === 'ikisi' && GRUPLU_OYUNLAR.includes(oyun) && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={oyunTakimi} onChange={(e) => setOyunTakimi(e.target.checked)} /> Takımlı oyna
              </label>
            )}
            {takimiGerekli && mod !== 'halat' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button key={n} onClick={() => setGrup(n)} className={dugme(grup === n, 'emerald')}>
                    {n} takım
                  </button>
                ))}
              </div>
            )}
            {mod === 'halat' && <p className="text-xs text-slate-400">Halat çekme her zaman 2 takımdır.</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-300">2. Paket(ler): birden çok konu işaretleyebilirsin</h3>
          {hata && <p className="text-rose-300 text-sm">Paketler yüklenemedi.</p>}
          {!sorular && !hata && <p className="text-slate-400 text-sm">Yükleniyor…</p>}
          {sorular && liste.length === 0 && (
            <p className="text-slate-400 text-sm">Bu içerikte Zapoot paketi yok. Ders düzenleme sayfasından soru paketi ekleyebilirsin.</p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {liste.map((p) => {
              const acik = secili.includes(p.ad)
              return (
                <li key={p.ad}>
                  <button
                    onClick={() => setSecili((s) => (acik ? s.filter((x) => x !== p.ad) : [...s, p.ad]))}
                    className={`w-full text-left rounded-2xl border p-3 ${acik ? 'border-emerald-300 bg-emerald-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  >
                    <b className="block text-sm">
                      {acik ? '☑' : '☐'} {p.ad}
                    </b>
                    <span className="text-xs text-slate-400">
                      {p.sorular.length} soru {p.onerilen && <span className="text-emerald-300 font-bold">· bu haftanın paketi</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {seciliPaketler.length > 0 && <SoruSecici gruplar={seciliPaketler} secim={secim} degistir={setSecim} />}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-300">3. {tur === 'oyun' ? 'Ne zaman bitsin?' : 'Kaç soru?'}</h3>
          {elle && <p className="text-xs text-emerald-300">Elle {elle.length} soru seçtin; sayı ve süre seçimi bu tur için kullanılmaz.</p>}
          <div className="flex flex-wrap gap-2">
            {tur === 'oyun' && (
              <>
                <button onClick={() => setSureli(false)} className={dugme(!sureli)}>
                  Soru sayısıyla
                </button>
                <button onClick={() => setSureli(true)} className={dugme(sureli)}>
                  ⏱ Süreyle
                </button>
              </>
            )}
            {(tur === 'zapoot' || !sureli) &&
              [...SORU_SAYILARI, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => setAdet(n === 0 ? toplam : n)}
                  className={dugme(n === 0 ? adet === toplam && !SORU_SAYILARI.includes(adet) : adet === n, 'emerald')}
                >
                  {n === 0 ? 'Hepsi' : `${n} soru`}
                </button>
              ))}
            {tur === 'oyun' &&
              sureli &&
              SURELER.map((n) => (
                <button key={n} onClick={() => setSureDk(n)} className={dugme(sureDk === n, 'emerald')}>
                  {n} dk
                </button>
              ))}
          </div>
          {tur === 'oyun' && sureli && <p className="text-xs text-slate-400">Süre dolunca o anki soru bitince oyun sona erer.</p>}
          <div className="flex flex-wrap gap-2 pt-1" aria-label="Soru sırası">
            <button onClick={() => setKolaydanZora(false)} className={dugme(!kolaydanZora)}>
              🔀 Karışık
            </button>
            <button onClick={() => setKolaydanZora(true)} className={dugme(kolaydanZora)} title="Sorular zorluk etiketine göre kolaydan zora sıralanır; etiketsizler ortada yer alır">
              📈 Kolaydan zora
            </button>
          </div>
        </div>

        <button disabled={mesgul || seciliPaketler.length === 0 || (elle !== null && elle.length === 0)} onClick={baslat} className="parlak-buton w-full rounded-2xl py-3 font-display font-extrabold">
          {mesgul
            ? 'Açılıyor…'
            : seciliPaketler.length === 0
              ? 'Önce paket seç'
              : elle && elle.length === 0
                ? 'En az bir soru işaretle'
                : `Lobiyi aç (${elle ? elle.length + ' soru, elle seçildi' : tur === 'oyun' && sureli ? 'süreli' : Math.min(adet, toplam) + ' soru'})`}
        </button>
      </section>
    </div>
  )
}
