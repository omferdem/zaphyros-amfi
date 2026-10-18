// Tek cihaz kuralı için tarayıcıda rastgele bir kimlik tutulur. Kişisel veri değildir:
// cihaz hakkında hiçbir bilgi içermez, yalnızca "aynı tarayıcı mı" sorusuna cevap verir.
const ANAHTAR = 'amfi_cihaz'

function uret(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Eski tarayıcılar ve güvenli olmayan bağlantı (http) için
  const baytlar = new Uint8Array(16)
  crypto.getRandomValues(baytlar)
  return Array.from(baytlar, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function cihazKimligi(): string {
  try {
    let id = localStorage.getItem(ANAHTAR)
    if (!id) {
      id = uret()
      localStorage.setItem(ANAHTAR, id)
    }
    return id
  } catch {
    // Gizli sekme gibi depolamanın kapalı olduğu durumlar
    let id = sessionStorage.getItem(ANAHTAR)
    if (!id) {
      id = uret()
      sessionStorage.setItem(ANAHTAR, id)
    }
    return id
  }
}

export function sakla(anahtar: string, deger: string) {
  try {
    localStorage.setItem(anahtar, deger)
  } catch {
    /* depolama kapalıysa yok say */
  }
}

export function oku(anahtar: string): string | null {
  try {
    return localStorage.getItem(anahtar)
  } catch {
    return null
  }
}
