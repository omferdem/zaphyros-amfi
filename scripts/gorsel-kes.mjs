#!/usr/bin/env node
// Gemini görsellerini keser ve uygulamanın kullandığı adlara çevirir.
//   gorsel-ham/ogrenci-N-tablo.png  (2x2: koşu, halat, düşüş, sevinç) -> ogrenci-N-kos|cek|dus|sevin.webp
//   gorsel-ham/kahraman-N-tablo.png (3 sütun: vur, düş, sevin)        -> kahraman-N-vur|dus|sevin.webp
//   gorsel-ham/ejderha-tablo.png    (2 sütun: kükre, ateş)            -> ejderha-kukre|ates.webp
//   gorsel-ham/hoca-tablo.png       (2x2: normal, mutlu, zıplar, üzgün) -> hoca-normal|mutlu|ziplar|uzgun.webp
//   gorsel-ham/arka-*.png                                             -> arka-*.webp (1920x1080; arka-kule-gok 1080x1920)
//   diğer tekil nesneler (dag-*, kule-*)                              -> arka planı şeffaf, kırpılmış .webp
// Her çalıştırmada klasör baştan taranır. Çıktı: public/gorseller. Kontrol sayfası: denetim/<etiket>/gorsel-kontrol.html
//
// Kullanım: node scripts/gorsel-kes.mjs [--etiket v0.67] [--ham gorsel-ham]

