<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useTheme, type ThemeMode } from '@/composables/useTheme'

const { mode } = useTheme()
const ORDER: ThemeMode[] = ['auto', 'light', 'dark']
const icon = computed(() => ({ auto: Monitor, light: Sun, dark: Moon })[mode.value])
function next() {
  mode.value = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length]!
}
</script>

<template>
  <Button variant="ghost" size="icon" :aria-label="$t(`settings.theme.${mode}`)" :title="$t(`settings.theme.${mode}`)" @click="next">
    <component :is="icon" class="size-4.5" />
  </Button>
</template>
