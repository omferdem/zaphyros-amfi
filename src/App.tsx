import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Katil from './sayfalar/Katil'

// Öğrenci telefonu yalnızca Katil sayfasını indirir; hoca sayfaları ayrı paketlerde gelir.
const HocaAlani = lazy(() => import('./bilesenler/HocaAlani'))
const Panel = lazy(() => import('./sayfalar/Panel'))
const DersDetay = lazy(() => import('./sayfalar/DersDetay'))
const OturumDetay = lazy(() => import('./sayfalar/OturumDetay'))
const Sahne = lazy(() => import('./sayfalar/Sahne'))

export default function App() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Yükleniyor…</main>}>
      <Routes>
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route element={<HocaAlani />}>
          <Route path="/panel" element={<Panel />} />
          <Route path="/panel/ders/:dersId" element={<DersDetay />} />
          <Route path="/panel/oturum/:oturumId" element={<OturumDetay />} />
        </Route>
        <Route element={<HocaAlani cercevesiz />}>
          <Route path="/sahne/:oturumId" element={<Sahne />} />
        </Route>
        <Route path="/katil" element={<Katil />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </Suspense>
  )
}
