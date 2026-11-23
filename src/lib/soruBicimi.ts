import { zomrOku, type ZomrSonucu, type ZomrSorusu } from './zomr'

/** Soru yüklemede kabul edilen metin biçimleri. Hepsi aynı soru modeline çevrilir. */
export type SoruBicimi = 'otomatik' | 'zomr' | 'sekmeli' | 'siklar'

export const BICIMLER: { anahtar: SoruBicimi; ad: string; ornek: string; talimat: string }[] = [
  {
    anahtar: 'otomatik',
    ad: 'Otomatik tanı',
    ornek: '',
    talimat: '',
  },
  {
    anahtar: 'zomr',
    ad: 'ZOMR (etiketli)',
    ornek: '#QUESTION:Sorunun metni?\n#CORRECT:Doğru cevap\n#WRONG:Yanlış cevap 1\n#WRONG:Yanlış cevap 2\n#WRONG:Yanlış cevap 3',
    talimat:
      'Aşağıdaki soruları şu etiketli düz metin (.txt) biçimine çevir. Her soru için sırayla bu satırlar olsun: "#QUESTION:" ile soru metni, "#CORRECT:" ile tek doğru cevap, "#WRONG:" ile her yanlış cevap (her biri ayrı satır, 1 ile 5 arası). Sorular arasına boş satır koy. Başka açıklama, numara ya da madde işareti ekleme.',
  },
  {
    anahtar: 'sekmeli',
    ad: 'Sekmeli tablo (Excel / Word tablosundan)',
    ornek: 'Soru metni?\tDoğru cevap\tYanlış 1\tYanlış 2\tYanlış 3',
    talimat:
      'Aşağıdaki soruları, her soru tek satır olacak biçimde sekmeyle (TAB) ayrılmış düz metne çevir. Sütunlar sırayla: soru metni, DOĞRU cevap, yanlış cevap 1, yanlış cevap 2, yanlış cevap 3 (doğru cevap her zaman ikinci sütunda olsun). Başlık satırı, numara ya da başka açıklama ekleme.',
  },
  {
    anahtar: 'siklar',
    ad: 'Şıklı metin (A B C D ve Cevap satırı)',
    ornek: 'Soru metni?\nA) Birinci şık\nB) İkinci şık\nC) Üçüncü şık\nD) Dördüncü şık\nCevap: C',
    talimat:
      'Aşağıdaki soruları şu düz metin biçimine çevir: önce soru metni, sonra her biri ayrı satırda "A) ", "B) ", "C) ", "D) " ile başlayan şıklar, sonra "Cevap: " ve doğru şıkkın harfi. Sorular arasına bir boş satır koy. Soruları numaralama, başka açıklama ekleme.',
  },
]

function sorulaTemizle(s: string): string {
  return s.replace(/^\s*\d+\s*[.)]\s+/, '').trim()
}

function sekmeliOku(metin: string): ZomrSonucu {
  const sorular: ZomrSorusu[] = []
  const hatalar: string[] = []
  let no = 0
  for (const satir of metin.replace(/\r\n?/g, '\n').split('\n')) {
    if (!satir.trim()) continue
    no++
    const alanlar = satir.split('\t').map((x) => x.trim()).filter(Boolean)
    const [soru, dogru, ...yanlislar] = alanlar
    if (alanlar.length < 3) hatalar.push(`${no}. satır: en az soru, doğru ve bir yanlış cevap gerekir (sekmeyle ayrılmış)`)
    else if (yanlislar.length > 5) hatalar.push(`${no}. satır: en fazla 5 yanlış cevap olabilir`)
    else if (yanlislar.includes(dogru)) hatalar.push(`${no}. satır: doğru cevap yanlışlar arasında da yazılmış`)
    else sorular.push({ soru: sorulaTemizle(soru), dogru, yanlislar, ek: {} })
  }
  return { sorular, hatalar }
}

