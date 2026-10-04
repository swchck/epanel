<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMagicKeys, whenever } from '@vueuse/core'
import { Ellipsis, FlaskConical, House, LogOut, PanelLeftClose, PanelLeftOpen, PencilLine, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useText } from '@/composables/useText'
import { confirmAction, isDesktop } from '@/platform'
import { NAV, type NavName } from '@/router'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'
import BrandMark from './BrandMark.vue'
import OfflineBadge from './OfflineBadge.vue'
import SearchDialog from './SearchDialog.vue'
import { NAV_ICONS } from './navIcons'

const data = useData()
const ui = useUi()
const route = useRoute()
const router = useRouter()

// on the web a published panel is the home page itself; everywhere else there is a start screen to go back to
const canLeave = computed(() => isDesktop || data.source !== 'published')

async function leave() {
  // only the published panel's draft is autosaved; a file or a new project lives in memory until saved
  const unsaved = (data.source === 'new' && !data.file) || (data.hasDraft && (data.source === 'file' || data.source === 'new'))
  if (unsaved && !(await confirmAction(t('nav.leaveUnsaved')))) return
  moreOpen.value = false
  // `?demo` would put the visitor straight back into the demo on the next load, so it goes first
  await router.replace({ path: '/', query: {} })
  ui.resetSimulation()
  ui.clearFilters()
  ui.select(null)
  await data.init()
}
const { t, tx } = useText()
const moreOpen = ref(false)
const collapsed = computed(() => ui.sidebarCollapsed)
// on <html> so the window drag strip in App.vue lines up with the sidebar too;
// the rail keeps the macOS traffic lights centred: 16px inset + ~54px of buttons + the same gap on the right
watchEffect(() => document.documentElement.style.setProperty('--sidebar-w', collapsed.value ? '5.5rem' : '15.5rem'))

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

// full-height views (the plan) take exactly what is left under the banners instead of the whole viewport
// selecting a device swaps / for /d/:id; both are the same page, so it must not remount and fade
const pageKey = computed(() => (route.name === 'panel' || route.name === 'device' ? 'panel' : route.name === 'edit' ? 'edit' : route.path))
const fill = computed(() => route.meta.fill === true)
// on wide screens the page scrolls inside <main>, not the window, so the router's own scroll reset misses it
const scroller = ref<HTMLElement | null>(null)
watch(pageKey, () => scroller.value?.scrollTo({ top: 0 }))
const overlayTitlebar = document.documentElement.dataset.titlebar === 'overlay'
const draftBanner = computed(() => data.hasDraft && current.value !== 'edit')
const banner = computed(() => data.source === 'demo' || draftBanner.value)

const overdue = computed(() => data.overdue)

const badge = computed<Partial<Record<NavName, { n: number; tone: string }>>>(() => {
  const errors = data.checks.filter((c) => c.level === 'error').length
  const warns = data.checks.filter((c) => c.level === 'warn').length
  return {
    checks: errors ? { n: errors, tone: 'bg-danger text-white' } : warns ? { n: warns, tone: 'bg-warn text-black' } : undefined,
    maintenance: overdue.value ? { n: overdue.value, tone: 'bg-danger text-white' } : undefined,
  }
})

const { Meta_K, Ctrl_K, Slash, Meta_Backslash, Ctrl_Backslash } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && e.type === 'keydown') e.preventDefault()
  },
})
whenever(() => Meta_K?.value || Ctrl_K?.value, () => (ui.searchOpen = true))
whenever(
  () => Meta_Backslash?.value || Ctrl_Backslash?.value,
  () => (ui.sidebarCollapsed = !ui.sidebarCollapsed),
)
whenever(
  () => Slash?.value,
  () => {
    const tag = (document.activeElement?.tagName ?? '').toLowerCase()
    if (tag !== 'input' && tag !== 'textarea') ui.searchOpen = true
  },
)
</script>

