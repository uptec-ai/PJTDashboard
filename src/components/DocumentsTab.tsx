import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deleteDocumentVersion, downloadDocument, formatSize } from '../lib/documents'
import DocumentUploadModal from './DocumentUploadModal'
import DocumentViewerModal from './DocumentViewerModal'
import type { DocumentVersion, DocumentVersionRow } from '../types'

interface Props {
  pid: string
  canEdit: boolean
}

export default function DocumentsTab({ pid, canEdit }: Props) {
  const [rows, setRows] = useState<DocumentVersionRow[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewing, setViewing] = useState<DocumentVersionRow | null>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'documents')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentVersion) }))),
    )
  }, [pid])

  // 문서 이름별 그룹, 각 그룹은 버전 내림차순
  const groups = useMemo(() => {
    const map = new Map<string, DocumentVersionRow[]>()
    for (const r of rows) {
      const list = map.get(r.name) ?? []
      list.push(r)
      map.set(r.name, list)
    }
    for (const list of map.values()) list.sort((a, b) => b.version - a.version)
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const handleDownload = async (r: DocumentVersionRow) => {
    setBusyId(r.id)
    try {
      await downloadDocument(r)
    } catch {
      alert('다운로드에 실패했습니다.')
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async (r: DocumentVersionRow) => {
    if (!confirm(`"${r.name}" v${r.version}을(를) 삭제할까요?`)) return
    try {
      await deleteDocumentVersion(pid, r)
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  /** diff 보기: 같은 이름의 바로 이전 버전을 찾아 뷰어에 넘긴다 */
  const prevOf = (r: DocumentVersionRow): DocumentVersionRow | null => {
    const list = groups.find(([name]) => name === r.name)?.[1] ?? []
    return list.find((d) => d.version < r.version) ?? null
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h3>문서 ({rows.length})</h3>
        {canEdit && <button className="btn btn-sm btn-primary" onClick={() => setUploadOpen(true)}>+ 문서 업로드</button>}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          등록된 문서가 없습니다.
          {canEdit && <><br />md/txt 문서는 내용 보기와 버전 간 변경 비교(diff)를 지원합니다.</>}
        </div>
      ) : (
        groups.map(([name, list]) => (
          <div key={name} className="doc-group">
            <div className="doc-group-head">
              📄 <b>{name}</b>
              <span className="muted">최신 v{list[0].version} · {list.length}개 버전</span>
            </div>
            {list.map((r) => (
              <div key={r.id} className="doc">
                <span className="d-ver">v{r.version}</span>
                <button className="d-name" onClick={() => setViewing(r)} title="내용 보기">
                  {r.fileName}
                </button>
                <span className={`by ${r.source === 'ai' ? 'by-ai' : 'by-user'}`}>
                  {r.source === 'ai' ? 'AI 재작성' : r.version === 1 ? '원본' : '사용자'}
                </span>
                {r.diffAdded !== null && (
                  <span className="diff">
                    <span className="add">+{r.diffAdded}줄</span>{' '}
                    <span className="del">−{r.diffRemoved}줄</span>
                  </span>
                )}
                <span className="muted d-size">{formatSize(r.size)}</span>
                <span className="d-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleDownload(r)}
                    disabled={busyId === r.id}
                  >
                    ⬇ 다운로드
                  </button>
                  {canEdit && (
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))
      )}

      {uploadOpen && (
        <DocumentUploadModal
          pid={pid}
          existing={rows}
          onClose={() => setUploadOpen(false)}
        />
      )}
      {viewing && (
        <DocumentViewerModal
          row={viewing}
          prev={prevOf(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  )
}
