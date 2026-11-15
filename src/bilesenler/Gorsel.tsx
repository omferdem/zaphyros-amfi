import { useState } from 'react'

/** public/gorseller altındaki bir görselin adresi (site alt klasörde yayınlansa da doğru çalışır). */
export function gorselAdresi(ad: string): string {
  return `${import.meta.env.BASE_URL}gorseller/${ad}`
}

/** Arka plan görselli CSS stili; dosya yoksa yalnızca verilen yedek zemin görünür. */
export function arkaPlan(ad: string, yedek = 'linear-gradient(135deg, #0b1030, #1a1450)'): React.CSSProperties {
  return { backgroundImage: `linear-gradient(rgba(7,10,31,0.25), rgba(7,10,31,0.55)), url("${gorselAdresi(ad)}"), ${yedek}`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

/**
 * Görsel (ör. "roket-1.webp"); dosya yoksa ya da yüklenemezse emoji gösterir. Böylece görseller eksik olsa da hiçbir sahne bozulmaz.
 */
export default function Gorsel({ ad, emoji, className = '', emojiClass, alt = '' }: { ad: string; emoji: string; className?: string; /** Görsel yoksa emojinin boyutu (verilmezse className) */ emojiClass?: string; alt?: string }) {
  const [hata, setHata] = useState(false)
  if (hata) return <span className={emojiClass ?? className} aria-hidden>{emoji}</span>
  return <img src={gorselAdresi(ad)} alt={alt} className={`object-contain select-none ${className}`} draggable={false} loading="lazy" onError={() => setHata(true)} />
}

/** Bir addan 1 ile n arasında sabit bir sıra numarası (aynı öğrenci hep aynı karakteri alır). */
export function adIndeksi(ad: string, n: number): number {
  let h = 0
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0
  return (h % n) + 1
}
