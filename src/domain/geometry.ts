import type { Point2 } from './schema'

export function polygonArea(poly: Point2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!
    const [x2, y2] = poly[(i + 1) % poly.length]!
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

export function polygonCentroid(poly: Point2[]): Point2 {
  if (poly.length === 0) return [0, 0]
  const a = polygonArea(poly)
  if (a === 0) return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!
    const [x2, y2] = poly[(i + 1) % poly.length]!
    const f = x1 * y2 - x2 * y1
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  const signed = poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length]!
    return s + p[0] * q[1] - q[0] * p[1]
  }, 0) / 2
  return [cx / (6 * signed), cy / (6 * signed)]
}

export function pointInPolygon(x: number, y: number, poly: Point2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// plan units are centimetres
export function areaM2(poly: Point2[]): number {
  return polygonArea(poly) / 10_000
}

export function snap(v: number, step: number): number {
  return Math.round(v / step) * step
}
