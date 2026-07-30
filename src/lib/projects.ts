import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Goal, Project, ProjectRow } from '../types'

/** 목표 목록의 평균으로 전체 달성률 계산 (목표가 없으면 null) */
export function computeProgress(goals: Goal[]): number | null {
  if (goals.length === 0) return null
  const sum = goals.reduce((acc, g) => acc + g.progress, 0)
  return Math.round(sum / goals.length)
}

/** 달성률 스냅샷 기록 — Phase 6 "달성률 추이 차트"의 데이터가 된다 */
async function snapshotProgress(projectId: string, progress: number) {
  await addDoc(collection(db, 'projects', projectId, 'progressHistory'), {
    date: serverTimestamp(),
    progress,
  })
}

export async function createProject(
  data: Omit<Project, 'ownerUid' | 'createdAt' | 'updatedAt'>,
  ownerUid: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'projects'), {
    ...data,
    ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await snapshotProgress(ref.id, data.progress)
  return ref.id
}

export async function updateProject(
  id: string,
  data: Partial<Project>,
  prevProgress?: number,
) {
  await updateDoc(doc(db, 'projects', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
  // 달성률이 실제로 바뀐 경우에만 추이 기록
  if (data.progress !== undefined && data.progress !== prevProgress) {
    await snapshotProgress(id, data.progress)
  }
}

export async function deleteProject(id: string) {
  await deleteDoc(doc(db, 'projects', id))
}

/** D-day 계산: 양수=남음, 0=오늘, 음수=지남, null=마감일 없음 */
export function daysLeft(dueDate: string): number | null {
  if (!dueDate) return null
  const due = new Date(`${dueDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export function ddayLabel(dueDate: string): string {
  const d = daysLeft(dueDate)
  if (d === null) return ''
  if (d === 0) return 'D-DAY'
  return d > 0 ? `D-${d}` : `D+${-d}`
}

/** 정렬: 최신순 / 마감일순 / 중요도순 */
export type SortKey = 'latest' | 'due' | 'priority'

const PRIORITY_ORDER = { high: 0, mid: 1, low: 2 } as const

export function sortProjects(rows: ProjectRow[], key: SortKey): ProjectRow[] {
  const sorted = [...rows]
  if (key === 'latest') {
    sorted.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt))
  } else if (key === 'due') {
    // 마감일 없는 프로젝트는 뒤로
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  } else {
    sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }
  return sorted
}

function toMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis()
  }
  return 0
}
