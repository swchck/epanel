// Renders the link preview image (public/og.png, 1200 x 630) shown by messengers and social sites.
import sharp from 'sharp'

const W = 1200
const H = 630
const font = 'Helvetica Neue, Helvetica, Arial, sans-serif'

const breaker = (x, y, w, on, accent = '#f2b630') => `
  <g transform="translate(${x} ${y})">
    <rect width="${w}" height="190" rx="8" fill="#f4f1ea"/>
    <rect x="6" y="10" width="${w - 12}" height="14" rx="3" fill="#d9d3c6"/>
    <rect x="6" y="166" width="${w - 12}" height="14" rx="3" fill="#d9d3c6"/>
    <rect x="${w / 2 - 14}" y="60" width="28" height="70" rx="5" fill="#1d1b16"/>
    <rect x="${w / 2 - 10}" y="${on ? 64 : 96}" width="20" height="30" rx="3" fill="${accent}"/>
  </g>`

const modules = [
  [0, 58, true, '#f2b630'],
  [64, 58, true, '#f2b630'],
  [128, 116, true, '#7c5cff'],
  [250, 58, false, '#f2b630'],
  [314, 58, true, '#f2b630'],
]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="900" cy="300" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f2b630" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#f2b630" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0c0f12"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <g transform="translate(72 72)">
    <rect width="64" height="64" rx="14" fill="#f2b630"/>
    <rect x="12" y="14" width="40" height="36" rx="4.5" fill="#1d1b16"/>
    <rect x="16.5" y="18.5" width="7" height="27" rx="1.6" fill="#f2b630"/>
    <rect x="25.5" y="18.5" width="7" height="27" rx="1.6" fill="#f2b630"/>
    <rect x="34.5" y="18.5" width="13" height="27" rx="1.6" fill="#f2b630"/>
    <path d="M42.5 22.5 L37.8 32.5 H42 L39.3 41 L45.6 29.8 H41.4 L44.2 22.5 Z" fill="#1d1b16"/>
    <text x="84" y="44" font-family="${font}" font-size="30" font-weight="600" fill="#f4f1ea">Щиток</text>
  </g>

  <text font-family="${font}" font-size="58" font-weight="700" fill="#f4f1ea" letter-spacing="-1">
    <tspan x="72" y="262">Что отключает</tspan>
    <tspan x="72" y="330">каждый автомат</tspan>
  </text>
  <text font-family="${font}" font-size="26" fill="#a9a59c">
    <tspan x="72" y="400">QR-код на дверце щитка открывает схему</tspan>
    <tspan x="72" y="438">автоматов и план квартиры с кабелями.</tspan>
  </text>
  <text x="72" y="552" font-family="${font}" font-size="22" fill="#f2b630">Работает без интернета · данные зашифрованы</text>

  <g transform="translate(700 150)">
    <rect x="-24" y="-30" width="420" height="270" rx="22" fill="#1b1f24" stroke="#2c3238" stroke-width="2"/>
    <rect x="-24" y="85" width="420" height="20" fill="#2c3238"/>
    ${modules.map(([x, w, on, c]) => breaker(x, 0, w, on, c)).join('')}
  </g>
  <g transform="translate(700 450)" font-family="${font}" font-size="20" fill="#a9a59c">
    <text x="0" y="0">QF1 · Кухня</text>
    <text x="250" y="0">QF4 · Ванная</text>
  </g>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(new URL('../public/og.png', import.meta.url).pathname)
