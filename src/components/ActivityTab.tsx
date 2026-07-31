import { useEffect, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'

interface ActivityEntry {
  id: string
  type: string // register | update | doc ...
  by: string // claude-code | user
  summary: string
  sourcePath: string
  docCount?: number
  at?: unknown
}

const TYPE_ICON: Record<string, string> = {
  register: '✨',
  update: '🔄',
  doc: '📄',
}

const TYPE_LABEL: Record<string, string> = {
  register: '최초 등록',
  update: '업데이트',
  doc: '문서 업로드',
}

function formatAt(at: unknown): string {
  if (at && typeof at === 'object' && 'toDate' in at) {
    return (at as { toDate: () => Date }).toDate().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }
  return ''
}

function toMillis(at: unknown): number {
  if (at && typeof at === 'object' && 'toMillis' in at) {
    return (at as { toMillis: () => number }).toMillis()
  }
  return 0
}

export default function ActivityTab({ pid }: { pid: string }) {
  const [rows, setRows] = useState<ActivityEntry[]>([])

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'activity')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityEntry, 'id'>) }))
      list.sort((a, b) => toMillis(b.at) - toMillis(a.at))
      setRows(list)
    })
  }, [pid])

  return (
    <section className="panel">
      <h3>연동 이력 ({rows.length})</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
        Claude Code("대시보드에 올려줘")가 이 프로젝트를 언제 어떻게 갱신했는지의 기록입니다.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          아직 연동 이력이 없습니다.
          <br />다른 프로젝트 폴더에서 Claude Code에 "대시보드에 올려줘"라고 하면 여기에 기록됩니다.
        </div>
      ) : (
        <div className="timeline">
          {rows.map((r) => (
            <div key={r.id} className="tl-item">
              <span className="tl-icon">{TYPE_ICON[r.type] ?? '•'}</span>
              <div className="tl-main">
                <div className="tl-head">
                  <b>{TYPE_LABEL[r.type] ?? r.type}</b>
                  <span className={`by ${r.by === 'claude-code' ? 'by-ai' : 'by-user'}`}>
                    {r.by === 'claude-code' ? '🤖 Claude Code' : '사용자'}
                  </span>
                  {(r.docCount ?? 0) > 0 && <span className="chip chip-accent">📄 문서 {r.docCount}건</span>}
                  <span className="muted tl-date">{formatAt(r.at)}</span>
                </div>
                {r.summary && <div className="tl-summary">{r.summary}</div>}
                {r.sourcePath && <div className="muted tl-path">{r.sourcePath}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
