<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Download, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useText } from '@/composables/useText'
import { appUrl } from '@/lib/appUrl'
import { saveTextFile } from '@/platform'
import { useData } from '@/stores/data'
import QrCode from './QrCode.vue'

const props = defineProps<{ path: string; title: string }>()
const open = defineModel<boolean>('open', { default: false })
const data = useData()
const { t } = useText()
const withKey = ref(true)
const qr = ref<InstanceType<typeof QrCode> | null>(null)

const url = computed(() => appUrl(data.data?.meta.publicUrl, props.path, withKey.value ? data.password : null))
const noBase = computed(() => !url.value.startsWith('http'))

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    toast.success(t('qr.copied'))
  } catch {
    // clipboard blocked: the link is still on screen to select by hand
    toast.error(t('qr.copyFailed'))
  }
}

async function download() {
  if (!qr.value?.svg) return
  try {
    await saveTextFile(`qr-${props.path.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'panel'}.svg`, qr.value.svg)
  } catch (e) {
    toast.error((e as Error).message)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ t('qr.description') }}</DialogDescription>
      </DialogHeader>
      <div class="mx-auto aspect-square w-56 rounded-xl bg-white p-3">
        <QrCode ref="qr" :value="url" />
      </div>
      <label class="flex items-center justify-between gap-3 text-sm">
        <span>{{ t('qr.withPassword') }}</span>
        <Switch v-model="withKey" />
      </label>
      <p v-if="withKey" class="text-xs text-muted-foreground">{{ t('qr.withPasswordHint') }}</p>
      <p v-if="noBase" class="flex gap-2 rounded-lg bg-warn/15 p-2 text-xs"><TriangleAlert class="size-4 shrink-0 text-warn" />{{ t('qr.noPublicUrl') }}</p>
      <code class="block truncate rounded-md bg-muted px-2 py-1.5 font-mono text-[11px]">{{ withKey ? url.replace(/k=[^&]+/, 'k=••••') : url }}</code>
      <div class="flex gap-2">
        <Button variant="outline" class="flex-1" @click="copy"><Copy /> {{ t('qr.copy') }}</Button>
        <Button variant="outline" class="flex-1" @click="download"><Download /> SVG</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
