import Gorsel from './Gorsel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EN_COK_UCAN, useTepkiDinle, type Tepki } from '../lib/tepki'

interface Ucan {
  id: number
  emoji: Tepki
  /** Başlangıç yatay konumu (%) ve yolun savrulma miktarları (vw) */
  x: number
  s1: number
  s2: number
  sure: number
  /** Birleşmiş emoji sayısı ("×4") */
  adet: number
  kalp: boolean
}

/**
 * Perde: öğrencilerin emojileri alttan yukarı kıvrımlı bir yolda yükselip solar. ❤️ sağ alttaki hoca karakterine uçar;
 * hoca gülümser, kalpler üst üste gelirse mutlu zıplar. Aynı anda en çok 25 emoji uçar, fazlası "×N" olarak birleşir.
 */
export default function TepkiKatmani({ oturum, etkin, ayar }: { oturum: string; etkin: boolean; ayar?: (acik: boolean) => void }) {
  const [ucanlar, setUcanlar] = useState<Ucan[]>([])
  const [hocaDurumu, setHocaDurumu] = useState<'sakin' | 'gulumse' | 'ziplar'>('sakin')
  const sayac = useRef(0)
  const kalpler = useRef<number[]>([])
  const hocaZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null)

  const geldi = useCallback((emoji: Tepki) => {
    const id = ++sayac.current
    if (emoji === '❤️') {
      const simdi = Date.now()
      kalpler.current = [...kalpler.current.filter((t) => simdi - t < 4000), simdi]
      setHocaDurumu(kalpler.current.length >= 3 ? 'ziplar' : 'gulumse')
      if (hocaZamanlayici.current) clearTimeout(hocaZamanlayici.current)
      hocaZamanlayici.current = setTimeout(() => setHocaDurumu('sakin'), 2200)
    }
    setUcanlar((liste) => {
      // Kalabalıkta aynı emoji birleşir: en yeni uçanın sayısı artar
      if (liste.length >= EN_COK_UCAN) {
        const i = liste.map((u) => u.emoji).lastIndexOf(emoji)
        if (i >= 0) return liste.map((u, j) => (j === i ? { ...u, adet: u.adet + 1 } : u))
        return liste
      }
      const kalp = emoji === '❤️'
      return [
        ...liste,
        { id, emoji, x: 8 + Math.random() * 70, s1: (Math.random() - 0.5) * 18, s2: (Math.random() - 0.5) * 18, sure: 4.2 + Math.random() * 1.6, adet: 1, kalp },
      ]
    })
    setTimeout(() => setUcanlar((l) => l.filter((u) => u.id !== id)), 6200)
  }, [])

  // Kanal her zaman dinlenir ki kumandadan "aç" komutu kapalıyken de alınsın; kapalıyken gelen emojiler yok sayılır
  const etkinRef = useRef(etkin)
  etkinRef.current = etkin
  useTepkiDinle(oturum, true, (t) => etkinRef.current && geldi(t), ayar)
  useEffect(
    () => () => {
      if (hocaZamanlayici.current) clearTimeout(hocaZamanlayici.current)
    },
    [],
  )
  if (!etkin) return null
  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden" aria-hidden>
      {ucanlar.map((u) => (
        <span
          key={u.id}
          className={u.kalp ? 'tepki-kalp' : 'tepki-yol'}
          style={{ left: `${u.x}%`, animationDuration: `${u.sure}s`, ['--s1' as string]: `${u.s1}vw`, ['--s2' as string]: `${u.s2}vw`, ['--x0' as string]: `${u.x}vw` }}
        >
          {u.emoji}
          {u.adet > 1 && <b className="text-sm align-top text-white bg-black/50 rounded-full px-1.5 ml-0.5">×{u.adet}</b>}
        </span>
      ))}
      <div className={`fixed bottom-28 text-4xl select-none ${hocaDurumu === 'ziplar' ? 'tepki-hoca-zipla' : ''}`} style={{ right: 'calc(var(--perde-sag, 0px) + 12px)' }} title="Hoca">
        <Gorsel ad="hoca.webp" poz={hocaDurumu === 'sakin' ? 'normal' : hocaDurumu === 'gulumse' ? 'mutlu' : 'ziplar'} emoji={hocaDurumu === 'sakin' ? '🧑‍🏫' : hocaDurumu === 'gulumse' ? '😊' : '🥳'} className="w-16 h-16" emojiClass="text-4xl" />
      </div>
    </div>
  )
}
