import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Göreli yol: site hangi adreste yayınlanırsa yayınlansın çalışır
// (GitHub Pages'te depo adı ne olursa olsun, ya da başka bir statik sunucuda).
// Sayfa yönlendirmesi HashRouter ile yapıldığı için alt sayfalar da sorunsuz açılır.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
