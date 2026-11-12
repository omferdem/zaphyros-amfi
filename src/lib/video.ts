// Video adımı: yalnızca https adresleri kabul edilir. YouTube bağlantıları perdede gömülü oynatılır
// (çerezsiz alan adıyla); başka adresler için "Videoyu aç" bağlantısı gösterilir.

/** Adres https ile başlıyorsa temizlenmiş halini, değilse null döndürür. */
export function videoAdresi(girdi: string): string | null {
  const s = girdi.trim()
  if (!/^https:\/\/[^\s]{4,255}$/.test(s)) return null
  try {
    return new URL(s).toString()
  } catch {
    return null
  }
}

/** YouTube bağlantısından gömme adresi; YouTube değilse null. */
export function youtubeGomme(adres: string): string | null {
  let u: URL
  try {
    u = new URL(adres)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)
      id = m ? m[1] : null
    }
  }
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null
  const bas = u.searchParams.get('t') ?? u.searchParams.get('start')
  const sn = bas && /^\d+s?$/.test(bas) ? parseInt(bas, 10) : 0
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${sn ? `&start=${sn}` : ''}`
}
