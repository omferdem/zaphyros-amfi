// public/favicon.svg dosyasından uygulama simgesini (build/icon.png, 512x512) üretir.
// Kullanım: npm run ikon   (simge değişmedikçe gerekmez; üretilen dosya repoda durur)
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(fileURLToPath(new URL('../public/favicon.svg', import.meta.url)), 'utf8')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 }, background: 'rgba(0,0,0,0)' }).render().asPng()
mkdirSync(fileURLToPath(new URL('./build', import.meta.url)), { recursive: true })
writeFileSync(fileURLToPath(new URL('./build/icon.png', import.meta.url)), png)
console.log('build/icon.png üretildi', png.length, 'bayt')
