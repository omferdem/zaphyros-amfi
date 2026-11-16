// Yorumcu bandı: her sonuçtan sonra perdede tek satırlık, gerçek verilere dayalı kısa yorum.
// Saf kurallar (ekran ve veritabanı bilmez). Kimseyle alay etmez; aynı yorum üst üste gelmez.

export type YorumSonucu = 1 | 0 | -1 | null

export interface YorumOyuncusu {
  ad: string
  sonuc: YorumSonucu[]
}

export interface Yorum {
  /** Aynı türün tekrarını önlemek için sabit anahtar */
  anahtar: string
  metin: string
}

/** Oyuncunun `oynanan` soruya kadar olan sonundaki doğru serisi. */
export function seri(sonuc: YorumSonucu[], oynanan: number): number {
  let n = 0
  for (let i = Math.min(oynanan, sonuc.length) - 1; i >= 0; i--) {
    if (sonuc[i] === 1) n++
    else break
  }
  return n
}

/** Oyuncu temelli yorumlar (öncelik sırasıyla): doğru serisi. */
export function oyuncuYorumlari(oyuncular: YorumOyuncusu[], oynanan: number): Yorum[] {
  if (oynanan < 3 || oyuncular.length === 0) return []
  const seriler = oyuncular.map((o) => ({ ad: o.ad, s: seri(o.sonuc, oynanan) }))
  const enUzun = Math.max(...seriler.map((x) => x.s))
  if (enUzun < 3) return []
  const liderler = seriler.filter((x) => x.s === enUzun)
  if (liderler.length === 1) {
    return [{ anahtar: 'seri-tek', metin: `${liderler[0].ad} ${enUzun} sorudur durdurulamıyor! 🔥` }]
  }
  return [{ anahtar: 'seri-cok', metin: `${liderler.length} kişi ${enUzun} soruluk seri yakaladı, aralarında ${liderler[0].ad} var 🔥` }]
}

/** Sınıfın doğru oranına (yüzde) ve gidişine göre yorumlar. `gecmis`: önceki soruların oranları (en eskiden yeniye), bu soru dahil. */
export function sinifYorumlari(oran: number, oynanan: number, toplam: number, gecmis: number[]): Yorum[] {
  const o = Math.round(oran)
  const liste: Yorum[] = []
  const son3 = gecmis.slice(-3)
  if (son3.length === 3 && son3.every((x) => x >= 60)) {
    liste.push({ anahtar: 'sinif-seri', metin: 'Sınıf üç sorudur üst üste %60 üstünde, ekip durdurulamıyor 🔥' })
  }
  if (toplam > 0 && toplam - oynanan === 1) {
    liste.push({ anahtar: 'son-soru', metin: 'Bir soru kaldı, herkes yerinde! 🏁' })
  }
  if (o >= 90) liste.push({ anahtar: 'cok-kolay', metin: `Sınıfın %${o}'i bildi, bu soru kolay geldi 👏` })
  else if (o >= 75) liste.push({ anahtar: 'kolay', metin: `Sınıfın %${o}'i doğru cevapladı, güzel gidiyor` })
  else if (o >= 60) liste.push({ anahtar: 'orta-iyi', metin: `Sınıfın %${o}'i bildi, eşiğin üstünde` })
  else if (o >= 40) liste.push({ anahtar: 'ikiye-bolundu', metin: `Sınıf ikiye bölündü: %${o} bildi, %${100 - o} bilemedi` })
  else if (o >= 20) liste.push({ anahtar: 'zor', metin: `Bu soru zorladı, %${o} doğru cevap verdi` })
  else liste.push({ anahtar: 'cok-zor', metin: `Soru sınıfa baskın çıktı, yalnızca %${o} bildi` })
  return liste
}

/** Adaylardan son iki gösterilenle aynı türde olmayan ilkini seçer; hepsi tekrarsa ilkini verir. */
export function yorumSec(adaylar: Yorum[], sonAnahtarlar: string[]): Yorum | null {
  if (adaylar.length === 0) return null
  const yasak = new Set(sonAnahtarlar.slice(-2))
  return adaylar.find((y) => !yasak.has(y.anahtar)) ?? adaylar[0]
}
