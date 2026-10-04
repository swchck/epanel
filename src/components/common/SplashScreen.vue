<script setup lang="ts">
import BrandMark from './BrandMark.vue'
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-background">
    <div class="flex flex-col items-center gap-4 text-muted-foreground">
      <BrandMark class="size-14 animate-pulse" />
      <span class="text-sm">{{ $t('common.loading') }}</span>
    </div>
  </div>
</template>
