#!/usr/bin/env node
/**
 * PDF export validation (dev/CI tooling).
 *
 * Exports the WorkSmart 2026-04 report (full + brief) via scripts/export-pdf.mjs
 * against a running dev server, then asserts:
 *   - page count between 3 and 18 (full) / 1 and 18 (brief)
 *   - file size < 5 MB
 *   - if pdftoppm is available: renders PNG previews into exports/preview/ for
 *     manual review and fails if any rendered page is > 98% white pixels
 *     (blank-page detector). Skips with a warning when tooling is missing.
 *
 * Usage: npm run validate:pdf   (dev server must be running on :3000 or set REPORT_BASE_URL)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { exportPdf } from './export-pdf.mjs'

const CUSTOMER = 'worksmart'
const MONTH = '2026-04'
const MAX_BYTES = 5 * 1024 * 1024
// Letter portrait (8.5×11) paginates longer than the old landscape layout.
const MAX_PAGES = 18

let failures = 0
const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  failures++
}
const ok = (msg) => console.log(`ok: ${msg}`)

function which(cmd) {
  try {
    return execFileSync('which', [cmd], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function pageCount(pdfPath) {
  const pdfinfo = which('pdfinfo')
  if (pdfinfo) {
    const out = execFileSync(pdfinfo, [pdfPath], { encoding: 'utf8' })
    const m = out.match(/^Pages:\s+(\d+)/m)
    if (m) return Number(m[1])
  }
  // Fallback: count page objects in the raw PDF (works for Chromium output).
  const raw = readFileSync(pdfPath, 'latin1')
  const matches = raw.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : null
}

// Whiteness check via PPM (P6) output — trivially parseable raw RGB.
function whitenessOfPpm(buf) {
  // P6\n<w> <h>\n255\n<raw rgb>
  const header = buf.slice(0, 64).toString('latin1')
  const m = header.match(/^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/)
  if (!m) return null
  const dataStart = m[0].length
  const total = Number(m[1]) * Number(m[2])
  let white = 0
  let sampled = 0
  for (let i = 0; i < total; i += 7) {
    // sample every 7th pixel
    const o = dataStart + i * 3
    if (buf[o] > 250 && buf[o + 1] > 250 && buf[o + 2] > 250) white++
    sampled++
  }
  return white / sampled
}

async function validate(scope, minPages) {
  const outPath = await exportPdf({ customer: CUSTOMER, month: MONTH, scope })
  const bytes = statSync(outPath).size
  if (bytes >= MAX_BYTES) fail(`${outPath} is ${(bytes / 1e6).toFixed(1)} MB (limit 5 MB)`)
  else ok(`${path.basename(outPath)} size ${(bytes / 1024).toFixed(0)} KB`)

  const pages = pageCount(outPath)
  if (pages === null) console.warn(`warn: could not determine page count of ${outPath}`)
  else if (pages < minPages || pages > MAX_PAGES) fail(`${outPath} has ${pages} pages (expected ${minPages}-${MAX_PAGES})`)
  else ok(`${path.basename(outPath)} page count ${pages}`)

  const pdftoppm = which('pdftoppm')
  if (!pdftoppm) {
    console.warn('warn: pdftoppm not found — skipping blank-page / preview rendering')
    return
  }
  const previewDir = path.resolve('exports', 'preview')
  mkdirSync(previewDir, { recursive: true })
  const stem = path.join(previewDir, `${CUSTOMER}-${MONTH}-${scope}`)
  // PNG previews for manual review
  execFileSync(pdftoppm, ['-png', '-r', '80', outPath, stem])
  // Low-res PPM for the whiteness check
  execFileSync(pdftoppm, ['-r', '30', outPath, `${stem}-check`])
  const ppms = readdirSync(previewDir).filter(
    (f) => f.startsWith(`${CUSTOMER}-${MONTH}-${scope}-check`) && f.endsWith('.ppm'),
  )
  for (const f of ppms.sort()) {
    const ratio = whitenessOfPpm(readFileSync(path.join(previewDir, f)))
    if (ratio === null) {
      console.warn(`warn: could not parse ${f} for whiteness check`)
    } else if (ratio > 0.98) {
      fail(`${f} is ${(ratio * 100).toFixed(1)}% white — likely a blank page`)
    } else {
      ok(`${f} whiteness ${(ratio * 100).toFixed(1)}%`)
    }
  }
  console.log(`PNG previews written to ${previewDir}`)
}

try {
  await validate('full', 3)
  await validate('brief', 1)
} catch (err) {
  fail(err.message ?? String(err))
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s)`)
  process.exit(1)
}
console.log('\nAll PDF validations passed')
