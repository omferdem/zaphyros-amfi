import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import { ayarlariYukle } from './lib/ayarlar'
import KurulumEksik from './bilesenler/KurulumEksik'

// HashRouter: GitHub Pages alt sayfalarda (ör. /katil) 404 vermesin diye
// adresler #/katil biçiminde tutulur. QR linkleri de bu biçimde üretilir.
const kok = createRoot(document.getElementById('root')!)

ayarlariYukle().then(async (ayar) => {
  if (!ayar) {
    kok.render(<KurulumEksik />)
    return
  }
  // Uygulama (ve Supabase istemcisi) ayarlar okunduktan sonra yüklenir.
  const { default: App } = await import('./App.tsx')
  kok.render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
})
