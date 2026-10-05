// Renders the macOS installer background (src-tauri/dmg/background.tiff) at 1x and 2x.
// Icon positions must match bundle.macOS.dmg in src-tauri/tauri.conf.json: app at x 170, Applications at x 490, y 215.
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import sharp from 'sharp'

// the window opens at 660 x 400; the canvas runs on past it so a window resized larger stays filled
const W = 660
const H = 400
const CANVAS_W = 1800
const CANVAS_H = 1200
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs>
    <radialGradient id="bg" cx="${W / 2}" cy="${H / 2}" r="${CANVAS_W}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbf8f2"/>
      <stop offset="1" stop-color="#ebe3d3"/>
    </radialGradient>
    <pattern id="rail" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="11" cy="11" r="1.1" fill="#1d1b16" opacity="0.07"/>
    </pattern>
    <marker id="head" viewBox="0 0 12 12" refX="3" refY="6" markerWidth="3.4" markerHeight="3.4" orient="auto">
      <path d="M1 1 L11 6 L1 11 Z" fill="#e0a21e"/>
    </marker>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#rail)"/>
  <text x="${W / 2}" y="62" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#1d1b16">Panel Editor</text>
  <text x="${W / 2}" y="88" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13.5" fill="#6b6457">Drag the app to Applications to install it</text>
  <path d="M258 212 C 296 172, 362 172, 398 206" fill="none" stroke="#f2b630" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 11" marker-end="url(#head)"/>
  <text x="${W / 2}" y="356" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11.5" fill="#8a8274">Unsigned build: the first time, open it with right-click → Open</text>
</svg>`

const out = new URL('../src-tauri/dmg/', import.meta.url).pathname
for (const [scale, name] of [[1, 'bg.png'], [2, 'bg@2x.png']]) {
  await sharp(Buffer.from(svg), { density: 72 * scale }).png().toFile(out + name)
}
// Finder picks the 2x frame on Retina screens only from a multi-resolution TIFF
execFileSync('tiffutil', ['-cathidpicheck', out + 'bg.png', out + 'bg@2x.png', '-out', out + 'raw.tiff'])
// uncompressed, the 2x frame alone is about 35 MB; the flat colours shrink to almost nothing with LZW
execFileSync('tiffutil', ['-lzw', out + 'raw.tiff', '-out', out + 'background.tiff'])
rmSync(out + 'raw.tiff')
rmSync(out + 'bg.png')
rmSync(out + 'bg@2x.png')
