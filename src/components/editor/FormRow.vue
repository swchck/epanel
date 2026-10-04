<script setup lang="ts">
defineProps<{ label: string; hint?: string; for?: string }>()
</script>

<template>
  <div class="space-y-1.5">
    <label :for="$props.for" class="text-xs font-medium text-muted-foreground">{{ label }}</label>
    <slot />
    <p v-if="hint" class="text-[11px] text-muted-foreground">{{ hint }}</p>
  </div>
</template>
