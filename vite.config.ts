import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'node:fs'

// Yayın doğrulaması için sürüm bilgisini surum.json olarak yayına koyar.
function surumDosyasi(): Plugin {
  return {
    name: 'surum-dosyasi',
    generateBundle() {
      const surum = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
      this.emitFile({ type: 'asset', fileName: 'surum.json', source: JSON.stringify({ surum }) })
    },
  }
}

// Göreli yol: site hangi adreste yayınlanırsa yayınlansın çalışır
// (GitHub Pages'te depo adı ne olursa olsun, ya da başka bir statik sunucuda).
// Sayfa yönlendirmesi HashRouter ile yapıldığı için alt sayfalar da sorunsuz açılır.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), surumDosyasi()],
})
