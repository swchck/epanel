import {
  CalendarCheck,
  ClipboardCheck,
  Images,
  Map,
  PanelsTopLeft,
  PencilRuler,
  ScanSearch,
  Settings,
  Siren,
  Tags,
  Waypoints,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { NavName } from '@/router'

export const NAV_ICONS: Record<NavName, Component> = {
  panel: PanelsTopLeft,
  plan: Map,
  find: ScanSearch,
  emergency: Siren,
  schema: Waypoints,
  checks: ClipboardCheck,
  maintenance: CalendarCheck,
  photos: Images,
  labels: Tags,
  edit: PencilRuler,
  settings: Settings,
}
