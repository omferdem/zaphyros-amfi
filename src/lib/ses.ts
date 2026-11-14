// Oyunlar ve yarışmalar için ses efektleri ve müzik. Dosya gerekmez: hepsi Web Audio ile üretilir (telif sorunu yoktur).
// Hoca "Diğer" menüsünden sesi ve müziği ayrı ayrı kapatabilir.
import { useEffect, useRef, useState } from 'react'

export type Ses = 'tik' | 'dogru' | 'yanlis' | 'zafer' | 'yenilgi' | 'geri' | 'sure_bitti' | 'whoosh' | 'alkis' | 'baslat'

const SES_ANAHTARI = 'amfi_ses'
const MUZIK_ANAHTARI = 'amfi_muzik'
let baglam: AudioContext | null = null
let cikis: DynamicsCompressorNode | null = null
let gurultuTamponu: AudioBuffer | null = null

function oku(anahtar: string): boolean {
  try {
    return localStorage.getItem(anahtar) !== '0'
  } catch {
    return true
  }
}

function yaz(anahtar: string, acik: boolean): void {
  try {
    localStorage.setItem(anahtar, acik ? '1' : '0')
  } catch {
    // Depolama kapalıysa ayar yalnızca bu açılışta geçerli olmaz; ses açık kalır
  }
  window.dispatchEvent(new Event('amfi-ses-ayari'))
}

export const sesAcikMi = () => oku(SES_ANAHTARI)
export const sesAyarla = (acik: boolean) => yaz(SES_ANAHTARI, acik)
export const muzikAcikMi = () => oku(MUZIK_ANAHTARI)
export const muzikAyarla = (acik: boolean) => yaz(MUZIK_ANAHTARI, acik)

/** Ses bağlamını kurar (ilk çağrıda); çıkışa sert tepeleri yumuşatan bir sıkıştırıcı konur. */
function hazirla(): AudioContext {
  baglam ??= new AudioContext()
  if (baglam.state === 'suspended') void baglam.resume()
  if (!cikis) {
    cikis = baglam.createDynamicsCompressor()
    cikis.threshold.value = -14
    cikis.ratio.value = 6
    cikis.connect(baglam.destination)
  }
  if (!gurultuTamponu) {
    gurultuTamponu = baglam.createBuffer(1, baglam.sampleRate, baglam.sampleRate)
    const v = gurultuTamponu.getChannelData(0)
    for (let i = 0; i < v.length; i++) v[i] = Math.random() * 2 - 1
  }
  return baglam
}

interface NotaSecenek {
  tur?: OscillatorType
  seviye?: number
  /** Notanın sonunda ulaşacağı frekans (kayma: sirenler, düşen sesler) */
  son?: number
  /** Alçak geçiren süzgeç (keskin tonları yumuşatır) */
  suzgec?: number
  atak?: number
  hedef?: AudioNode
}

function nota(frekans: number, baslangic: number, sure: number, s: NotaSecenek = {}): void {
  if (!baglam || !cikis) return
  const o = baglam.createOscillator()
  const g = baglam.createGain()
  const t0 = baglam.currentTime + baslangic
  o.type = s.tur ?? 'sine'
  o.frequency.setValueAtTime(frekans, t0)
  if (s.son) o.frequency.exponentialRampToValueAtTime(s.son, t0 + sure)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(s.seviye ?? 0.1, t0 + (s.atak ?? 0.015))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure)
  let son: AudioNode = o
  if (s.suzgec) {
    const f = baglam.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = s.suzgec
    o.connect(f)
    son = f
  }
  son.connect(g).connect(s.hedef ?? cikis)
  o.start(t0)
  o.stop(t0 + sure + 0.05)
}

