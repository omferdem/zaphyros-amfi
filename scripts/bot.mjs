#!/usr/bin/env node
// Gerçek ders test botu: açık bir TEST-BOT dersine N sanal öğrenci katar ve her soruya cevap verir.
// Gerçek RPC'leri (takma_ad_al, cevap_ver) anon anahtarla çağırır; hoca girişi ya da servis anahtarı gerekmez.
//
// Kullanım:
//   node scripts/bot.mjs --oturum <oturum-uuid> [--n 30] [--basari 0.6] [--gecikme 1-15]
//   node scripts/bot.mjs --kod 123456 [--n 30] ...
//
// Önce panelde adı "TEST-BOT" ile başlayan bir ders (şube) açıp dersi başlatın. Gerçek derslere cevap verilmez:
// doğru şıkkı veren test_dogru_index işlevi yalnızca TEST-BOT derslerinde çalışır.
// Başarı oranı: her bot, doğru şıkkı bu olasılıkla seçer; aksi hâlde rastgele yanlış şık seçer.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AYAR = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ayarlar.json'), 'utf8'))

function arg(ad, varsayilan) {
  const i = process.argv.indexOf(`--${ad}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : varsayilan
}

const N = Math.max(1, Math.min(250, Number(arg('n', 30))))
const BASARI = Math.max(0, Math.min(1, Number(arg('basari', 0.6))))
const [GEC_MIN, GEC_MAX] = String(arg('gecikme', '1-15')).split('-').map(Number)
let oturum = arg('oturum', null)
const kod = arg('kod', null)

const sb = createClient(AYAR.supabaseUrl, AYAR.supabaseKey, { auth: { persistSession: false } })

const ADLAR = [
  'Ayşe', 'Mehmet', 'Elif', 'Mustafa', 'Zeynep', 'Ahmet', 'Fatma', 'Ali', 'Hatice', 'Hasan', 'Emine', 'Hüseyin', 'Merve', 'İbrahim', 'Büşra', 'Yusuf',
  'Esra', 'Ömer', 'Kübra', 'Emre', 'Rabia', 'Burak', 'Seda', 'Kemal', 'Sena', 'Murat', 'Gül', 'Eren', 'Nur', 'Can', 'Derya', 'Selim', 'Tuğba', 'Fatih',
  'Selin', 'Furkan', 'Ece', 'Berkay', 'İrem', 'Onur', 'Dilara', 'Kaan', 'Yağmur', 'Baran', 'Ceren', 'Arda', 'Aslı', 'Tolga', 'Pınar', 'Volkan', 'Sibel',
  'Serkan', 'Gamze', 'Cem', 'Hilal', 'Barış', 'Nihal', 'Doğan', 'Leyla', 'Ufuk', 'Melek', 'Koray', 'Şeyma', 'Taner', 'Bahar', 'Yasin', 'Cansu', 'Sinan',
  'Nilay', 'Orhan', 'Songül', 'Alper', 'Gizem', 'Erdem', 'Hande', 'Mert', 'Tuba', 'Levent', 'Aylin', 'Okan', 'Özge', 'Rıza', 'Banu', 'Uğur',
]
const bot = Array.from({ length: N }, (_, i) => ({
  ad: i < ADLAR.length ? ADLAR[i] : `${ADLAR[i % ADLAR.length]} ${Math.floor(i / ADLAR.length) + 1}`,
  cihaz: randomUUID(),
  son: null,
}))

const bekle = (ms) => new Promise((r) => setTimeout(r, ms))
const rastgele = (a, b) => a + Math.random() * (b - a)
const log = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), ...a)

async function oturumBul() {
  if (oturum) return oturum
  if (!kod) throw new Error('--oturum ya da --kod verin')
  const { data, error } = await sb.rpc('kodla_katil', { p_kod: kod, p_cihaz: randomUUID() })
  if (error || !data?.oturum) throw new Error(`kod çözülemedi: ${error?.message ?? data?.hata}`)
  return data.oturum
}

async function katil() {
  let tamam = 0
  for (let i = 0; i < bot.length; i += 10) {
    await Promise.all(
      bot.slice(i, i + 10).map(async (b) => {
        const { data, error } = await sb.rpc('takma_ad_al', { p_session: oturum, p_cihaz: b.cihaz, p_ad: b.ad })
        if (error || data?.hata) log('katılamadı:', b.ad, error?.message ?? data?.hata)
        else tamam++
      }),
    )
  }
  log(`${tamam}/${N} sanal öğrenci katıldı`)
  if (tamam === 0) throw new Error('hiçbiri katılamadı (oturum bitti mi?)')
}

let uyarildi = false
async function soruyuOyna(adim, kalanMs) {
  // Doğru şık: yalnızca TEST-BOT derslerinde sorgulanabilir
  const { data } = await sb.rpc('test_dogru_index', { p_session: oturum })
  const dogru = typeof data?.dogru_index === 'number' ? data.dogru_index : null
  if (dogru === null && !uyarildi) {
    uyarildi = true
    log('UYARI: doğru şık alınamadı (' + (data?.hata ?? 'hata') + '); botlar rastgele cevap verecek, başarı oranı tutmaz. Ders adı TEST-BOT ile başlamalı ve 0047 uygulanmış olmalı.')
  }
  const secenekSayisi = adim.secenekler?.length ?? 4
  const elenen = new Set(adim.elenen ?? [])
  const sonuc = { cevap: 0, dogru: 0, hata: 0 }
  const enGec = Math.max(500, kalanMs - 1200)
  const isler = bot.map(async (b) => {
    const gec = Math.min(enGec, rastgele(GEC_MIN, GEC_MAX) * 1000)
    await bekle(gec)
    let secim
    const bilir = dogru !== null && Math.random() < BASARI
    if (bilir) secim = dogru
    else {
      const adaylar = Array.from({ length: secenekSayisi }, (_, i) => i).filter((i) => i !== dogru && !elenen.has(i))
      secim = adaylar[Math.floor(Math.random() * adaylar.length)] ?? 0
    }
    const { data: r, error } = await sb.rpc('cevap_ver', { p_session: oturum, p_cihaz: b.cihaz, p_secim: secim })
    if (error || r?.hata) sonuc.hata++
    else {
      sonuc.cevap++
      if (secim === dogru) sonuc.dogru++
    }
  })
  await Promise.all(isler)
  log(`soru "${String(adim.soru ?? '').slice(0, 50)}": ${sonuc.cevap} cevap, ${sonuc.dogru} doğru, ${sonuc.hata} hata`)
}

async function dongu() {
  let sonAdim = null
  let bos = 0
  while (true) {
    const { data: d, error } = await sb.rpc('ders_durumu', { p_session: oturum })
    if (error || !d || d.hata) {
      if (++bos > 5) throw new Error('ders durumu okunamadı')
    } else {
      bos = 0
      if (d.bitti) {
        log('ders bitti, bot duruyor')
        return
      }
      const a = d.adim
      if (a && a.tur === 'soru' && a.soru_durum === 'acik' && a.id !== sonAdim) {
        sonAdim = a.id
        void soruyuOyna(a, a.kalan_ms ?? 20000)
      }
    }
    await bekle(1000)
  }
}

try {
  oturum = await oturumBul()
  log(`oturum ${oturum} · ${N} bot · başarı %${Math.round(BASARI * 100)} · gecikme ${GEC_MIN}-${GEC_MAX} sn`)
  await katil()
  log('sorular bekleniyor (durdurmak için Ctrl+C)')
  await dongu()
} catch (e) {
  console.error('HATA:', e.message)
  process.exit(1)
}
