import { createClient } from '@supabase/supabase-js'

// Bu iki değer HERKESE AÇIK olacak şekilde tasarlanmıştır (frontend'de zaten görünür).
// Güvenliği RLS politikaları ve SECURITY DEFINER RPC fonksiyonları sağlar.
// service_role anahtarı ASLA buraya ya da repoya yazılmaz.
//
// Yerel geliştirmede farklı bir projeye bağlanmak için .env.local içinde
// VITE_SUPABASE_URL ve VITE_SUPABASE_KEY tanımlanabilir.
const URL_VARSAYILAN = 'https://oiqatggmfktgnexxaspc.supabase.co'
const ANAHTAR_VARSAYILAN = 'sb_publishable_iXZC9Q-YPzley008nYw8Fg_AbUU5c6v'

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || URL_VARSAYILAN
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY || ANAHTAR_VARSAYILAN

// PKCE akışı: e-postadaki giriş bağlantısı siteye ?code=... ile döner.
// (Varsayılan akış jetonu adresin # kısmına koyar; bu, HashRouter'ın #/panel adresleriyle çakışır.)
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
})

/** Veritabanına basit bir sorgu atar; bağlantı sağlıklıysa true döner. */
export async function baglantiyiDene(): Promise<boolean> {
  const { data, error } = await supabase.rpc('saglik')
  return !error && data === true
}
