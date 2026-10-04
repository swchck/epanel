<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff, KeyRound, LoaderCircle, QrCode } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BrandMark from '@/components/common/BrandMark.vue'
import LangSwitch from '@/components/common/LangSwitch.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { useData } from '@/stores/data'

const data = useData()
const password = ref('')
const remember = ref(true)
const show = ref(false)
const busy = ref(false)

async function submit() {
  if (!password.value) return
  busy.value = true
  await data.unlock(password.value, remember.value)
  busy.value = false
}
</script>

<template>
  <div class="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4">
    <div class="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--foreground)_1px,transparent_1px)] [background-size:18px_18px]" />
    <div class="absolute top-[calc(var(--titlebar)+0.75rem)] right-3 flex gap-1">
      <LangSwitch />
      <ThemeToggle />
    </div>
    <form class="relative w-full max-w-sm" @submit.prevent="submit">
      <div class="mb-8 flex flex-col items-center gap-4 text-center">
        <BrandMark class="size-16" />
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ $t('unlock.title') }}</h1>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ $t('unlock.subtitle') }}</p>
        </div>
      </div>
      <div class="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div class="space-y-2">
          <Label for="pw">{{ $t('unlock.password') }}</Label>
          <div class="relative">
            <KeyRound class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pw"
              v-model="password"
              :type="show ? 'text' : 'password'"
              autocomplete="current-password"
              autofocus
              class="h-11 pr-10 pl-9 text-base"
              :aria-invalid="data.error === 'wrong-password'"
            />
            <button
              type="button"
              class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              :aria-label="$t(show ? 'unlock.hide' : 'unlock.show')"
              @click="show = !show"
            >
              <component :is="show ? EyeOff : Eye" class="size-4" />
            </button>
          </div>
          <p v-if="data.error === 'wrong-password'" class="text-sm text-destructive">{{ $t('unlock.wrong') }}</p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="remember" />
          {{ $t('unlock.remember') }}
        </label>
        <Button type="submit" class="h-11 w-full text-base" :disabled="busy || !password">
          <LoaderCircle v-if="busy" class="size-4 animate-spin" />
          {{ $t('unlock.submit') }}
        </Button>
      </div>
      <p class="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
        <QrCode class="mt-0.5 size-4 shrink-0" />
        {{ $t('unlock.hint') }}
      </p>
      <p class="mt-3 text-center text-sm">
        <button type="button" class="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" @click="data.init({ demo: true })">{{ $t('unlock.demo') }}</button>
      </p>
    </form>
  </div>
</template>
