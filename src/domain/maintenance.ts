import type { MaintenanceLog, MaintenanceTask } from './model'

export interface TaskStatus {
  task: MaintenanceTask
  last?: MaintenanceLog
  // ISO date (YYYY-MM-DD); undefined when the task was never done
  due?: string
  // negative while there is time left
  overdueDays: number
  state: 'never' | 'ok' | 'soon' | 'overdue'
}

const DAY = 86_400_000

/**
 * Returns the local calendar date as YYYY-MM-DD.
 */
export function isoDay(d: Date): string {
  // local, not toISOString(): just after midnight east of UTC that would still be yesterday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function taskStatuses(tasks: MaintenanceTask[], log: MaintenanceLog[], today = new Date()): TaskStatus[] {
  // the log holds calendar days, so the math runs on UTC midnights of those days, today included
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return tasks.map((task) => {
    const last = log
      .filter((l) => l.task === task.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!last) return { task, overdueDays: 0, state: 'never' as const }
    const dueMs = Date.parse(last.date) + task.intervalDays * DAY
    const overdueDays = Math.floor((now - dueMs) / DAY)
    const soonWindow = Math.min(7, Math.ceil(task.intervalDays * 0.2))
    const state = overdueDays > 0 ? 'overdue' : overdueDays > -soonWindow ? 'soon' : 'ok'
    return { task, last, due: new Date(dueMs).toISOString().slice(0, 10), overdueDays, state }
  })
}
