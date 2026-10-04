<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Download,
  FileLock2,
  Map as MapIcon,
  Network,
  PanelsTopLeft,
  PencilRuler,
  Power,
  QrCode as QrIcon,
  RotateCcw,
  ScanSearch,
  Siren,
  Tags,
  WifiOff,
  Waypoints,
} from '@lucide/vue'
import BrandMark from '@/components/common/BrandMark.vue'
import LangSwitch from '@/components/common/LangSwitch.vue'
import QrCode from '@/components/common/QrCode.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import FloorPlan from '@/components/plan/FloorPlan.vue'
import PanelEnclosure from '@/components/panel/PanelEnclosure.vue'
import { pointPowered } from '@/domain/graph'
import { useText } from '@/composables/useText'
import { useTheme } from '@/composables/useTheme'
import { useData } from '@/stores/data'
import { useUi } from '@/stores/ui'

useTheme()
const data = useData()
const ui = useUi()
const { t, tx, tm, rt } = useText()
const repo = __REPO_URL__
const ready = computed(() => data.status === 'ready')

onMounted(async () => {
  await data.init({ demo: true, prefix: 'app/' })
  ui.simulate = true
  ui.planLayers.labels = false
  // start with something switched off so the demo explains itself without a click
  ui.toggleOff('QD1')
})

const dead = computed(() => {
  if (!data.graph || !data.data) return new Set<string>()
  return new Set(data.data.points.filter((p) => !pointPowered(data.graph!, p, ui.off)).map((p) => p.id))
})
const offLabels = computed(() => [...ui.off].map((id) => data.graph?.byId.get(id)).filter(Boolean))

const FEATURES = [
  { id: 'panel', icon: PanelsTopLeft },
  { id: 'find', icon: ScanSearch },
  { id: 'emergency', icon: Siren },
  { id: 'plan', icon: MapIcon },
  { id: 'checks', icon: ClipboardCheck },
  { id: 'schema', icon: Waypoints },
  { id: 'smart', icon: Network },
  { id: 'labels', icon: Tags },
  { id: 'offline', icon: WifiOff },
] as const

const STEPS = [
  { id: 'describe', icon: PencilRuler },
  { id: 'encrypt', icon: FileLock2 },
  { id: 'stick', icon: QrIcon },
] as const

const diy = computed(() => (tm('landing.diy.steps') as unknown[]).map((s) => rt(s as never)))
const demoUrl = computed(() => new URL('app/#/?demo', document.baseURI).toString())
const year = new Date().getFullYear()
const hint = ref(true)
</script>

