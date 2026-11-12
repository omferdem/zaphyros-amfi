import { useState } from 'react'

const RENKLER = ['#ff4d9d', '#7c5cff', '#22e3d2', '#ffd23f', '#b8ff4a', '#ff8a3d']

/** Ekranın üstünden dökülen renkli kâğıtlar (yalnızca CSS; hareket azaltma tercihinde durur). */
export default function Konfeti({ adet = 56 }: { adet?: number }) {
  const [parcalar] = useState(() =>
    Array.from({ length: adet }, (_, i) => ({
      sol: Math.random() * 100,
      x: Math.round((Math.random() - 0.5) * 30),
      r: Math.round(Math.random() * 720 - 360),
      sure: 2.4 + Math.random() * 2,
      gecikme: Math.random() * 0.6,
      renk: RENKLER[i % RENKLER.length],
      genislik: 6 + Math.round(Math.random() * 6),
      yukseklik: 10 + Math.round(Math.random() * 8),
    })),
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-[60]">
      {parcalar.map((p, i) => (
        <span
          key={i}
          className="konfeti-parca"
          style={
            {
              left: `${p.sol}%`,
              width: p.genislik,
              height: p.yukseklik,
              background: p.renk,
              '--x': `${p.x}vw`,
              '--r': `${p.r}deg`,
              '--sure': `${p.sure}s`,
              '--gecikme': `${p.gecikme}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
