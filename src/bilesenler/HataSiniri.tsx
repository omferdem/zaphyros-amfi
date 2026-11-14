import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Durum {
  hata: Error | null
}

/**
 * Bir sayfa çökerse boş ekran yerine ne olduğunu ve çıkış yollarını gösterir ("Ana sayfaya dön" her zaman çalışır).
 * `sifirla` değişince (sayfa değişince) kendiliğinden temizlenir.
 */
export default class HataSiniri extends Component<{ children: ReactNode; sifirla: string }, Durum> {
  state: Durum = { hata: null }

  static getDerivedStateFromError(hata: Error): Durum {
    return { hata }
  }

  componentDidUpdate(onceki: { sifirla: string }) {
    if (this.state.hata && onceki.sifirla !== this.props.sifirla) this.setState({ hata: null })
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    console.error('Sayfa hatası:', hata, bilgi.componentStack)
    // Yeni sürüm yayınlanınca açık sekmenin eski sayfa dosyaları sunucudan kalkar ("dynamically imported module" hatası):
    // sayfa bir kez kendiliğinden yenilenir ve yeni sürüm yüklenir.
    if (/dynamically imported module|importing a module script|Failed to fetch|Loading chunk/i.test(hata.message)) {
      try {
        const son = Number(sessionStorage.getItem('amfi_yenileme') ?? 0)
        if (Date.now() - son > 60_000) {
          sessionStorage.setItem('amfi_yenileme', String(Date.now()))
          window.location.reload()
        }
      } catch {
        /* depolama kapalıysa hata ekranı gösterilir */
      }
    }
  }

  render() {
    const { hata } = this.state
    if (!hata) return this.props.children
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <section className="cam-panel rounded-3xl p-8 w-full max-w-md space-y-4">
          <h1 className="text-lg font-bold">Bu sayfa açılırken bir sorun oldu</h1>
          <p className="text-sm text-slate-300">Verilerin etkilenmedi. Ana sayfaya dönüp tekrar deneyebilirsin.</p>
          <p className="text-xs text-slate-500 font-mono break-words rounded-xl bg-black/30 p-3">{hata.message || String(hata)}</p>
          <div className="flex flex-wrap gap-2">
            <a href="#/panel" onClick={() => this.setState({ hata: null })} className="parlak-buton rounded-xl px-5 py-2.5 font-bold">
              🏠 Ana sayfaya dön
            </a>
            <button className="ikincil-buton" onClick={() => window.location.reload()}>
              Sayfayı yenile
            </button>
          </div>
        </section>
      </main>
    )
  }
}
