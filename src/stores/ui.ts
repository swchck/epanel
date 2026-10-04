import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DeviceType, PointKind } from '@/domain/schema'
import { useData } from './data'

export const useUi = defineStore('ui', () => {
  const selectedDevice = ref<string | null>(null)
  const selectedPoint = ref<string | null>(null)
  const hoverDevice = ref<string | null>(null)
  const searchOpen = ref(false)

  const filterTypes = ref<DeviceType[]>([])
  const filterRoom = ref<string | null>(null)
  const filterTag = ref<string | null>(null)
  const filterIssues = ref(false)

  const simulate = ref(false)
  const off = ref<Set<string>>(new Set())

  const planLayers = ref<Record<PointKind | 'routes' | 'bus' | 'photos' | 'labels' | 'background', boolean>>({
    socket: true,
    light: true,
    switch: true,
    appliance: true,
    heating: true,
    ac: true,
    junction: true,
    network: true,
    panel: true,
    sensor: true,
    other: true,
    routes: false,
    bus: true,
    photos: true,
    labels: true,
    background: true,
  })

  const data = useData()

  // the device chain that explains the current selection: everything feeding it and everything it feeds
  const highlighted = computed<Set<string>>(() => {
    const id = hoverDevice.value ?? selectedDevice.value
    const g = data.graph
    if (!id || !g) return new Set()
    return new Set([id, ...g.ancestors(id).map((d) => d.id), ...g.descendants(id).map((d) => d.id)])
  })

  const filtersActive = computed(
    () => filterTypes.value.length > 0 || !!filterRoom.value || !!filterTag.value || filterIssues.value,
  )

  const matchesFilter = computed(() => {
    const d = data.data
    const g = data.graph
    if (!d || !g || !filtersActive.value) return (_id: string) => true
    const withIssues = new Set(data.checks.filter((c) => c.level !== 'info').map((c) => c.device))
    const types = new Set(filterTypes.value)
    return (id: string) => {
      const dev = g.byId.get(id)
      if (!dev) return false
      if (types.size && !types.has(dev.type)) return false
      if (filterTag.value && !dev.tags.includes(filterTag.value)) return false
      if (filterIssues.value && !withIssues.has(id)) return false
      if (filterRoom.value) {
        const inRoom = g.pointsOf(id, true).some((p) => p.room === filterRoom.value)
        if (!inRoom) return false
      }
      return true
    }
  })

  function select(id: string | null) {
    selectedDevice.value = id
    if (id) selectedPoint.value = null
  }

  function selectPoint(id: string | null) {
    selectedPoint.value = id
  }

  function toggleOff(id: string) {
    const next = new Set(off.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    off.value = next
  }

  function resetSimulation() {
    off.value = new Set()
  }

  function clearFilters() {
    filterTypes.value = []
    filterRoom.value = null
    filterTag.value = null
    filterIssues.value = false
  }

  return {
    selectedDevice,
    selectedPoint,
    hoverDevice,
    searchOpen,
    filterTypes,
    filterRoom,
    filterTag,
    filterIssues,
    simulate,
    off,
    planLayers,
    highlighted,
    filtersActive,
    matchesFilter,
    select,
    selectPoint,
    toggleOff,
    resetSimulation,
    clearFilters,
  }
})
