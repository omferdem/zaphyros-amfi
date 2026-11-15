// Çevrimiçi öğrenci sayısı: öğrenci telefonu derse bağlıyken bir Realtime "presence" kanalına katılır, sahne yalnızca
// sayıyı okur. Hiçbir şey veritabanına yazılmaz; kanal yalnızca katılma ve ayrılma anında mesaj üretir (Realtime kotasını şişirmez).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const kanalAdi = (oturumId: string) => `varlik:${oturumId}`

/** Öğrenci tarafı: telefon dersteyken kanala katılır; sayfa kapanınca kendiliğinden ayrılır. */
export function varlikBildir(oturumId: string, cihaz: string): () => void {
  const kanal = supabase.channel(kanalAdi(oturumId), { config: { presence: { key: cihaz } } })
  kanal.subscribe((durum) => {
    if (durum === 'SUBSCRIBED') void kanal.track({ t: Date.now() })
  })
  return () => {
    void supabase.removeChannel(kanal)
  }
}

/** Sahne tarafı: kanaldaki çevrimiçi telefon sayısı. */
export function useVarlikSayisi(oturumId: string, etkin: boolean): number {
  const [sayi, setSayi] = useState(0)
  useEffect(() => {
    if (!etkin) return
    const kanal = supabase.channel(kanalAdi(oturumId), { config: { presence: { key: `sahne-${oturumId}` } } })
    kanal.on('presence', { event: 'sync' }, () => {
      const durum = kanal.presenceState()
      setSayi(Object.keys(durum).filter((k) => !k.startsWith('sahne-')).length)
    })
    kanal.subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [oturumId, etkin])
  return sayi
}
