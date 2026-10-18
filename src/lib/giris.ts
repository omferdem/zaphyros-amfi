import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Oturum açmış hocanın Supabase oturumunu izler. undefined = henüz bilinmiyor. */
export function useGiris(): Session | null | undefined {
  const [oturum, setOturum] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setOturum(data.session))
    const { data } = supabase.auth.onAuthStateChange((_olay, yeni) => {
      setOturum(yeni)
      // Giriş bağlantısından dönen ?code=... adresten temizlenir.
      if (yeni && window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return oturum
}

/** Giriş bağlantısı hatalı ya da süresi geçmişse Supabase adrese hata ekler. */
export function adrestekiGirisHatasi(): string | null {
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#\/?[^?]*\??/, ''))
  const kod = q.get('error_code') || h.get('error_code') || q.get('error') || h.get('error')
  if (!kod) return null
  if (kod === 'otp_expired') return 'Giriş bağlantısının süresi dolmuş. Yeni bağlantı iste.'
  return 'Giriş bağlantısı kullanılamadı. Yeni bağlantı iste.'
}

export function useHocaMi(oturum: Session | null | undefined): boolean | undefined {
  const [hoca, setHoca] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!oturum) {
      setHoca(undefined)
      return
    }
    supabase.rpc('hoca_mi').then(({ data, error }) => setHoca(!error && data === true))
  }, [oturum?.user.id])
  return hoca
}
