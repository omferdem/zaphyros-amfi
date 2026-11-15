// Öğrenci ekran görüntüsü: slaytın bütün metnini telefonda bir canvas kartına çizer ve PNG olarak telefona indirir.
// Hiçbir sunucu isteği yapılmaz; kaynak telefonda zaten bulunan veridir (slayt metni, başlık, ders adı, hafta, slayt numarası).

/** Metni verilen genişliğe sığacak satırlara böler. `olc` bir metnin piksel genişliğini verir. Çok uzun kelimeler harf harf bölünür. */
export function kelimeSar(metin: string, enFazla: number, olc: (s: string) => number): string[] {
  const satirlar: string[] = []
  for (const paragraf of metin.split('\n')) {
    if (paragraf.trim() === '') {
      satirlar.push('')
      continue
    }
    let satir = ''
    for (const kelime of paragraf.split(/\s+/).filter(Boolean)) {
      let k = kelime
      // Tek başına sığmayan kelimeyi parçala
      while (olc(k) > enFazla && k.length > 1) {
        let n = k.length - 1
        while (n > 1 && olc(k.slice(0, n)) > enFazla) n--
        if (satir) {
          satirlar.push(satir)
          satir = ''
        }
        satirlar.push(k.slice(0, n))
        k = k.slice(n)
      }
      const aday = satir ? `${satir} ${k}` : k
      if (olc(aday) <= enFazla) satir = aday
      else {
        satirlar.push(satir)
        satir = k
      }
    }
    if (satir) satirlar.push(satir)
  }
  return satirlar
}

export interface SlaytKartiGirdisi {
  ders: string
  hafta: string | null
  slayt: number | null
  sayfaSayisi: number | null
  satirlar: string[]
  /** Telefonda zaten inmiş slayt görseli (telefon modu); yoksa yalnızca metin çizilir */
  gorselUrl?: string | null
}

const GENISLIK = 1080
const KENAR = 64

function gorselYukle(url: string): Promise<HTMLImageElement | null> {
  return new Promise((coz) => {
    const g = new Image()
    g.onload = () => coz(g)
    g.onerror = () => coz(null)
    g.src = url
  })
}

/** Kartı çizer; metin uzadıkça kart aşağı uzar, hiçbir satır kesilmez. */
export async function slaytKartiOlustur(g: SlaytKartiGirdisi): Promise<Blob | null> {
  const gorsel = g.gorselUrl ? await gorselYukle(g.gorselUrl) : null
  const olcCanvas = document.createElement('canvas').getContext('2d')
  if (!olcCanvas) return null
  const GOVDE = 38
  const SATIR = 54
  olcCanvas.font = `${GOVDE}px sans-serif`
  const satirlar = kelimeSar(g.satirlar.join('\n'), GENISLIK - KENAR * 2, (s) => olcCanvas.measureText(s).width)
  const gorselYuksekligi = gorsel ? Math.round(((GENISLIK - KENAR * 2) * gorsel.height) / gorsel.width) : 0
  const ustYuksekligi = 170
  const yukseklik = ustYuksekligi + (gorsel ? gorselYuksekligi + 40 : 0) + satirlar.length * SATIR + KENAR + 60
  const canvas = document.createElement('canvas')
  canvas.width = GENISLIK
  canvas.height = yukseklik
  const c = canvas.getContext('2d')
  if (!c) return null
  const arka = c.createLinearGradient(0, 0, 0, yukseklik)
  arka.addColorStop(0, '#1b1240')
  arka.addColorStop(1, '#0b1020')
  c.fillStyle = arka
  c.fillRect(0, 0, GENISLIK, yukseklik)
  c.fillStyle = '#fde047'
  c.font = 'bold 34px sans-serif'
  c.fillText(g.ders.slice(0, 48), KENAR, 84)
  c.fillStyle = '#94a3b8'
  c.font = '28px sans-serif'
  c.fillText([g.hafta, g.slayt ? `Slayt ${g.slayt}${g.sayfaSayisi ? ` / ${g.sayfaSayisi}` : ''}` : null].filter(Boolean).join('  ·  '), KENAR, 130)
  let y = ustYuksekligi
  if (gorsel) {
    c.fillStyle = '#ffffff'
    c.fillRect(KENAR, y, GENISLIK - KENAR * 2, gorselYuksekligi)
    c.drawImage(gorsel, KENAR, y, GENISLIK - KENAR * 2, gorselYuksekligi)
    y += gorselYuksekligi + 40
  }
  c.fillStyle = '#f1f5f9'
  c.font = `${GOVDE}px sans-serif`
  for (const s of satirlar) {
    y += SATIR
    c.fillText(s, KENAR, y - 14)
  }
  c.fillStyle = '#64748b'
  c.font = '24px sans-serif'
  c.fillText('ZAPEDU', KENAR, yukseklik - 40)
  return new Promise((coz) => canvas.toBlob((b) => coz(b), 'image/png'))
}

/** Kartı paylaşım menüsüyle (galeriye kaydedilebilsin) ya da normal indirmeyle telefona verir. */
export async function kartiKaydet(blob: Blob, dosyaAdi: string): Promise<void> {
  const dosya = new File([blob], dosyaAdi, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [dosya] })) {
    try {
      await navigator.share({ files: [dosya] })
      return
    } catch (e) {
      // Kullanıcı paylaşım menüsünü kapattıysa tekrar indirme açılmaz
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dosyaAdi
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
