// Migration'ları ve düz SQL testlerini PGlite (tarayıcıda da çalışan WASM Postgres) üzerinde dener.
// Bilgisayarda Postgres kurulu olması gerekmez. Kullanım: npm run sql-test
// Sıra: Supabase taklidi, bütün migration'lar, sonra supabase/test altındaki *_test.sql dosyaları.
// (0002 testi psql komutları kullandığı için burada çalışmaz; onu psql ile çalıştır.)
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const kok = fileURLToPath(new URL('..', import.meta.url))
const klasor = (...y) => join(kok, 'supabase', ...y)
const db = new PGlite()

const migrationlar = readdirSync(klasor('migrations')).filter((d) => /^\d{4}_.+\.sql$/.test(d)).sort()
const testler = readdirSync(klasor('test'))
  .filter((d) => /_test\.sql$/.test(d) && !readFileSync(klasor('test', d), 'utf8').includes('\gset'))
  .sort()

const adimlar = [klasor('test', 'supabase_taklit.sql'), ...migrationlar.map((d) => klasor('migrations', d)), ...testler.map((d) => klasor('test', d))]
for (const dosya of adimlar) {
  try {
    await db.exec(readFileSync(dosya, 'utf8'))
    console.log('tamam ', dosya.slice(kok.length))
  } catch (e) {
    console.error('HATA  ', dosya.slice(kok.length), '\n      ', e.message)
    process.exit(1)
  }
}
