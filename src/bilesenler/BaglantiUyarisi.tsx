import { useCevrimici } from '../lib/ses'

/** İnternet kopunca ekranın üstünde belirir; ders durumu sunucuda durduğu için bağlantı gelince kaldığı yerden sürer. */
export default function BaglantiUyarisi() {
  const cevrimici = useCevrimici()
  if (cevrimici) return null
  return (
    <div role="alert" className="fixed top-2 left-1/2 -translate-x-1/2 z-[90] rounded-2xl bg-rose-600/95 text-white px-4 py-2 text-sm font-bold shadow-xl flex items-center gap-2">
      <span aria-hidden>⚠</span>
      İnternet bağlantısı yok. Ders durumu sunucuda saklı; bağlantı gelince kendiliğinden devam eder.
    </div>
  )
}
