<script setup lang="ts">
import { ref, watchEffect } from 'vue'

const props = withDefaults(defineProps<{ value: string; margin?: number; dark?: string; light?: string }>(), {
  margin: 1,
  dark: '#111111',
  light: '#ffffff',
})
const svg = ref('')

watchEffect(async (onCleanup) => {
  let stale = false
  onCleanup(() => (stale = true))
  if (!props.value) {
    svg.value = ''
    return
  }
  const opts = { type: 'svg', errorCorrectionLevel: 'M', margin: props.margin, color: { dark: props.dark, light: props.light } } as const
  // qrcode is only needed on the few screens that show a code, so it isn't part of the startup bundle
  const { default: QRCode } = await import('qrcode')
  const out = await QRCode.toString(props.value, opts)
  if (!stale) svg.value = out
})

defineExpose({ svg })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- generated locally by the qrcode library -->
  <div class="qr [&>svg]:block [&>svg]:h-full [&>svg]:w-full" v-html="svg" />
</template>