<template>
  <div class="min-h-dvh bg-background lg:grid lg:h-dvh lg:grid-cols-[var(--sidebar-w)_1fr] lg:overflow-hidden print:block print:h-auto print:overflow-visible">
    <aside class="no-print sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div class="flex items-center pt-[calc(var(--titlebar)+1rem)] pb-3" :class="collapsed ? 'justify-center px-2' : 'px-5'">
        <RouterLink to="/" class="flex min-w-0 flex-1 items-center gap-3" :class="{ 'justify-center': collapsed }">
          <BrandMark class="size-9 shrink-0" />
          <div v-if="!collapsed" class="min-w-0">
            <div class="truncate text-sm font-semibold leading-tight">{{ tx(data.data?.meta.title) || t('app.name') }}</div>
            <div class="truncate text-xs text-muted-foreground">{{ t('app.tagline') }}</div>
          </div>
        </RouterLink>
      </div>
      <Tooltip :disabled="!collapsed">
        <TooltipTrigger as-child>
          <button
            class="mb-2 flex items-center gap-2 rounded-lg border bg-background text-left text-sm text-muted-foreground transition hover:border-primary/50"
            :class="collapsed ? 'mx-auto size-9 justify-center' : 'mx-4 px-3 py-1.5'"
            :aria-label="t('search.open')"
            @click="ui.searchOpen = true"
          >
            <Search class="size-4" />
            <template v-if="!collapsed">
              <span class="flex-1">{{ t('search.placeholderShort') }}</span>
              <Kbd>⌘K</Kbd>
            </template>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{{ t('search.placeholderShort') }}</TooltipContent>
      </Tooltip>
      <!-- scrolls only on a very short window; the bar itself would just be noise next to the icons -->
      <nav class="flex-1 [scrollbar-width:none] overflow-y-auto pb-2 [&::-webkit-scrollbar]:hidden" :class="collapsed ? 'px-2' : 'px-3'">
        <div v-for="(g, gi) in GROUPS" :key="g.key" :class="collapsed ? 'mb-1.5' : 'mb-2.5'">
          <div v-if="!collapsed" class="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{{ t(`nav.group.${g.key}`) }}</div>
          <div v-else-if="gi > 0" class="mx-auto mb-1.5 w-8 border-t border-sidebar-border" />
          <Tooltip v-for="n in g.items.filter(visible)" :key="n" :disabled="!collapsed">
            <TooltipTrigger as-child>
              <RouterLink
                :to="pathOf(n)"
                class="group relative flex items-center gap-3 rounded-lg text-sm transition"
                :class="[
                  collapsed ? 'mx-auto size-9 justify-center' : 'px-2.5 py-1.5',
                  current === n ? 'bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                ]"
                :aria-label="collapsed ? t(`nav.${n}`) : undefined"
              >
                <component :is="NAV_ICONS[n]" class="size-4.5 shrink-0" :class="current === n ? 'text-primary' : n === 'emergency' ? 'text-danger' : ''" />
                <template v-if="!collapsed">
                  <span class="flex-1">{{ t(`nav.${n}`) }}</span>
                  <span v-if="badge[n]" class="rounded-full px-1.5 text-[11px] font-semibold tabular" :class="badge[n]!.tone">{{ badge[n]!.n }}</span>
                </template>
                <span v-else-if="badge[n]" class="absolute top-1.5 right-1.5 size-2 rounded-full" :class="badge[n]!.tone" />
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right">{{ t(`nav.${n}`) }}<template v-if="badge[n]"> · {{ badge[n]!.n }}</template></TooltipContent>
          </Tooltip>
        </div>
      </nav>
      <div class="flex gap-1 border-t border-sidebar-border px-3 py-2.5" :class="collapsed ? 'flex-col items-center px-2' : 'items-center'">
        <OfflineBadge />
        <Tooltip v-if="canLeave" :disabled="!collapsed">
          <TooltipTrigger as-child>
            <button
              class="flex min-w-0 items-center gap-2 rounded-lg py-1.5 text-sm text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground"
              :class="collapsed ? 'size-9 justify-center' : 'flex-1 px-2'"
              :aria-label="t('nav.leave')"
              @click="leave"
            >
              <House class="size-4 shrink-0" />
              <span v-if="!collapsed" class="truncate">{{ t('nav.leave') }}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ t('nav.leave') }}</TooltipContent>
        </Tooltip>
        <div v-else-if="!collapsed" class="flex-1" />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="size-9 shrink-0 text-muted-foreground" :aria-label="t(collapsed ? 'nav.expand' : 'nav.collapse')" @click="ui.sidebarCollapsed = !collapsed">
              <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ t(collapsed ? 'nav.expand' : 'nav.collapse') }} <Kbd>⌘\</Kbd></TooltipContent>
        </Tooltip>
      </div>
    </aside>

    <div class="relative flex min-w-0 flex-col overflow-x-clip lg:h-dvh lg:overflow-hidden print:block print:h-auto print:overflow-visible">
      <!-- the window has no title bar: the banners are the drag handle when shown, otherwise this strip over the page's top padding -->
      <div v-if="overlayTitlebar && !banner" data-tauri-drag-region class="no-print absolute inset-x-0 top-0 z-20 h-(--titlebar)" />
      <header class="no-print sticky top-0 z-30 flex items-center gap-2 border-b bg-background/85 px-4 pt-[calc(var(--titlebar)+0.625rem)] pb-2.5 backdrop-blur-md lg:hidden">
        <RouterLink to="/" class="flex min-w-0 flex-1 items-center gap-2.5">
          <BrandMark class="size-8 shrink-0" />
          <span class="truncate text-sm font-semibold">{{ t(`nav.${current}`) }}</span>
        </RouterLink>
        <Button variant="ghost" size="icon" :aria-label="t('search.open')" @click="ui.searchOpen = true">
          <Search class="size-5" />
        </Button>
      </header>

      <div v-if="data.source === 'demo'" data-tauri-drag-region class="no-print flex items-center gap-2 border-b bg-info/10 px-4 py-2 text-sm text-info lg:px-8">
        <FlaskConical class="pointer-events-none size-4 shrink-0" />
        <span class="pointer-events-none flex-1">{{ t('banner.demo') }}</span>
        <Button variant="ghost" size="sm" class="h-7 shrink-0 text-info hover:text-info" @click="leave"><LogOut /> {{ t('banner.leaveDemo') }}</Button>
      </div>
      <div v-if="draftBanner" data-tauri-drag-region class="no-print flex items-center gap-2 border-b bg-warn/15 px-4 py-2 text-sm lg:px-8">
        <PencilLine class="pointer-events-none size-4 shrink-0 text-warn" />
        <span class="pointer-events-none flex-1">{{ t('banner.draft') }}</span>
        <RouterLink to="/edit/publish" class="font-medium underline-offset-2 hover:underline">{{ t('banner.draftAction') }}</RouterLink>
      </div>

      <main ref="scroller" class="flex-1 pb-24 lg:min-h-0 lg:overflow-y-auto lg:overscroll-none print:block print:overflow-visible print:p-0" :class="fill ? 'lg:pb-0' : 'lg:pb-10'">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="pageKey" />
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
          <button v-if="canLeave" class="flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-4 text-center text-xs" @click="leave">
            <House class="size-6 text-primary" />
            {{ t('nav.leave') }}
          </button>
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
