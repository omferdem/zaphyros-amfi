#!/usr/bin/env node
// Görsel denetim kapısı (Playwright). Gerçek bir TEST-BOT oturumu kurar, sahneyi her durumda ve her ekran boyutunda açar,
// ekran görüntüsü alır ve çakışma/taşma ölçümleri yapar. Ölçüm ihlali varsa süreç 1 koduyla çıkar.
//
// Kullanım:
//   npm run gorsel-denetim -- [--etiket v0.66] [--hazir] [--durum yoklama,slayt] [--ekran projeksiyon,telefon-390] [--yumusak]
//   --hazir     dist/ zaten derlenmiş (derlemeyi atlar)
//   --yumusak   ihlal olsa da 0 ile çıkar (yalnızca ekran görüntüsü toplamak için)
//
// Gerekli: denetim/.gizli-sifre dosyası ya da GORSEL_DENETIM_SIFRE ortam değişkeni (geçici test hocasının şifresi),
// e-posta GORSEL_DENETIM_EPOSTA (varsayılan gorsel-denetim@ornek.test). Test verisi iş bitince silinir.

import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { spawn, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..')
const AYAR = JSON.parse(readFileSync(join(KOK, 'public', 'ayarlar.json'), 'utf8'))
const arg = (ad, v = null) => {
  const i = process.argv.indexOf(`--${ad}`)
  return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : v
}
const ETIKET = arg('etiket', 'v0.66')
const PORT = 4199
const BASE = `http://localhost:${PORT}/`
const CIKTI = join(KOK, 'denetim', ETIKET)
mkdirSync(CIKTI, { recursive: true })
const EPOSTA = process.env.GORSEL_DENETIM_EPOSTA || 'gorsel-denetim@ornek.test'
const SIFRE = process.env.GORSEL_DENETIM_SIFRE || (existsSync(join(KOK, 'denetim', '.gizli-sifre')) ? readFileSync(join(KOK, 'denetim', '.gizli-sifre'), 'utf8').trim() : '')
if (!SIFRE) throw new Error('Test hocasının şifresi yok (denetim/.gizli-sifre).')

const EKRANLAR = {
  projeksiyon: [1280, 720],
  'projeksiyon-tam': [1920, 1080],
  'dar-laptop-1366': [1366, 768],
  'dar-laptop-1024': [1024, 768],
  'telefon-360': [360, 640],
  'telefon-390': [390, 844],
  'telefon-412': [412, 915],
  'telefon-yatay': [844, 390],
}
// Oyun durumları için kısa liste (hepsini her boyutta almak çok uzun sürer)
const OYUN_EKRANLARI = ['projeksiyon', 'projeksiyon-tam', 'dar-laptop-1024', 'telefon-390']
const OYUNLAR = ['zombi', 'roket', 'ejderha', 'arena', 'kule', 'kale', 'orman', 'halat', 'merdiven', 'hoca']

const durumFiltresi = (arg('durum', '') || '').split(',').filter(Boolean)
const ekranFiltresi = (arg('ekran', '') || '').split(',').filter(Boolean)
const istenen = (d) => durumFiltresi.length === 0 || durumFiltresi.some((f) => d.startsWith(f))
const NL = String.fromCharCode(10)
const bekle = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), ...a)

const UZUN_SORU =
  'Skinner ve Sarpong\'un geocaching üzerine yaptığı çalışmada, özel ilgi turizminin yerel ekonomiye katkısı, katılımcı profilinin kuşaklara göre dağılımı ve destinasyon seçim davranışı birlikte ele alınırken, aşağıdakilerden hangisi araştırmacıların vardığı temel sonuç olarak gösterilebilir?'
const UZUN_SIK = 'Yerel işletmelerin sürece katılması, kutu sayısından ve teknolojik altyapıdan daha belirleyici bir başarı etkenidir'

