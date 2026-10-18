/** ayarlar.json doldurulmamış bir kopyada görünen ekran */
export default function KurulumEksik() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="cam-panel rounded-3xl p-8 w-full max-w-lg space-y-4">
        <h1 className="text-xl font-extrabold">Kurulum tamamlanmamış</h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          Bu site henüz bir Supabase projesine bağlanmamış. Sitenin bulunduğu depoda{' '}
          <code className="font-mono text-indigo-300">public/ayarlar.json</code> dosyasına kendi Supabase proje adresini
          ve publishable anahtarını yaz.
        </p>
        <p className="text-sm text-slate-400">
          Adım adım anlatım için depodaki <code className="font-mono text-indigo-300">docs/KURULUM.md</code> dosyasına bak.
        </p>
      </section>
    </main>
  )
}
