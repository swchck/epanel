import { AirVent, Cable, CircleDot, EthernetPort, Heater, Lightbulb, Plug, Radar, Router, TabletSmartphone, ToggleLeft, WashingMachine } from '@lucide/vue'
import type { Component } from 'vue'
import type { CableType, PointKind } from '@/domain/schema'

export const POINT_ICONS: Record<PointKind, Component> = {
  socket: Plug,
  light: Lightbulb,
  switch: ToggleLeft,
  appliance: WashingMachine,
  heating: Heater,
  ac: AirVent,
  junction: Cable,
  network: Router,
  data: EthernetPort,
  panel: TabletSmartphone,
  sensor: Radar,
  other: CircleDot,
}

export const POINT_COLORS: Record<PointKind, string> = {
  socket: '#2563eb',
  light: '#d97706',
  switch: '#64748b',
  appliance: '#7c3aed',
  heating: '#dc2626',
  ac: '#0891b2',
  junction: '#475569',
  network: '#059669',
  data: '#0284c7',
  panel: '#16a34a',
  sensor: '#0d9488',
  other: '#6b7280',
}

export const CABLE_COLORS: Record<CableType, string> = {
  ethernet: '#0284c7',
  hdmi: '#9333ea',
  coax: '#b45309',
  usb: '#475569',
  speaker: '#db2777',
  fiber: '#ca8a04',
  phone: '#0d9488',
  alarm: '#dc2626',
  other: '#64748b',
}
