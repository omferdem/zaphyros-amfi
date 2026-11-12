/**
 * Haftalık planı topluca akışa çevirir: yapıştırılan her dolu satır bir akış olur. Satır başındaki
 * "1.", "1)", "Hafta 1:", "1. hafta -" gibi numaralar atılır ve akış "N. hafta: konu" adıyla açılır.
 * Boş satırlar sayılmaz. Hata durumunda o ana kadar açılanlar kalır.
 */
export function haftaSatirlari(metin: string, baslangicNo: number): string[] {
  const satirlar = metin
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((s) => s.replace(/\t+/g, ' ').trim())
    .filter(Boolean)
  return satirlar.map((s, i) => {
    const konu = s
      .replace(/^(hafta\s*)?\d{1,2}\s*[.):\-–]?\s*(\.?\s*hafta)?\s*[:\-–.)]?\s*/i, '')
      .trim()
    return `${baslangicNo + i}. hafta${konu ? `: ${konu}` : ''}`.slice(0, 200)
  })
}
