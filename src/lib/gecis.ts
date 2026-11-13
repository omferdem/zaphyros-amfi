// Ders sırasında "Kahoot'a git" / "Quize git" geçişleri için yardımcılar (Supabase'e bağımlı değil, birim testlenir).
import type { PaketGrubu } from './paket'

/** Kahoot geçişi için açılan gizli akışların adı bu işaretle başlar; akış listelerinde görünmez. */
export const KAHOOT_ISARETI = '⚡'

export function kahootAkisAdi(paketAdi: string): string {
  return `${KAHOOT_ISARETI} ${paketAdi}`.slice(0, 200)
}

export function kahootAkisiMi(ad: string | null | undefined): boolean {
  return !!ad && ad.startsWith(KAHOOT_ISARETI)
}

/** "3. hafta: ..." gibi bir addan hafta numarasını alır. */
export function adaGoreHafta(ad: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*\.\s*hafta/i.exec(ad ?? '')
  return m ? Number(m[1]) : null
}

/** Paket türü: adında "quiz" geçenler ciddi quiz, diğerleri Kahoot (hızlı yarışma) sayılır. */
export function paketTuru(ad: string): 'quiz' | 'kahoot' {
  return /quiz/i.test(ad) ? 'quiz' : 'kahoot'
}

/**
 * Seçiciye gidecek paket listesi: istenen türdekiler, o anki haftanın paketi başta ("önerilen");
 * paketsiz sorular listelenmez.
 */
export function paketleriSirala(gruplar: PaketGrubu[], tur: 'kahoot' | 'quiz', hafta: number | null): (PaketGrubu & { onerilen: boolean })[] {
  const uygun = gruplar.filter((g) => g.ad && (tur === 'quiz' ? true : paketTuru(g.ad) === 'kahoot'))
  const liste = uygun.map((g) => ({ ...g, onerilen: hafta !== null && adaGoreHafta(g.ad) === hafta && paketTuru(g.ad) === tur }))
  const sira = (g: { ad: string; onerilen: boolean }) => (g.onerilen ? 0 : paketTuru(g.ad) === tur ? 1 : 2)
  return liste
    .map((g, i) => ({ g, i }))
    .sort((a, b) => sira(a.g) - sira(b.g) || (adaGoreHafta(a.g.ad) ?? 99) - (adaGoreHafta(b.g.ad) ?? 99) || a.i - b.i)
    .map((x) => x.g)
}

/** Quiz süresi için öneri: soru başına 45 saniye, en az 3 dakika, 5 dakikaya yuvarlanır. */
export function onerilenQuizSuresi(soruSayisi: number): number {
  const dk = Math.ceil((soruSayisi * 45) / 60)
  return Math.max(3, Math.ceil(dk / 5) * 5)
}
