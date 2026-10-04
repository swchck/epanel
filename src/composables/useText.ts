import { useI18n } from 'vue-i18n'
import { tr, type LocalizedText } from '@/domain/schema'

export function useText() {
  const i18n = useI18n()
  const tx = (t: LocalizedText | undefined, fallback = '') => tr(t, i18n.locale.value, fallback)
  return { ...i18n, tx }
}
