<script setup lang="ts">
import { isoDay } from '@/domain/maintenance'
import { ref } from 'vue'
import { FilePlus2, ImagePlus, Link2, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ASSET_PREFIX, resolveAsset } from '@/domain/model'
import { uniqueId } from '@/editor/ops'
import { blobToDataUrl, compressImage, MAX_DOC_BYTES, newId } from '@/lib/media'
import { useDraft } from '@/composables/useDraft'
import { useText } from '@/composables/useText'
import { openBinaryFiles } from '@/platform'
import FormRow from './FormRow.vue'
import LocalizedInput from './LocalizedInput.vue'

const { d, assets } = useDraft()
const { t, tx } = useText()
const busy = ref(false)
const DOC_KINDS = ['act', 'scheme', 'passport', 'warranty', 'invoice', 'other'] as const

async function addPhotos() {
  const files = await openBinaryFiles('image/*', true)
  if (!files.length) return
  busy.value = true
  let added = 0
  try {
    for (const f of files) {
      // one HEIC or broken file must not abort the whole batch
      const img = await compressImage(f.blob).catch(() => null)
      if (!img) {
        toast.error(t('editor.media.unreadable', { name: f.name }))
        continue
      }
      added++
      const aid = newId('photo')
      assets.value[aid] = img.url
      d.value.photos.push({
        id: uniqueId(
          d.value.photos.map((p) => p.id),
          'ph-',
        ),
        src: ASSET_PREFIX + aid,
        caption: f.name.replace(/\.[^.]+$/, ''),
        date: isoDay(new Date()),
      })
    }
    if (added) toast.success(t('editor.media.added', { n: added }))
  } finally {
    busy.value = false
  }
}

async function addDocument() {
  const [f] = await openBinaryFiles('application/pdf,image/*')
  if (!f) return
  if (f.blob.size > MAX_DOC_BYTES) {
    toast.error(t('editor.media.tooBig', { mb: MAX_DOC_BYTES / 1024 / 1024 }))
    return
  }
  busy.value = true
  try {
    const url = f.type.startsWith('image/') ? (await compressImage(f.blob, 2400, 0.85)).url : await blobToDataUrl(f.blob)
    const aid = newId('doc')
    assets.value[aid] = url
    d.value.documents.push({
      id: uniqueId(
        d.value.documents.map((x) => x.id),
        'doc-',
      ),
      title: f.name.replace(/\.[^.]+$/, ''),
      kind: 'other',
      href: ASSET_PREFIX + aid,
      date: isoDay(new Date()),
    })
  } catch {
    toast.error(t('editor.media.unreadable', { name: f.name }))
  } finally {
    busy.value = false
  }
}

function addLink() {
  d.value.documents.push({
    id: uniqueId(
      d.value.documents.map((x) => x.id),
      'doc-',
    ),
    title: '',
    kind: 'other',
    href: 'https://',
  })
}
</script>

<template>
  <div class="space-y-8">
    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-semibold">{{ t('nav.photos') }}</h3>
          <p class="text-sm text-muted-foreground">{{ t('editor.media.photosHint') }}</p>
        </div>
        <Button :disabled="busy" @click="addPhotos"><ImagePlus /> {{ t('editor.media.addPhotos') }}</Button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="(p, i) in d.photos" :key="p.id" class="overflow-hidden rounded-xl border bg-card">
          <img :src="resolveAsset(p.src, assets)" class="aspect-[4/3] w-full object-cover" alt="" />
          <div class="space-y-2 p-3">
            <LocalizedInput v-model="p.caption" :placeholder="t('editor.plan.caption')" />
            <div class="flex gap-2">
              <Select :model-value="p.room ?? '__'" @update:model-value="(v) => (p.room = v === '__' ? undefined : (v as string))">
                <SelectTrigger class="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__">{{ t('common.noRoom') }}</SelectItem>
                  <SelectItem v-for="r in d.rooms" :key="r.id" :value="r.id">{{ tx(r.name) }}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="d.photos.splice(i, 1)"><Trash2 /></Button>
            </div>
            <p v-if="p.x === undefined" class="text-[11px] text-muted-foreground">{{ t('editor.media.notOnPlan') }}</p>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold">{{ t('photos.documents') }}</h3>
        <div class="flex gap-2">
          <Button variant="outline" @click="addLink"><Link2 /> {{ t('editor.media.addLink') }}</Button>
          <Button :disabled="busy" @click="addDocument"><FilePlus2 /> {{ t('editor.media.addDoc') }}</Button>
        </div>
      </div>
      <div class="space-y-2">
        <div v-for="(doc, i) in d.documents" :key="doc.id" class="grid items-end gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_10rem_9rem_auto]">
          <FormRow :label="t('editor.media.docTitle')"><LocalizedInput v-model="doc.title" /></FormRow>
          <FormRow :label="t('editor.media.docKind')">
            <Select v-model="doc.kind">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem v-for="k in DOC_KINDS" :key="k" :value="k">{{ t(`docKind.${k}`) }}</SelectItem></SelectContent>
            </Select>
          </FormRow>
          <FormRow :label="t('maintenance.date')"><Input v-model="doc.date" type="date" /></FormRow>
          <Button variant="ghost" size="icon" :aria-label="t('common.delete')" @click="d.documents.splice(i, 1)"><Trash2 /></Button>
          <FormRow v-if="!doc.href.startsWith(ASSET_PREFIX)" :label="t('editor.media.link')" class="sm:col-span-4"><Input v-model="doc.href" /></FormRow>
        </div>
      </div>
    </section>
  </div>
</template>
