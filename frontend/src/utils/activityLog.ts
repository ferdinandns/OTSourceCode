import type { Division } from "../context/auth-context"

export interface ActivityItem {
  id: number
  name: string
  division: Division
  action: string
  table: string
  detail: string
  time: string
}

const STORAGE_KEY = "activity_logs"
function formatTime(date: Date): string {
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
}

export function addLog(
  name: string,
  division: Division,
  action: string,
  table: string,
  detail: string
): void {
  const stored = localStorage.getItem(STORAGE_KEY)
  const logs: ActivityItem[] = stored ? JSON.parse(stored) : []

  const newLog: ActivityItem = {
    id: Date.now(),
    name,
    division,
    action,
    table,
    detail,
    time: formatTime(new Date())
  }
  const updatedLogs = [newLog, ...logs]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs))
  window.dispatchEvent(new Event("activity_updated"))
}

export function getLogs(): ActivityItem[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  const logs: ActivityItem[] = JSON.parse(stored)
  return logs.sort((a, b) => b.id - a.id)
}

export function deleteLogById(id: number): void {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return

  const logs: ActivityItem[] = JSON.parse(stored)
  const filtered = logs.filter(log => log.id !== id)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  window.dispatchEvent(new Event("activity_updated"))
}

export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event("activity_updated"))
}