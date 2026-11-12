import { useEffect, useMemo, useState } from 'react'
import type { Ders, Ogrenci, Oturum } from '../lib/tipler'
import { sorulariGetir } from '../lib/akis'
import { oturumCevaplari, oturumKatilimlari } from '../lib/veri'
import { gelisimHesapla, type CevapKaydi, type KatilimKaydi, type Olcut } from '../lib/gelisim'
import { gelisimiExceleAktar } from '../lib/rapor'
import GelisimGorunumu, { OLCUTLER } from '../bilesenler/GelisimGorunumu'
import type { Soru } from '../lib/tipler'

/** Ders sayfasındaki "Gelişim" sekmesi: bilgi yarışması cevaplarından öğrenci x konu başarısı. */
export default function Gelisim({ ders, ogrenciler, oturumlar }: { ders: Ders; ogrenciler: Ogrenci[]; oturumlar: Oturum[] }) {
  const [veri, setVeri] = useState<{ cevaplar: CevapKaydi[]; katilimlar: KatilimKaydi[]; sorular: Soru[] } | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [olcut, setOlcut] = useState<Olcut>('otomatik')

  const oturumKimlikleri = useMemo(() => oturumlar.map((o) => o.id), [oturumlar])

  useEffect(() => {
    let iptal = false
    setVeri(null)
    Promise.all([oturumCevaplari(oturumKimlikleri), oturumKatilimlari(oturumKimlikleri), sorulariGetir(ders.subject_id)])
      .then(([cevaplar, katilimlar, sorular]) => {
        if (!iptal) setVeri({ cevaplar, katilimlar, sorular })
      })
      .catch(() => !iptal && setHata('Gelişim verisi yüklenemedi.'))
    return () => {
      iptal = true
    }
  }, [oturumKimlikleri, ders.subject_id])

  const sonuc = useMemo(
    () => (veri ? gelisimHesapla(ogrenciler, veri.cevaplar, veri.katilimlar, veri.sorular, oturumlar, olcut) : null),
    [veri, ogrenciler, oturumlar, olcut],
  )

  if (hata) return <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl p-3">{hata}</p>
  if (!sonuc) return <p className="text-sm text-slate-400">Yükleniyor…</p>

  if (sonuc.toplamCevap === 0)
    return (
      <div className="cam-panel rounded-3xl p-6 space-y-3">
        <h2 className="text-lg font-extrabold">📈 Henüz izlenecek bir yarışma cevabı yok</h2>
        <p className="text-sm text-slate-300">
          Bu şubede bilgi yarışması oynadıkça öğrencilerin konu konu başarısı burada görünür. Gelişimin öğrenciye bağlanması
          için yarışmayı <b>yoklamalı</b> (öğrenci numarasıyla girilen) bir derste oynat; takma adla oynayanlar izlenemez.
        </p>
        <p className="text-sm text-slate-400">Konu, sorudaki #OUTCOME (kazanım) ya da soru paketinin adından alınır.</p>
      </div>
    )

  return (
    <GelisimGorunumu
      sonuc={sonuc}
      olcut={olcut}
      setOlcut={setOlcut}
      excel={() => gelisimiExceleAktar(ders, sonuc, OLCUTLER.find(([k]) => k === olcut)?.[1].split(' (')[0] ?? '')}
    />
  )
}