function siklarOku(metin: string): ZomrSonucu {
  const sorular: ZomrSorusu[] = []
  const hatalar: string[] = []
  const bloklar = metin.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  bloklar.forEach((blok, i) => {
    const no = i + 1
    const soruSatirlari: string[] = []
    const siklar = new Map<string, string>()
    let cevap = ''
    for (const satir of blok.split('\n')) {
      const c = satir.match(/^\s*(?:cevap|doğru cevap|dogru cevap|doğru)\s*[:-]\s*([A-Ea-e])\b/i)
      const s = satir.match(/^\s*([A-Ea-e])\s*[).:]\s*(.+)$/)
      if (c) cevap = c[1].toUpperCase()
      else if (s) siklar.set(s[1].toUpperCase(), s[2].trim())
      else if (siklar.size === 0) soruSatirlari.push(satir.trim())
    }
    const soru = sorulaTemizle(soruSatirlari.join('\n'))
    const dogru = siklar.get(cevap)
    if (!soru) hatalar.push(`${no}. soru: soru metni yok`)
    else if (siklar.size < 2) hatalar.push(`${no}. soru: en az iki şık (A, B…) gerekir`)
    else if (!dogru) hatalar.push(`${no}. soru: "Cevap: X" satırı yok ya da şıklarda yok`)
    else sorular.push({ soru, dogru, yanlislar: [...siklar.entries()].filter(([k]) => k !== cevap).map(([, v]) => v), ek: {} })
  })
  return { sorular, hatalar }
}

/** Metnin biçimini tahmin eder: #QUESTION varsa ZOMR, sekme varsa sekmeli, değilse şıklı. */
export function bicimiTani(metin: string): Exclude<SoruBicimi, 'otomatik'> {
  if (/^\s*#QUESTION/im.test(metin)) return 'zomr'
  if (metin.includes('\t')) return 'sekmeli'
  return 'siklar'
}

export function soruMetniOku(metin: string, bicim: SoruBicimi = 'otomatik'): ZomrSonucu {
  const b = bicim === 'otomatik' ? bicimiTani(metin) : bicim
  if (b === 'zomr') return zomrOku(metin)
  return b === 'sekmeli' ? sekmeliOku(metin) : siklarOku(metin)
}

/** Soruları seçilen biçimde düz metne yazar (dışa aktarma). Aynı biçim geri içe aktarılabilir. */
export function soruMetniYaz(sorular: { soru: string; dogru: string; yanlislar: string[]; ek?: Record<string, unknown> }[], bicim: Exclude<SoruBicimi, 'otomatik'> = 'zomr'): string {
  const NL = String.fromCharCode(10)
  const tek = (m: string) => m.split(NL).join(' ')
  if (bicim === 'sekmeli') return sorular.map((q) => [tek(q.soru), q.dogru, ...q.yanlislar].join(String.fromCharCode(9))).join(NL) + NL
  if (bicim === 'siklar') {
    return (
      sorular
        .map((q, i) => {
          const siklar = [q.dogru, ...q.yanlislar]
          // Doğru şık sabit konumda kalmasın: sıraya göre döndür
          const kaydir = i % siklar.length
          const sirali = [...siklar.slice(kaydir), ...siklar.slice(0, kaydir)].reverse().slice(0)
          const dogruHarf = 'ABCDEF'[sirali.indexOf(q.dogru)]
          return [q.soru, ...sirali.map((x, j) => `${'ABCDEF'[j]}) ${x}`), `Cevap: ${dogruHarf}`].join(NL)
        })
        .join(NL + NL) + NL
    )
  }
  return (
    sorular
      .map((q) => {
        const ekler = Object.entries(q.ek ?? {})
          .filter(([k, v]) => k !== 'paket' && typeof v === 'string' && v)
          .map(([k, v]) => `#${k.toUpperCase()}:${v}`)
        return [`#QUESTION:${q.soru}`, `#CORRECT:${q.dogru}`, ...q.yanlislar.map((y) => `#WRONG:${y}`), ...ekler].join(NL)
      })
      .join(NL + NL) + NL
  )
}

/** Metni .txt dosyası olarak indirtir. */
export function metniIndir(metin: string, dosyaAdi: string): void {
  const url = URL.createObjectURL(new Blob([metin], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = dosyaAdi.replace(/["*/:<>?|]+/g, '').trim().slice(0, 80) + '.txt'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
