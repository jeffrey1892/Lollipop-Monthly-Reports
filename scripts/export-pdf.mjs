#!/usr/bin/env node
/**
 * Headless PDF export for the workforce-intelligence report (dev/CI tooling).
 *
 * Renders the dedicated print route (src/app/print) in headless Chromium and
 * writes ./exports/<customer>-<month>-<scope>.pdf. Puppeteer is a
 * devDependency only — this never runs in the Vercel prod build/runtime.
 *
 * Usage (dev server must be running):
 *   npm run export:pdf -- --customer worksmart --month 2026-06 --scope full
 *
 * Options:
 *   --customer <id>       customer id (default: worksmart)
 *   --month <YYYY-MM>     reporting month (default: latest)
 *   --range <month|quarter>  weekly-engagement range (default: month)
 *   --scope <full|brief>  full includes appendix (default: full)
 *   --audience <executive|hr-restricted>  (default: executive)
 *   --base <url>          base URL (default: env REPORT_BASE_URL or http://localhost:3000)
 *   --out <path>          explicit output file path
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

export async function exportPdf(options = {}) {
  const customer = options.customer ?? 'worksmart'
  const month = options.month ?? ''
  const range = options.range ?? 'month'
  const scope = options.scope === 'brief' ? 'brief' : 'full'
  const audience = options.audience === 'hr-restricted' ? 'hr-restricted' : 'executive'
  const base = options.base ?? process.env.REPORT_BASE_URL ?? 'http://localhost:3000'

  const query = new URLSearchParams({ customer, range, scope })
  if (month) query.set('month', month)
  if (audience !== 'executive') query.set('audience', audience)
  const url = `${base}/print?${query.toString()}`

  const outDir = path.resolve('exports')
  await mkdir(outDir, { recursive: true })
  const outPath =
    options.out ?? path.join(outDir, `${customer}-${month || 'latest'}-${scope}${audience === 'hr-restricted' ? '-hr' : ''}.pdf`)

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })
    if (!response || !response.ok()) {
      throw new Error(`Navigation to ${url} failed: HTTP ${response ? response.status() : 'no response'}`)
    }
    try {
      await page.waitForFunction('window.__REPORT_PDF_READY__ === true', { timeout: 30_000 })
    } catch {
      throw new Error(
        `Timed out after 30s waiting for window.__REPORT_PDF_READY__ on ${url} — ` +
          'is the print route rendering PrintClient correctly?',
      )
    }
    await page.pdf({
      path: outPath,
      format: 'Letter',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      // 0 everywhere: page margins are built into the document's .print-frame
      // so output is identical whatever the print dialog's margin setting is.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    console.log(`Wrote ${outPath}`)
    return outPath
  } finally {
    await browser.close()
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))
if (isMain) {
  exportPdf(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err.message ?? err)
    process.exit(1)
  })
}
