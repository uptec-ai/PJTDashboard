import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import type { StudyNote, StudyNoteRow } from '../types'

const toMillis = (v: unknown): number =>
  v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis: () => number }).toMillis() : 0

function formatAt(v: unknown): string {
  if (v && typeof v === 'object' && 'toDate' in v) {
    return (v as { toDate: () => Date }).toDate().toLocaleDateString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
    })
  }
  return ''
}

/** Study — 개인 공부 메모 (완전 비공개, 본인 계정만) */
export default function MyStudyPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<StudyNoteRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(query(collection(db, 'users', user.uid, 'notes')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as StudyNote) }))
      list.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt))
      setRows(list)
    })
  }, [user])

  const select = (r: StudyNoteRow) => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 이동할까요?')) return
    setSelectedId(r.id)
    setTitle(r.title)
    setContent(r.content)
    setDirty(false)
  }

  const handleNew = async () => {
    if (!user) return
    const ref = await addDoc(collection(db, 'users', user.uid, 'notes'), {
      title: '새 노트',
      content: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setSelectedId(ref.id)
    setTitle('새 노트')
    setContent('')
    setDirty(false)
  }

  const handleSave = async () => {
    if (!user || !selectedId) return
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notes', selectedId), {
        title: title.trim() || '제목 없음',
        content,
        updatedAt: serverTimestamp(),
      })
      setDirty(false)
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !selectedId) return
    if (!confirm('이 노트를 삭제할까요?')) return
    await deleteDoc(doc(db, 'users', user.uid, 'notes', selectedId)).catch(() => alert('삭제 실패'))
    setSelectedId(null)
    setTitle('')
    setContent('')
    setDirty(false)
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="page-head">
          <h1>📚 Study <span className="chip chip-mute">🔒 비공개</span></h1>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link to="/" className="btn btn-sm btn-ghost">← 대시보드</Link>
            <button className="btn btn-sm btn-primary" onClick={handleNew}>+ 새 노트</button>
          </span>
        </div>

        <div className="study-grid">
          {/* 노트 목록 */}
          <section className="panel study-list">
            {rows.length === 0 ? (
              <div className="empty">노트가 없습니다.<br />"+ 새 노트"로 시작하세요.</div>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  className={`study-item ${selectedId === r.id ? 'on' : ''}`}
                  onClick={() => select(r)}
                >
                  <span className="study-title">{r.title || '제목 없음'}</span>
                  <span className="muted study-date">{formatAt(r.updatedAt)}</span>
                </button>
              ))
            )}
          </section>

          {/* 편집기 */}
          <section className="panel study-editor">
            {!selectedId ? (
              <div className="empty">왼쪽에서 노트를 선택하거나 새 노트를 만드세요.</div>
            ) : (
              <>
                <div className="row-between">
                  <input
                    className="study-title-input"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                    placeholder="제목"
                  />
                  <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={busy || !dirty}>
                      {dirty ? '저장' : '저장됨'}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={handleDelete}>삭제</button>
                  </span>
                </div>
                <textarea
                  className="study-content"
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true) }}
                  placeholder="공부 내용을 자유롭게 기록하세요…"
                />
              </>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
