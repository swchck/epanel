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

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function taskStatuses(tasks: MaintenanceTask[], log: MaintenanceLog[], today = new Date()): TaskStatus[] {
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return tasks.map((task) => {
    const last = log
      .filter((l) => l.task === task.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!last) return { task, overdueDays: 0, state: 'never' as const }
    const dueMs = Date.parse(last.date) + task.intervalDays * DAY
    const overdueDays = Math.floor((now - dueMs) / DAY)
    const soonWindow = Math.min(7, Math.ceil(task.intervalDays * 0.2))
    const state = overdueDays > 0 ? 'overdue' : overdueDays > -soonWindow ? 'soon' : 'ok'
    return { task, last, due: isoDay(new Date(dueMs)), overdueDays, state }
  })
}
