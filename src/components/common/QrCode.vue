<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = withDefaults(defineProps<{ value: string; margin?: number; dark?: string; light?: string }>(), {
  margin: 1,
  dark: '#111111',
  light: '#ffffff',
})
const svg = ref('')

watchEffect(async () => {
  if (!props.value) {
    svg.value = ''
    return
  }
  svg.value = await QRCode.toString(props.value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: props.margin,
    color: { dark: props.dark, light: props.light },
  })
})

defineExpose({ svg })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- generated locally by the qrcode library -->
  <div class="qr [&>svg]:block [&>svg]:h-full [&>svg]:w-full" v-html="svg" />
</template>
