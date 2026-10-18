import { createClient } from '@supabase/supabase-js'
import { ayarlar } from './ayarlar'

// Bu modül, main.tsx ayarlar.json'u yükledikten sonra içe aktarılır.
const { supabaseUrl, supabaseKey } = ayarlar()

export const SUPABASE_URL: string = supabaseUrl

// PKCE akışı: e-postadaki giriş bağlantısı siteye ?code=... ile döner.
// (Varsayılan akış jetonu adresin # kısmına koyar; bu, HashRouter'ın #/panel adresleriyle çakışır.)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
})

/** Veritabanına basit bir sorgu atar; bağlantı sağlıklıysa true döner. */
export async function baglantiyiDene(): Promise<boolean> {
  const { data, error } = await supabase.rpc('saglik')
  return !error && data === true
}
