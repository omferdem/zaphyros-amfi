/** Geri sayım halkası: oran 1'den 0'a iner, son çeyrekte kırmızıya döner. */
export default function Halka({ oran, etiket, boyut = 144 }: { oran: number; etiket: React.ReactNode; boyut?: number }) {
  const yaricap = 44
  const cevre = 2 * Math.PI * yaricap
  const o = Math.max(0, Math.min(1, oran))
  const acil = o < 0.25
  return (
    <div className="relative shrink-0" style={{ width: boyut, height: boyut }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={yaricap} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={yaricap}
          fill="none"
          stroke={acil ? '#ff4d6d' : '#22e3d2'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={cevre}
          strokeDashoffset={cevre * (1 - o)}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-extrabold tabular-nums ${acil ? 'text-rose-300' : 'text-white'}`}
        style={{ fontSize: boyut * 0.38 }}
      >
        {etiket}
      </span>
    </div>
  )
}
