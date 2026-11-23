import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
const etiket = process.argv[2] || 'v0.67'
const t = await chromium.launch()
const s = await t.newPage({ viewport: { width: 1300, height: 900 } })
await s.goto(pathToFileURL(join(process.cwd(), 'denetim', etiket, 'gorsel-kontrol.html')).href)
await s.waitForTimeout(1500)
await s.screenshot({ path: join('denetim', etiket, 'gorsel-kontrol.png'), fullPage: true })
await t.close()
