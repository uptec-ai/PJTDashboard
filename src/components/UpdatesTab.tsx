import { useEffect, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { UPDATE_KIND_LABEL } from '../types'
import type { UpdateEntry, UpdateEntryRow } from '../types'

const KIND_CLASS: Record<string, string> = {
  feature: 'chip-accent',
  view: 'chip-good',
  db: 'chip-warn',
  comm: 'chip-mute',
  fix: 'chip-crit',
  etc: 'chip-mute',
}

/** 프로그램 업데이트 이력 — 기능/화면/DB/통신 등 굵직한 변경만 기록 */
export default function UpdatesTab({ pid }: { pid: string }) {
  const [rows, setRows] = useState<UpdateEntryRow[]>([])

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'updates')), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as UpdateEntry) }))
      list.sort((a, b) => b.date.localeCompare(a.date))
      setRows(list)
    })
  }, [pid])

  return (
    <section className="panel">
      <h3>업데이트 이력 ({rows.length})</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
        기능·화면·DB·통신 등 굵직한 변경 기록입니다. Claude Code로 업데이트("대시보드에 올려줘")할 때 자동으로 쌓입니다.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          아직 업데이트 이력이 없습니다.
          <br />프로젝트 폴더에서 "대시보드에 올려줘"라고 하면 주요 변경이 기록됩니다.
        </div>
      ) : (
        <div className="timeline">
          {rows.map((r) => (
            <div key={r.id} className="tl-item">
              <span className="tl-date-col mono muted">{r.date}</span>
              <span className={`chip ${KIND_CLASS[r.kind] ?? 'chip-mute'}`}>
                {UPDATE_KIND_LABEL[r.kind] ?? r.kind}
              </span>
              <div className="tl-main">
                <div className="tl-summary" style={{ color: 'var(--ink)' }}>{r.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
