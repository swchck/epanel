<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMagicKeys, whenever } from '@vueuse/core'
import { Ellipsis, FlaskConical, PencilLine, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useText } from '@/composables/useText'
import { NAV, type NavName } from '@/router'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'
import BrandMark from './BrandMark.vue'
import LangSwitch from './LangSwitch.vue'
import OfflineBadge from './OfflineBadge.vue'
import SearchDialog from './SearchDialog.vue'
import ThemeToggle from './ThemeToggle.vue'
import { NAV_ICONS } from './navIcons'

const data = useData()
const ui = useUi()
const route = useRoute()
const { t, tx } = useText()
const moreOpen = ref(false)

const GROUPS: { key: string; items: NavName[] }[] = [
  { key: 'main', items: ['panel', 'plan', 'find', 'emergency'] },
  { key: 'engineering', items: ['schema', 'checks', 'smart', 'network'] },
  { key: 'service', items: ['maintenance', 'photos', 'labels'] },
  { key: 'manage', items: ['edit', 'settings'] },
]
const MOBILE: NavName[] = ['panel', 'plan', 'find', 'emergency']
const pathOf = (n: NavName) => NAV.find((x) => x.name === n)!.path
const hasSmart = computed(() => !!data.data && (data.data.devices.some((d) => d.smart) || data.data.points.some((p) => p.kind === 'panel')))
const hasNetwork = computed(() => !!data.data?.routes.some((r) => r.kind === 'low' || r.kind === 'conduit'))
const visible = (n: NavName) => (n === 'smart' ? hasSmart.value : n === 'network' ? hasNetwork.value : true)

const current = computed<NavName>(() => {
  const n = route.name as string
  if (n === 'device') return 'panel'
  return (NAV.find((x) => x.name === n)?.name ?? 'panel') as NavName
})

const overdue = computed(() => data.overdue)

const badge = computed<Partial<Record<NavName, { n: number; tone: string }>>>(() => {
  const errors = data.checks.filter((c) => c.level === 'error').length
  const warns = data.checks.filter((c) => c.level === 'warn').length
  return {
    checks: errors ? { n: errors, tone: 'bg-danger text-white' } : warns ? { n: warns, tone: 'bg-warn text-black' } : undefined,
    maintenance: overdue.value ? { n: overdue.value, tone: 'bg-danger text-white' } : undefined,
  }
})

const { Meta_K, Ctrl_K, Slash } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && e.type === 'keydown') e.preventDefault()
  },
})
whenever(() => Meta_K?.value || Ctrl_K?.value, () => (ui.searchOpen = true))
whenever(
  () => Slash?.value,
  () => {
    const tag = (document.activeElement?.tagName ?? '').toLowerCase()
    if (tag !== 'input' && tag !== 'textarea') ui.searchOpen = true
  },
)
</script>

