import { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import ProgressChart from './ProgressChart'
import ActivityHeatmap from './ActivityHeatmap'
import MermaidDiagram from './MermaidDiagram'
import type { ProjectRow } from '../types'

interface HistoryPoint {
  date: Date
  progress: number
}

const toDate = (v: unknown): Date | null =>
  v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : null

interface Props {
  project: ProjectRow
  canEdit: boolean
  onEdit: () => void
}

export default function OverviewTab({ project, canEdit, onEdit }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [activityDates, setActivityDates] = useState<Date[]>([])

  // 달성률 추이 (실시간)
  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', project.id, 'progressHistory')), (snap) => {
      const pts = snap.docs
        .map((d) => {
          const date = toDate(d.data().date)
          return date ? { date, progress: Number(d.data().progress) || 0 } : null
        })
        .filter((p): p is HistoryPoint => p !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
      setHistory(pts)
    })
  }, [project.id])

  // 주간 활동 집계 (탭 진입 시 1회): 일정/이슈·문서·연동이력·달성률 기록
  useEffect(() => {
    let active = true
    const load = async () => {
      const dates: Date[] = []
      const subs: { name: string; field: string }[] = [
        { name: 'tasks', field: 'updatedAt' },
        { name: 'documents', field: 'createdAt' },
        { name: 'activity', field: 'at' },
        { name: 'progressHistory', field: 'date' },
      ]
      for (const s of subs) {
        const snap = await getDocs(collection(db, 'projects', project.id, s.name))
        for (const d of snap.docs) {
          const t = toDate(d.data()[s.field])
          if (t) dates.push(t)
        }
      }
      if (active) setActivityDates(dates)
    }
    load().catch(() => {})
    return () => { active = false }
  }, [project.id])

  return (
    <>
      <div className="overview-grid">
        <section className="panel">
          <h3>달성률 추이</h3>
          <ProgressChart points={history} />
        </section>

        <section className="panel">
          <h3>주간 활동</h3>
          <p className="ph muted">일정·이슈·문서·연동 기록 횟수 (최근 12주)</p>
          <ActivityHeatmap dates={activityDates} />
        </section>
      </div>

      <section className="panel">
        <h3>목표 (마일스톤)</h3>
        {project.goals.length === 0 ? (
          <div className="empty">
            등록된 목표가 없습니다.
            {canEdit && <><br />"프로젝트 수정"에서 목표를 추가하면 달성률이 자동 계산됩니다.</>}
          </div>
        ) : (
          <div className="goal-list">
            {project.goals.map((g) => (
              <div key={g.id} className="goal-view">
                <div className="g-row">
                  <span>{g.title}</span>
                  <span className={`by ${g.updatedBy === 'ai' ? 'by-ai' : 'by-user'}`}>
                    {g.updatedBy === 'ai' ? 'AI' : '사용자'}
                  </span>
                  <b>{g.progress}%</b>
                </div>
                <div className="bar"><i style={{ width: `${g.progress}%` }} /></div>
                {(g.items?.length ?? 0) > 0 && (
                  <ul className="goal-items">
                    {g.items!.map((it) => (
                      <li key={it.id} className={`gi ${it.done ? 'gi-done' : ''}`}>
                        <span className="gi-mark">{it.done ? '✓' : '○'}</span>
                        {it.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>동작 설명 · 시퀀스</h3>
        {!project.workflowNote && !project.sequenceMermaid ? (
          <div className="empty">
            아직 동작 설명이 없습니다.
            {canEdit && (
              <>
                <br />Claude Code로 등록("대시보드에 올려줘")하면 자동으로 채워지며,{' '}
                <button className="btn btn-sm btn-ghost" onClick={onEdit}>프로젝트 수정</button>
                에서 직접 입력할 수도 있습니다.
              </>
            )}
          </div>
        ) : (
          <>
            {project.workflowNote && (
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                {project.workflowNote}
              </p>
            )}
            {project.sequenceMermaid && <MermaidDiagram code={project.sequenceMermaid} />}
          </>
        )}
      </section>
    </>
  )
}