/** Süzgeçten geçen gürültü patlaması (vuruş, alkış, hışırtı). tepe2: süzgeç frekansı sürerken ulaşacağı değer. */
function gurultu(baslangic: number, sure: number, seviye: number, tur: BiquadFilterType, frekans: number, tepe2?: number, hedef?: AudioNode): void {
  if (!baglam || !cikis || !gurultuTamponu) return
  const k = baglam.createBufferSource()
  k.buffer = gurultuTamponu
  k.loop = true
  const f = baglam.createBiquadFilter()
  f.type = tur
  const t0 = baglam.currentTime + baslangic
  f.frequency.setValueAtTime(frekans, t0)
  if (tepe2) f.frequency.exponentialRampToValueAtTime(tepe2, t0 + sure)
  f.Q.value = tur === 'bandpass' ? 2 : 0.7
  const g = baglam.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(seviye, t0 + Math.min(0.02, sure / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure)
  k.connect(f).connect(g).connect(hedef ?? cikis)
  k.start(t0, Math.random() * 0.5)
  k.stop(t0 + sure + 0.05)
}

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5

const EFEKTLER: Record<Ses, () => void> = {
  // Tahta çıkması gibi kısa tık
  tik: () => {
    gurultu(0, 0.04, 0.12, 'highpass', 3000)
    nota(880, 0, 0.06, { tur: 'triangle', seviye: 0.07 })
  },
  // Geri sayım: tahta blok
  geri: () => {
    nota(1250, 0, 0.07, { tur: 'sine', seviye: 0.14, son: 900 })
    gurultu(0, 0.03, 0.1, 'bandpass', 2200)
  },
  // Işıltılı çan: yükselen arpej, üstüne parıltı
  dogru: () => {
    ;[C5, E5, G5, C6].forEach((f, i) => {
      nota(f, i * 0.07, 0.5, { tur: 'sine', seviye: 0.11 })
      nota(f * 2.01, i * 0.07, 0.35, { tur: 'triangle', seviye: 0.04 })
    })
    gurultu(0.2, 0.5, 0.025, 'highpass', 7000)
  },
  // Kısa, kaba "hata" uyarısı: düşen testere + alçak vuruş
  yanlis: () => {
    nota(240, 0, 0.35, { tur: 'sawtooth', seviye: 0.1, son: 110, suzgec: 900 })
    nota(70, 0, 0.25, { tur: 'sine', seviye: 0.22, son: 40 })
    nota(250, 0.18, 0.3, { tur: 'sawtooth', seviye: 0.08, son: 90, suzgec: 700 })
  },
  // Zafer fanfarı: pirinç gibi testere akorları, davul tırıllı ve alkış
  zafer: () => {
    gurultu(0, 0.5, 0.06, 'bandpass', 600, 3000)
    ;[
      [C5, 0.0],
      [E5, 0.12],
      [G5, 0.24],
      [C6, 0.4],
    ].forEach(([f, t]) => {
      nota(f, t, 0.5, { tur: 'sawtooth', seviye: 0.07, suzgec: 2400 })
      nota(f / 2, t, 0.5, { tur: 'square', seviye: 0.04, suzgec: 1200 })
    })
    nota(C6, 0.4, 1.1, { tur: 'sawtooth', seviye: 0.08, suzgec: 3000, atak: 0.03 })
    nota(G5, 0.4, 1.1, { tur: 'sawtooth', seviye: 0.06, suzgec: 3000, atak: 0.03 })
    for (let i = 0; i < 8; i++) gurultu(0.6 + i * 0.12, 0.25, 0.05, 'highpass', 1800 + Math.random() * 2000)
  },
  // Üzgün trombon: aşağı kayan üç nota
  yenilgi: () => {
    ;[
      [392, 0],
      [370, 0.32],
      [330, 0.64],
    ].forEach(([f, t]) => nota(f, t, 0.5, { tur: 'sawtooth', seviye: 0.08, suzgec: 900, son: f * 0.94 }))
    nota(262, 0.96, 0.9, { tur: 'sawtooth', seviye: 0.09, suzgec: 800, son: 200 })
  },
  // Süre bitti: iki tonlu zil
  sure_bitti: () => {
    for (let i = 0; i < 3; i++) {
      nota(440, i * 0.22, 0.18, { tur: 'square', seviye: 0.08, suzgec: 2000 })
      nota(554, i * 0.22 + 0.06, 0.16, { tur: 'square', seviye: 0.06, suzgec: 2000 })
    }
  },
  // Süpürme (geçişler, oyun başlangıcı)
  whoosh: () => {
    gurultu(0, 0.45, 0.12, 'bandpass', 300, 5000)
  },
  // Alkış
  alkis: () => {
    for (let i = 0; i < 30; i++) gurultu(i * 0.05 + Math.random() * 0.03, 0.12, 0.05, 'bandpass', 1500 + Math.random() * 2500)
  },
  // Yarışma başlıyor: yükselen süpürme ve vuruş
  baslat: () => {
    gurultu(0, 0.6, 0.1, 'bandpass', 250, 4500)
    nota(110, 0.5, 0.4, { tur: 'sine', seviye: 0.28, son: 45 })
    ;[C5, G5].forEach((f, i) => nota(f, 0.5 + i * 0.05, 0.6, { tur: 'sawtooth', seviye: 0.06, suzgec: 2600 }))
  },
}

/** Efekti çalar; ses kapalıysa ya da tarayıcı izin vermiyorsa sessizce geçer. */
export function sesCal(ad: Ses): void {
  if (!sesAcikMi()) return
  try {
    hazirla()
    EFEKTLER[ad]()
  } catch {
    // Ses desteklenmiyorsa oyun yine çalışır
  }
}

// ---------------------------------------------------------------------------
// Müzik: dört akorluk (Am, F, C, G) tempolu bir döngü. Bas, arpej, davul; hepsi her çalışta üretilir.

const BPM = 126
const ADIM_SN = 60 / BPM / 4
const BAS = [110, 87.31, 130.81, 98]
const AKORLAR = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
]
const ARPEJ = [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 2, 1, 0, 1]