<template>
  <div class="min-h-dvh bg-background lg:grid lg:grid-cols-[15.5rem_1fr]">
    <aside class="no-print sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <RouterLink to="/" class="flex items-center gap-3 px-5 pt-5 pb-4">
        <BrandMark class="size-9 shrink-0" />
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold leading-tight">{{ tx(data.data?.meta.title) || t('app.name') }}</div>
          <div class="truncate text-xs text-muted-foreground">{{ t('app.tagline') }}</div>
        </div>
      </RouterLink>
      <button
        class="mx-4 mb-3 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition hover:border-primary/50"
        @click="ui.searchOpen = true"
      >
        <Search class="size-4" />
        <span class="flex-1">{{ t('search.placeholderShort') }}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <nav class="flex-1 overflow-y-auto px-3 pb-4">
        <div v-for="g in GROUPS" :key="g.key" class="mb-4">
          <div class="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{{ t(`nav.group.${g.key}`) }}</div>
          <RouterLink
            v-for="n in g.items.filter(visible)"
            :key="n"
            :to="pathOf(n)"
            class="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition"
            :class="current === n ? 'bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'"
          >
            <component :is="NAV_ICONS[n]" class="size-4.5 shrink-0" :class="current === n ? 'text-primary' : n === 'emergency' ? 'text-danger' : ''" />
            <span class="flex-1">{{ t(`nav.${n}`) }}</span>
            <span v-if="badge[n]" class="rounded-full px-1.5 text-[11px] font-semibold tabular" :class="badge[n]!.tone">{{ badge[n]!.n }}</span>
          </RouterLink>
        </div>
      </nav>
      <div class="flex items-center gap-1 border-t border-sidebar-border px-3 py-3">
        <OfflineBadge />
        <div class="flex-1" />
        <LangSwitch />
        <ThemeToggle />
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      <header class="no-print sticky top-0 z-30 flex items-center gap-2 border-b bg-background/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <RouterLink to="/" class="flex min-w-0 flex-1 items-center gap-2.5">
          <BrandMark class="size-8 shrink-0" />
          <span class="truncate text-sm font-semibold">{{ t(`nav.${current}`) }}</span>
        </RouterLink>
        <Button variant="ghost" size="icon" :aria-label="t('search.open')" @click="ui.searchOpen = true">
          <Search class="size-5" />
        </Button>
        <LangSwitch />
        <ThemeToggle />
      </header>

      <div v-if="data.source === 'demo'" class="no-print flex items-center gap-2 border-b bg-info/10 px-4 py-2 text-sm text-info lg:px-8">
        <FlaskConical class="size-4 shrink-0" />
        <span>{{ t('banner.demo') }}</span>
      </div>
      <RouterLink
        v-if="data.hasDraft && current !== 'edit'"
        to="/edit/publish"
        class="no-print flex items-center gap-2 border-b bg-warn/15 px-4 py-2 text-sm lg:px-8"
      >
        <PencilLine class="size-4 shrink-0 text-warn" />
        <span class="flex-1">{{ t('banner.draft') }}</span>
        <span class="font-medium underline-offset-2 hover:underline">{{ t('banner.draftAction') }}</span>
      </RouterLink>

      <main class="flex-1 pb-24 lg:pb-10">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.name === 'device' ? 'panel' : route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav class="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/92 backdrop-blur-md lg:hidden">
      <div class="grid grid-cols-5">
        <RouterLink
          v-for="n in MOBILE"
          :key="n"
          :to="pathOf(n)"
          class="flex flex-col items-center gap-1 py-2.5 text-[11px] transition"
          :class="current === n ? 'text-foreground' : 'text-muted-foreground'"
        >
          <component :is="NAV_ICONS[n]" class="size-5.5" :class="current === n ? 'text-primary' : n === 'emergency' ? 'text-danger' : ''" />
          <span class="truncate">{{ t(`nav.short.${n}`) }}</span>
        </RouterLink>
        <button class="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" @click="moreOpen = true">
          <Ellipsis class="size-5.5" />
          <span>{{ t('nav.more') }}</span>
        </button>
      </div>
    </nav>

    <Sheet v-model:open="moreOpen">
      <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{{ t('nav.more') }}</SheetTitle>
        </SheetHeader>
        <div class="grid grid-cols-3 gap-2 px-4 pb-2">
          <RouterLink
            v-for="n in NAV.map((x) => x.name).filter((x) => !MOBILE.includes(x) && visible(x))"
            :key="n"
            :to="pathOf(n)"
            class="relative flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-4 text-center text-xs"
            @click="moreOpen = false"
          >
            <component :is="NAV_ICONS[n]" class="size-6 text-primary" />
            {{ t(`nav.${n}`) }}
            <span v-if="badge[n]" class="absolute top-2 right-2 rounded-full px-1.5 text-[10px] font-semibold" :class="badge[n]!.tone">{{ badge[n]!.n }}</span>
          </RouterLink>
        </div>
      </SheetContent>
    </Sheet>

    <SearchDialog />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
</style>
