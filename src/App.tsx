import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Katil from './sayfalar/Katil'

// Öğrenci telefonu yalnızca Katil sayfasını indirir; hoca sayfaları ayrı paketlerde gelir.
const HocaAlani = lazy(() => import('./bilesenler/HocaAlani'))
const Panel = lazy(() => import('./sayfalar/Panel'))
const DersDetay = lazy(() => import('./sayfalar/DersDetay'))
const OturumDetay = lazy(() => import('./sayfalar/OturumDetay'))
const AkisDuzenle = lazy(() => import('./sayfalar/AkisDuzenle'))
const HaftaPlani = lazy(() => import('./sayfalar/HaftaPlani'))
const Sahne = lazy(() => import('./sayfalar/Sahne'))
const Kumanda = lazy(() => import('./sayfalar/Kumanda'))

const bekle = <main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Yükleniyor…</main>

/**
 * Sitenin kök adresi: perdede yazan adres budur. Öğrenci ders kodunu girer;
 * giriş yapmış hoca doğrudan paneline gider.
 */
function KokSayfa() {
  const [hoca, setHoca] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHoca(!!data.session))
  }, [])
  if (hoca === undefined) return bekle
  // E-postadaki giriş bağlantısı da köke döner (?code=... ya da hata). Bunlar hoca girişidir.
  const girisDonusu = /[?&](code|error|error_code)=/.test(window.location.search)
  return hoca || girisDonusu ? <Navigate to="/panel" replace /> : <Katil />
}

export default function App() {
  return (
    <Suspense fallback={bekle}>
      <Routes>
        <Route path="/" element={<KokSayfa />} />
        <Route element={<HocaAlani />}>
          <Route path="/panel" element={<Panel />} />
          <Route path="/panel/ders/:dersId" element={<DersDetay />} />
          <Route path="/panel/plan/:donemId/:icerikId" element={<HaftaPlani />} />
          <Route path="/panel/akis/:akisId" element={<AkisDuzenle />} />
          <Route path="/panel/oturum/:oturumId" element={<OturumDetay />} />
        </Route>
        <Route element={<HocaAlani cercevesiz />}>
          <Route path="/sahne/:oturumId" element={<Sahne />} />
        </Route>
        <Route path="/katil" element={<Katil />} />
        <Route path="/kumanda" element={<Kumanda />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
