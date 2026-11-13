import { useRef, useState } from 'react'

/**
 * Sunum yükleme alanı: PDF dosyalarını (birden fazla) sürükleyip bırakmak ya da tıklayıp seçmek yeter.
 * Seçilen dosyaları verilen işleve iletir; yüklemenin kendisi üst bileşende yapılır.
 */
export default function SunumSurukle({
  dosyalar,
  mesgul,
  durum,
  yardim,
}: {
  dosyalar: (liste: File[]) => void
  mesgul: boolean
  durum: string | null
  yardim?: string
}) {
  const [uzerinde, setUzerinde] = useState(0)
  const girdi = useRef<HTMLInputElement>(null)

  function birak(e: React.DragEvent) {
    e.preventDefault()
    setUzerinde(0)
    if (mesgul) return
    const liste = [...e.dataTransfer.files]
    if (liste.length) dosyalar(liste)
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        setUzerinde((n) => n + 1)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setUzerinde((n) => Math.max(0, n - 1))}
      onDrop={birak}
      onClick={() => !mesgul && girdi.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !mesgul && girdi.current?.click()}
      className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
        uzerinde > 0 ? 'border-indigo-300 bg-indigo-500/15' : 'border-white/15 bg-white/5 hover:bg-white/10'
      } ${mesgul ? 'opacity-70 cursor-wait' : ''}`}
    >
      <p className="text-3xl" aria-hidden>
        📄
      </p>
      <p className="font-bold mt-1">{mesgul ? (durum ?? 'Yükleniyor…') : 'Sunumları buraya sürükleyip bırak'}</p>
      <p className="text-xs text-slate-400 mt-1">{yardim ?? 'PDF dosyaları; birden fazlasını aynı anda bırakabilirsin. Ya da tıklayıp seç.'}</p>
      <input
        ref={girdi}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const liste = [...(e.target.files ?? [])]
          e.target.value = ''
          if (liste.length) dosyalar(liste)
        }}
      />
    </div>
  )
}
