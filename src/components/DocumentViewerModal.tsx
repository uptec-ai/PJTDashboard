import { useEffect, useMemo, useState } from 'react'
import { diffLines } from '../lib/diff'
import { downloadDocument, fileExt, getPreviewUrl } from '../lib/documents'
import type { DocumentVersionRow } from '../types'

type Mode = 'content' | 'diff'

interface Props {
  row: DocumentVersionRow
  prev: DocumentVersionRow | null // 같은 문서의 바로 이전 버전
  onClose: () => void
}

export default function DocumentViewerModal({ row, prev, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('content')
  const [pdfUrl, setPdfUrl] = useState('')
  const isPdf = fileExt(row.fileName) === 'pdf'
  const hasText = row.textContent != null
  const canDiff = hasText && prev?.textContent != null

  // PDF는 브라우저 내장 뷰어로 미리보기
  useEffect(() => {
    if (!isPdf) return
    let url = ''
    getPreviewUrl(row).then((u) => {
      url = u
      setPdfUrl(u)
    }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [row, isPdf])

  const diffOps = useMemo(() => {
    if (!canDiff || mode !== 'diff') return []
    return diffLines(prev!.textContent!, row.textContent!)
  }, [canDiff, mode, prev, row])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>📄 {row.name} <span className="d-ver">v{row.version}</span></h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕ 닫기</button>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>{row.fileName}</div>

        {canDiff && (
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button className={mode === 'content' ? 'on' : ''} onClick={() => setMode('content')}>내용</button>
            <button className={mode === 'diff' ? 'on' : ''} onClick={() => setMode('diff')}>
              변경사항 (v{prev!.version} → v{row.version})
            </button>
          </div>
        )}

        {mode === 'diff' && canDiff ? (
          <div className="doc-body diff-view">
            {diffOps.map((op, i) => (
              <div key={i} className={`diff-line diff-${op.type}`}>
                <span className="diff-mark">{op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}</span>
                {op.line || ' '}
              </div>
            ))}
          </div>
        ) : hasText ? (
          <pre className="doc-body">{row.textContent}</pre>
        ) : isPdf ? (
          pdfUrl
            ? <iframe className="pdf-frame" src={pdfUrl} title={row.fileName} />
            : <div className="empty">PDF 불러오는 중…</div>
        ) : (
          <div className="empty">
            이 형식({fileExt(row.fileName).toUpperCase()})은 미리보기를 지원하지 않습니다.
            <br />다운로드해서 확인하거나, Phase 5의 AI 변환본(텍스트)을 이용하세요.
            <br /><br />
            <button className="btn btn-sm btn-ghost" onClick={() => downloadDocument(row)}>⬇ 다운로드</button>
          </div>
        )}
      </div>
    </div>
  )
}
