import { computed } from 'vue'
import type { PanelData } from '@/domain/model'
import { useData } from '@/stores/data'

// editor components only mount after EditView has started a draft
export function useDraft() {
  const data = useData()
  const d = computed(() => data.draft!.data as PanelData)
  const assets = computed(() => data.draft!.assets as Record<string, string>)
  return { d, assets, data }
}
