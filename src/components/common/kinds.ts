import { AirVent, Cable, CircleDot, Heater, Lightbulb, Plug, Router, ToggleLeft, WashingMachine } from '@lucide/vue'
import type { Component } from 'vue'
import type { PointKind } from '@/domain/schema'

export const POINT_ICONS: Record<PointKind, Component> = {
  socket: Plug,
  light: Lightbulb,
  switch: ToggleLeft,
  appliance: WashingMachine,
  heating: Heater,
  ac: AirVent,
  junction: Cable,
  network: Router,
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
  other: '#6b7280',
}
