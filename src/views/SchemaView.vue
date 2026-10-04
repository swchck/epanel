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

const COL = 190
const ROW = 54
const NODE_W = 128
const NODE_H = 40
const PAD = 24

interface Node {
  d: Device | null
  x: number
  y: number
  depth: number
  children: Node[]
  leaf: boolean
}

const SKIP = new Set(['bus', 'terminal'])

const tree = computed(() => {
  const g = data.graph
  if (!g) return { nodes: [] as Node[], edges: [] as [Node, Node][], width: 0, height: 0 }
  let leafIndex = 0
  const nodes: Node[] = []
  const edges: [Node, Node][] = []
  function build(d: Device | null, depth: number): Node {
    const kids = d ? (g!.children.get(d.id) ?? []).filter((c) => !SKIP.has(c.type)) : g!.roots.filter((r) => !SKIP.has(r.type))
    const node: Node = { d, x: PAD + depth * COL, y: 0, depth, children: [], leaf: kids.length === 0 }
    nodes.push(node)
    if (kids.length === 0) {
      node.y = PAD + leafIndex * ROW
      leafIndex += 1
    } else {
      node.children = kids.map((k) => build(k, depth + 1))
      node.y = (node.children[0]!.y + node.children.at(-1)!.y) / 2
      node.children.forEach((c) => edges.push([node, c]))
    }
    return node
  }
  build(null, 0)
  const maxDepth = Math.max(...nodes.map((n) => n.depth))
  return { nodes, edges, width: PAD * 2 + maxDepth * COL + NODE_W + 280, height: PAD * 2 + Math.max(1, leafIndex) * ROW - (ROW - NODE_H) }
})

function energized(d: Device | null) {
  return !d || (data.graph?.isPowered(d.id, ui.off) ?? true)
}

function edgePath(a: Node, b: Node) {
  const x1 = a.x + NODE_W
  const y1 = a.y + NODE_H / 2
  const x2 = b.x
  const y2 = b.y + NODE_H / 2
  const mx = x1 + (x2 - x1) / 2
  return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`
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
  <div class="mx-auto max-w-[1500px] px-4 pt-5 lg:px-8 lg:pt-8">
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="mr-auto">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('schema.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('schema.subtitle') }}</p>
      </div>
      <label class="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs" :class="{ 'border-live bg-live/15': ui.simulate }">
        <Power class="size-3.5" :class="ui.simulate ? 'text-live' : ''" />
        {{ t('panel.simulate') }}
        <Switch v-model="ui.simulate" class="scale-90" />
      </label>
      <Button v-if="ui.off.size" size="sm" variant="ghost" class="rounded-full" @click="ui.resetSimulation()"><RotateCcw /> {{ t('panel.simReset') }}</Button>
    </div>

    <div class="overflow-x-auto rounded-2xl border bg-card">
      <svg :width="tree.width" :height="tree.height" :viewBox="`0 0 ${tree.width} ${tree.height}`" class="block">
        <defs>
          <pattern id="schema-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--border)" />
          </pattern>
        </defs>
        <rect :width="tree.width" :height="tree.height" fill="url(#schema-grid)" />
        <g fill="none">
          <template v-for="([a, b], i) in tree.edges" :key="i">
            <path :d="edgePath(a, b)" :stroke="energized(b.d) ? 'var(--live)' : 'var(--muted-foreground)'" :stroke-opacity="energized(b.d) ? 0.35 : 0.25" stroke-width="5" />
            <path v-if="energized(b.d)" :d="edgePath(a, b)" stroke="var(--live)" stroke-width="2" class="flow-line" />
            <path v-else :d="edgePath(a, b)" stroke="var(--muted-foreground)" stroke-width="1.5" stroke-dasharray="2 4" />
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
            <text x="14" y="31" class="nrating">{{ rating(n.d) || t(`device.typeShort.${n.d.type}`) }}</text>
            <circle :cx="NODE_W - 12" cy="12" r="4" :fill="energized(n.d) ? 'var(--live)' : 'var(--muted-foreground)'" :opacity="energized(n.d) ? 1 : 0.4" />
            <text v-if="n.leaf" :x="NODE_W + 12" y="17" class="leaf-label" :class="{ dead: !energized(n.d) }">{{ tx(n.d.label) }}</text>
            <text v-if="n.leaf" :x="NODE_W + 12" y="32" class="leaf-sub">{{ loadKw(n.d) }}</text>
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
  font-size: 13px;
  fill: var(--foreground);
}
.leaf-label.dead {
  fill: var(--muted-foreground);
  text-decoration: line-through;
}
.leaf-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--muted-foreground);
}
</style>
