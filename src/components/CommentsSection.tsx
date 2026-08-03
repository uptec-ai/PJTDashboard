import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { addComment, deleteComment, setCommentAcked } from '../lib/comments'
import type { Comment, CommentRow } from '../types'

const toMillis = (v: unknown): number =>
  v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis: () => number }).toMillis() : 0

function formatAt(at: unknown): string {
  if (at && typeof at === 'object' && 'toDate' in at) {
    return (at as { toDate: () => Date }).toDate().toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }
  return ''
}

interface Props {
  pid: string
  canManage: boolean // 마스터/소유자 — 확인 표시·삭제 가능
}

/** 요청·코멘트 — 게스트(거래처)가 목표·동작 설명에 대한 추가/수정 요청을 남기는 창구 */
export default function CommentsSection({ pid, canManage }: Props) {
  const { user, profile } = useAuth()
  const isGuest = user?.isAnonymous ?? false
  const [rows, setRows] = useState<CommentRow[]>([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'comments')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Comment) }))
      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      setRows(list)
    })
  }, [pid])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return
    if (!text.trim()) return setError('내용을 입력하세요.')

    setBusy(true)
    try {
      await addComment(pid, {
        author: isGuest ? (name.trim() || '게스트') : (profile?.name ?? '회원'),
        role: isGuest ? 'guest' : (profile?.role ?? 'personal'),
        text: text.trim(),
        authorUid: user.uid,
      })
      setText('')
    } catch {
      setError('등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (r: CommentRow) => {
    if (!confirm('이 코멘트를 삭제할까요?')) return
    try { await deleteComment(pid, r.id) } catch { alert('삭제에 실패했습니다.') }
  }

  const openCount = rows.filter((r) => !r.acked).length

  return (
    <section className="panel">
      <h3>
        요청 · 코멘트 ({rows.length})
        {openCount > 0 && canManage && <span className="tab-badge" style={{ marginLeft: 6 }}>{openCount}</span>}
      </h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
        목표·동작 설명에 대한 추가/수정 요청을 남겨주세요. {canManage && '관리자는 확인 처리·삭제할 수 있습니다.'}
      </p>

      {/* 작성 폼 */}
      <form onSubmit={handleSubmit} className="comment-form">
        {isGuest && (
          <input
            className="comment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (선택)"
            maxLength={30}
          />
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="요청 내용 (예: 목표에 ○○ 항목 추가 부탁드립니다)"
        />
        {error && <div className="msg msg-error">{error}</div>}
        <button className="btn btn-primary btn-sm" disabled={busy} style={{ alignSelf: 'flex-end' }}>
          등록
        </button>
      </form>

      {/* 목록 */}
      {rows.length === 0 ? (
        <div className="empty">아직 코멘트가 없습니다.</div>
      ) : (
        <div className="comment-list">
          {rows.map((r) => (
            <div key={r.id} className={`comment-item ${r.acked ? 'comment-acked' : ''}`}>
              <div className="comment-head">
                <b>{r.author}</b>
                <span className={`by ${r.role === 'guest' ? 'by-user' : 'by-ai'}`}>
                  {r.role === 'guest' ? '게스트' : r.role === 'master' ? '마스터' : '회원'}
                </span>
                {r.acked && <span className="chip chip-good">✓ 확인됨</span>}
                <span className="muted comment-date">{formatAt(r.createdAt)}</span>
              </div>
              <div className="comment-text">{r.text}</div>
              {(canManage || r.authorUid === user?.uid) && (
                <div className="comment-actions">
                  {canManage && (
                    <button className="btn btn-sm btn-ghost" onClick={() => setCommentAcked(pid, r.id, !r.acked)}>
                      {r.acked ? '확인 취소' : '확인함'}
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
