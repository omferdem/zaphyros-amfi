// Emoji tepkileri: öğrenci telefonu Realtime Broadcast ile (abone olmadan, HTTP ile) gönderir; kanalı yalnızca perde dinler.
// Böylece mesajlar öğrencilere yayılmaz. Veritabanına hiçbir şey yazılmaz.
import { useEffect, useRef } from 'react'
import { cihazKimligi } from './cihaz'
import { supabase } from './supabase'

export const TEPKILER = ['👍', '😂', '😮', '🤔', '👏', '❤️'] as const
export type Tepki = (typeof TEPKILER)[number]
/** Bir öğrenci en çok bu aralıkta bir emoji gönderebilir (ms). Hem telefon hem perde uygular. */
export const TEPKI_ARALIGI = 3000
/** Perdede aynı anda uçan en çok emoji; fazlası "×N" olarak birleşir. */
export const EN_COK_UCAN = 25

const kanalAdi = (oturum: string) => `tepki:${oturum}`

/** Telefon kimliğinden kısa, kişisel olmayan bir anahtar (aralık denetimi için). */
function kisaAnahtar(): string {
  const c = cihazKimligi()
  return c.slice(-8)
}

let sonGonderim = 0

/** Öğrenci: tepki gönderir. Aralık dolmadıysa false döner ve hiçbir şey göndermez. */
export function tepkiGonder(oturum: string, tepki: Tepki): boolean {
  const simdi = Date.now()
  if (simdi - sonGonderim < TEPKI_ARALIGI) return false
  sonGonderim = simdi
  const kanal = supabase.channel(kanalAdi(oturum), { config: { broadcast: { self: false } } })
  void kanal.httpSend('tepki', { e: tepki, k: kisaAnahtar() }).catch(() => {})
  return true
}

/** Perde: tepkileri dinler. Aynı kişiden 3 saniyeden sık gelenler yok sayılır. */
export function useTepkiDinle(oturum: string, etkin: boolean, geldi: (t: Tepki) => void, ayar?: (acik: boolean) => void): void {
  const geldiRef = useRef(geldi)
  geldiRef.current = geldi
  const ayarRef = useRef(ayar)
  ayarRef.current = ayar
  useEffect(() => {
    if (!etkin) return
    const son = new Map<string, number>()
    const kanal = supabase.channel(kanalAdi(oturum), { config: { broadcast: { self: false } } })
    kanal.on('broadcast', { event: 'tepki' }, ({ payload }) => {
      const p = payload as { e?: string; k?: string } | null
      if (!p?.e || !p.k || !(TEPKILER as readonly string[]).includes(p.e)) return
      const simdi = Date.now()
      if (simdi - (son.get(p.k) ?? 0) < TEPKI_ARALIGI - 200) return
      son.set(p.k, simdi)
      geldiRef.current(p.e as Tepki)
    })
    // Kumandadan açma/kapama: { acik: boolean }
    kanal.on('broadcast', { event: 'ayar' }, ({ payload }) => {
      const p = payload as { acik?: boolean } | null
      if (typeof p?.acik === 'boolean') ayarRef.current?.(p.acik)
    })
    kanal.subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [oturum, etkin])
}

/** Kumanda: perdedeki emoji tepkilerini açar ya da kapatır. */
export function tepkiAyarGonder(oturum: string, acik: boolean): void {
  const kanal = supabase.channel(kanalAdi(oturum), { config: { broadcast: { self: false } } })
  void kanal.httpSend('ayar', { acik }).catch(() => {})
}
