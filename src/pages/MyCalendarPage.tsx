import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import koLocale from '@fullcalendar/core/locales/ko'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventInput } from '@fullcalendar/core'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import type { PersonalEvent, PersonalEventRow } from '../types'

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 개인 일정 관리 — 완전 비공개 (본인 계정만 접근, 마스터도 열람 불가) */
export default function MyCalendarPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<PersonalEventRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalEventRow | null>(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(query(collection(db, 'users', user.uid, 'events')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as PersonalEvent) }))),
    )
  }, [user])

  const events: EventInput[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        start: r.startDate,
        end: r.endDate ? addDays(r.endDate, 1) : undefined, // FullCalendar end는 미포함
        allDay: true,
        classNames: ['ev-schedule'],
      })),
    [rows],
  )

  const openNew = (date?: string) => {
    setEditing(null)
    setTitle('')
    setStartDate(date ?? new Date().toISOString().slice(0, 10))
    setEndDate('')
    setMemo('')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (r: PersonalEventRow) => {
    setEditing(r)
    setTitle(r.title)
    setStartDate(r.startDate)
    setEndDate(r.endDate)
    setMemo(r.memo)
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return
    if (!title.trim()) return setError('일정 제목을 입력하세요.')
    if (!startDate) return setError('시작일을 선택하세요.')
    if (endDate && endDate < startDate) return setError('종료일이 시작일보다 빠릅니다.')

    const data = { title: title.trim(), startDate, endDate, memo: memo.trim() }
    setBusy(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'users', user.uid, 'events', editing.id), data)
      } else {
        await addDoc(collection(db, 'users', user.uid, 'events'), { ...data, createdAt: serverTimestamp() })
      }
      setModalOpen(false)
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !editing) return
    if (!confirm(`"${editing.title}" 일정을 삭제할까요?`)) return
    await deleteDoc(doc(db, 'users', user.uid, 'events', editing.id)).catch(() => alert('삭제 실패'))
    setModalOpen(false)
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="page-head">
          <h1>📆 개인 일정 <span className="chip chip-mute">🔒 비공개</span></h1>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link to="/" className="btn btn-sm btn-ghost">← 대시보드</Link>
            <button className="btn btn-sm btn-primary" onClick={() => openNew()}>+ 일정 추가</button>
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -10 }}>
          본인 계정에서만 보이는 개인 캘린더입니다. 날짜를 클릭해 일정을 등록하세요.
        </p>

        <section className="panel">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={koLocale}
            events={events}
            dateClick={(arg: DateClickArg) => openNew(arg.dateStr)}
            eventClick={(arg: EventClickArg) => {
              const r = rows.find((x) => x.id === arg.event.id)
              if (r) openEdit(r)
            }}
            height="auto"
            dayMaxEventRows={3}
          />
        </section>
      </main>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>{editing ? '일정 수정' : '일정 추가'}</h2>
            <div className="field">
              <label htmlFor="pe-title">제목 *</label>
              <input id="pe-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pe-start">시작일 *</label>
                <input id="pe-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="pe-end">종료일 (선택)</label>
                <input id="pe-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pe-memo">메모 (선택)</label>
              <textarea id="pe-memo" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            {editing?.memo && !memo && null}
            {error && <div className="msg msg-error">{error}</div>}
            <div className="modal-actions">
              {editing && (
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} style={{ marginRight: 'auto' }}>
                  삭제
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={busy}>취소</button>
              <button className="btn btn-primary" disabled={busy}>{editing ? '저장' : '추가'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
