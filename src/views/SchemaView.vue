<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Power, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TYPE_ACCENT } from '@/components/panel/geometry'
import { deviceLoad } from '@/domain/load'
import type { Device } from '@/domain/model'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

const data = useData()
const ui = useUi()
const router = useRouter()
const { t, tx } = useText()

const NODE_W = 150
const NODE_H = 56
const PAD = 24
const CHAIN_GAP = 40
const COL_GAP = 16
const ROW_GAP = 10
const INDENT = 14
const BUS_DROP = 28

interface Node {
  d: Device | null
  x: number
  y: number
  leaf: boolean
}

interface Edge {
  path: string
  to: Device | null
}

const SKIP = new Set(['bus', 'terminal'])

// the usual single-line layout: the supply chain runs along the top, a bus under the last device
// of that chain, and every outgoing group hangs off the bus as its own column
const tree = computed(() => {
  const g = data.graph
  if (!g) return { nodes: [] as Node[], edges: [] as Edge[], width: 0, height: 0 }
  const kids = (d: Device | null) => (d ? (g.children.get(d.id) ?? []) : g.roots).filter((c) => !SKIP.has(c.type))
  const nodes: Node[] = []
  const edges: Edge[] = []

  // the chain goes on through a device that feeds one branch plus a stray leaf or two (an SPD
  // off the main breaker); those leaves hang under it as taps instead of becoming bus columns
  const chain: Node[] = []
  const taps: [Node, Device][] = []
  let cur: Device | null = null
  for (;;) {
    const node: Node = { d: cur, x: PAD + chain.length * (NODE_W + CHAIN_GAP), y: PAD, leaf: kids(cur).length === 0 }
    chain.push(node)
    const next = kids(cur)
    const branches = next.filter((k) => kids(k).length > 0)
    const through = next.length === 1 ? next[0] : branches.length === 1 && next.length <= 3 ? branches[0] : undefined
    if (!through) break
    next.filter((k) => k !== through).forEach((k) => taps.push([node, k]))
    cur = through
  }
  chain.forEach((n, i) => {
    nodes.push(n)
    if (i > 0) edges.push({ path: `M ${chain[i - 1]!.x + NODE_W} ${PAD + NODE_H / 2} H ${n.x}`, to: n.d })
  })
  let tapsBottom = PAD + NODE_H
  const tapRows = new Map<Node, number>()
  for (const [parent, d] of taps) {
    const row = tapRows.get(parent) ?? 0
    tapRows.set(parent, row + 1)
    const node: Node = { d, x: parent.x + INDENT, y: PAD + NODE_H + ROW_GAP * 2 + row * (NODE_H + ROW_GAP), leaf: true }
    nodes.push(node)
    edges.push({ path: `M ${parent.x + 10} ${parent.y + NODE_H} V ${node.y + NODE_H / 2} H ${node.x}`, to: d })
    tapsBottom = Math.max(tapsBottom, node.y + NODE_H)
  }

  const hub = chain.at(-1)!
  const busY = tapsBottom + BUS_DROP
  let colX = PAD
  let bottom = PAD + NODE_H
  for (const root of kids(hub.d)) {
    let row = 0
    let maxDepth = 0
    const place = (d: Device, depth: number, parent: Node | null): void => {
      const node: Node = { d, x: colX + depth * INDENT, y: busY + BUS_DROP + row * (NODE_H + ROW_GAP), leaf: kids(d).length === 0 }
      row += 1
      maxDepth = Math.max(maxDepth, depth)
      nodes.push(node)
      if (parent) edges.push({ path: `M ${parent.x + 10} ${parent.y + NODE_H} V ${node.y + NODE_H / 2} H ${node.x}`, to: d })
      else edges.push({ path: `M ${hub.x + NODE_W / 2} ${hub.y + NODE_H} V ${busY} H ${node.x + NODE_W / 2} V ${node.y}`, to: d })
      bottom = Math.max(bottom, node.y + NODE_H)
      kids(d).forEach((k) => place(k, depth + 1, node))
    }
    place(root, 0, null)
    colX += NODE_W + maxDepth * INDENT + COL_GAP
  }

  // a dead branch shares the bus with live ones, so it goes underneath them
  edges.sort((a, b) => Number(energized(a.to)) - Number(energized(b.to)))
  const width = Math.max(colX - COL_GAP, hub.x + NODE_W) + PAD
  return { nodes, edges, width, height: bottom + PAD }
})

function energized(d: Device | null) {
  return !d || (data.graph?.isPowered(d.id, ui.off) ?? true)
}

function clip(text: string, max = 22) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function rating(d: Device) {
  const parts = [d.rating ? `${d.curve ?? ''}${d.rating}A` : '', d.leakage ? `${d.leakage}mA` : ''].filter(Boolean)
  return parts.join(' · ')
}

