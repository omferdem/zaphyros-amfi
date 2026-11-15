// Zapoot ve oyunlar için soru seçimi: seçilen paketlerden istenen sayıda soru, paketlere orantılı dağıtılarak ve karıştırılarak çekilir.
// Aynı turda tekrar olmaz; mümkünse son iki turda sorulmamış sorular önce gelir.
import { karistir } from './paket'

export interface SecimPaketi<T> {
  ad: string
  sorular: T[]
}

/** Her pakete düşen soru sayısı: orantılı pay, artan kontenjan en büyük kesirlilere gider. Toplam her zaman min(adet, toplam) olur. */
export function paketPaylari(boyutlar: number[], adet: number): number[] {
  const toplam = boyutlar.reduce((a, b) => a + b, 0)
  const hedef = Math.max(0, Math.min(adet, toplam))
  if (toplam === 0 || hedef === 0) return boyutlar.map(() => 0)
  const tam = boyutlar.map((n) => Math.floor((hedef * n) / toplam))
  let artan = hedef - tam.reduce((a, b) => a + b, 0)
  const sira = boyutlar.map((n, i) => ({ i, kesir: (hedef * n) / toplam - tam[i] })).sort((a, b) => b.kesir - a.kesir || boyutlar[b.i] - boyutlar[a.i])
  for (const s of sira) {
    if (artan <= 0) break
    if (tam[s.i] < boyutlar[s.i]) {
      tam[s.i] += 1
      artan -= 1
    }
  }
  return tam
}

/**
 * Paketlerden `adet` soru çeker. `kimlik` bir sorunun kimliğini verir; `sonKullanilan` son turlarda sorulmuş kimlikler.
 * Aynı soru iki kez gelmez; sonuç karışıktır.
 */
export function dengeliSec<T>(
  paketler: SecimPaketi<T>[],
  adet: number,
  kimlik: (s: T) => string,
  sonKullanilan: Set<string> = new Set(),
  rastgele: () => number = Math.random,
): T[] {
  const payAdlar = paketPaylari(
    paketler.map((p) => p.sorular.length),
    adet,
  )
  const secilen: T[] = []
  const goruldu = new Set<string>()
  paketler.forEach((p, i) => {
    const essiz = p.sorular.filter((s) => {
      const k = kimlik(s)
      if (goruldu.has(k)) return false
      goruldu.add(k)
      return true
    })
    const yeni = karistir(
      essiz.filter((s) => !sonKullanilan.has(kimlik(s))),
      rastgele,
    )
    const eski = karistir(
      essiz.filter((s) => sonKullanilan.has(kimlik(s))),
      rastgele,
    )
    secilen.push(...[...yeni, ...eski].slice(0, payAdlar[i]))
  })
  return karistir(secilen, rastgele)
}

/** Seçilen soruları havuzdaki özgün sıraya dizer: her turda farklı sorular gelir ama oynanma sırası paketin sırasıdır. */
export function havuzSirasinaDiz<T>(secilen: T[], havuz: T[]): T[] {
  const sira = new Map(havuz.map((s, i) => [s, i]))
  return [...secilen].sort((a, b) => (sira.get(a) ?? 0) - (sira.get(b) ?? 0))
}

const GECMIS_SAYISI = 2

/** Son iki turda sorulmuş soru kimlikleri (oturum başına tarayıcıda tutulur). */
export function sonSorulanlar(oturumId: string): Set<string> {
  try {
    const kayit = JSON.parse(localStorage.getItem(`amfi_son_turlar_${oturumId}`) ?? '[]') as string[][]
    return new Set(kayit.flat())
  } catch {
    return new Set()
  }
}

export function turuKaydet(oturumId: string, idler: string[]): void {
  try {
    const anahtar = `amfi_son_turlar_${oturumId}`
    const kayit = JSON.parse(localStorage.getItem(anahtar) ?? '[]') as string[][]
    localStorage.setItem(anahtar, JSON.stringify([...kayit, idler].slice(-GECMIS_SAYISI)))
  } catch {
    /* önemsiz */
  }
}
