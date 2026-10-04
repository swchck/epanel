<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from 'reka-ui'
import { SelectRoot, useForwardPropsEmits } from 'reka-ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<SelectRootProps>()
const emits = defineEmits<SelectRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
// reka-ui captures each item's text when it mounts, so the trigger kept showing the old language
const { locale } = useI18n()
</script>

<template>
  <SelectRoot
    v-slot="slotProps"
    :key="locale"
    data-slot="select"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
