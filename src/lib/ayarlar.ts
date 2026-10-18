// Her kurulum kendi Supabase projesine bağlanır. Adres ve anahtar koda gömülmez,
// sitenin yanındaki ayarlar.json dosyasından okunur. Böylece başka bir hoca kendi
// kopyasında yalnızca bu dosyayı düzenler, kodu derlemesi gerekmez.
//
// Bu iki değer HERKESE AÇIK olacak şekilde tasarlanmıştır (frontend'de zaten görünür).
// Güvenliği RLS politikaları ve SECURITY DEFINER RPC fonksiyonları sağlar.
// service_role anahtarı ASLA ayarlar.json'a ya da repoya yazılmaz.
//
// Yerel geliştirmede .env.local içindeki VITE_SUPABASE_URL ve VITE_SUPABASE_KEY dosyadaki değerlerin önüne geçer.

export interface Ayarlar {
  supabaseUrl: string
  supabaseKey: string
}

let yuklenen: Ayarlar | null = null

export async function ayarlariYukle(): Promise<Ayarlar | null> {
  let dosya: Partial<Ayarlar> = {}
  try {
    const yanit = await fetch('./ayarlar.json', { cache: 'no-store' })
    if (yanit.ok) dosya = (await yanit.json()) as Partial<Ayarlar>
  } catch {
    /* dosya yoksa ya da bozuksa aşağıda boş sayılır */
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || dosya.supabaseUrl || ''
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || dosya.supabaseKey || ''
  if (!/^https?:\/\/.+/.test(supabaseUrl) || !supabaseKey || supabaseKey.includes('BURAYA')) return null
  yuklenen = { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseKey }
  return yuklenen
}

export function ayarlar(): Ayarlar {
  if (!yuklenen) throw new Error('ayarlar.json yüklenmeden Supabase kullanılamaz')
  return yuklenen
}
