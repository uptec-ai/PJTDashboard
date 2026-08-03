import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { deleteDocumentVersion, downloadDocument, formatSize, setDocumentPublic } from '../lib/documents'
import DocumentUploadModal from './DocumentUploadModal'
import DocumentViewerModal from './DocumentViewerModal'
import type { DocumentVersion, DocumentVersionRow } from '../types'

interface Props {
  pid: string
  canEdit: boolean
}

type DocSortKey = 'created' | 'modified' | 'name'

const toMillis = (v: unknown): number =>
  v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis: () => number }).toMillis() : 0

export default function DocumentsTab({ pid, canEdit }: Props) {
  const { user } = useAuth()
  const isGuest = user?.isAnonymous ?? false
  const [rows, setRows] = useState<DocumentVersionRow[]>([])
  const [sortKey, setSortKey] = useState<DocSortKey>('created')
  const [asc, setAsc] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewing, setViewing] = useState<DocumentVersionRow | null>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    // 게스트는 공개 문서만 (보안 규칙과 일치하는 조건)
    const base = collection(db, 'projects', pid, 'documents')
    const q = isGuest ? query(base, where('isPublic', '==', true)) : query(base)
    return onSnapshot(q, (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentVersion) }))),
    )
  }, [pid, isGuest])

  // 문서 이름별 그룹, 각 그룹은 버전 내림차순. 그룹 정렬: 등록순/수정일순/이름순 × 오름/내림
  const groups = useMemo(() => {
    const map = new Map<string, DocumentVersionRow[]>()
    for (const r of rows) {
      const list = map.get(r.name) ?? []
      list.push(r)
      map.set(r.name, list)
    }
    for (const list of map.values()) list.sort((a, b) => b.version - a.version)

    const firstCreated = (list: DocumentVersionRow[]) =>
      Math.min(...list.map((d) => toMillis(d.createdAt) || Number.MAX_SAFE_INTEGER))
    // PC 파일의 "수정한 날짜" 기준 (미보존 문서는 업로드 시점으로 대체)
    const lastFileModified = (list: DocumentVersionRow[]) =>
      Math.max(...list.map((d) => d.fileModifiedAt ?? toMillis(d.createdAt)))

    const entries = [...map.entries()]
    entries.sort((a, b) => {
      let cmp: number
      if (sortKey === 'name') cmp = a[0].localeCompare(b[0], 'ko')
      else if (sortKey === 'modified') cmp = lastFileModified(a[1]) - lastFileModified(b[1])
      else cmp = firstCreated(a[1]) - firstCreated(b[1]) // 최초 등록 순
      return asc ? cmp : -cmp
    })
    return entries
  }, [rows, sortKey, asc])

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
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as DocSortKey)}>
            <option value="created">정렬: 등록순 (대시보드에 올린 순)</option>
            <option value="modified">정렬: 파일 수정일순 (PC 수정 날짜)</option>
            <option value="name">정렬: 이름순</option>
          </select>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title={asc ? '오름차순 (클릭하면 내림차순)' : '내림차순 (클릭하면 오름차순)'}
            onClick={() => setAsc(!asc)}
          >
            {asc ? '▲ 오름차순' : '▼ 내림차순'}
          </button>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={() => setUploadOpen(true)}>+ 문서 업로드</button>}
        </span>
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
                {r.isPublic && <span className="chip chip-accent">🌐 게스트 공개</span>}
                {r.diffAdded !== null && (
                  <span className="diff">
                    <span className="add">+{r.diffAdded}줄</span>{' '}
                    <span className="del">−{r.diffRemoved}줄</span>
                  </span>
                )}
                <span className="muted d-size">{formatSize(r.size)}</span>
                {r.fileModifiedAt != null && (
                  <span className="muted d-size" title="PC에서 파일을 마지막 수정한 날짜">
                    수정 {new Date(r.fileModifiedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                  </span>
                )}
                <span className="d-actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleDownload(r)}
                    disabled={busyId === r.id}
                  >
                    ⬇ 다운로드
                  </button>
                  {canEdit && (
                    <>
                      <button
                        className="btn btn-sm btn-ghost"
                        title={r.isPublic ? '게스트 공개 해제' : '게스트에게 공개'}
                        onClick={() => setDocumentPublic(pid, r, !r.isPublic).catch(() => alert('변경 실패'))}
                      >
                        {r.isPublic ? '비공개로' : '공개로'}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                    </>
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