import sharp from 'sharp'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (ad, v) => {
  const i = process.argv.indexOf(`--${ad}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : v
}
const ETIKET = arg('etiket', 'v0.67')
const HAM = join(KOK, arg('ham', 'gorsel-ham'))
const CIKTI = join(KOK, 'public', 'gorseller')
const KONTROL = join(KOK, 'denetim', ETIKET)
mkdirSync(CIKTI, { recursive: true })
mkdirSync(KONTROL, { recursive: true })

const TABLOLAR = [
  { desen: /^ogrenci-(\d+)-tablo\.png$/, sutun: 2, satir: 2, adlar: (n) => [`ogrenci-${n}-kos`, `ogrenci-${n}-cek`, `ogrenci-${n}-dus`, `ogrenci-${n}-sevin`] },
  { desen: /^kahraman-(\d+)-tablo\.png$/, sutun: 3, satir: 1, adlar: (n) => [`kahraman-${n}-vur`, `kahraman-${n}-dus`, `kahraman-${n}-sevin`] },
  { desen: /^(ejderha)-tablo\.png$/, sutun: 2, satir: 1, adlar: () => ['ejderha-kukre', 'ejderha-ates'] },
  { desen: /^(hoca)-tablo\.png$/, sutun: 2, satir: 2, adlar: () => ['hoca-normal', 'hoca-mutlu', 'hoca-ziplar', 'hoca-uzgun'] },
]

const acikBeyaz = (r, g, b) => r > 232 && g > 232 && b > 232
const koyu = (r, g, b) => r < 60 && g < 60 && b < 60

/** RGBA ham tamponu; kenarlardaki ince koyu ayırıcı şeritleri kırpar. */
async function oku(girdi) {
  const { data, info } = await sharp(girdi).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

function kirpKoyuKenar({ data, w, h }) {
  const oran = (kes) => {
    let k = 0
    let n = 0
    for (const [x, y] of kes) {
      const i = (y * w + x) * 4
      if (koyu(data[i], data[i + 1], data[i + 2])) k++
      n++
    }
    return k / n
  }
  let ust = 0
  let alt = h - 1
  let sol = 0
  let sag = w - 1
  const satir = (y) => Array.from({ length: w }, (_, x) => [x, y])
  const sutun = (x) => Array.from({ length: h }, (_, y) => [x, y])
  while (ust < h / 4 && oran(satir(ust)) > 0.5) ust++
  while (alt > (h * 3) / 4 && oran(satir(alt)) > 0.5) alt--
  while (sol < w / 4 && oran(sutun(sol)) > 0.5) sol++
  while (sag > (w * 3) / 4 && oran(sutun(sag)) > 0.5) sag--
  // ince çizginin anti-alias kenarı için 2 px pay
  ust = Math.min(h - 1, ust > 0 ? ust + 2 : ust)
  sol = Math.min(w - 1, sol > 0 ? sol + 2 : sol)
  alt = Math.max(0, alt < h - 1 ? alt - 2 : alt)
  sag = Math.max(0, sag < w - 1 ? sag - 2 : sag)
  const yw = sag - sol + 1
  const yh = alt - ust + 1
  const yeni = Buffer.alloc(yw * yh * 4)
  for (let y = 0; y < yh; y++) data.copy(yeni, y * yw * 4, ((ust + y) * w + sol) * 4, ((ust + y) * w + sol + yw) * 4)
  return { data: yeni, w: yw, h: yh }
}

/** Kenardan başlayarak bağlantılı beyaz alanı şeffaf yapar (karakterin içindeki beyaz kalır), kenarı 1 px yumuşatır. */
function beyaziSil({ data, w, h }) {
  const ziyaret = new Uint8Array(w * h)
  const yigin = []
  const dene = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (ziyaret[p]) return
    const i = p * 4
    if (!acikBeyaz(data[i], data[i + 1], data[i + 2]) && !koyu(data[i], data[i + 1], data[i + 2]) && data[i + 3] > 0) return
    if (koyu(data[i], data[i + 1], data[i + 2]) && !(x < 3 || y < 3 || x >= w - 3 || y >= h - 3)) return
    ziyaret[p] = 1
    yigin.push(p)
  }
  for (let x = 0; x < w; x++) {
    dene(x, 0)
    dene(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    dene(0, y)
    dene(w - 1, y)
  }
  while (yigin.length) {
    const p = yigin.pop()
    const x = p % w
    const y = (p - x) / w
    dene(x + 1, y)
    dene(x - 1, y)
    dene(x, y + 1)
    dene(x, y - 1)
  }
  for (let p = 0; p < w * h; p++) if (ziyaret[p]) data[p * 4 + 3] = 0
  // 1 px yumuşatma: şeffafla komşu olan opak pikseller yarı saydam olur
  const kopya = Buffer.from(data)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (kopya[p * 4 + 3] === 0) continue
      if (kopya[(p - 1) * 4 + 3] === 0 || kopya[(p + 1) * 4 + 3] === 0 || kopya[(p - w) * 4 + 3] === 0 || kopya[(p + w) * 4 + 3] === 0) data[p * 4 + 3] = 140
    }
  }
  return { data, w, h }
}

function sinirKutusu({ data, w, h }) {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

async function yaz(rgba, ad, { kare = true } = {}) {
  const kutu = sinirKutusu(rgba)
  if (!kutu) throw new Error(`${ad}: boş görsel`)
  const kesit = sharp(rgba.data, { raw: { width: rgba.w, height: rgba.h, channels: 4 } }).extract({ left: kutu.x0, top: kutu.y0, width: kutu.x1 - kutu.x0 + 1, height: kutu.y1 - kutu.y0 + 1 })
  if (kare) {
    // 512x512: ayaklar aynı taban çizgisinde (y=496), yatayda ortalı
    const ic = await kesit.resize({ width: 480, height: 480, fit: 'inside' }).png().toBuffer()
    const m = await sharp(ic).metadata()
    await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: ic, left: Math.round((512 - m.width) / 2), top: 496 - m.height }])
      .webp({ quality: 85, alphaQuality: 90 })
      .toFile(join(CIKTI, `${ad}.webp`))
  } else {
    await kesit.resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90 }).toFile(join(CIKTI, `${ad}.webp`))
  }
}

const uretilen = []
const uyari = []
const dosyalar = readdirSync(HAM).filter((f) => f.toLowerCase().endsWith('.png'))

for (const f of dosyalar) {
  const tablo = TABLOLAR.map((t) => ({ t, m: f.match(t.desen) })).find((x) => x.m)
  if (tablo) {
    const { t, m } = tablo
    const adlar = t.adlar(m[1])
    const tam = await oku(join(HAM, f))
    const hw = Math.floor(tam.w / t.sutun)
    const hh = Math.floor(tam.h / t.satir)
    for (let r = 0; r < t.satir; r++) {
      for (let c = 0; c < t.sutun; c++) {
        const ad = adlar[r * t.sutun + c]
        const hucre = await oku(await sharp(join(HAM, f)).extract({ left: c * hw, top: r * hh, width: hw, height: hh }).png().toBuffer())
        try {
          await yaz(beyaziSil(kirpKoyuKenar(hucre)), ad)
          uretilen.push(ad)
        } catch (e) {
          uyari.push(e.message)
        }
      }
    }
    continue
  }
  const ad = f.replace(/\.png$/i, '')
  if (ad.startsWith('arka-')) {
    const dikey = ad === 'arka-kule-gok'
    await sharp(join(HAM, f)).resize(dikey ? 1080 : 1920, dikey ? 1920 : 1080, { fit: 'cover' }).webp({ quality: 82 }).toFile(join(CIKTI, `${ad}.webp`))
    uretilen.push(ad)
    continue
  }
  try {
    await yaz(beyaziSil(await oku(join(HAM, f))), ad, { kare: false })
    uretilen.push(ad)
  } catch (e) {
    uyari.push(e.message)
  }
}

// Kontrol sayfası: her görsel koyu ve açık zeminde
const kart = (ad) => `<figure><div class="z k"><img src="../../public/gorseller/${ad}.webp"></div><div class="z a"><img src="../../public/gorseller/${ad}.webp"></div><figcaption>${ad}</figcaption></figure>`
writeFileSync(
  join(KONTROL, 'gorsel-kontrol.html'),
  `<!doctype html><meta charset="utf-8"><title>Görsel kontrol</title><style>body{margin:0;background:#222;font:12px sans-serif;color:#ddd}main{display:grid;grid-template-columns:repeat(auto-fill,300px);gap:10px;padding:10px}figure{margin:0}.z{height:150px;display:inline-block;width:148px;text-align:center}.k{background:#0b1030}.a{background:#f4f4f4}img{max-width:100%;max-height:150px}</style><main>${uretilen.map(kart).join('')}</main>`,
)
console.log(`${uretilen.length} görsel üretildi`)
if (uyari.length) console.log('Uyarılar:\n' + uyari.join('\n'))
