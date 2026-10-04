<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LOCALES, type Locale } from '@/domain/model'
import { LOCALE_NAMES, setLocale } from '@/i18n'

const { locale } = useI18n()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-1.5 px-2 font-mono text-xs uppercase" :aria-label="`${locale} · ${$t('settings.language')}`">
        <Languages class="size-4" />
        {{ locale }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup :model-value="locale" @update:model-value="(v) => setLocale(v as Locale)">
        <DropdownMenuRadioItem v-for="l in LOCALES" :key="l" :value="l">{{ LOCALE_NAMES[l] }}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
