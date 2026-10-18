import { useParams } from 'react-router-dom'

export default function Sahne() {
  const { oturumId } = useParams()

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="cam-panel rounded-3xl p-10 w-full max-w-3xl text-center space-y-3">
        <p className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Sahne</p>
        <h1 className="text-3xl font-extrabold">Projeksiyon ekranı</h1>
        <p className="text-sm text-slate-400">
          Oturum: <span className="font-mono text-slate-300">{oturumId}</span>
        </p>
        <p className="text-sm text-slate-400">Ders başladığında QR kod ve ders akışı burada görünecek.</p>
      </section>
    </main>
  )
}
