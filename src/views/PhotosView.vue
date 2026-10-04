<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, FileText, MapPin } from '@lucide/vue'
import PhotoLightbox from '@/components/common/PhotoLightbox.vue'
import { resolveAsset } from '@/domain/model'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const data = useData()
const { t, tx } = useText()
const open = ref<string | null>(null)
const room = ref<string | null>(null)

const photos = computed(() => (data.data?.photos ?? []).filter((p) => !room.value || p.room === room.value))
const rooms = computed(() => (data.data?.rooms ?? []).filter((r) => data.data!.photos.some((p) => p.room === r.id)))
const docs = computed(() => data.data?.documents ?? [])
const roomName = (id?: string) => tx(data.data?.rooms.find((r) => r.id === id)?.name)

function openDoc(href: string) {
  const url = resolveAsset(href, data.assets)
  if (!url) return
  if (url.startsWith('data:')) {
    // browsers block top-level navigation to data: URLs, so hand them a blob instead
    const [meta, b64] = url.split(',')
    const mime = meta!.slice(5).split(';')[0]
    const bytes = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0))
    window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), '_blank', 'noopener')
  } else window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8">
    <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ t('photos.title') }}</h1>
    <p class="mt-1 text-muted-foreground">{{ t('photos.subtitle') }}</p>

    <div v-if="rooms.length > 1" class="mt-5 flex flex-wrap gap-1.5">
      <button class="rounded-full border px-3 py-1 text-xs" :class="!room ? 'bg-foreground text-background' : 'bg-card'" @click="room = null">{{ t('panel.allRooms') }}</button>
      <button v-for="r in rooms" :key="r.id" class="rounded-full border px-3 py-1 text-xs" :class="room === r.id ? 'bg-foreground text-background' : 'bg-card'" @click="room = r.id">{{ tx(r.name) }}</button>
    </div>

    <div v-if="photos.length" class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <button v-for="p in photos" :key="p.id" class="group overflow-hidden rounded-2xl border bg-card text-left" @click="open = p.id">
        <div class="aspect-[4/3] overflow-hidden bg-muted">
          <img :src="resolveAsset(p.src, data.assets)" :alt="tx(p.caption)" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
        <div class="p-3">
          <div class="line-clamp-2 text-sm font-medium">{{ tx(p.caption, t('photos.untitled')) }}</div>
          <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span v-if="p.room" class="flex items-center gap-1"><MapPin class="size-3" />{{ roomName(p.room) }}</span>
            <span v-if="p.date">{{ p.date }}</span>
          </div>
        </div>
      </button>
    </div>
    <p v-else class="mt-8 text-sm text-muted-foreground">{{ t('photos.empty') }}</p>

    <section class="mt-10 mb-6">
      <h2 class="mb-3 font-semibold">{{ t('photos.documents') }}</h2>
      <div v-if="docs.length" class="grid gap-2 sm:grid-cols-2">
        <button v-for="d in docs" :key="d.id" class="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50" @click="openDoc(d.href)">
          <FileText class="size-6 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ tx(d.title) }}</div>
            <div class="text-xs text-muted-foreground">{{ t(`docKind.${d.kind}`) }}<template v-if="d.date"> · {{ d.date }}</template></div>
          </div>
          <ExternalLink class="size-4 text-muted-foreground" />
        </button>
      </div>
      <p v-else class="text-sm text-muted-foreground">{{ t('photos.noDocs') }}</p>
    </section>
    <PhotoLightbox v-model:id="open" />
  </div>
</template>
