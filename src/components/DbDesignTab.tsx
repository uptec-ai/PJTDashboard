import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { DbDesign, ProjectRow } from '../types'

/** DB 테이블 설계 — 테이블별 컬럼 정의 표 + 기능 한 줄 요약 (회원 이상 전용) */
export default function DbDesignTab({ project }: { project: ProjectRow }) {
  // 회원 전용 데이터라 프로젝트 문서가 아닌 별도 하위 문서(design/db)에 저장한다
  const [design, setDesign] = useState<DbDesign | null>(null)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'projects', project.id, 'design', 'db'),
      (snap) => setDesign(snap.exists() ? (snap.data() as DbDesign) : null),
      () => setDesign(null),
    )
  }, [project.id])

  if (!design || design.tables.length === 0) {
    return (
      <section className="panel">
        <h3>DB 설계</h3>
        <div className="empty">
          등록된 DB 설계가 없습니다.
          <br />Claude Code로 업데이트("대시보드에 올려줘")하면 프로젝트의 스키마 파일을 분석해 자동으로 채워집니다.
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="panel">
        <div className="db-head">
          <h3>🗄 {design.dbName}</h3>
          <span className="muted">테이블 {design.tables.length}개</span>
        </div>
        {design.note && <p className="db-note muted">{design.note}</p>}
      </section>

      {design.tables.map((t) => (
        <section key={t.name} className="panel">
          <div className="db-table-head">
            <h3 className="mono-title">{t.name}</h3>
            <span className="db-summary">{t.summary}</span>
          </div>
          <div className="table-wrap">
            <table className="list db-cols">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>컬럼</th>
                  <th style={{ width: '26%' }}>타입</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {t.columns.map((c) => (
                  <tr key={c.name}>
                    <td className="mono">{c.name}</td>
                    <td className="mono muted">{c.type}</td>
                    <td>{c.desc ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  )
}
