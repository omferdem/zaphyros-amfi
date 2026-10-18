import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// HashRouter: GitHub Pages alt sayfalarda (ör. /katil) 404 vermesin diye
// adresler #/katil biçiminde tutulur. QR linkleri de bu biçimde üretilecek.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
