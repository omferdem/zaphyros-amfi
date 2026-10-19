// ZOMR biçimindeki soru metnini okur:
//   #QUESTION:Sorunun metni?
//   #CORRECT:Doğru cevap
//   #WRONG:Yanlış cevap 1
//   #WRONG:Yanlış cevap 2
// İsteğe bağlı #EASINESS, #BLOOM, #OUTCOME (ve tanınmayan diğer etiketler) ek bilgi olarak saklanır.
// Etiketsiz satır, bir önceki alanın devamı sayılır (çok satırlı soru metni).

export interface ZomrSorusu {
  soru: string
  dogru: string
  yanlislar: string[]
  ek: Record<string, string>
}

export interface ZomrSonucu {
  sorular: ZomrSorusu[]
  /** Okunamayan soruların sırası ve nedeni, ör. "3. soru: doğru cevap yok" */
  hatalar: string[]
}

const ETIKET = /^\s*#([A-Za-zÇĞİÖŞÜçğıöşü_]+)\s*:?\s*(.*)$/

export function zomrOku(metin: string): ZomrSonucu {
  const sorular: ZomrSorusu[] = []
  const hatalar: string[] = []
  let gecerli: { soru: string; dogru: string; yanlislar: string[]; ek: Record<string, string> } | null = null
  let sonAlan: { tur: 'soru' | 'dogru' | 'yanlis' | 'ek'; anahtar?: string } | null = null

  function bitir() {
    if (!gecerli) return
    const no = sorular.length + hatalar.length + 1
    const s = {
      soru: gecerli.soru.trim(),
      dogru: gecerli.dogru.trim(),
      yanlislar: gecerli.yanlislar.map((y) => y.trim()).filter(Boolean),
      ek: gecerli.ek,
    }
    if (!s.soru) hatalar.push(`${no}. soru: soru metni boş`)
    else if (!s.dogru) hatalar.push(`${no}. soru: doğru cevap (#CORRECT) yok`)
    else if (s.yanlislar.length === 0) hatalar.push(`${no}. soru: yanlış cevap (#WRONG) yok`)
    else if (s.yanlislar.length > 5) hatalar.push(`${no}. soru: en fazla 5 yanlış cevap olabilir`)
    else if (s.yanlislar.includes(s.dogru)) hatalar.push(`${no}. soru: doğru cevap yanlışlar arasında da yazılmış`)
    else if (new Set(s.yanlislar).size !== s.yanlislar.length) hatalar.push(`${no}. soru: aynı yanlış cevap iki kez yazılmış`)
    else if (s.soru.length > 1000 || s.dogru.length > 300 || s.yanlislar.some((y) => y.length > 300))
      hatalar.push(`${no}. soru: metin çok uzun`)
    else sorular.push(s)
    gecerli = null
    sonAlan = null
  }

  for (const satir of metin.replace(/\r\n?/g, '\n').split('\n')) {
    const m = satir.match(ETIKET)
    if (!m) {
      // Etiketsiz satır: önceki alanın devamı
      const ek = satir.trim()
      if (!ek || !gecerli || !sonAlan) continue
      const g: NonNullable<typeof gecerli> = gecerli
      if (sonAlan.tur === 'soru') g.soru += '\n' + ek
      else if (sonAlan.tur === 'dogru') g.dogru += ' ' + ek
      else if (sonAlan.tur === 'yanlis') g.yanlislar[g.yanlislar.length - 1] += ' ' + ek
      continue
    }
    const etiket = m[1].toUpperCase()
    const deger = m[2]
    if (etiket === 'QUESTION') {
      bitir()
      gecerli = { soru: deger, dogru: '', yanlislar: [], ek: {} }
      sonAlan = { tur: 'soru' }
    } else if (!gecerli) {
      continue
    } else if (etiket === 'CORRECT') {
      gecerli.dogru = deger
      sonAlan = { tur: 'dogru' }
    } else if (etiket === 'WRONG') {
      gecerli.yanlislar.push(deger)
      sonAlan = { tur: 'yanlis' }
    } else {
      if (deger.trim()) gecerli.ek[etiket.toLowerCase()] = deger.trim()
      sonAlan = { tur: 'ek', anahtar: etiket }
    }
  }
  bitir()
  return { sorular, hatalar }
}
