import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { isTextDoc, uploadDocument } from '../lib/documents'
import type { DocumentVersionRow } from '../types'

interface Props {
  pid: string
  existing: DocumentVersionRow[]
  onClose: () => void
}

interface UploadItem {
  id: string
  file: File
  name: string // 문서 이름 (기본값: 파일명에서 확장자 제거)
}

export default function DocumentUploadModal({ pid, existing, onClose }: Props) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const existingNames = useMemo(
    () => [...new Set(existing.map((d) => d.name))].sort(),
    [existing],
  )

  const handleFiles = (list: FileList | null) => {
    if (!list) return
    const added: UploadItem[] = [...list].map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.[^.]+$/, ''),
    }))
    setItems((prev) => [...prev, ...added])
  }

  const setItemName = (id: string, name: string) =>
    setItems(items.map((it) => (it.id === id ? { ...it, name } : it)))

  const removeItem = (id: string) => setItems(items.filter((it) => it.id !== id))

  /** 배치 내 같은 이름 반복까지 고려한 다음 버전 번호 */
  const nextVersionOf = (item: UploadItem): number => {
    const name = item.name.trim()
    const fromExisting = existing.filter((d) => d.name === name).map((d) => d.version)
    const before = items.slice(0, items.indexOf(item)).filter((it) => it.name.trim() === name).length
    return (fromExisting.length ? Math.max(...fromExisting) : 0) + before + 1
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (items.length === 0) return setError('파일을 선택하세요.')
    if (items.some((it) => !it.name.trim())) return setError('문서 이름이 빈 항목이 있습니다.')
    const oversize = items.find((it) => it.file.size > 20 * 1024 * 1024)
    if (oversize) return setError(`20MB 초과: ${oversize.file.name}`)

    setBusy(true)
    // 순차 업로드 — 같은 이름을 여러 개 올려도 배치 안에서 버전이 이어지도록
    const acc = [...existing]
    const remaining = [...items]
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      setProgress(`${i + 1}/${items.length} 업로드 중 — ${it.file.name}`)
      try {
        const row = await uploadDocument(pid, it.name.trim(), it.file, acc, isPublic)
        acc.push(row)
        remaining.shift()
      } catch {
        setItems(remaining)
        setError(`"${it.file.name}" 업로드에 실패했습니다. 남은 항목부터 다시 시도하세요.`)
        setBusy(false)
        setProgress('')
        return
      }
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>문서 업로드</h2>

        <div className="field">
          <label htmlFor="du-file">파일 (여러 개 선택 가능) *</label>
          <input
            id="du-file"
            type="file"
            multiple
            accept=".md,.txt,.log,.csv,.json,.pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.zip,.png,.jpg"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
          <span className="hint">
            Ctrl/Shift로 여러 파일을 한 번에 선택할 수 있고, 다시 선택하면 목록에 추가됩니다.
          </span>
        </div>

        {items.length > 0 && (
          <div className="goals-edit">
            <b>업로드 목록 ({items.length})</b>
            {items.map((it) => (
              <div key={it.id} className="upload-item">
                <div className="goal-row">
                  <input
                    value={it.name}
                    onChange={(e) => setItemName(it.id, e.target.value)}
                    placeholder="문서 이름"
                    list="doc-names"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <span className="d-ver">v{nextVersionOf(it)}</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeItem(it.id)}>✕</button>
                </div>
                <span className="muted upload-file">
                  {it.file.name}
                  {isTextDoc(it.file.name)
                    ? ' · 내용 보기·diff 지원'
                    : ' · 보관·다운로드 (비교는 md/txt)'}
                </span>
              </div>
            ))}
            <datalist id="doc-names">
              {existingNames.map((n) => <option key={n} value={n} />)}
            </datalist>
            <span className="hint">
              같은 이름의 문서가 있으면 자동으로 다음 버전(v2, v3…)이 됩니다.
            </span>
          </div>
        )}

        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          게스트 공개 — 게스트도 조회·다운로드 가능 (제공용 문서만 권장, 전체 항목에 적용)
        </label>

        {progress && <div className="msg msg-ok">{progress}</div>}
        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy || items.length === 0}>
            {busy ? '업로드 중…' : `${items.length}개 업로드`}
          </button>
        </div>
      </form>
    </div>
  )
}
