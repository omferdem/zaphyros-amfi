import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cihazKimligi, oku, sakla } from '../lib/cihaz'
import { SIKLAR } from '../lib/yarisma'
import Konfeti from '../bilesenler/Konfeti'

interface QuizPaketi {
  attempt: string
  baslik: string
  ders: string
  sure_dk: number
  kalan_ms: number
  bitti: boolean
  sorular: { id: string; soru: string; secenekler: string[]; secim: number | null }[]
}

const HATALAR: Record<string, string> = {
  kod_yanlis: 'Bu kodla açık bir quiz yok. Quiz bitmiş ya da kod yanlış olabilir; perdedeki kodu kontrol et.',
  liste_disi: 'Bu numara bu şubenin listesinde yok. Numaranı kontrol et; doğruysa hocana söyle.',
  numara_kullanildi: 'Bu numarayla bu quize başka bir telefondan girilmiş. Hatalıysa hocana söyle.',
  cihaz_kullanildi: 'Bu telefondan bu quize başka bir numarayla girildi. Her öğrenci kendi telefonunu kullanmalı.',
  numara_gecersiz: 'Numarayı yalnızca rakam (ve gerekiyorsa harf) olarak yaz.',
  cihaz_gecersiz: 'Tarayıcın tanınamadı. Sayfayı yenileyip tekrar dene.',
  zaten_bitti: 'Bu quizi zaten bitirdin.',
  tekrar_dene: 'Bir çakışma oldu. Tekrar dene.',
  yoklama_yok: 'Bu derste yoklaman görünmüyor. Perdedeki karekodu okutup derse gir ya da quiz kodunu ve numaranı elle yaz.',
  quiz_yok: 'Şu an açık bir quiz yok. Hocan quizi kapatmış olabilir.',
  oturum_yok: 'Bu ders bitmiş. Quiz kodun varsa ana sayfadan gir.',
}

