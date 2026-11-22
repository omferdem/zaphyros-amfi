// Renklerin tek kaynağı: hoca perdesi, öğrenci telefonu, kumanda, önizleme ve tüm oyun sahneleri buradan okur.
// Şık renkleri perdedeki palettir (A pembe-kırmızı, B mavi, C turuncu-sarı, D yeşil); telefon aynı tonları kullanır.
export { TAKIMLAR as TAKIM_RENKLERI, takimBilgisi } from './takim'

export const SIK_RENKLERI = [
  { harf: 'A', sekil: '▲', hex: '#f43f5e' },
  { harf: 'B', sekil: '◆', hex: '#38bdf8' },
  { harf: 'C', sekil: '●', hex: '#fbbf24' },
  { harf: 'D', sekil: '■', hex: '#34d399' },
  { harf: 'E', sekil: '★', hex: '#8b5cf6' },
  { harf: 'F', sekil: '⬢', hex: '#22d3ee' },
] as const
