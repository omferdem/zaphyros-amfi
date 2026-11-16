// PDF'ten çıkan slayt metninde görsellerin alt metni ya da dosya adı satır olarak kalabilir
// (Google Slaytlar ve PowerPoint görselleri "preencoded.png", "image1.png", "Picture 3" gibi adlarla PDF'e yazar).
// Bu satırlar ayıklanır; başlık temizlenmiş metnin ilk anlamlı satırından alınır.

const DOSYA_ADI = /^[\w.\- ()çğıöşüÇĞİÖŞÜ]{1,80}\.(png|jpe?g|gif|webp|svg|bmp|tiff?|emf|wmf|heic)$/i
const GORSEL_ADI = /^(resim|picture|image|img|görsel|gorsel|şekil|sekil|figure|fig|slide image|slayt görseli)\s*\d{0,4}$/i
const BICIMSIZ = /^(preencoded|untitled|başlıksız)$/i

/** Bir satır görselin dosya adı ya da alt metin kalıbı mı? */
export function gorselSatiriMi(satir: string): boolean {
  const s = satir.trim()
  if (!s) return false
  return DOSYA_ADI.test(s) || GORSEL_ADI.test(s) || BICIMSIZ.test(s)
}

/** Metinden görsel adı satırlarını ayıklar; kalan satırları aynen korur. */
export function slaytMetniniTemizle(metin: string | null | undefined): string {
  return (metin ?? '')
    .split('\n')
    .filter((s) => !gorselSatiriMi(s))
    .join('\n')
}

/** Slaytın başlığı: temizlenmiş metnin ilk anlamlı satırı; yoksa "Slayt N". */
export function slaytBasligi(metin: string | null | undefined, sayfaNo: number | null | undefined, enFazla = 120): string {
  const ilk = slaytMetniniTemizle(metin)
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s.length > 0)
  return ilk ? ilk.slice(0, enFazla) : `Slayt ${sayfaNo ?? ''}`.trim()
}