function dakika(ms: number): string {
  const sn = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`
}

function yerelAnahtar(kod: string) {
  return `amfi_quiz_${kod}`
}

/** Öğrencinin habersiz quiz ekranı: kod + numara ile girer, soruları kendi hızında çözer. */
export default function Quiz() {
  const [parametreler] = useSearchParams()
  const kod = (parametreler.get('k') ?? '').replace(/\D/g, '')
  const oturumParam = parametreler.get('o') ?? ''
  const oturum = /^[0-9a-f-]{36}$/i.test(oturumParam) ? oturumParam : ''
  const [hataKodu, setHataKodu] = useState<string | null>(null)
  const [asama, setAsama] = useState<'yukleniyor' | 'giris' | 'coz' | 'bitti' | 'hata'>('yukleniyor')
  const [baslik, setBaslik] = useState<{ baslik: string; ders: string } | null>(null)
  const [numara, setNumara] = useState(() => oku('amfi_ogrenci_no') ?? '')
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [paket, setPaket] = useState<QuizPaketi | null>(null)
  const [cevaplar, setCevaplar] = useState<Record<string, number>>({})
  const [sira, setSira] = useState(0)
  const [bitis, setBitis] = useState(0)
  const [simdi, setSimdi] = useState(Date.now())
  const [sonuc, setSonuc] = useState<{ dogru: number; toplam: number } | null>(null)
  const bekleyen = useRef<Map<string, number>>(new Map())
  const bitiriliyor = useRef(false)
  const basladi = useRef(false)

  const baslat = useCallback(
    async (no: string): Promise<void> => {
      setMesgul(true)
      setHata(null)
      const { data, error } = await supabase.rpc('quiz_baslat', { p_kod: kod, p_ogrenci_no: no, p_cihaz: cihazKimligi() })
      setMesgul(false)
      const s = data as (QuizPaketi & { hata?: string }) | null
      if (error || !s) {
        setHata('Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.')
        setAsama('giris')
        return
      }
      if (s.hata) {
        sakla(yerelAnahtar(kod), '')
        setHata(HATALAR[s.hata] ?? 'Bir sorun oldu. Tekrar dene.')
        setAsama(s.hata === 'zaten_bitti' ? 'bitti' : 'giris')
        return
      }
      sakla('amfi_ogrenci_no', no.trim())
      sakla(yerelAnahtar(kod), no.trim())
      setPaket(s)
      setCevaplar(Object.fromEntries(s.sorular.filter((x) => x.secim !== null).map((x) => [x.id, x.secim as number])))
      setBitis(Date.now() + s.kalan_ms)
      setSira(0)
      setAsama(s.bitti ? 'bitti' : 'coz')
    },
    [kod],
  )

  /** Derse girmiş öğrenci: kimlik yoklama kaydından alınır, kod ve numara sorulmaz. */
  const oturumdanBaslat = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase.rpc('oturum_quizi_baslat', { p_session: oturum, p_cihaz: cihazKimligi() })
    const s = data as (QuizPaketi & { hata?: string }) | null
    if (error || !s || s.hata) {
      setHataKodu(error || !s ? 'baglanti' : (s.hata as string))
      if (s?.hata === 'zaten_bitti') {
        setAsama('bitti')
        return
      }
      setAsama('hata')
      return
    }
    setPaket(s)
    setCevaplar(Object.fromEntries(s.sorular.filter((x) => x.secim !== null).map((x) => [x.id, x.secim as number])))
    setBitis(Date.now() + s.kalan_ms)
    setSira(0)
    setAsama(s.bitti ? 'bitti' : 'coz')
  }, [oturum])

  // Açılışta: quiz var mı? Bu telefonda yarıda kalmış deneme varsa kendiliğinden devam edilir.
  useEffect(() => {
    if (basladi.current) return
    basladi.current = true
    if (oturum) {
      oturumdanBaslat()
      return
    }
    if (kod.length !== 6) {
      setAsama('hata')
      return
    }
    supabase.rpc('quiz_bul', { p_kod: kod }).then(({ data, error }) => {
      const s = data as { baslik?: string; ders?: string; hata?: string } | null
      if (error || !s || s.hata) {
        setAsama('hata')
        return
      }
      setBaslik({ baslik: s.baslik ?? '', ders: s.ders ?? '' })
      const kayitli = oku(yerelAnahtar(kod))
      if (kayitli) baslat(kayitli)
      else setAsama('giris')
    })
  }, [kod, baslat, oturum, oturumdanBaslat])

  useEffect(() => {
    if (asama !== 'coz') return
    const t = setInterval(() => setSimdi(Date.now()), 500)
    return () => clearInterval(t)
  }, [asama])

  /** Gönderilemeyen cevaplar varsa yeniden dener. */
  const bekleyenleriGonder = useCallback(async () => {
    if (!paket) return
    for (const [soru, secim] of bekleyen.current.entries()) {
      const { data, error } = await supabase.rpc('quiz_cevapla', { p_attempt: paket.attempt, p_cihaz: cihazKimligi(), p_soru: soru, p_secim: secim })
      const s = (data ?? {}) as { durum?: string; hata?: string }
      if (!error && (s.durum || s.hata)) bekleyen.current.delete(soru)
    }
  }, [paket])

  const bitir = useCallback(
    async (otomatik = false) => {
      if (!paket || bitiriliyor.current) return
      if (!otomatik) {
        const bos = paket.sorular.filter((x) => cevaplar[x.id] === undefined).length
        if (bos > 0 && !window.confirm(`${bos} soruyu boş bıraktın. Quiz bitirilsin mi?`)) return
      }
      bitiriliyor.current = true
      setMesgul(true)
      await bekleyenleriGonder()
      const { data, error } = await supabase.rpc('quiz_bitir', { p_attempt: paket.attempt, p_cihaz: cihazKimligi() })
      setMesgul(false)
      const s = (data ?? {}) as { durum?: string; dogru?: number; toplam?: number }
      if (error || !s.durum) {
        bitiriliyor.current = false
        setHata('Bitirilemedi. İnternet bağlantını kontrol edip tekrar dene.')
        return
      }
      if (typeof s.dogru === 'number' && typeof s.toplam === 'number') setSonuc({ dogru: s.dogru, toplam: s.toplam })
      sakla(yerelAnahtar(kod), '')
      setAsama('bitti')
    },
    [paket, cevaplar, bekleyenleriGonder, kod],
  )

  // Süre dolunca quiz kendiliğinden biter.
  const kalan = Math.max(0, bitis - simdi)
  useEffect(() => {
    if (asama === 'coz' && paket && kalan === 0) bitir(true)
  }, [asama, paket, kalan, bitir])

  async function cevapla(soruId: string, secim: number) {
    if (!paket) return
    setCevaplar((c) => ({ ...c, [soruId]: secim }))
    setHata(null)
    const { data, error } = await supabase.rpc('quiz_cevapla', { p_attempt: paket.attempt, p_cihaz: cihazKimligi(), p_soru: soruId, p_secim: secim })
    const s = (data ?? {}) as { durum?: string; hata?: string }
    if (error || (!s.durum && !s.hata)) {
      // Bağlantı sorunu: cevap yerelde durur, sonraki cevapla ya da bitirirken yeniden denenir.
      bekleyen.current.set(soruId, secim)
      setHata('Bağlantı zayıf. Cevabın telefonunda duruyor, bağlantı gelince gönderilecek.')
      return
    }
    bekleyen.current.delete(soruId)
    if (s.hata === 'sure_bitti' || s.hata === 'kapali' || s.hata === 'bitti') {
      bitir(true)
      return
    }
    if (s.hata) setHata('Cevap alınamadı. Tekrar dene.')
    else if (bekleyen.current.size > 0) bekleyenleriGonder()
  }

  if (asama === 'yukleniyor')
    return (
      <Kabuk>
        <p className="text-center text-slate-300">Quiz kontrol ediliyor…</p>
      </Kabuk>
    )

  if (asama === 'hata')
    return (
      <Kabuk>
        <p className="text-5xl text-center">🤔</p>
        <h1 className="text-xl font-extrabold text-center">Quiz bulunamadı</h1>
        <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-4">{hataKodu === 'baglanti' ? 'Sunucuya ulaşılamadı. Bağlantını kontrol edip sayfayı yenile.' : HATALAR[hataKodu ?? 'kod_yanlis'] ?? HATALAR.kod_yanlis}</p>
        <Link to="/" className="parlak-buton rounded-2xl py-3 text-center">
          Kodu yeniden gir
        </Link>
      </Kabuk>
    )

  if (asama === 'giris')
    return (
      <Kabuk>
        <p className="text-5xl text-center suzul" aria-hidden>
          📝
        </p>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold renkli-yazi pb-1">{baslik?.baslik || 'Quiz'}</h1>
          <p className="text-xs font-mono text-indigo-300">{baslik?.ders}</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            baslat(numara)
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Öğrenci numaran</span>
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              maxLength={24}
              value={numara}
              onChange={(e) => setNumara(e.target.value)}
              className="giris-kutusu !py-4 text-2xl font-mono tracking-wider text-center"
            />
          </label>
          <button disabled={mesgul || !numara.trim()} className="parlak-buton w-full rounded-2xl py-4 text-lg disabled:opacity-60">
            {mesgul ? 'Başlatılıyor…' : 'Quize başla 🚀'}
          </button>
          {hata && <p className="text-sm text-rose-200 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
          <p className="text-[11px] text-slate-500 text-center">Yalnızca numaran ve cevapların kaydedilir. Süre başladıktan sonra durmaz.</p>
        </form>
      </Kabuk>
    )

  if (asama === 'bitti')
    return (
      <Kabuk>
        {sonuc && sonuc.dogru / Math.max(1, sonuc.toplam) >= 0.8 && <Konfeti adet={40} />}
        <p className="text-6xl text-center pop" aria-hidden>
          {sonuc ? (sonuc.dogru / Math.max(1, sonuc.toplam) >= 0.5 ? '🎉' : '💪') : '✅'}
        </p>
        <h1 className="text-2xl font-extrabold text-center">Quiz tamamlandı</h1>
        {sonuc ? (
          <p className="text-center">
            <b className="text-5xl font-display font-extrabold renkli-yazi">
              {sonuc.dogru} / {sonuc.toplam}
            </b>
            <span className="block text-slate-300 mt-1">doğru cevap</span>
          </p>
        ) : (
          <p className="text-center text-slate-300">Cevapların kaydedildi. Sonuçları hocan paylaşacak.</p>
        )}
        {hata && <p className="text-sm text-slate-400 text-center">{hata}</p>}
        <Link to="/" className="ikincil-buton !py-3 text-center">
          Ana sayfa
        </Link>
      </Kabuk>
    )

  // asama === 'coz'
  const sorular = paket?.sorular ?? []
  const soru = sorular[sira]
  const cevapli = sorular.filter((x) => cevaplar[x.id] !== undefined).length
  const oran = paket ? kalan / (paket.sure_dk * 60000) : 0

  return (
    <main className="min-h-screen p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-indigo-300 truncate">{paket?.ders}</p>
            <h1 className="font-display font-extrabold truncate">{paket?.baslik}</h1>
          </div>
          <span className={`font-mono font-bold text-lg tabular-nums rounded-full px-3 py-1 ${oran < 0.2 ? 'bg-rose-500/25 text-rose-200 nabiz' : 'bg-white/10'}`}>{dakika(kalan)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full transition-[width] duration-500 ease-linear ${oran < 0.2 ? 'bg-rose-400' : 'bg-linear-to-r from-pink-500 to-violet-500'}`} style={{ width: `${oran * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sorular.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setSira(i)}
              aria-label={`Soru ${i + 1}${cevaplar[x.id] !== undefined ? ', cevaplandı' : ''}`}
              className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                cevaplar[x.id] !== undefined ? 'bg-linear-to-br from-pink-500 to-violet-500' : 'bg-white/10 text-slate-300'
              } ${i === sira ? 'ring-2 ring-white scale-110' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </header>

      {soru && (
        <section key={soru.id} className="cam-panel rounded-3xl p-5 space-y-4 girdi">
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
            Soru {sira + 1} / {sorular.length}
          </p>
          <h2 className="text-xl font-extrabold leading-snug whitespace-pre-line">{soru.soru}</h2>
          <div className="grid gap-3">
            {soru.secenekler.map((x, i) => {
              const sik = SIKLAR[i % SIKLAR.length]
              const secili = cevaplar[soru.id] === i
              return (
                <button
                  key={i}
                  onClick={() => cevapla(soru.id, i)}
                  className={`${sik.renk} rounded-3xl px-4 py-4 flex items-center gap-3 text-left text-lg font-bold active:scale-[0.97] transition-all ${
                    secili ? 'ring-4 ring-white scale-[1.02]' : cevaplar[soru.id] !== undefined ? 'opacity-55' : ''
                  }`}
                >
                  <span className="w-9 h-9 rounded-lg bg-black/25 flex items-center justify-center shrink-0">{secili ? '✓' : sik.harf}</span>
                  <span className="flex-1">{x}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {hata && <p className="text-sm text-amber-200 bg-amber-500/10 rounded-xl p-3">{hata}</p>}

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button className="ikincil-buton !py-4 !text-base" disabled={sira === 0} onClick={() => setSira(sira - 1)}>
          ◀ Önceki
        </button>
        {sira < sorular.length - 1 ? (
          <button className="parlak-buton rounded-full py-4 text-base" onClick={() => setSira(sira + 1)}>
            Sonraki ▶
          </button>
        ) : (
          <button className="parlak-buton rounded-full py-4 text-base disabled:opacity-60" disabled={mesgul} onClick={() => bitir()}>
            {mesgul ? 'Bitiriliyor…' : '🏁 Quizi bitir'}
          </button>
        )}
      </div>
      <button className="text-xs text-slate-400 hover:text-white underline self-center pb-2" disabled={mesgul} onClick={() => bitir()}>
        {cevapli} / {sorular.length} cevaplandı · şimdi bitir
      </button>
    </main>
  )
}

function Kabuk({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-[2rem] p-6 w-full max-w-sm space-y-5 girdi flex flex-col">{children}</section>
    </main>
  )
}
