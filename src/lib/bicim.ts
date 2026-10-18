/** "Ali Veli Yılmaz" -> "Ali Y." (perdede tam ad göstermemek için) */
export function kisaAd(adSoyad: string): string {
  const parcalar = adSoyad.trim().split(/\s+/)
  if (parcalar.length < 2) return parcalar[0] ?? ''
  return `${parcalar[0]} ${parcalar[parcalar.length - 1][0]}.`
}

export function tarih(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function tarihSaat(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function saat(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Oturumun listede ve raporda görünen adı */
export function oturumAdi(o: { baslik: string | null; basladi: string }): string {
  return o.baslik?.trim() || tarih(o.basladi)
}
