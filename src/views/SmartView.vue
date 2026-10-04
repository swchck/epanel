<script setup lang="ts">
import { computed } from 'vue'
import { Network, TabletSmartphone } from '@lucide/vue'
import DeviceChip from '@/components/common/DeviceChip.vue'
import { POINT_ICONS } from '@/components/common/kinds'
import { SMART_TYPES, type Channel, type Device, type PlanPoint } from '@/domain/schema'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()

const devices = computed(() => (data.data?.devices ?? []).filter((d) => d.smart || SMART_TYPES.includes(d.type)))
const panels = computed(() => (data.data?.points ?? []).filter((p) => p.kind === 'panel' || p.kind === 'sensor'))

function addrKey(a?: string) {
  return (a ?? '99.99.999').split('.').map((n) => n.padStart(3, '0')).join('.')
}
const topology = computed(() => [...devices.value].sort((a, b) => addrKey(a.smart?.address).localeCompare(addrKey(b.smart?.address))))

interface GroupRow {
  group: string
  channels: { device: Device; channel: Channel }[]
  panels: PlanPoint[]
}
const groups = computed<GroupRow[]>(() => {
  const m = new Map<string, GroupRow>()
  const row = (g: string) => m.get(g) ?? (m.set(g, { group: g, channels: [], panels: [] }), m.get(g)!)
  for (const d of devices.value) for (const ch of d.smart?.channels ?? []) if (ch.group) row(ch.group).channels.push({ device: d, channel: ch })
  for (const p of panels.value) for (const g of p.controls) row(g).panels.push(p)
  const key = (g: string) => g.split('/').map((n) => n.padStart(4, '0')).join('/')
  return [...m.values()].sort((a, b) => key(a.group).localeCompare(key(b.group)))
})

const pointById = computed(() => new Map((data.data?.points ?? []).map((p) => [p.id, p])))
const roomName = (id?: string) => tx(data.data?.rooms.find((r) => r.id === id)?.name)
const pointName = (p: PlanPoint) => tx(p.label, t(`point.kind.${p.kind}`))
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="flex items-center gap-2.5 text-2xl font-semibold tracking-tight lg:text-3xl"><Network class="size-7 text-green-600" /> {{ t('smart.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('smart.subtitle') }}</p>

    <div v-if="!devices.length && !panels.length" class="mt-8 rounded-2xl border border-dashed p-8 text-center">
      <p class="mx-auto max-w-lg text-sm text-muted-foreground">{{ t('smart.empty') }}</p>
      <a href="#/?demo=smart" class="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" @click.prevent="data.init({ demo: 'smart' })">{{ t('smart.openDemo') }}</a>
    </div>

    <template v-else>
      <p class="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">{{ t('smart.safety') }}</p>

      <section class="mt-6">
        <h2 class="mb-3 font-semibold">{{ t('smart.topology') }}</h2>
        <div class="overflow-x-auto rounded-2xl border bg-card">
          <table class="w-full text-sm">
            <thead class="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.address') }}</th>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.device') }}</th>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.channels') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="d in topology" :key="d.id" class="align-top">
                <td class="px-4 py-3 font-mono text-xs">
                  <span class="rounded bg-green-600/12 px-1.5 py-0.5 text-green-700 dark:text-green-400">{{ (d.smart?.system ?? 'knx').toUpperCase() }}</span>
                  {{ d.smart?.address ?? '—' }}
                </td>
                <td class="px-4 py-3">
                  <RouterLink :to="`/d/${d.id}`" class="flex items-center gap-2"><DeviceChip :device="d" size="sm" /> {{ tx(d.label) || t(`device.type.${d.type}`) }}</RouterLink>
                </td>
                <td class="px-4 py-3">
                  <div v-for="ch in d.smart?.channels ?? []" :key="ch.id" class="flex flex-wrap items-baseline gap-x-2 py-0.5 text-xs">
                    <span class="font-mono font-semibold">{{ ch.id }}</span>
                    <span class="text-muted-foreground">{{ t(`smart.fn.${ch.function}`) }}</span>
                    <span v-if="ch.group" class="font-mono text-green-700 dark:text-green-400">{{ ch.group }}</span>
                    <span v-for="pid in ch.points" :key="pid">{{ pointById.get(pid) ? pointName(pointById.get(pid)!) : pid }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="groups.length" class="mt-8">
        <h2 class="mb-3 font-semibold">{{ t('smart.groups') }}</h2>
        <div class="overflow-x-auto rounded-2xl border bg-card">
          <table class="w-full text-sm">
            <thead class="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.group') }}</th>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.output') }}</th>
                <th class="px-4 py-2.5 font-medium">{{ t('smart.controlledFrom') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="g in groups" :key="g.group" class="align-top">
                <td class="px-4 py-3 font-mono text-xs font-semibold">{{ g.group }}</td>
                <td class="px-4 py-3">
                  <div v-for="c in g.channels" :key="c.device.id + c.channel.id" class="py-0.5">
                    <span class="font-mono text-xs">{{ c.device.id }}.{{ c.channel.id }}</span>
                    <span class="text-muted-foreground"> → </span>
                    {{ c.channel.points.map((pid) => (pointById.get(pid) ? pointName(pointById.get(pid)!) : pid)).join(', ') || t(`smart.fn.${c.channel.function}`) }}
                  </div>
                  <span v-if="!g.channels.length" class="text-xs text-warn">{{ t('smart.noOutput') }}</span>
                </td>
                <td class="px-4 py-3">
                  <RouterLink v-for="p in g.panels" :key="p.id" :to="{ path: '/plan', query: { point: p.id } }" class="flex items-center gap-1.5 py-0.5 hover:underline">
                    <component :is="POINT_ICONS[p.kind]" class="size-3.5 text-muted-foreground" />{{ pointName(p) }}
                    <span class="text-xs text-muted-foreground">· {{ roomName(p.room) }}</span>
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="panels.length" class="mt-8 mb-6">
        <h2 class="mb-3 flex items-center gap-2 font-semibold"><TabletSmartphone class="size-4.5" /> {{ t('smart.panels') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink v-for="p in panels" :key="p.id" :to="{ path: '/plan', query: { point: p.id } }" class="rounded-2xl border bg-card p-4 transition hover:border-green-600/50">
            <div class="flex items-center gap-2 font-medium"><component :is="POINT_ICONS[p.kind]" class="size-4.5 text-green-600" /> {{ pointName(p) }}</div>
            <div class="text-xs text-muted-foreground">{{ roomName(p.room) }}</div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="g in p.controls" :key="g" class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{{ g }}</span>
            </div>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