async function main() {
  // 1) Derleme ve sunucu
  if (!arg('hazir')) {
    log('derleniyor…')
    execSync('npm run build', { cwd: KOK, stdio: 'ignore' })
  }
  const sunucu = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: KOK, shell: true, stdio: 'ignore' })
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {
      /* henüz açılmadı */
    }
    await bekle(500)
  }

  // 2) Test hocası, ders, sorular, sunum, akış, oturum
  const sb = createClient(AYAR.supabaseUrl, AYAR.supabaseKey, { auth: { persistSession: false } })
  const { data: giris, error: girisHatasi } = await sb.auth.signInWithPassword({ email: EPOSTA, password: SIFRE })
  if (girisHatasi || !giris.session) throw new Error('Test hocası girişi başarısız: ' + girisHatasi?.message)
  const oturumJson = JSON.stringify(giris.session)
  const depoAnahtari = `sb-${new URL(AYAR.supabaseUrl).hostname.split('.')[0]}-auth-token`

  await temizle(sb)
  const { data: ders, error: dersHatasi } = await sb.from('courses').insert({ ad: 'TEST-BOT Denetim', donem: 'TEST-DENETIM' }).select('id, subject_id').single()
  if (dersHatasi) throw dersHatasi
  const soruSatirlari = Array.from({ length: 20 }, (_, i) => ({
    subject_id: ders.subject_id,
    soru: i === 0 ? UZUN_SORU : `Denetim sorusu ${i + 1}: kısa bir soru metni?`,
    dogru: i === 0 ? UZUN_SIK : `Doğru ${i + 1}`,
    yanlislar: i === 0 ? [UZUN_SIK + ' değildir', 'Reklam bütçesinin büyüklüğü', 'Havalimanına yakınlık'] : ['Yanlış A', 'Yanlış B', 'Yanlış C'],
    sure_sn: 60,
    ek: { paket: 'Denetim Paketi' },
    olusturuldu: new Date(Date.now() + i).toISOString(),
  }))
  const { data: sorular } = await sb.from('questions').insert(soruSatirlari).select('id, olusturuldu')
  sorular.sort((a, b) => a.olusturuldu.localeCompare(b.olusturuldu))
  const { data: sunum } = await sb
    .from('presentations')
    .insert({
      subject_id: ders.subject_id,
      ad: 'Denetim Sunumu',
      sayfa_sayisi: 2,
      metinler: ['Birinci slayt: Özel ilgi turizmi\nGeocaching, GPS ile oynanan bir hazine avıdır. Bu satır slaydın ilk satırıdır ve araç çubuğu tarafından örtülmemelidir.', 'İkinci slayt\nİkinci sayfanın metni burada.'],
    })
    .select('id')
    .single()
  const pdf = ornekPdf([
    { baslik: 'Ozel ilgi turizmi: Geocaching', satirlar: ['Ilk satir araci cubugu tarafindan ortulmemeli', 'GPS ile oynanan bir hazine avidir', 'Yerel isletmelerin katilimi belirleyicidir'] },
    { baslik: 'Ikinci slayt', satirlar: ['Ikinci sayfanin metni burada', 'Kod seridi bu metne degmemeli'] },
  ])
  const yukleme = await sb.storage.from('sunumlar').upload(`${ders.subject_id}/${sunum.id}.pdf`, pdf, { contentType: 'application/pdf', upsert: true })
  if (yukleme.error) throw yukleme.error
  const { data: akis } = await sb.from('lessons').insert({ subject_id: ders.subject_id, ad: 'Denetim Akışı', sira: 0 }).select('id').single()
  const { data: adimlar } = await sb
    .from('lesson_steps')
    .insert([
      { lesson_id: akis.id, sira: 0, tur: 'slayt', presentation_id: sunum.id, sayfa_no: 1 },
      { lesson_id: akis.id, sira: 1, tur: 'slayt', presentation_id: sunum.id, sayfa_no: 2 },
      { lesson_id: akis.id, sira: 2, tur: 'soru', question_id: sorular[0].id },
      { lesson_id: akis.id, sira: 3, tur: 'soru', question_id: sorular[1].id },
    ])
    .select('id, sira')
  adimlar.sort((a, b) => a.sira - b.sira)
  const { data: oturum } = await sb.from('sessions').insert({ course_id: ders.id, lesson_id: akis.id, baslik: 'Denetim' }).select('id').single()
  const SID = oturum.id
  log('oturum', SID)

  // 3) Tarayıcı
  const tarayici = await chromium.launch()
  const sonuclar = []
  const ihlalToplam = []
  const baglamlar = new Map()
  let depo = '{}'
  async function sayfaAc(ekran) {
    const [w, h] = EKRANLAR[ekran]
    const baglam = await tarayici.newContext({ viewport: { width: w, height: h }, hasTouch: w <= 500 || h <= 450, deviceScaleFactor: 1 })
    await baglam.addInitScript(([k, v, d]) => {
      try {
        for (const [a, b] of Object.entries(JSON.parse(d))) localStorage.setItem(a, b)
        localStorage.setItem(k, v)
      } catch {
        /* önemsiz */
      }
    }, [depoAnahtari, oturumJson, depo])
    const sayfa = await baglam.newPage()
    baglamlar.set(sayfa, baglam)
    return sayfa
  }
  async function sayfaKapat(sayfa) {
    await baglamlar.get(sayfa)?.close()
    baglamlar.delete(sayfa)
  }

  async function olc(sayfa, durum, ekran) {
    const dosya = `${durum}__${ekran}.png`
    await sayfa.mouse.move(Math.round(sayfa.viewportSize().width / 2), 6)
    await sayfa.waitForTimeout(500)
    await sayfa.screenshot({ path: join(CIKTI, dosya) })
    const ihlaller = await sayfa.evaluate(olcumBetigi)
    sonuclar.push({ durum, ekran, dosya, ihlaller })
    for (const i of ihlaller) ihlalToplam.push(`${dosya}: ${i}`)
    log(ihlaller.length ? `✗ ${dosya} (${ihlaller.length})` : `✓ ${dosya}`)
  }

  async function durumuYakala(durum, ekranlar) {
    if (!istenen(durum)) return
    for (const ekran of ekranlar) {
      if (ekranFiltresi.length && !ekranFiltresi.includes(ekran)) continue
      const sayfa = await sayfaAc(ekran)
      try {
        await sayfa.goto(`${BASE}#/sahne/${SID}`)
        await sayfa.waitForTimeout(3000)
        await olc(sayfa, durum, ekran)
      } catch (e) {
        log('hata', durum, ekran, e.message)
        ihlalToplam.push(`${durum}__${ekran}: yakalanamadı (${e.message})`)
      }
      await sayfaKapat(sayfa)
    }
  }
  const adimYaz = (aktif_adim, yoklama_acik) => sb.from('sessions').update({ aktif_adim, yoklama_acik, bitti: null }).eq('id', SID)

  // Çekirdek durumlar
  await adimYaz(null, true)
  await durumuYakala('yoklama', Object.keys(EKRANLAR))
  await adimYaz(adimlar[0].id, false)
  await durumuYakala('slayt-metinli', Object.keys(EKRANLAR))
  // Lazer ve kalem testi: lazer çizmez ve tıklamayı geçirir; kalem çizer
  if (istenen('arac')) {
    const sayfa = await sayfaAc('projeksiyon')
    try {
      await adimYaz(adimlar[0].id, false)
      await sayfa.goto(`${BASE}#/sahne/${SID}`)
      await sayfa.waitForTimeout(3000)
      const piksel = () =>
        sayfa.evaluate(() => {
          const c = document.querySelector('.perde-alan canvas')
          if (!c) return -1
          const g = c.getContext('2d')
          const veri = g.getImageData(0, 0, c.width, c.height).data
          let n = 0
          for (let i = 3; i < veri.length; i += 4) if (veri[i] > 0) n++
          return n
        })
      const surukle = async () => {
        await sayfa.mouse.move(300, 200)
        await sayfa.mouse.down()
        for (let i = 0; i < 12; i++) await sayfa.mouse.move(300 + i * 40, 200 + i * 15)
        await sayfa.mouse.up()
      }
      await sayfa.locator('button[title^="Lazer"]').click()
      await sayfa.waitForTimeout(400)
      await surukle()
      const lazerPiksel = await piksel()
      const ustte = await sayfa.evaluate(() => {
        const e = document.elementFromPoint(640, 360)
        return e && e.closest('.perde-alan') ? 'CIZIM-KATMANI' : e ? e.tagName : 'yok'
      })
      if (lazerPiksel > 0) ihlalToplam.push(`lazer testi: lazer çizim yaptı (${lazerPiksel} piksel)`)
      if (ustte === 'CIZIM-KATMANI') ihlalToplam.push('lazer testi: lazer açıkken tıklama canvas tarafından yutuluyor')
      await sayfa.locator('button[title^="Lazer"]').click()
      await sayfa.locator('button[title^="Kalem"]').click()
      await sayfa.waitForTimeout(400)
      await surukle()
      const kalemPiksel = await piksel()
      if (kalemPiksel <= 0) ihlalToplam.push('kalem testi: kalem açıkken sürükleme çizim bırakmadı')
      log(`arac testi: lazer piksel=${lazerPiksel}, üstteki öğe=${ustte}, kalem piksel=${kalemPiksel}`)
    } catch (e) {
      ihlalToplam.push(`arac testi çalışmadı: ${e.message}`)
    }
    await sayfaKapat(sayfa)
  }
  await adimYaz(adimlar[2].id, false)
  await durumuYakala('zapoot-uzun-soru', Object.keys(EKRANLAR))
  await sb.from('sessions').update({ soru_durum: 'sonuc' }).eq('id', SID)
  await durumuYakala('zapoot-sonuc', OYUN_EKRANLARI)

  // Oyun durumları: sürücü sayfa oyunu kumanda isteğiyle başlatır, botlar oynar
  const oyunlar = OYUNLAR.filter((o) => istenen(`oyun-${o}`))
  if (oyunlar.length) {
    const bot = spawn('node', ['scripts/bot.mjs', '--oturum', SID, '--n', '12', '--takim', '3', '--gecikme', '1-4'], { cwd: KOK, stdio: 'ignore' })
    const surucu = await sayfaAc('projeksiyon')
    await surucu.goto(`${BASE}#/sahne/${SID}`)
    await surucu.waitForTimeout(3000)
    // Oyun seçimi hocanın tarayıcısında (localStorage) tutulur; yeni sayfalar da aynı depoyla açılsın
    const surucuDepoyuYay = async () => {
      depo = await surucu.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))
    }
    for (const mod of oyunlar) {
      log('oyun', mod)
      await surucuDepoyuYay()
      await sb.from('sessions').update({ kumanda_istek: { tur: 'kahoot', paket: 'Denetim Paketi', mod, adet: mod === 'merdiven' ? 15 : 6, zorluk: 'orta', sure: 0, t: Date.now() } }).eq('id', SID)
      await surucu.waitForTimeout(9000)
      await surucuDepoyuYay()
      await durumuYakala(`oyun-${mod}-soru`, OYUN_EKRANLARI)
      await sb.from('sessions').update({ soru_durum: 'sonuc' }).eq('id', SID)
      await surucu.waitForTimeout(1500)
      await durumuYakala(`oyun-${mod}-sonuc`, OYUN_EKRANLARI)
      await sb.from('sessions').update({ kumanda_istek: { tur: 'derse_don', t: Date.now() } }).eq('id', SID)
      await surucu.waitForTimeout(3000)
    }
    await sayfaKapat(surucu)
    bot.kill()
  }

  await tarayici.close()
  writeFileSync(join(CIKTI, 'rapor.json'), JSON.stringify({ surum: ETIKET, sonuclar }, null, 2))
  await temizle(sb)
  sunucu.kill()
  try {
    execSync(`taskkill /pid ${sunucu.pid} /T /F`, { stdio: 'ignore' })
  } catch {
    /* zaten kapandı */
  }

  if (ihlalToplam.length) {
    console.log(`\n${ihlalToplam.length} ihlal:\n` + ihlalToplam.join('\n'))
    if (!arg('yumusak')) process.exit(1)
  } else log('ihlal yok')
}

