import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import ProgressChart from './ProgressChart'
import MermaidDiagram from './MermaidDiagram'
import MetricsSection from './MetricsSection'
import CommentsSection from './CommentsSection'
import type { ProjectRow } from '../types'

interface HistoryPoint {
  date: Date
  progress: number
}

/** 대시보드 기록 한 건 (활동 캘린더 클릭 상세용) */
interface DayRecord {
  dateKey: string // YYYY-MM-DD
  label: string
}

const toDate = (v: unknown): Date | null =>
  v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate() : null

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface Props {
  project: ProjectRow
  canEdit: boolean
  onEdit: () => void
}

export default function OverviewTab({ project, canEdit, onEdit }: Props) {
  const { user } = useAuth()
  const isGuest = user?.isAnonymous ?? false
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [records, setRecords] = useState<DayRecord[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 달성률 추이 (실시간) — 게스트에게는 비공개 (내부 진행 이력)
  useEffect(() => {
    if (isGuest) return
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
  }, [project.id, isGuest])

  // 대시보드 기록 수집 (탭 진입 시 1회): 일정/이슈·문서·연동·달성률 — 클릭 상세용 라벨 포함
  useEffect(() => {
    if (isGuest) return
    let active = true
    const load = async () => {
      const out: DayRecord[] = []
      const push = (v: unknown, label: string) => {
        const t = toDate(v)
        if (t) out.push({ dateKey: dayKey(t), label })
      }
      const [tasks, docs, acts, hist] = await Promise.all([
        getDocs(collection(db, 'projects', project.id, 'tasks')).catch(() => null),
        getDocs(collection(db, 'projects', project.id, 'documents')).catch(() => null),
        getDocs(collection(db, 'projects', project.id, 'activity')).catch(() => null),
        getDocs(collection(db, 'projects', project.id, 'progressHistory')).catch(() => null),
      ])
      for (const d of tasks?.docs ?? []) {
        const x = d.data()
        push(x.updatedAt, `${x.kind === 'issue' ? '⚠ 이슈' : '📅 일정'} — ${x.title}`)
      }
      for (const d of docs?.docs ?? []) {
        const x = d.data()
        push(x.createdAt, `📄 문서 업로드 — ${x.name} v${x.version}`)
      }
      for (const d of acts?.docs ?? []) {
        const x = d.data()
        push(x.at, `🔄 연동 — ${String(x.summary ?? '').slice(0, 60)}`)
      }
      for (const d of hist?.docs ?? []) {
        const x = d.data()
        push(x.date, `📈 달성률 ${x.progress}% 기록`)
      }
      if (active) setRecords(out)
    }
    load().catch(() => {})
    return () => { active = false }
  }, [project.id, isGuest])

  // 캘린더 이벤트: 커밋(파랑) + 기록(회색)
  const activityEvents: EventInput[] = useMemo(() => {
    const events: EventInput[] = (project.commitDays ?? []).map((d) => ({
      title: `커밋 ${d.count}건`,
      start: d.date,
      allDay: true,
      classNames: ['ev-schedule'],
    }))
    const recordCount = new Map<string, number>()
    for (const r of records) recordCount.set(r.dateKey, (recordCount.get(r.dateKey) ?? 0) + 1)
    for (const [date, n] of recordCount) {
      events.push({ title: `기록 ${n}건`, start: date, allDay: true, classNames: ['ev-done'] })
    }
    return events
  }, [project.commitDays, records])

  const handleEventClick = (arg: EventClickArg) => setSelectedDate(arg.event.startStr)
  const handleDateClick = (arg: DateClickArg) => setSelectedDate(arg.dateStr)

  // 선택한 날짜의 상세 내용
  const selected = useMemo(() => {
    if (!selectedDate) return null
    const commits = (project.commitDays ?? []).find((d) => d.date === selectedDate) ?? null
    const dayRecords = records.filter((r) => r.dateKey === selectedDate)
    return { commits, dayRecords }
  }, [selectedDate, project.commitDays, records])

  return (
    <>
      {/* 1행: 부가효과 지표 | 달성률 추이 */}
      {isGuest ? (
        <MetricsSection pid={project.id} canEdit={false} />
      ) : (
        <div className="overview-grid">
          <MetricsSection pid={project.id} canEdit={canEdit} />
          <section className="panel">
            <h3>달성률 추이</h3>
            <ProgressChart points={history} />
          </section>
        </div>
      )}

      {/* 2행: 활동 캘린더 | 클릭 상세 */}
      {!isGuest && (
        <div className="overview-grid">
          <section className="panel">
            <h3>활동 캘린더</h3>
            <p className="ph muted">커밋(파랑)·기록(회색)을 클릭하면 오른쪽에 내용이 표시됩니다</p>
            <div className="calendar-wrap">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale={koLocale}
                events={activityEvents}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
                height="auto"
                dayMaxEventRows={2}
              />
            </div>
          </section>

          <section className="panel">
            <h3>활동 내용 {selectedDate && <span className="muted day-detail-date">{selectedDate}</span>}</h3>
            {!selected ? (
              <div className="empty">캘린더에서 날짜나 커밋/기록을 클릭하면<br />해당 날짜의 내용이 여기에 표시됩니다.</div>
            ) : (
              <div className="day-detail">
                {selected.commits && (
                  <div className="dd-group">
                    <b>💻 커밋 {selected.commits.count}건</b>
                    {selected.commits.messages?.length ? (
                      <ul>
                        {selected.commits.messages.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    ) : (
                      <p className="muted dd-hint">커밋 메시지는 다음 "대시보드에 올려줘" 때 수집됩니다.</p>
                    )}
                  </div>
                )}
                {selected.dayRecords.length > 0 && (
                  <div className="dd-group">
                    <b>🗂 대시보드 기록 {selected.dayRecords.length}건</b>
                    <ul>
                      {selected.dayRecords.map((r, i) => <li key={i}>{r.label}</li>)}
                    </ul>
                  </div>
                )}
                {!selected.commits && selected.dayRecords.length === 0 && (
                  <div className="empty">이 날짜에는 활동이 없습니다.</div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 3행: 목표 */}
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
                {/* 세부항목 체크리스트 — 내부 작업 내용이므로 게스트에게 숨김 */}
                {!isGuest && (g.items?.length ?? 0) > 0 && (
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

      {/* 4행: 동작 설명 · 시퀀스 */}
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

      {/* 5행: 요청·코멘트 (게스트 포함 소통 창구) */}
      <CommentsSection pid={project.id} canManage={canEdit} />
    </>
  )
}
