// one DIN module is 17.5 mm wide; the face of a typical breaker is ~85 mm tall, hence the ratio
export const MODULE = 36
export const HEIGHT = 176
export const ROW_GAP = 64
export const RAIL_PAD = 22

export const TYPE_ACCENT: Record<string, string> = {
  mcb: '#3f4a5a',
  rcd: '#2563eb',
  rcbo: '#7c3aed',
  'voltage-relay': '#0d9488',
  spd: '#ea580c',
  meter: '#0891b2',
  switch: '#dc2626',
  contactor: '#4b5563',
  'din-socket': '#6b7280',
  bus: '#b08d2c',
  terminal: '#64748b',
  other: '#64748b',
}
