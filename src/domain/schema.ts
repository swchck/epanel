import { z } from 'zod'

export const LOCALES = ['ru', 'en', 'sr', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export const LocalizedText = z.union([z.string(), z.partialRecord(z.enum(LOCALES), z.string())])
export type LocalizedText = z.infer<typeof LocalizedText>

export const DEVICE_TYPES = [
  'mcb',
  'rcd',
  'rcbo',
  'voltage-relay',
  'spd',
  'meter',
  'switch',
  'contactor',
  'din-socket',
  'bus',
  'terminal',
  'actuator',
  'bus-psu',
  'bus-gateway',
  'bus-io',
  'other',
] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const PROTECTIVE_TYPES: readonly DeviceType[] = ['mcb', 'rcd', 'rcbo', 'switch', 'voltage-relay']
export const RCD_TYPES: readonly DeviceType[] = ['rcd', 'rcbo']
// devices that physically break the circuit and are safe to rely on before touching wires;
// bus actuators and contactors are software-driven relays and never count as isolation
export const ISOLATING_TYPES: readonly DeviceType[] = ['mcb', 'rcd', 'rcbo', 'switch']
export const SMART_TYPES: readonly DeviceType[] = ['actuator', 'bus-psu', 'bus-gateway', 'bus-io']

export const BUS_SYSTEMS = ['knx', 'dali', 'modbus', 'zigbee', 'other'] as const
export const CHANNEL_FUNCTIONS = ['switch', 'dimmer', 'blind', 'heating', 'hvac', 'input', 'other'] as const

export const Channel = z.object({
  id: z.string(),
  label: LocalizedText.optional(),
  function: z.enum(CHANNEL_FUNCTIONS).default('switch'),
  // KNX group address like 1/2/3; other systems use whatever addressing they have
  group: z.string().optional(),
  points: z.array(z.string()).default([]),
})
export type Channel = z.infer<typeof Channel>

export const Smart = z.object({
  system: z.enum(BUS_SYSTEMS).default('knx'),
  // KNX physical address area.line.device, e.g. 1.1.5
  address: z.string().optional(),
  channels: z.array(Channel).default([]),
})
export type Smart = z.infer<typeof Smart>

export const Note = z.object({
  author: z.string().default(''),
  date: z.string(),
  text: z.string(),
})
export type Note = z.infer<typeof Note>

export const Circuit = z.object({
  cable: z.string().optional(),
  // mm², copper assumed
  crossSection: z.number().positive().optional(),
  lengthM: z.number().nonnegative().optional(),
  purpose: LocalizedText.optional(),
})
export type Circuit = z.infer<typeof Circuit>

export const Device = z.object({
  id: z.string().min(1),
  type: z.enum(DEVICE_TYPES),
  label: LocalizedText.default(''),
  // amperes
  rating: z.number().positive().optional(),
  curve: z.enum(['B', 'C', 'D', 'K', 'Z']).optional(),
  poles: z.number().int().min(1).max(4).default(1),
  // DIN modules of 17.5 mm; derived from type and poles when omitted
  width: z.number().positive().max(12).optional(),
  // milliamperes
  leakage: z.number().positive().optional(),
  rcdClass: z.enum(['AC', 'A', 'F', 'B']).optional(),
  selective: z.boolean().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  upstream: z.string().optional(),
  phase: z.enum(['L1', 'L2', 'L3', 'L1L2L3']).optional(),
  circuit: Circuit.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.array(Note).default([]),
  photos: z.array(z.string()).default([]),
  smart: Smart.optional(),
  // reserved for a future live-data adapter (e.g. a Home Assistant entity id)
  entity: z.string().optional(),
})
export type Device = z.infer<typeof Device>

export const RowItem = z.union([z.string(), z.object({ blank: z.number().positive() })])
export type RowItem = z.infer<typeof RowItem>

export const Row = z.object({
  id: z.string(),
  modules: z.number().int().positive().max(48),
  items: z.array(RowItem).default([]),
})
export type Row = z.infer<typeof Row>

export const Point2 = z.tuple([z.number(), z.number()])
export type Point2 = z.infer<typeof Point2>

export const Room = z.object({
  id: z.string(),
  name: LocalizedText,
  wet: z.boolean().default(false),
  polygon: z.array(Point2).default([]),
  color: z.string().optional(),
})
export type Room = z.infer<typeof Room>

export const POINT_KINDS = [
  'socket',
  'light',
  'switch',
  'appliance',
  'heating',
  'ac',
  'junction',
  'network',
  'panel',
  'sensor',
  'other',
] as const
export type PointKind = (typeof POINT_KINDS)[number]

export const APPLIANCE_PROFILES = [
  'generic',
  'washer',
  'dishwasher',
  'oven',
  'cooktop',
  'fridge',
  'boiler',
  'inverter-ac',
  'floor-heating',
  'ev',
] as const
export type ApplianceProfile = (typeof APPLIANCE_PROFILES)[number]

export const PlanPoint = z.object({
  id: z.string(),
  kind: z.enum(POINT_KINDS),
  room: z.string().optional(),
  x: z.number(),
  y: z.number(),
  device: z.string().optional(),
  label: LocalizedText.optional(),
  // watts, nameplate
  powerW: z.number().nonnegative().optional(),
  profile: z.enum(APPLIANCE_PROFILES).optional(),
  // millimetres from finished floor
  heightMm: z.number().nonnegative().optional(),
  // multiplies powerW: six spots of 7 W are count 6, a double socket is still one point
  count: z.number().int().positive().default(1),
  // group addresses a room control panel (or sensor) sends to
  controls: z.array(z.string()).default([]),
})
export type PlanPoint = z.infer<typeof PlanPoint>

export const Route = z.object({
  id: z.string(),
  device: z.string().optional(),
  points: z.array(Point2).min(2),
  note: LocalizedText.optional(),
  kind: z.enum(['power', 'bus', 'low']).default('power'),
  // the strip around the route that must not be drilled, in plan units
  safeWidth: z.number().positive().default(15),
})
export type Route = z.infer<typeof Route>

export const Photo = z.object({
  id: z.string(),
  src: z.string(),
  room: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  caption: LocalizedText.optional(),
  date: z.string().optional(),
})
export type Photo = z.infer<typeof Photo>

export const MaintenanceTask = z.object({
  id: z.string(),
  title: LocalizedText,
  intervalDays: z.number().int().positive(),
  devices: z.array(z.string()).default([]),
  howTo: LocalizedText.optional(),
})
export type MaintenanceTask = z.infer<typeof MaintenanceTask>

export const MaintenanceLog = z.object({
  task: z.string(),
  date: z.string(),
  note: z.string().optional(),
  author: z.string().optional(),
})
export type MaintenanceLog = z.infer<typeof MaintenanceLog>

export const DocumentRef = z.object({
  id: z.string(),
  title: LocalizedText,
  kind: z.enum(['act', 'scheme', 'passport', 'warranty', 'invoice', 'other']).default('other'),
  href: z.string(),
  date: z.string().optional(),
})
export type DocumentRef = z.infer<typeof DocumentRef>

export const Contact = z.object({
  role: z.enum(['electrician', 'management', 'emergency', 'utility', 'other']),
  name: z.string(),
  phone: z.string().optional(),
  note: LocalizedText.optional(),
})
export type Contact = z.infer<typeof Contact>

export const Plan = z.object({
  // plan units are centimetres: a 10 m wall is 1000 units
  width: z.number().positive().default(1200),
  height: z.number().positive().default(800),
  background: z.string().optional(),
  backgroundOpacity: z.number().min(0).max(1).default(0.6),
  grid: z.number().positive().default(50),
})
export type Plan = z.infer<typeof Plan>

export const PanelData = z.object({
  meta: z.object({
    title: LocalizedText,
    address: z.string().optional(),
    updated: z.string().optional(),
    enclosure: z.string().optional(),
    location: LocalizedText.optional(),
    // where the web app is published, e.g. https://user.github.io/panel/app/ — QR codes point here
    publicUrl: z.string().optional(),
    contacts: z.array(Contact).default([]),
  }),
  supply: z.object({
    phases: z.union([z.literal(1), z.literal(3)]).default(1),
    voltage: z.number().positive().default(230),
    // kilowatts allowed by the grid contract
    maxPowerKw: z.number().positive().optional(),
    input: z.string().optional(),
  }),
  rows: z.array(Row).default([]),
  devices: z.array(Device).default([]),
  rooms: z.array(Room).default([]),
  plan: Plan.default({ width: 1200, height: 800, backgroundOpacity: 0.6, grid: 50 }),
  points: z.array(PlanPoint).default([]),
  routes: z.array(Route).default([]),
  photos: z.array(Photo).default([]),
  maintenance: z
    .object({
      tasks: z.array(MaintenanceTask).default([]),
      log: z.array(MaintenanceLog).default([]),
    })
    .default({ tasks: [], log: [] }),
  documents: z.array(DocumentRef).default([]),
})
export type PanelData = z.infer<typeof PanelData>
export type PanelInput = z.input<typeof PanelData>

export function tr(text: LocalizedText | undefined, locale: string, fallback = ''): string {
  if (text === undefined) return fallback
  if (typeof text === 'string') return text
  const t = text as Partial<Record<string, string>>
  return t[locale] ?? t.en ?? t.ru ?? Object.values(t).find(Boolean) ?? fallback
}

export function defaultWidth(d: Pick<Device, 'type' | 'poles' | 'width'>): number {
  if (d.width) return d.width
  switch (d.type) {
    case 'meter':
      return d.poles >= 3 ? 7 : 4
    case 'din-socket':
      return 3
    case 'voltage-relay':
      return d.poles >= 3 ? 4 : 2
    case 'bus':
      return 4
    case 'actuator':
      return d.poles >= 3 ? 4 : d.poles >= 2 ? 4 : 2
    case 'bus-psu':
      return 4
    case 'bus-gateway':
      return 2
    case 'bus-io':
      return 2
    case 'rcd':
      return d.poles >= 3 ? 4 : 2
    case 'rcbo':
      return d.poles >= 3 ? 4 : 2
    default:
      return d.poles
  }
}

export function parsePanel(input: unknown): PanelData {
  return PanelData.parse(input)
}

export type ValidationIssue = { path: string; message: string }

export function safeParsePanel(input: unknown): { ok: true; data: PanelData } | { ok: false; issues: ValidationIssue[] } {
  const r = PanelData.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}

// referential integrity is outside zod's reach, so it is checked separately
export function referenceIssues(d: PanelData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const ids = new Set<string>()
  d.devices.forEach((dev, i) => {
    if (ids.has(dev.id)) issues.push({ path: `devices.${i}.id`, message: `duplicate id ${dev.id}` })
    ids.add(dev.id)
  })
  const roomIds = new Set(d.rooms.map((r) => r.id))
  d.devices.forEach((dev, i) => {
    if (dev.upstream && !ids.has(dev.upstream))
      issues.push({ path: `devices.${i}.upstream`, message: `unknown device ${dev.upstream}` })
  })
  d.rows.forEach((row, ri) =>
    row.items.forEach((it, ii) => {
      if (typeof it === 'string' && !ids.has(it))
        issues.push({ path: `rows.${ri}.items.${ii}`, message: `unknown device ${it}` })
    }),
  )
  d.points.forEach((p, i) => {
    if (p.device && !ids.has(p.device))
      issues.push({ path: `points.${i}.device`, message: `unknown device ${p.device}` })
    if (p.room && !roomIds.has(p.room)) issues.push({ path: `points.${i}.room`, message: `unknown room ${p.room}` })
  })
  return issues
}