<template>
  <div class="min-h-dvh overflow-x-hidden bg-background text-foreground">
    <!-- header -->
    <header class="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <a href="./" class="flex items-center gap-2.5 font-semibold"><BrandMark class="size-8" /> {{ t('app.name') }}</a>
        <nav class="ml-6 hidden gap-5 text-sm whitespace-nowrap text-muted-foreground lg:flex">
          <a href="#features" class="hover:text-foreground">{{ t('landing.nav.features') }}</a>
          <a href="#how" class="hover:text-foreground">{{ t('landing.nav.how') }}</a>
          <a href="#privacy" class="hover:text-foreground">{{ t('landing.nav.privacy') }}</a>
          <a href="#diy" class="hover:text-foreground">{{ t('landing.nav.diy') }}</a>
        </nav>
        <div class="flex-1" />
        <LangSwitch />
        <ThemeToggle />
        <a href="app/#/?demo" class="hidden rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground sm:inline-flex">{{ t('landing.cta.demo') }}</a>
      </div>
    </header>

    <!-- hero -->
    <section class="relative">
      <div class="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(var(--foreground)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div class="relative mx-auto max-w-6xl px-4 pt-14 pb-10 lg:pt-20">
        <div class="max-w-3xl">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium">
            <QrIcon class="size-3.5 text-primary" /> {{ t('landing.hero.badge') }}
          </span>
          <h1 class="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            {{ t('landing.hero.title') }}
          </h1>
          <p class="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{{ t('landing.hero.subtitle') }}</p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a href="app/#/?demo" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground shadow-sm transition hover:brightness-105">
              {{ t('landing.cta.demo') }} <ArrowRight class="size-4" />
            </a>
            <a href="app/#/?demo=smart" class="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 font-medium transition hover:border-foreground/30">
              <Network class="size-4 text-green-600" /> {{ t('landing.cta.smart') }}
            </a>
            <a v-if="repo" :href="`${repo}/releases/latest`" class="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 font-medium transition hover:border-foreground/30">
              <Download class="size-4" /> {{ t('landing.cta.download') }}
            </a>
          </div>
        </div>

        <!-- live demo: the real panel and plan components on the demo data -->
        <div class="mt-12 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div class="relative rounded-3xl border bg-card/60 p-3 shadow-xl shadow-black/5 sm:p-4">
            <div v-if="ready">
              <PanelEnclosure />
            </div>
            <div v-else class="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
            <div
              v-if="hint && ready"
              class="absolute top-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background shadow-lg"
              @click="hint = false"
            >
              <Power class="size-3.5" /> {{ t('landing.hero.tap') }}
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <div class="relative min-h-72 flex-1 overflow-hidden rounded-3xl border bg-card">
              <FloorPlan v-if="ready" :interactive="false" :dead-points="dead" :show-routes="false" />
            </div>
            <div class="rounded-2xl border bg-card p-4 text-sm">
              <div class="flex items-center gap-2 font-medium">
                <span class="relative flex size-2.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" /><span class="relative inline-flex size-2.5 rounded-full bg-live" /></span>
                {{ t('landing.hero.live', { n: dead.size }) }}
              </div>
              <div v-if="offLabels.length" class="mt-2 flex flex-wrap gap-1.5">
                <button v-for="d in offLabels" :key="d!.id" class="rounded-md border px-2 py-0.5 text-xs hover:bg-accent" @click="ui.toggleOff(d!.id)">
                  <b class="font-mono">{{ d!.id }}</b> · {{ tx(d!.label) }}
                </button>
              </div>
              <button v-if="ui.off.size" class="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" @click="ui.resetSimulation()">
                <RotateCcw class="size-3.5" /> {{ t('panel.simReset') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- how -->
    <section id="how" class="border-y bg-muted/30">
      <div class="mx-auto max-w-6xl px-4 py-16">
        <h2 class="text-3xl font-semibold tracking-tight">{{ t('landing.how.title') }}</h2>
        <div class="mt-8 grid gap-4 md:grid-cols-3">
          <div v-for="(s, i) in STEPS" :key="s.id" class="relative rounded-2xl border bg-card p-6">
            <span class="absolute top-5 right-5 font-mono text-5xl font-semibold text-muted-foreground/15">{{ i + 1 }}</span>
            <component :is="s.icon" class="size-7 text-primary" />
            <h3 class="mt-4 text-lg font-semibold">{{ t(`landing.how.${s.id}.title`) }}</h3>
            <p class="mt-2 text-sm text-muted-foreground">{{ t(`landing.how.${s.id}.body`) }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- features -->
    <section id="features" class="mx-auto max-w-6xl px-4 py-16">
      <h2 class="text-3xl font-semibold tracking-tight">{{ t('landing.features.title') }}</h2>
      <p class="mt-2 max-w-2xl text-muted-foreground">{{ t('landing.features.subtitle') }}</p>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="f in FEATURES" :key="f.id" class="group rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/5">
          <div class="grid size-11 place-items-center rounded-xl bg-primary/12 transition group-hover:bg-primary group-hover:text-primary-foreground">
            <component :is="f.icon" class="size-5.5" />
          </div>
          <h3 class="mt-4 font-semibold">{{ t(`landing.features.${f.id}.title`) }}</h3>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ t(`landing.features.${f.id}.body`) }}</p>
        </div>
      </div>
    </section>

    <!-- privacy -->
    <section id="privacy" class="bg-foreground text-background">
      <div class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1fr_auto]">
        <div>
          <FileLock2 class="size-8 text-primary" />
          <h2 class="mt-4 text-3xl font-semibold tracking-tight">{{ t('landing.privacy.title') }}</h2>
          <ul class="mt-6 space-y-3 text-background/80">
            <li v-for="k in ['p1', 'p2', 'p3', 'p4']" :key="k" class="flex gap-3">
              <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{{ t(`landing.privacy.${k}`) }}
            </li>
          </ul>
        </div>
        <div class="mx-auto w-52 rounded-2xl bg-white p-4 text-center text-black">
          <QrCode :value="demoUrl" :margin="0" />
          <p class="mt-3 text-xs">{{ t('landing.privacy.scan') }}</p>
        </div>
      </div>
    </section>

    <!-- diy -->
    <section id="diy" class="mx-auto max-w-6xl px-4 py-16">
      <h2 class="text-3xl font-semibold tracking-tight">{{ t('landing.diy.title') }}</h2>
      <p class="mt-2 max-w-2xl text-muted-foreground">{{ t('landing.diy.subtitle') }}</p>
      <ol class="mt-8 grid gap-3 md:grid-cols-2">
        <li v-for="(s, i) in diy" :key="i" class="flex gap-4 rounded-2xl border bg-card p-5">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">{{ i + 1 }}</span>
          <span class="pt-1 text-sm">{{ s }}</span>
        </li>
      </ol>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="app/" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground">{{ t('landing.cta.open') }} <ArrowRight class="size-4" /></a>
        <a v-if="repo" :href="repo" class="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 font-medium"><BookOpen class="size-4" /> {{ t('landing.cta.source') }}</a>
        <a v-if="repo" :href="`${repo}/releases/latest`" class="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 font-medium"><Download class="size-4" /> {{ t('landing.cta.download') }}</a>
      </div>
    </section>

    <footer class="border-t">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
        <BrandMark class="size-6" />
        <span>{{ t('app.name') }} · {{ year }}</span>
        <span class="flex-1" />
        <span>{{ t('landing.footer') }}</span>
      </div>
    </footer>
  </div>
</template>
