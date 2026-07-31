import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { addMetric, updateMetric } from '../lib/metrics'
import type { MetricPoint, MetricRow } from '../types'

interface Props {
  pid: string
  editing: MetricRow | null
  onClose: () => void
}

interface PointRow extends MetricPoint {
  id: string
}

export default function MetricFormModal({ pid, editing, onClose }: Props) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [points, setPoints] = useState<PointRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setUnit(editing.unit)
      setPoints(editing.points.map((p) => ({ ...p, id: crypto.randomUUID() })))
    }
  }, [editing])

  const currentMonth = new Date().toISOString().slice(0, 7)

  const addPoint = () =>
    setPoints([...points, { id: crypto.randomUUID(), month: currentMonth, value: 0 }])

  const setPoint = (id: string, patch: Partial<MetricPoint>) =>
    setPoints(points.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const removePoint = (id: string) => setPoints(points.filter((p) => p.id !== id))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('지표 이름을 입력하세요.')
    const months = points.map((p) => p.month)
    if (new Set(months).size !== months.length) return setError('같은 월이 중복 입력되었습니다.')

    const data = {
      name: name.trim(),
      unit: unit.trim(),
      points: points.map(({ month, value }) => ({ month, value: Number(value) || 0 })),
    }

    setBusy(true)
    try {
      if (editing) await updateMetric(pid, editing.id, data)
      else await addMetric(pid, data)
      onClose()
    } catch {
      setError('저장에 실패했습니다.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{editing ? '지표 수정' : '지표 추가'}</h2>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="mt-name">지표 이름 *</label>
            <input id="mt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 발전율, 월 사용량" required />
          </div>
          <div className="field">
            <label htmlFor="mt-unit">단위</label>
            <input id="mt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="예: %, kWh, 회" />
          </div>
        </div>

        <div className="goals-edit">
          <div className="row-between">
            <b>월별 값</b>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addPoint}>+ 값 추가</button>
          </div>
          {points.length === 0 && <p className="hint muted">월을 선택하고 해당 월의 값을 입력하세요.</p>}
          {points.map((p) => (
            <div key={p.id} className="goal-row">
              <input
                type="month"
                style={{ width: 150, flex: 'none' }}
                value={p.month}
                onChange={(e) => setPoint(p.id, { month: e.target.value })}
              />
              <input
                type="number"
                step="any"
                value={p.value}
                onChange={(e) => setPoint(p.id, { value: Number(e.target.value) })}
              />
              <span className="muted">{unit}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => removePoint(p.id)}>✕</button>
            </div>
          ))}
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy}>{editing ? '저장' : '추가'}</button>
        </div>
      </form>
    </div>
  )
}
