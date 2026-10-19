import { useEffect, useRef, useState } from 'react'
import type { RenderTask } from 'pdfjs-dist'
import { pdfAc, sayfaCizmeyeBasla, type PdfBelgesi } from '../lib/pdf'
import { sunumAdresi } from '../lib/akis'

/**
 * Sunum PDF'lerini bir kez açıp saklar. Aynı sunumun sayfaları arasında geçerken dosya
 * yeniden indirilmez.
 */
export function usePdfBelgeleri(icerikId: string | undefined, sunumIdleri: string[]) {
  const [belgeler, setBelgeler] = useState<Map<string, PdfBelgesi>>(new Map())
  const [hatalar, setHatalar] = useState<Set<string>>(new Set())
  const istenen = useRef(new Set<string>())
  const acik = useRef<PdfBelgesi[]>([])
  const anahtar = [...new Set(sunumIdleri)].sort().join(',')

  useEffect(() => {
    if (!icerikId) return
    for (const id of anahtar ? anahtar.split(',') : []) {
      if (istenen.current.has(id)) continue
      istenen.current.add(id)
      sunumAdresi(icerikId, id)
        .then(pdfAc)
        .then((b) => {
          acik.current.push(b)
          setBelgeler((m) => new Map(m).set(id, b))
        })
        .catch(() => setHatalar((h) => new Set(h).add(id)))
    }
  }, [icerikId, anahtar])

  // Sayfadan çıkınca açık belgeler kapatılır.
  useEffect(() => {
    const liste = acik.current
    return () => liste.forEach((b) => b.loadingTask.destroy())
  }, [])

  return { belgeler, hatalar }
}

/** PDF sayfasını kapsayıcısına sığacak en büyük boyutta çizer; boyut değişince yeniden çizer. */
export function SlaytCizimi({
  belge,
  sayfaNo,
  className = '',
}: {
  belge: PdfBelgesi | undefined
  sayfaNo: number
  className?: string
}) {
  const kutu = useRef<HTMLDivElement>(null)
  const tuval = useRef<HTMLCanvasElement>(null)
  const [boyut, setBoyut] = useState({ genislik: 0, yukseklik: 0 })

  useEffect(() => {
    const el = kutu.current
    if (!el) return
    const gozcu = new ResizeObserver(([g]) => {
      const { width, height } = g.contentRect
      setBoyut((b) =>
        Math.abs(b.genislik - width) < 2 && Math.abs(b.yukseklik - height) < 2 ? b : { genislik: width, yukseklik: height },
      )
    })
    gozcu.observe(el)
    return () => gozcu.disconnect()
  }, [])

  // pdf.js aynı tuvale aynı anda iki çizim yapılmasına izin vermez. Çizimler sıraya girer;
  // sırası gelen istek eskidiyse atlanır, süren çizim yeni istek gelince iptal edilir.
  const sira = useRef<Promise<void>>(Promise.resolve())
  const sonIstek = useRef(0)
  const surenGorev = useRef<RenderTask | null>(null)

  useEffect(() => {
    if (!belge || !tuval.current || boyut.genislik < 10 || boyut.yukseklik < 10) return
    const istek = ++sonIstek.current
    surenGorev.current?.cancel()
    const hedef = tuval.current
    const no = Math.min(Math.max(1, sayfaNo), belge.numPages)
    sira.current = sira.current.then(async () => {
      if (istek !== sonIstek.current) return
      try {
        const gorev = await sayfaCizmeyeBasla(belge, no, hedef, boyut, () => istek === sonIstek.current)
        if (!gorev) return
        surenGorev.current = gorev
        await gorev.promise
      } catch {
        // İptal edilen çizim hata fırlatır; yenisi zaten sırada.
      } finally {
        surenGorev.current = null
      }
    })
  }, [belge, sayfaNo, boyut])

  return (
    <div ref={kutu} className={`flex items-center justify-center overflow-hidden ${className}`}>
      {belge ? (
        <canvas ref={tuval} className="block bg-white shadow-2xl" />
      ) : (
        <span className="text-xs text-slate-500">Slayt yükleniyor…</span>
      )}
    </div>
  )
}
