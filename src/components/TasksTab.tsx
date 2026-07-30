import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import koLocale from '@fullcalendar/core/locales/ko'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import { db } from '../lib/firebase'
import { deleteTask, sortTasks, updateTask } from '../lib/subitems'
import type { TaskSortKey } from '../lib/subitems'
import TaskFormModal from './TaskFormModal'
import {
  ISSUE_STATUS_LABEL,
  PRIORITY_LABEL,
  SEVERITY_LABEL,
  TASK_STATUS_LABEL,
} from '../types'
import type { Task, TaskRow } from '../types'

type Filter = 'all' | 'schedule' | 'issue' | 'open'
type View = 'list' | 'calendar'

interface Props {
  pid: string
  canEdit: boolean
}

export default function TasksTab({ pid, canEdit }: Props) {
  const [rows, setRows] = useState<TaskRow[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<TaskSortKey>('due')
  const [view, setView] = useState<View>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskRow | null>(null)
  const [presetDate, setPresetDate] = useState<string | undefined>()

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'tasks')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Task) }))),
    )
  }, [pid])

  const visible = useMemo(() => {
    let filtered = rows
    if (filter === 'schedule') filtered = rows.filter((r) => r.kind === 'schedule')
    else if (filter === 'issue') filtered = rows.filter((r) => r.kind === 'issue')
    else if (filter === 'open') filtered = rows.filter((r) => r.kind === 'issue' && r.issueStatus === 'open')
    return sortTasks(filtered, sortKey)
  }, [rows, filter, sortKey])

  // ===== 캘린더 이벤트 변환 =====
  const events: EventInput[] = useMemo(() => {
    const evts: EventInput[] = []
    for (const t of rows) {
      if (t.kind === 'schedule') {
        const start = t.startDate || t.dueDate
        if (!start) continue
        evts.push({
          id: t.id,
          title: t.title,
          start,
          // FullCalendar의 end는 미포함(exclusive)이라 하루를 더해준다
          end: t.dueDate ? addDays(t.dueDate, 1) : undefined,
          allDay: true,
          classNames: [t.status === 'done' ? 'ev-done' : 'ev-schedule'],
        })
      } else if (t.dueDate) {
        evts.push({
          id: t.id,
          title: `⚠ ${t.title}`,
          start: t.dueDate,
          allDay: true,
          classNames: [t.issueStatus === 'resolved' ? 'ev-done' : 'ev-issue'],
        })
      }
    }
    return evts
  }, [rows])

  const openNew = (date?: string) => {
    setEditing(null)
    setPresetDate(date)
    setModalOpen(true)
  }
  const openEdit = (r: TaskRow) => {
    setEditing(r)
    setPresetDate(undefined)
    setModalOpen(true)
  }

  const handleDateClick = (arg: DateClickArg) => {
    if (canEdit) openNew(arg.dateStr)
  }
  const handleEventClick = (arg: EventClickArg) => {
    const t = rows.find((r) => r.id === arg.event.id)
    if (t && canEdit) openEdit(t)
  }

  const handleDelete = async (r: TaskRow) => {
    if (!confirm(`"${r.title}" 항목을 삭제할까요?`)) return
    try { await deleteTask(pid, r) } catch { alert('삭제에 실패했습니다.') }
  }

  /** 이슈 빠른 해결 처리 */
  const handleResolve = async (r: TaskRow) => {
    const resolution = prompt(`"${r.title}" 이슈의 해결 내용을 입력하세요:`)
    if (resolution === null) return
    if (!resolution.trim()) return alert('해결 내용을 입력해야 합니다.')
    try {
      await updateTask(pid, r, { issueStatus: 'resolved', resolution: resolution.trim() })
    } catch { alert('처리에 실패했습니다.') }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'schedule', label: '📅 일정' },
    { key: 'issue', label: '⚠ 이슈' },
    { key: 'open', label: '미해결' },
  ]

  return (
    <section className="panel">
      <div className="row-between">
        <h3>일정 · 이슈 ({rows.length})</h3>
        {canEdit && <button className="btn btn-sm btn-primary" onClick={() => openNew()}>+ 등록</button>}
      </div>

      <div className="filters">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <select className="sort" style={{ marginLeft: 0 }} value={sortKey} onChange={(e) => setSortKey(e.target.value as TaskSortKey)}>
            <option value="due">정렬: 마감일순</option>
            <option value="priority">정렬: 중요도순</option>
            <option value="latest">정렬: 최신순</option>
          </select>
        )}
        <div className="seg" style={{ marginLeft: 'auto' }}>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>목록</button>
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>캘린더</button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="calendar-wrap">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={koLocale}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
            dayMaxEventRows={3}
          />
          {canEdit && <p className="hint muted">날짜를 클릭하면 그 날짜로 일정/이슈를 등록합니다.</p>}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">해당하는 항목이 없습니다.</div>
      ) : (
        <div className="task-list">
          {visible.map((r) => (
            <div key={r.id} className={`task-row ${r.kind === 'issue' && r.issueStatus === 'open' ? 'task-open' : ''}`}>
              <span className="task-icon">{r.kind === 'schedule' ? '📅' : '⚠'}</span>
              <div className="task-main">
                <div className="task-title">
                  {r.title}
                  {r.kind === 'issue' && r.issueStatus === 'resolved' && r.resolution && (
                    <span className="muted task-res"> — 해결: {r.resolution}</span>
                  )}
                </div>
                <div className="task-sub muted">
                  {r.kind === 'schedule'
                    ? `${r.startDate || '?'} ~ ${r.dueDate || '?'}`
                    : r.dueDate ? `처리 기한 ${r.dueDate}` : '기한 없음'}
                </div>
              </div>
              {r.kind === 'schedule' ? (
                <>
                  <span className={`chip ${r.status === 'done' ? 'chip-good' : r.status === 'doing' ? 'chip-accent' : 'chip-mute'}`}>
                    {TASK_STATUS_LABEL[r.status]}
                  </span>
                  <span className="chip chip-mute">{PRIORITY_LABEL[r.priority]}</span>
                </>
              ) : (
                <>
                  <span className={`chip ${r.severity === 'high' ? 'chip-crit' : r.severity === 'mid' ? 'chip-warn' : 'chip-mute'}`}>
                    {SEVERITY_LABEL[r.severity]}
                  </span>
                  <span className={`chip ${r.issueStatus === 'open' ? 'chip-crit' : 'chip-good'}`}>
                    {ISSUE_STATUS_LABEL[r.issueStatus]}
                  </span>
                </>
              )}
              {canEdit && (
                <span className="task-actions">
                  {r.kind === 'issue' && r.issueStatus === 'open' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => handleResolve(r)}>해결</button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>수정</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TaskFormModal pid={pid} editing={editing} presetDate={presetDate} onClose={() => setModalOpen(false)} />
      )}
    </section>
  )
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
