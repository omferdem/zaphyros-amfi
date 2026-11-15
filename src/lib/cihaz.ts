// Tek cihaz kuralı için tarayıcıda rastgele bir kimlik tutulur. Kişisel veri değildir:
// cihaz hakkında hiçbir bilgi içermez, yalnızca "aynı tarayıcı mı" sorusuna cevap verir.
// Kimlik hem localStorage'da hem çerezde saklanır: öğrenci yalnızca birini temizleyerek yeni kimlik alamaz.
const ANAHTAR = 'amfi_cihaz'

function uret(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Eski tarayıcılar ve güvenli olmayan bağlantı (http) için
  const baytlar = new Uint8Array(16)
  crypto.getRandomValues(baytlar)
  return Array.from(baytlar, (b) => b.toString(16).padStart(2, '0')).join('')
}

function cerezOku(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${ANAHTAR}=([0-9A-Za-z-]{8,64})`))
    return m ? m[1] : null
  } catch {
    return null
  }
}

function cerezYaz(id: string): void {
  try {
    document.cookie = `${ANAHTAR}=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`
  } catch {
    /* çerez kapalıysa yok say */
  }
}

export function cihazKimligi(): string {
  try {
    let id = localStorage.getItem(ANAHTAR) ?? cerezOku()
    if (!id) id = uret()
    localStorage.setItem(ANAHTAR, id)
    cerezYaz(id)
    return id
  } catch {
    // Gizli sekme gibi depolamanın kapalı olduğu durumlar
    let id = sessionStorage.getItem(ANAHTAR) ?? cerezOku()
    if (!id) {
      id = uret()
      sessionStorage.setItem(ANAHTAR, id)
    }
    cerezYaz(id)
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
