<script setup lang="ts">
import { RotateCw, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import BrandMark from '@/components/common/BrandMark.vue'
import LangSwitch from '@/components/common/LangSwitch.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { useData } from '@/stores/data'

const data = useData()
</script>

<template>
  <div class="relative grid min-h-dvh place-items-center bg-background px-4 py-10">
    <div class="absolute top-3 right-3 flex gap-1">
      <LangSwitch />
      <ThemeToggle />
    </div>
    <div class="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <BrandMark class="size-16" />
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t(data.status === 'error' ? 'viewer.failedTitle' : 'viewer.emptyTitle') }}</h1>
        <p class="mt-1.5 text-sm text-balance text-muted-foreground">{{ $t(data.status === 'error' ? 'viewer.failedHint' : 'viewer.emptyHint') }}</p>
      </div>
      <div v-if="data.status === 'error' && data.error" class="flex w-full gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left text-sm">
        <TriangleAlert class="size-4 shrink-0 text-destructive" />{{ data.error }}
      </div>
      <Button variant="outline" @click="data.init()"><RotateCw /> {{ $t('viewer.retry') }}</Button>
    </div>
  </div>
</template>