let muzikIstegi = 0
let calan: { ana: GainNode; sayac: ReturnType<typeof setInterval> } | null = null
let sonrakiZaman = 0
let adimNo = 0
let durdurmaBekleme: ReturnType<typeof setTimeout> | null = null

function muzikAdimi(t: number, adim: number, hedef: AudioNode): void {
  if (!baglam) return
  const olcu = Math.floor(adim / 16) % 4
  const a = adim % 16
  const akor = AKORLAR[olcu]
  const at = (f: number, baslangic: number, sure: number, tur: OscillatorType, seviye: number, suzgec: number) => {
    const o = baglam!.createOscillator()
    const g = baglam!.createGain()
    const f2 = baglam!.createBiquadFilter()
    f2.type = 'lowpass'
    f2.frequency.value = suzgec
    o.type = tur
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, baslangic)
    g.gain.exponentialRampToValueAtTime(seviye, baslangic + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, baslangic + sure)
    o.connect(f2).connect(g).connect(hedef)
    o.start(baslangic)
    o.stop(baslangic + sure + 0.03)
  }
  // Bas: sekizlikler, ölçü sonunda oktav sıçraması
  if (a % 2 === 0) at(a === 14 || a === 6 ? BAS[olcu] * 2 : BAS[olcu], t, ADIM_SN * 1.8, 'sawtooth', 0.1, 520)
  // Arpej: akor sesleri, üst oktavda parlak
  at(akor[ARPEJ[a] % 3] * (ARPEJ[a] === 3 ? 4 : 2), t, ADIM_SN * 0.9, 'square', 0.028, 2600)
  // Davul: vuruş, tef ve ritim şapkası
  if (a % 4 === 0) {
    const o = baglam.createOscillator()
    const g = baglam.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g).connect(hedef)
    o.start(t)
    o.stop(t + 0.2)
  }
  if (a === 4 || a === 12) muzikGurultusu(t, 0.12, 0.09, 1600, hedef)
  if (a % 2 === 1) muzikGurultusu(t, 0.035, a % 4 === 3 ? 0.035 : 0.02, 7500, hedef)
}

function muzikGurultusu(t: number, sure: number, seviye: number, frekans: number, hedef: AudioNode): void {
  if (!baglam || !gurultuTamponu) return
  const k = baglam.createBufferSource()
  k.buffer = gurultuTamponu
  const f = baglam.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = frekans
  const g = baglam.createGain()
  g.gain.setValueAtTime(seviye, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure)
  k.connect(f).connect(g).connect(hedef)
  k.start(t, Math.random() * 0.5)
  k.stop(t + sure + 0.02)
}

function muzikBaslat(): void {
  if (calan) return
  try {
    const b = hazirla()
    const ana = b.createGain()
    ana.gain.setValueAtTime(0.0001, b.currentTime)
    ana.gain.exponentialRampToValueAtTime(0.5, b.currentTime + 1.2)
    ana.connect(cikis!)
    sonrakiZaman = b.currentTime + 0.1
    adimNo = 0
    const sayac = setInterval(() => {
      if (!baglam || !calan) return
      while (sonrakiZaman < baglam.currentTime + 0.25) {
        muzikAdimi(sonrakiZaman, adimNo, calan.ana)
        sonrakiZaman += ADIM_SN
        adimNo++
      }
    }, 60)
    calan = { ana, sayac }
  } catch {
    calan = null
  }
}

function muzikDurdur(): void {
  if (!calan || !baglam) return
  const { ana, sayac } = calan
  calan = null
  clearInterval(sayac)
  ana.gain.cancelScheduledValues(baglam.currentTime)
  ana.gain.setValueAtTime(Math.max(0.0001, ana.gain.value), baglam.currentTime)
  ana.gain.exponentialRampToValueAtTime(0.0001, baglam.currentTime + 0.6)
  setTimeout(() => ana.disconnect(), 800)
}

