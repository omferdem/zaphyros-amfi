import { useEffect } from 'react'

const BOLUMLER: { baslik: string; maddeler: string[] }[] = [
  {
    baslik: '📅 Ders öncesi',
    maddeler: [
      'Derslerim sayfasında şubenin yanındaki “▶ Başlat” düğmesi sıradaki haftanın yoklamasını açar.',
      'Akışı önceden dene: akış sayfasında “👁 Önizle” perdeyi ve öğrenci telefonunu yan yana gösterir.',
      'Oyunların nasıl göründüğünü görmek için “🧪 Oyun provası” sahte öğrencilerle baştan sona oynatır.',
      'Slayt notunu slayda tıklayıp yaz; telefondaki kumandada o slayt açıkken görünür.',
    ],
  },
  {
    baslik: '🎓 Derste',
    maddeler: [
      'Yoklamayı aç, perdedeki karekodu öğrencilere okut. Geç gelen kodu yazarak girer (kod 6 saniyede bir değişir).',
      'Akışı yukarıdaki listeden seç. Önceki derste yarım kaldıysa “↺ Kaldığın yerden devam” çıkar.',
      'Konu bitince “🎮 Zapoot’a git” (seri sorular, oyunlar) ya da “📝 Quize git” (ciddi quiz, sonuç perdede). Bitince “↩ Derse dön” kaldığın slayta götürür.',
      'Telefondan yönetmek için “📱 Kumanda” karekodunu okut; projeksiyon yoksa yoklamayı “telefondan yönet” seçeneğiyle aç.',
    ],
  },
  {
    baslik: '🛟 Sorun olursa',
    maddeler: [
      'Öğrenci giremiyor: perdedeki 6 haneli kodu söyle; listede yoksa Sınıf listesi sekmesinden ekle ya da yoklamada “var yaz” de.',
      'Sayfayı yanlışlıkla kapattın ya da internet gitti: ders açık kalır. Derslerim sayfasında “▶ Devam” ile sahneye dönersin.',
      'Dersi yanlışlıkla bitirdin: oturum sayfasından “Dersi yeniden aç”.',
      'Yoklama yanlış alındı: Yoklama haftası kartındaki “İptal et” haftayı sıfırlar, yeniden başlatabilirsin.',
      'Perdede sesi kapatmak için “⋯ Diğer” menüsündeki ses düğmesini kullan.',
    ],
  },
  {
    baslik: '⌨️ Kısayollar (sahne)',
    maddeler: ['→ / boşluk / PageDown: sonraki adım   ← / PageUp: önceki adım', 'K: kodu gizle/göster   F: tam ekran'],
  },
]

/** Ders günü için kısa rehber: ders öncesi, derste, sorun olursa ve kısayollar. */
export default function Rehber({ kapat }: { kapat: () => void }) {
  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat()
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [kapat])
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur flex items-center justify-center p-3" onClick={kapat}>
      <section className="cam-panel rounded-3xl p-5 w-full max-w-3xl max-h-[92vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ders günü rehberi">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-display font-extrabold flex-1">❓ Ders günü rehberi</h2>
          <button className="ikincil-buton !py-1" onClick={kapat}>
            Kapat (Esc)
          </button>
        </div>
        {BOLUMLER.map((b) => (
          <div key={b.baslik} className="space-y-1.5">
            <h3 className="font-bold text-sm text-indigo-200">{b.baslik}</h3>
            <ul className="space-y-1 text-sm text-slate-200 list-disc pl-5">
              {b.maddeler.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
