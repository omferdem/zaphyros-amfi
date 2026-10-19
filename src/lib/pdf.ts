// PDF sunumlarını tarayıcıda açar, sayfaları tuvale çizer ve sayfa metinlerini çıkarır.
// Yalnızca hoca sayfalarında (sahne, akış düzenleyici) yüklenir; öğrenci telefonu bu paketi indirmez.
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import isciAdresi from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = isciAdresi

export type PdfBelgesi = PDFDocumentProxy

export async function pdfAc(kaynak: string | ArrayBuffer): Promise<PdfBelgesi> {
  const gorev = typeof kaynak === 'string' ? pdfjs.getDocument({ url: kaynak }) : pdfjs.getDocument({ data: new Uint8Array(kaynak) })
  return gorev.promise
}

/**
 * Sayfayı tuvale, verilen kutuya sığacak en büyük boyutta çizmeye başlar ve çizim görevini
 * döndürür (iptal edilebilsin diye beklemez). Sayfa hazırlanırken istek eskidiyse
 * (`gecerli` false dönerse) hiç çizmez. Ekranın piksel yoğunluğu hesaba katılır;
 * projeksiyonda yazılar keskin kalır.
 */
export async function sayfaCizmeyeBasla(
  belge: PdfBelgesi,
  sayfaNo: number,
  tuval: HTMLCanvasElement,
  kutu: { genislik: number; yukseklik: number },
  gecerli: () => boolean,
): Promise<RenderTask | null> {
  const sayfa = await belge.getPage(sayfaNo)
  if (!gecerli()) return null
  const temel = sayfa.getViewport({ scale: 1 })
  const olcek = Math.min(kutu.genislik / temel.width, kutu.yukseklik / temel.height)
  if (!(olcek > 0)) return null
  const yogunluk = Math.min(window.devicePixelRatio || 1, 2)
  const gorunum = sayfa.getViewport({ scale: olcek * yogunluk })
  tuval.width = Math.floor(gorunum.width)
  tuval.height = Math.floor(gorunum.height)
  tuval.style.width = `${Math.floor(gorunum.width / yogunluk)}px`
  tuval.style.height = `${Math.floor(gorunum.height / yogunluk)}px`
  return sayfa.render({ canvas: tuval, viewport: gorunum })
}

/**
 * Bir sayfanın metni: satırlar korunur, fazla boşluk atılır.
 * (pdf.js kelime aralarını kendisi boşluk parçası olarak verir; parçalar arasına boşluk
 * eklenirse bölünmüş kelimeler "Tanr ı" gibi ayrılır.)
 */
export function metniDuzenle(parcalar: { str: string; hasEOL?: boolean }[]): string {
  let metin = ''
  for (const p of parcalar) {
    metin += p.str
    if (p.hasEOL) metin += '\n'
  }
  return metin
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
}

export async function sayfaMetinleri(belge: PdfBelgesi): Promise<string[]> {
  const metinler: string[] = []
  for (let i = 1; i <= belge.numPages; i++) {
    const sayfa = await belge.getPage(i)
    const icerik = await sayfa.getTextContent()
    metinler.push(metniDuzenle(icerik.items as { str: string; hasEOL?: boolean }[]))
  }
  return metinler
}
