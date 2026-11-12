import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error: düz JavaScript betiği, tip tanımı yok
import { kurulumSqlUret } from './kurulum-sql.mjs'

describe('kurulum.sql', () => {
  it('migration dosyalarıyla güncel (değilse: npm run kurulum-sql)', () => {
    const dosya = readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8')
    // Windows'ta git dosyaları CRLF ile çıkarabilir; içerik aynıysa satır sonu fark yaratmasın.
    expect(dosya.replace(/\r\n/g, '\n')).toBe(kurulumSqlUret().replace(/\r\n/g, '\n'))
  })
})