function loadKw(d: Device) {
  if (!data.graph || !data.data) return ''
  const l = deviceLoad(data.graph, d, data.data.supply.voltage)
  return l.nameplateW ? `${(l.demandW / 1000).toFixed(1)} kW` : ''
}

function activate(d: Device | null) {
  if (!d) return
  if (ui.simulate) ui.toggleOff(d.id)
  else router.push(`/d/${d.id}`)
}
</script>

<template>
  <div class="mx-auto flex max-w-[1500px] flex-col px-4 pt-5 pb-6 lg:h-full lg:px-8 lg:pt-8">
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="mr-auto">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('schema.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('schema.subtitle') }}</p>
      </div>
      <label class="flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-sm" :class="{ 'border-live/60 bg-live/10': ui.simulate }">
        <Power class="size-4" :class="ui.simulate ? 'text-live' : 'text-muted-foreground'" />
        {{ t('panel.simulate') }}
        <Switch v-model="ui.simulate" />
      </label>
      <Button v-if="ui.off.size" size="sm" variant="ghost" @click="ui.resetSimulation()"><RotateCcw /> {{ t('panel.simReset') }}</Button>
    </div>

    <div class="min-h-0 overflow-hidden rounded-2xl border bg-card lg:flex-1">
      <svg :viewBox="`0 0 ${tree.width} ${tree.height}`" preserveAspectRatio="xMidYMid meet" class="block h-auto w-full lg:h-full">
        <defs>
          <pattern id="schema-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--border)" />
          </pattern>
        </defs>
        <rect :width="tree.width" :height="tree.height" fill="url(#schema-grid)" />
        <g fill="none">
          <template v-for="(e, i) in tree.edges" :key="i">
            <path :d="e.path" :stroke="energized(e.to) ? 'var(--live)' : 'var(--muted-foreground)'" :stroke-opacity="energized(e.to) ? 0.35 : 0.25" stroke-width="5" />
            <path v-if="energized(e.to)" :d="e.path" stroke="var(--live)" stroke-width="2" class="flow-line" />
            <path v-else :d="e.path" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="2 4" />
          </template>
        </g>
        <g v-for="n in tree.nodes" :key="n.d?.id ?? 'grid'" :transform="`translate(${n.x}, ${n.y})`" class="node" :class="{ 'cursor-pointer': n.d }" @click="activate(n.d)">
          <template v-if="!n.d">
            <rect :width="NODE_W" :height="NODE_H" rx="10" fill="var(--foreground)" />
            <text :x="NODE_W / 2" :y="NODE_H / 2 + 4.5" text-anchor="middle" class="grid-label">⚡ {{ t('schema.grid', { v: data.data?.supply.voltage ?? 230 }) }}</text>
          </template>
          <template v-else>
            <rect :width="NODE_W" :height="NODE_H" rx="9" fill="var(--background)" :stroke="ui.off.has(n.d.id) ? 'var(--danger)' : 'var(--border)'" :stroke-width="ui.off.has(n.d.id) ? 2 : 1" />
            <rect width="5" :height="NODE_H" rx="2.5" :fill="TYPE_ACCENT[n.d.type]" />
            <text x="14" y="17" class="nid">{{ n.d.id }}</text>
            <circle :cx="NODE_W - 12" cy="12" r="4" :fill="energized(n.d) ? 'var(--live)' : 'var(--muted-foreground)'" :opacity="energized(n.d) ? 1 : 0.4" />
            <text x="14" y="31" class="nrating">{{ [rating(n.d) || t(`device.typeShort.${n.d.type}`), n.leaf ? loadKw(n.d) : ''].filter(Boolean).join(' · ') }}</text>
            <text x="14" y="47" class="leaf-label" :class="{ dead: !energized(n.d) }">
              <title>{{ tx(n.d.label) }}</title>
              {{ clip(tx(n.d.label)) }}
            </text>
          </template>
        </g>
      </svg>
    </div>
    <p class="mt-3 text-xs text-muted-foreground">{{ t('schema.hint') }}</p>
  </div>
</template>

<style scoped>
.node rect {
  transition: stroke 0.2s;
}
.node:hover rect:first-child {
  stroke: var(--primary);
}
.grid-label {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  fill: var(--background);
}
.nid {
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 600;
  fill: var(--foreground);
}
.nrating {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--muted-foreground);
}
.leaf-label {
  font-family: var(--font-sans);
  font-size: 11.5px;
  fill: var(--foreground);
}
.leaf-label.dead {
  fill: var(--muted-foreground);
  text-decoration: line-through;
}
</style>
