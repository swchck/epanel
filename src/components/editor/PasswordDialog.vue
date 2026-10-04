<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MIN_PASSWORD_LENGTH } from '@/domain/crypto'
import { useText } from '@/composables/useText'
import FormRow from './FormRow.vue'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ change?: boolean }>()
const emit = defineEmits<{ set: [password: string] }>()
const { t } = useText()
const pw1 = ref('')
const pw2 = ref('')
const err = ref('')

watch(open, (v) => {
  if (v) pw1.value = pw2.value = err.value = ''
})

function submit() {
  if (pw1.value.length < MIN_PASSWORD_LENGTH || pw1.value !== pw2.value) {
    err.value = t('start.passwordMismatch')
    return
  }
  emit('set', pw1.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <form class="space-y-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t(change ? 'editor.publish.changePassword' : 'editor.publish.setPassword') }}</DialogTitle>
          <DialogDescription>{{ t(change ? 'editor.publish.passwordHint' : 'start.passwordHint') }}</DialogDescription>
        </DialogHeader>
        <FormRow :label="t('start.password')"><Input v-model="pw1" type="password" autocomplete="new-password" autofocus /></FormRow>
        <FormRow :label="t('start.passwordRepeat')"><Input v-model="pw2" type="password" autocomplete="new-password" /></FormRow>
        <p v-if="err" class="text-sm text-destructive">{{ err }}</p>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
          <Button type="submit">{{ t(change ? 'editor.publish.changePassword' : 'common.done') }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
