import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Metric, MetricPoint } from '../types'

export function sortPoints(points: MetricPoint[]): MetricPoint[] {
  return [...points].sort((a, b) => a.month.localeCompare(b.month))
}

export async function addMetric(pid: string, data: Metric) {
  await addDoc(collection(db, 'projects', pid, 'metrics'), {
    ...data,
    points: sortPoints(data.points),
    createdAt: serverTimestamp(),
  })
}

export async function updateMetric(pid: string, id: string, data: Partial<Metric>) {
  const patch = { ...data }
  if (patch.points) patch.points = sortPoints(patch.points)
  await updateDoc(doc(db, 'projects', pid, 'metrics', id), patch)
}

export async function deleteMetric(pid: string, id: string) {
  await deleteDoc(doc(db, 'projects', pid, 'metrics', id))
}

/** 최근 값과 전월 대비 증감 */
export function latestDelta(points: MetricPoint[]): {
  last: MetricPoint | null
  prev: MetricPoint | null
  delta: number | null
} {
  const sorted = sortPoints(points)
  const last = sorted[sorted.length - 1] ?? null
  const prev = sorted[sorted.length - 2] ?? null
  return {
    last,
    prev,
    delta: last && prev ? Math.round((last.value - prev.value) * 100) / 100 : null,
  }
}
