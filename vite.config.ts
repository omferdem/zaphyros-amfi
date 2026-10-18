import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages siteyi /zaphyros-amfi/ alt yolunda yayınlar.
// Yerel geliştirmede (npm run dev) kök yol kullanılır.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zaphyros-amfi/' : '/',
  plugins: [react(), tailwindcss()],
}))
