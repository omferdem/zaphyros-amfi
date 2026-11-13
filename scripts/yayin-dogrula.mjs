// Yayın sonrası otomatik doğrulama: yeni sürüm gerçekten yayında mı, Supabase ayakta mı?
// Kullanım: SITE=https://.../ node scripts/yayin-dogrula.mjs   (GitHub Actions "Yayınla" iş akışının son adımı)
// 1) siteden surum.json okunur, package.json'daki sürümle eşleşene kadar (en çok 6 dakika) beklenir;
// 2) public/ayarlar.json'daki adresle Supabase'in saglik() fonksiyonu çağrılır (yazma yapmaz);
// 3) giriş sayfası ve ayarlar.json'un açıldığı denetlenir.
// Herhangi biri başarısızsa çıkış kodu 1 olur; GitHub iş akışı kırmızı olur ve sahibine bildirim gider.
import { readFileSync } from 'node:fs'

const site = (process.env.SITE ?? '').replace(/\/?$/, '/')
if (site === '/') {
  console.error('SITE tanımlı değil')
  process.exit(1)
}
const paket = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const ayar = JSON.parse(readFileSync(new URL('../public/ayarlar.json', import.meta.url), 'utf8'))
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

async function getir(yol) {
  const r = await fetch(site + yol + (yol.includes('?') ? '&' : '?') + 'kontrol=' + Date.now(), { cache: 'no-store' })
  return r
}

let hatalar = 0
function sonuc(tamam, mesaj) {
  console.log((tamam ? 'TAMAM  ' : 'HATA   ') + mesaj)
  if (!tamam) hatalar++
}

// 1) Sürüm
let yayindaki = null
for (let i = 0; i < 24; i++) {
  try {
    const r = await getir('surum.json')
    if (r.ok) {
      yayindaki = (await r.json()).surum
      if (yayindaki === paket.version) break
    }
  } catch {
    // ağ dalgalanması: yeniden denenir
  }
  await bekle(15000)
}
sonuc(yayindaki === paket.version, `yayındaki sürüm ${yayindaki ?? 'okunamadı'}, beklenen ${paket.version}`)

// 2) Supabase sağlık
try {
  const r = await fetch(`${ayar.supabaseUrl}/rest/v1/rpc/saglik`, {
    method: 'POST',
    headers: { apikey: ayar.supabaseKey, Authorization: `Bearer ${ayar.supabaseKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  sonuc(r.ok, `Supabase saglik() yanıtı: ${r.status}`)
} catch (e) {
  sonuc(false, `Supabase'e ulaşılamadı: ${e.message}`)
}

// 3) Sayfalar
for (const yol of ['', 'ayarlar.json']) {
  try {
    const r = await getir(yol)
    sonuc(r.ok, `/${yol} açıldı (${r.status})`)
  } catch (e) {
    sonuc(false, `/${yol} açılamadı: ${e.message}`)
  }
}

process.exit(hatalar ? 1 : 0)
