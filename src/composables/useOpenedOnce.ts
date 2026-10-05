import { ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * Returns a flag that turns true the first time `open` does and stays true.
 * Lazy dialogs mount on it: nothing loads before first use, and the close animation still plays.
 */
export function useOpenedOnce(open: WatchSource<boolean>): Ref<boolean> {
  const opened = ref(false)
  const stop = watch(
    open,
    (v) => {
      if (!v) return
      opened.value = true
      queueMicrotask(() => stop())
    },
    { immediate: true },
  )
  return opened
}
