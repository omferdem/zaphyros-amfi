// supabase/migrations altındaki dosyaları sırayla birleştirip supabase/kurulum.sql üretir.
// Yeni kurulum yapan hoca SQL Editor'e yalnızca bu tek dosyayı yapıştırır.
// Kullanım: npm run kurulum-sql   (migration ekleyince çalıştır; test, dosya eskiyse hata verir)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const kok = fileURLToPath(new URL('..', import.meta.url))

export function kurulumSqlUret() {
  const klasor = join(kok, 'supabase', 'migrations')
  const dosyalar = readdirSync(klasor).filter((d) => /^\d{4}_.+\.sql$/.test(d)).sort()
  const bolumler = dosyalar.map(
    (d) => `-- ===========================================================================\n-- ${d}\n-- ===========================================================================\n\n${readFileSync(join(klasor, d), 'utf8').trim()}\n`,
  )
  return `-- AmfiOS kurulum SQL'i (bu dosya otomatik üretilir, elle düzenleme; kaynağı supabase/migrations)
-- Yeni bir Supabase projesinde SQL Editor'e bu dosyanın tamamını yapıştırıp bir kez çalıştır.
-- İçerdiği migration'lar: ${dosyalar.join(', ')}

${bolumler.join('\n')}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(kok, 'supabase', 'kurulum.sql'), kurulumSqlUret())
  console.log('supabase/kurulum.sql güncellendi')
}
