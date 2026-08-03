import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { isTextDoc, uploadDocument } from '../lib/documents'
import type { DocumentVersionRow } from '../types'

interface Props {
  pid: string
  existing: DocumentVersionRow[]
  onClose: () => void
}

export default function DocumentUploadModal({ pid, existing, onClose }: Props) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const existingNames = useMemo(
    () => [...new Set(existing.map((d) => d.name))].sort(),
    [existing],
  )

  const nextVersion = useMemo(() => {
    const sameName = existing.filter((d) => d.name === name.trim())
    return sameName.length === 0 ? 1 : Math.max(...sameName.map((d) => d.version)) + 1
  }, [existing, name])

  const handleFile = (f: File | null) => {
    setFile(f)
    // 문서 이름이 비어 있으면 파일명(확장자 제외)으로 자동 채움
    if (f && !name.trim()) {
      setName(f.name.replace(/\.[^.]+$/, ''))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('문서 이름을 입력하세요.')
    if (!file) return setError('파일을 선택하세요.')
    if (file.size > 20 * 1024 * 1024) return setError('20MB 이하 파일만 업로드할 수 있습니다.')

    setBusy(true)
    try {
      await uploadDocument(pid, name.trim(), file, existing, isPublic)
      onClose()
    } catch {
      setError('업로드에 실패했습니다. 잠시 후 다시 시도하세요.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>문서 업로드</h2>

        <div className="field">
          <label htmlFor="du-file">파일 *</label>
          <input
            id="du-file"
            ref={fileRef}
            type="file"
            accept=".md,.txt,.log,.csv,.json,.pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.zip,.png,.jpg"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <span className="hint">
              {isTextDoc(file.name)
                ? '✅ 텍스트 문서 — 내용 보기·버전 간 변경 비교(diff)를 지원합니다.'
                : 'ℹ️ 이 형식은 보관·다운로드를 지원합니다. 내용 비교는 md/txt 문서에서 지원됩니다 (HWP·PDF는 Phase 5의 AI 변환본 기준).'}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="du-name">문서 이름 *</label>
          <input
            id="du-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 요구사양서"
            list="doc-names"
          />
          <datalist id="doc-names">
            {existingNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <span className="hint">
            {existingNames.includes(name.trim())
              ? `기존 문서의 새 버전으로 등록됩니다 → v${nextVersion}`
              : '같은 이름으로 다시 올리면 자동으로 다음 버전(v2, v3…)이 됩니다.'}
          </span>
        </div>

        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          게스트 공개 — 게스트도 이 문서를 조회·다운로드 가능 (제품 사양서 등 제공용 문서만 권장)
        </label>

        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '업로드 중…' : `v${nextVersion}로 업로드`}
          </button>
        </div>
      </form>
    </div>
  )
}
