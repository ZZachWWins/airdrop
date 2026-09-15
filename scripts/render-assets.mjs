/**
 * Renders the static brand assets in /public from the HTML templates beside
 * this file:
 *
 *   scripts/og-card.html    -> public/og.png                (1200x630 share card)
 *   scripts/app-icon.html   -> public/apple-touch-icon.png  (180x180)
 *                              public/icon-192.png
 *                              public/icon-512.png
 *
 * These are committed, so this only needs running when a template changes.
 * Playwright is not a project dependency — it exists solely to take these
 * screenshots, and shipping it to every contributor to regenerate two images
 * occasionally is not a trade worth making:
 *
 *   npx --yes playwright@1 install chromium   # first run only
 *   node scripts/render-assets.mjs
 *
 * Set PLAYWRIGHT_CHROMIUM to point at an existing Chromium instead.
 */

import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')

const TARGETS = [
  { template: 'og-card.html', out: 'og.png', width: 1200, height: 630 },
  { template: 'app-icon.html', out: 'apple-touch-icon.png', width: 512, height: 512, scale: 180 / 512 },
  { template: 'app-icon.html', out: 'icon-192.png', width: 512, height: 512, scale: 192 / 512 },
  { template: 'app-icon.html', out: 'icon-512.png', width: 512, height: 512, scale: 1 },
]

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error(
    'playwright is not installed. Run:\n  npm i -D playwright && npx playwright install chromium',
  )
  process.exit(1)
}

await mkdir(publicDir, { recursive: true })

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
)

for (const { template, out, width, height, scale = 1 } of TARGETS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  })
  const page = await context.newPage()

  await page.goto(pathToFileURL(resolve(here, template)).href, { waitUntil: 'networkidle' })
  // Let the webfonts settle before the shutter, or the card renders in a
  // fallback face and the kerning is visibly wrong.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)

  await page.screenshot({ path: resolve(publicDir, out) })
  await context.close()

  console.log(`rendered public/${out}  (${Math.round(width * scale)}x${Math.round(height * scale)})`)
}

await browser.close()
