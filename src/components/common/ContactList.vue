<script setup lang="ts">
import { computed } from 'vue'
import { Phone } from '@lucide/vue'
import type { Contact } from '@/domain/model'
import { useText } from '@/composables/useText'
import { useData } from '@/stores/data'

const props = withDefaults(defineProps<{ first?: Contact['role']; compact?: boolean }>(), { first: undefined, compact: false })
const data = useData()
const { t, tx } = useText()

// the role that fits the situation goes first: the management company for a building outage, the electrician otherwise
const contacts = computed(() => {
  const all = data.data?.meta.contacts ?? []
  return props.first ? [...all].sort((a, b) => Number(b.role === props.first) - Number(a.role === props.first)) : all
})
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
</script>

<template>
  <div v-if="contacts.length" class="grid gap-1.5">
    <component
      :is="c.phone ? 'a' : 'div'"
      v-for="c in contacts"
      :key="c.name"
      :href="c.phone ? tel(c.phone) : undefined"
      class="flex items-center gap-3 rounded-xl border bg-card transition"
      :class="[compact ? 'px-3 py-2' : 'p-3', c.phone ? 'hover:border-primary/50' : '']"
    >
      <div class="grid shrink-0 place-items-center rounded-full bg-primary/15" :class="compact ? 'size-8' : 'size-10'"><Phone class="size-4 text-primary" /></div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">{{ c.name }}</div>
        <div class="truncate text-xs text-muted-foreground">{{ t(`contact.role.${c.role}`) }}</div>
        <div v-if="c.note && !compact" class="text-xs text-muted-foreground">{{ tx(c.note) }}</div>
      </div>
      <span v-if="c.phone" class="shrink-0 font-mono text-sm tabular">{{ c.phone }}</span>
    </component>
  </div>
</template>