/** Küçük bir 16:9 PDF üretir (her sayfa: büyük başlık üstte, gövde satırları altta; kenarlara yakın metin araç çubuğu çakışmasını yakalar). */
function ornekPdf(sayfalar) {
  const nesneler = []
  const ekle = (icerik) => nesneler.push(icerik) && nesneler.length
  ekle('<< /Type /Catalog /Pages 2 0 R >>')
  ekle(`<< /Type /Pages /Kids [${sayfalar.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${sayfalar.length} >>`)
  ekle('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  sayfalar.forEach((p, i) => {
    const akis = ['BT /F1 40 Tf 40 490 Td (' + p.baslik + ') Tj ET', ...p.satirlar.map((l, j) => `BT /F1 22 Tf 40 ${420 - j * 40} Td (${l}) Tj ET`)].join(NL)
    ekle(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`)
    ekle(`<< /Length ${akis.length} >>${NL}stream${NL}${akis}${NL}endstream`)
  })
  let cikti = '%PDF-1.4' + NL
  const ofset = []
  nesneler.forEach((n, i) => {
    ofset.push(cikti.length)
    cikti += `${i + 1} 0 obj${NL}${n}${NL}endobj${NL}`
  })
  const xref = cikti.length
  cikti += `xref${NL}0 ${nesneler.length + 1}${NL}0000000000 65535 f ${NL}` + ofset.map((o) => String(o).padStart(10, '0') + ' 00000 n ' + NL).join('')
  cikti += `trailer${NL}<< /Size ${nesneler.length + 1} /Root 1 0 R >>${NL}startxref${NL}${xref}${NL}%%EOF`
  return Buffer.from(cikti, 'latin1')
}

async function temizle(sb) {
  const { data } = await sb.from('courses').select('id, subject_id').like('ad', 'TEST-BOT Denetim%')
  for (const d of data ?? []) {
    await sb.from('courses').delete().eq('id', d.id)
    await sb.from('subjects').delete().eq('id', d.subject_id)
  }
  await sb.from('terms').delete().eq('ad', 'TEST-DENETIM')
}

/** Sayfa içinde çalışır: ihlal listesi döner. Kanca (data-denetim) olmayan öğeler atlanır. */
function olcumBetigi() {
  const ihlal = []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = (el) => el.getBoundingClientRect()
  const gorunur = (el) => {
    const b = r(el)
    const s = getComputedStyle(el)
    return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const kesisim = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    return x > 1 && y > 1 ? Math.round(x * y) : 0
  }
  if (document.documentElement.scrollWidth > vw + 1) ihlal.push(`yatay taşma: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
  const q = (ad) => [...document.querySelectorAll(`[data-denetim~="${ad}"]`)].filter(gorunur)

  // Araç çubuğu: tek satır, en çok 56 px
  for (const arac of q('arac')) {
    const b = r(arac)
    if (b.height > 56) ihlal.push(`araç çubuğu yüksekliği ${Math.round(b.height)} px (en çok 56)`)
    const dugmeler = [...arac.querySelectorAll('button, a, select, summary')].filter(gorunur).filter((d) => !d.closest('details > div'))
    if (dugmeler.length) {
      const ust = dugmeler.map((d) => Math.round(r(d).top + r(d).height / 2))
      if (Math.max(...ust) - Math.min(...ust) > 6) ihlal.push('araç çubuğu ikinci satıra taşıyor')
    }
    if (b.right > vw + 1) ihlal.push('araç çubuğu ekranın dışına taşıyor')
  }

  // Çakışma yasağı çiftleri
  const ciftler = [
    ['arac', 'icerik'],
    ['kod', 'icerik'],
    ['arac', 'sahne'],
    ['alt', 'sahne'],
    ['arac', 'siklar'],
    ['alt', 'siklar'],
    ['etiket', 'siklar'],
    ['panel', 'sahne-karakter'],
  ]
  for (const [a, b] of ciftler) {
    for (const x of q(a)) for (const y of q(b)) {
      if (x === y || x.contains(y) || y.contains(x)) continue
      const k = kesisim(r(x), r(y))
      if (k) ihlal.push(`çakışma: ${a} × ${b} (${k} px²)`)
    }
  }

  // Şıklar görünür alanda ve üstü kapalı değil
  for (const sik of q('sik')) {
    const b = r(sik)
    if (b.bottom > vh + 1 || b.right > vw + 1 || b.left < -1 || b.top < -1) ihlal.push(`şık ekran dışında: ${sik.textContent?.slice(0, 24)}`)
    const e = document.elementFromPoint(Math.min(vw - 1, Math.max(0, b.left + b.width / 2)), Math.min(vh - 1, Math.max(0, b.top + b.height / 2)))
    if (e && !sik.contains(e) && !e.contains(sik)) ihlal.push(`şık üstü kapalı: ${sik.textContent?.slice(0, 24)}`)
  }

  // Dokunmatik ekranda düğmeler en az 40x40
  if (vw <= 500 || vh <= 450) {
    const kucuk = [...document.querySelectorAll('button')].filter(gorunur).filter((d) => r(d).width < 40 || r(d).height < 40)
    if (kucuk.length) ihlal.push(`${kucuk.length} düğme 40x40 px'ten küçük (ör. "${kucuk[0].textContent?.trim().slice(0, 16)}" ${Math.round(r(kucuk[0]).width)}x${Math.round(r(kucuk[0]).height)})`)
  }
  return ihlal
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