function muzikDurumunuGuncelle(): void {
  if (muzikIstegi > 0 && muzikAcikMi()) muzikBaslat()
  else muzikDurdur()
}

if (typeof window !== 'undefined') window.addEventListener('amfi-ses-ayari', muzikDurumunuGuncelle)

/** Müzik isteği ekler (+1) ya da kaldırır (-1). Soru geçişlerinde müzik kesilmesin diye durdurma kısa bir süre geciktirilir. */
function muzikIste(delta: 1 | -1): void {
  muzikIstegi = Math.max(0, muzikIstegi + delta)
  if (durdurmaBekleme) clearTimeout(durdurmaBekleme)
  if (muzikIstegi > 0) muzikDurumunuGuncelle()
  else durdurmaBekleme = setTimeout(muzikDurumunuGuncelle, 900)
}

/** Etkin olduğu sürece yarışma müziği çalar (ses ayarı "müzik" kapalıysa çalmaz). */
export function useMuzik(etkin: boolean): void {
  useEffect(() => {
    if (!etkin) return
    muzikIste(1)
    return () => muzikIste(-1)
  }, [etkin])
}

/** Ses ve müzik ayarlarını izleyen kanca (menüdeki düğmeler için). */
export function useSesAyari(): [boolean, (a: boolean) => void] {
  const [acik, setAcik] = useState(sesAcikMi)
  useEffect(() => {
    const g = () => setAcik(sesAcikMi())
    window.addEventListener('amfi-ses-ayari', g)
    return () => window.removeEventListener('amfi-ses-ayari', g)
  }, [])
  return [acik, sesAyarla]
}

export function useMuzikAyari(): [boolean, (a: boolean) => void] {
  const [acik, setAcik] = useState(muzikAcikMi)
  useEffect(() => {
    const g = () => setAcik(muzikAcikMi())
    window.addEventListener('amfi-ses-ayari', g)
    return () => window.removeEventListener('amfi-ses-ayari', g)
  }, [])
  return [acik, muzikAyarla]
}

/** Oyun sahnesinde: oyun sürerken müzik; yeni soru oynanınca tık, oyun bitince zafer ya da yenilgi sesi. */
export function useOyunSesi(oynanan: number, bitti: boolean, kazandi: boolean): void {
  useMuzik(!bitti)
  const onceki = useRef({ oynanan, bitti })
  useEffect(() => {
    const o = onceki.current
    if (bitti && !o.bitti) {
      sesCal(kazandi ? 'zafer' : 'yenilgi')
      if (kazandi) setTimeout(() => sesCal('alkis'), 700)
    } else if (oynanan > o.oynanan && !bitti) sesCal('whoosh')
    onceki.current = { oynanan, bitti }
  }, [oynanan, bitti, kazandi])
}

/**
 * Soru sahnesinde (Kahoot, quiz kapısı): soru açıkken müzik, son 5 saniyede geri sayım tıkı, süre bitince zil,
 * sonuç açılınca "doğru" çanı. kalanSn null ise süre sesi çalmaz.
 */
export function useSoruSesi(soruDurum: 'acik' | 'sonuc' | null, kalanSn: number | null): void {
  useMuzik(soruDurum === 'acik')
  const onceki = useRef<{ durum: typeof soruDurum; kalan: number | null }>({ durum: soruDurum, kalan: kalanSn })
  useEffect(() => {
    const o = onceki.current
    if (soruDurum === 'acik' && o.durum !== 'acik') sesCal('baslat')
    if (soruDurum === 'sonuc' && o.durum === 'acik') sesCal('dogru')
    if (soruDurum === 'acik' && kalanSn !== null && kalanSn !== o.kalan) {
      if (kalanSn === 0) sesCal('sure_bitti')
      else if (kalanSn <= 5) sesCal('geri')
    }
    onceki.current = { durum: soruDurum, kalan: kalanSn }
  }, [soruDurum, kalanSn])
}

/** İnternet bağlantısı var mı (tarayıcının çevrimiçi/çevrimdışı olayları). */
export function useCevrimici(): boolean {
  const [acik, setAcik] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const a = () => setAcik(true)
    const k = () => setAcik(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', k)
    return () => {
      window.removeEventListener('online', a)
      window.removeEventListener('offline', k)
    }
  }, [])
  return acik
}
