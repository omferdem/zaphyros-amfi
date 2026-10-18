import { useSearchParams } from 'react-router-dom'

export default function Katil() {
  const [parametreler] = useSearchParams()
  const oturum = parametreler.get('s')

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-6 w-full max-w-sm space-y-4 text-center">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Derse katıl</p>
        <h1 className="text-2xl font-extrabold">Hoş geldin</h1>
        {oturum ? (
          <p className="text-sm text-slate-300">
            Ders oturumu bulundu. Numara ile giriş bir sonraki sürümde açılacak.
          </p>
        ) : (
          <p className="text-sm text-slate-300">
            Derse katılmak için perdedeki QR kodu telefonunun kamerasıyla okut.
          </p>
        )}
      </section>
    </main>
  )
}
