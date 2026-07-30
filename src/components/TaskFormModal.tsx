import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { addTask, updateTask } from '../lib/subitems'
import type { IssueStatus, Priority, Severity, TaskKind, TaskRow, TaskStatus } from '../types'

interface Props {
  pid: string
  editing: TaskRow | null
  /** 캘린더에서 날짜 클릭으로 열었을 때 미리 채울 날짜 */
  presetDate?: string
  onClose: () => void
}

export default function TaskFormModal({ pid, editing, presetDate, onClose }: Props) {
  const [kind, setKind] = useState<TaskKind>('schedule')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(presetDate ?? '')
  const [dueDate, setDueDate] = useState(presetDate ?? '')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<Priority>('mid')
  const [severity, setSeverity] = useState<Severity>('mid')
  const [issueStatus, setIssueStatus] = useState<IssueStatus>('open')
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editing) {
      setKind(editing.kind)
      setTitle(editing.title)
      setStartDate(editing.startDate)
      setDueDate(editing.dueDate)
      setStatus(editing.status)
      setPriority(editing.priority)
      setSeverity(editing.severity)
      setIssueStatus(editing.issueStatus)
      setResolution(editing.resolution)
    }
  }, [editing])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('제목을 입력하세요.')
    if (kind === 'issue' && issueStatus === 'resolved' && !resolution.trim()) {
      return setError('해결 처리하려면 해결 내용을 입력하세요.')
    }

    const data = {
      kind,
      title: title.trim(),
      startDate: kind === 'schedule' ? startDate : '',
      dueDate,
      status,
      priority,
      severity,
      issueStatus,
      resolution: resolution.trim(),
    }

    setBusy(true)
    try {
      if (editing) await updateTask(pid, editing, data)
      else await addTask(pid, data)
      onClose()
    } catch {
      setError('저장에 실패했습니다.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{editing ? (kind === 'issue' ? '이슈 수정' : '일정 수정') : '일정 · 이슈 등록'}</h2>

        {!editing && (
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={kind === 'schedule' ? 'on' : ''} onClick={() => setKind('schedule')}>📅 일정</button>
            <button type="button" className={kind === 'issue' ? 'on' : ''} onClick={() => setKind('issue')}>⚠ 이슈</button>
          </div>
        )}

        <div className="field">
          <label htmlFor="tk-title">제목 *</label>
          <input id="tk-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        {kind === 'schedule' ? (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="tk-start">시작일</label>
                <input id="tk-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="tk-due">마감일</label>
                <input id="tk-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="tk-status">상태</label>
                <select id="tk-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                  <option value="todo">예정</option>
                  <option value="doing">진행중</option>
                  <option value="done">완료</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="tk-priority">우선순위</label>
                <select id="tk-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="high">높음</option>
                  <option value="mid">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="tk-sev">심각도</label>
                <select id="tk-sev" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                  <option value="high">심각</option>
                  <option value="mid">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="tk-due2">처리 기한</label>
                <input id="tk-due2" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="tk-istatus">이슈 상태</label>
              <select id="tk-istatus" value={issueStatus} onChange={(e) => setIssueStatus(e.target.value as IssueStatus)}>
                <option value="open">열림</option>
                <option value="resolved">해결</option>
              </select>
            </div>
            {issueStatus === 'resolved' && (
              <div className="field">
                <label htmlFor="tk-res">해결 내용 *</label>
                <input id="tk-res" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="어떻게 해결했는지 기록" />
              </div>
            )}
          </>
        )}

        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy}>{editing ? '저장' : '등록'}</button>
        </div>
      </form>
    </div>
  )
}
