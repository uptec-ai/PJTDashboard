import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Equipment, Task, TaskRow } from '../types'

// ===== 장비 =====

export async function addEquipment(pid: string, data: Equipment) {
  await addDoc(collection(db, 'projects', pid, 'equipment'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateEquipment(pid: string, id: string, data: Partial<Equipment>) {
  await updateDoc(doc(db, 'projects', pid, 'equipment', id), data)
}

export async function deleteEquipment(pid: string, id: string) {
  await deleteDoc(doc(db, 'projects', pid, 'equipment', id))
}

// ===== 일정/이슈 =====
// 프로젝트 문서의 openIssueCount(미해결 이슈 수)를 함께 유지한다 — 카드/KPI 표시에 사용

function isOpenIssue(t: Pick<Task, 'kind' | 'issueStatus'>) {
  return t.kind === 'issue' && t.issueStatus === 'open'
}

async function bumpIssueCount(pid: string, delta: number) {
  if (delta === 0) return
  await updateDoc(doc(db, 'projects', pid), { openIssueCount: increment(delta) })
}

export async function addTask(pid: string, data: Task) {
  await addDoc(collection(db, 'projects', pid, 'tasks'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (isOpenIssue(data)) await bumpIssueCount(pid, 1)
}

export async function updateTask(pid: string, prev: TaskRow, data: Partial<Task>) {
  const next = { ...prev, ...data }
  const patch: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() }
  // 이슈를 해결로 바꾸는 순간 해결 시각 기록
  if (isOpenIssue(prev) && !isOpenIssue(next)) patch.resolvedAt = serverTimestamp()
  await updateDoc(doc(db, 'projects', pid, 'tasks', prev.id), patch)
  const delta = (isOpenIssue(next) ? 1 : 0) - (isOpenIssue(prev) ? 1 : 0)
  await bumpIssueCount(pid, delta)
}

export async function deleteTask(pid: string, prev: TaskRow) {
  await deleteDoc(doc(db, 'projects', pid, 'tasks', prev.id))
  if (isOpenIssue(prev)) await bumpIssueCount(pid, -1)
}

// ===== 일정/이슈 정렬 =====

export type TaskSortKey = 'due' | 'priority' | 'latest'

const ORDER = { high: 0, mid: 1, low: 2 } as const

export function sortTasks(rows: TaskRow[], key: TaskSortKey): TaskRow[] {
  const sorted = [...rows]
  if (key === 'due') {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  } else if (key === 'priority') {
    // 일정은 우선순위, 이슈는 심각도로 비교
    const rank = (t: TaskRow) => ORDER[t.kind === 'issue' ? t.severity : t.priority]
    sorted.sort((a, b) => rank(a) - rank(b))
  } else {
    const ms = (v: unknown) =>
      v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis: () => number }).toMillis() : 0
    sorted.sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
  }
  return sorted
}
