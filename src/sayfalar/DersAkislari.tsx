import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Akis, Ders, Sunum } from '../lib/tipler'
import { akisOlustur, akislariGetir, gorselleriHazirla, sunumSil, sunumlariGetir } from '../lib/akis'
import { tarihSaat } from '../lib/bicim'
import { icerigiDisaAktar, icerigiIceAktar, paketiOku } from '../lib/icerikAktar'
import SoruBankasi from './SoruBankasi'
import TopluAkis from '../bilesenler/TopluAkis'

/** Ders sayfasındaki "Ders akışları" sekmesi: akışlar ve dersin sunum kitaplığı. */
export default function DersAkislari({ ders }: { ders: Ders }) {
  const navigate = useNavigate()
  const [akislar, setAkislar] = useState<Akis[] | null>(null)
  const [sunumlar, setSunumlar] = useState<Sunum[]>([])
  const [yeniAd, setYeniAd] = useState('')
  const [isleniyor, setIsleniyor] = useState<{ id: string; metin: string } | null>(null)
  const [donemler, setDonemler] = useState<{ id: string; ad: string; donem: string | null }[]>([])
  const [hata, setHata] = useState<string | null>(null)
  const [aktarmaDurumu, setAktarmaDurumu] = useState<string | null>(null)
  const [bilgi, setBilgi] = useState<string | null>(null)
  // İçe aktarmadan sonra soru paketleri listesi yeniden kurulsun
  const [bankaSurumu, setBankaSurumu] = useState(0)

  const yukle = useCallback(async () => {
    try {
      const [a, s, d] = await Promise.all([
        akislariGetir(ders.subject_id),
        sunumlariGetir(ders.subject_id),
        supabase.from('courses').select('id, ad, donem').eq('subject_id', ders.subject_id).order('olusturuldu'),
      ])
      setAkislar(a)
      setSunumlar(s)
      // Aynı dönemin şubeleri tek satır sayılır (ilk şubenin sayfasına gider).
      const tum = (d.data ?? []) as { id: string; ad: string; donem: string | null }[]
      setDonemler(tum.filter((x, i) => tum.findIndex((y) => y.donem === x.donem) === i))
    } catch {
      setHata('Akışlar yüklenemedi.')
    }
  }, [ders.subject_id])

  useEffect(() => {
    yukle()
  }, [yukle])

  async function olustur(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    try {
      const akis = await akisOlustur(ders.subject_id, yeniAd || `${(akislar?.length ?? 0) + 1}. hafta`)
      navigate(`/panel/akis/${akis.id}`)
    } catch {
      setHata('Akış oluşturulamadı.')
    }
  }

  async function akisSil(a: Akis) {
    if (!window.confirm(`"${a.ad}" akışı silinecek. Sunum dosyaları kitaplıkta kalır. Emin misin?`)) return
    const { error } = await supabase.from('lessons').delete().eq('id', a.id)
    if (error) setHata('Akış silinemedi.')
    yukle()
  }

  async function disaAktar() {
    setHata(null)
    setBilgi(null)
    try {
      await icerigiDisaAktar(ders.subject_id, ders.ad, setAktarmaDurumu)
      setBilgi('Paket indirildi. Dosyayı başka bir hocaya gönderebilirsin; öğrenci listesi ve yoklama pakete girmez.')
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Dışa aktarılamadı.')
    }
    setAktarmaDurumu(null)
  }

  async function iceAktar(dosya: File) {
    setHata(null)
    setBilgi(null)
    try {
      setAktarmaDurumu('Paket okunuyor…')
      const { paket, dosyalar } = await paketiOku(dosya)
      const ozet = `${paket.akislar.length} akış, ${paket.sunumlar.length} sunum, ${paket.sorular.length} soru`
      if (!window.confirm(`"${paket.ad}" paketi bu dersin içeriğine eklenecek: ${ozet}. Var olan içerik silinmez. Devam edilsin mi?`)) {
        setAktarmaDurumu(null)
        return
      }
      const r = await icerigiIceAktar(ders.subject_id, paket, dosyalar, setAktarmaDurumu)
      setBilgi(`Eklendi: ${r.akis} akış, ${r.sunum} sunum, ${r.soru} soru.`)
      setBankaSurumu((n) => n + 1)
      yukle()
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İçe aktarılamadı.')
      yukle()
    }
    setAktarmaDurumu(null)
  }

  async function gorselleriYap(s: Sunum) {
    setHata(null)
    setIsleniyor({ id: s.id, metin: 'Hazırlanıyor…' })
    try {
      await gorselleriHazirla(s, (metin) => setIsleniyor({ id: s.id, metin }))
    } catch {
      setHata('Telefon görselleri hazırlanamadı. İnternet bağlantını kontrol edip tekrar dene.')
    }
    setIsleniyor(null)
    yukle()
  }

  async function sunumuSil(s: Sunum) {
    if (!window.confirm(`"${s.ad}" sunumu silinecek. Bu sunumun slaytları bütün akışlardan da çıkar. Emin misin?`)) return
    try {
      await sunumSil(s)
    } catch {
      setHata('Sunum silinemedi.')
    }
    yukle()
  }

  return (
    <div className="space-y-6">
      {hata && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>}
      {bilgi && <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-xl p-3">{bilgi}</p>}

      <p className="text-sm text-slate-400">
        Akışlar ve sunumlar dönemden bağımsız ders içeriğinde durur; her yıl yeniden kullanılır.
        {donemler.length > 1 && (
          <>
            {' '}
            Bu içerik şu dönemlerle ortak:{' '}
            {donemler.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ', '}
                {d.id === ders.id ? <b className="text-slate-200">{d.donem || d.ad}</b> : <Link to={`/panel/ders/${d.id}`} className="underline">{d.donem || d.ad}</Link>}
              </span>
            ))}
            . Burada yaptığın değişiklik hepsinde görünür.
          </>
        )}
      </p>

      <form onSubmit={olustur} className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Yeni ders akışı</h2>
        <p className="text-sm text-slate-400">
          Akış, derste perdede sırayla göstereceğin adımlardır: yoklama, sunum slaytları ve bilgi yarışması soruları.
          Sonraki sürümlerde video ve beyin fırtınası da araya eklenebilecek.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            maxLength={200}
            className="giris-kutusu"
            placeholder={`Akışın adı (ör. ${(akislar?.length ?? 0) + 1}. hafta: Tanrı'nın varlığı)`}
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
          />
          <button className="parlak-buton rounded-xl px-5 py-2.5 font-bold whitespace-nowrap">Oluştur</button>
        </div>
      </form>

      <TopluAkis
        icerikId={ders.subject_id}
        mevcutSayi={akislar?.length ?? 0}
        eklendi={(n) => {
          setBilgi(`${n} akış açıldı. Her birinin içine slayt ve soru ekleyebilirsin.`)
          yukle()
        }}
      />

      {akislar === null ? (
        <p className="text-sm text-slate-400">Yükleniyor…</p>
      ) : akislar.length === 0 ? (
        <p className="text-sm text-slate-400">Bu derste henüz akış yok.</p>
      ) : (
        <ul className="space-y-2">
          {akislar.map((a) => (
            <li key={a.id} className="cam-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.ad}</p>
                <p className="text-xs text-slate-400">{tarihSaat(a.olusturuldu)}</p>
              </div>
              <Link to={`/panel/akis/${a.id}`} className="ikincil-buton">
                Düzenle
              </Link>
              <button className="tehlike-buton" onClick={() => akisSil(a)}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Sunum kitaplığı</h2>
        <p className="text-sm text-slate-400">
          Yüklediğin sunumlar burada durur; aynı sunumu birden fazla akışta ve her yıl kullanabilirsin. Sunum yüklemek için bir akışı
          aç.
        </p>
        {sunumlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz sunum yok.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {sunumlar.map((s) => (
              <li key={s.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate">{s.ad}</span>
                <span className="text-xs text-slate-400">{s.sayfa_sayisi} sayfa</span>
                {isleniyor?.id === s.id ? (
                  <span className="text-xs text-indigo-300">{isleniyor.metin}</span>
                ) : s.gorseller_hazir ? (
                  <span className="text-xs text-emerald-300" title="Telefon modunda öğrencilerin telefonunda görünür">
                    telefon görselleri hazır
                  </span>
                ) : (
                  <button className="ikincil-buton !py-1 !px-2 text-xs" disabled={!!isleniyor} onClick={() => gorselleriYap(s)}>
                    Telefon görsellerini hazırla
                  </button>
                )}
                <button className="tehlike-buton !py-1 !px-2 text-xs" onClick={() => sunumuSil(s)}>
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cam-panel rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">İçeriği paylaş</h2>
        <p className="text-sm text-slate-400">
          Bu dersin akışlarını, sunumlarını ve soru bankasını tek bir .amfi dosyasına aktarıp başka bir hocaya verebilirsin. Hoca dosyayı
          kendi kurulumunda içe aktarır. Öğrenci listesi, şube ve yoklama verisi pakete girmez.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="ikincil-buton" disabled={!!aktarmaDurumu} onClick={disaAktar}>
            Dışa aktar
          </button>
          <label className={`ikincil-buton cursor-pointer ${aktarmaDurumu ? 'opacity-50 pointer-events-none' : ''}`}>
            İçe aktar
            <input
              type="file"
              accept=".amfi,.zip"
              className="hidden"
              disabled={!!aktarmaDurumu}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) iceAktar(f)
              }}
            />
          </label>
          {aktarmaDurumu && <span className="text-sm text-indigo-300">{aktarmaDurumu}</span>}
        </div>
      </section>

      <SoruBankasi key={bankaSurumu} icerikId={ders.subject_id} />
    </div>
  )
}
