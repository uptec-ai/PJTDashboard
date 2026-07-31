import { useEffect, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deleteMetric, latestDelta } from '../lib/metrics'
import MetricChart from './MetricChart'
import MetricFormModal from './MetricFormModal'
import type { Metric, MetricRow } from '../types'

interface Props {
  pid: string
  canEdit: boolean
}

/** 부가효과 지표 — 발전율·사용량 등 프로젝트 성과 지표 (단일 패널, 게스트에게도 공개) */
export default function MetricsSection({ pid, canEdit }: Props) {
  const [rows, setRows] = useState<MetricRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MetricRow | null>(null)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'metrics')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Metric) }))),
    )
  }, [pid])

  const openNew = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (r: MetricRow) => { setEditing(r); setModalOpen(true) }

  const handleDelete = async (r: MetricRow) => {
    if (!confirm(`지표 "${r.name}"을(를) 삭제할까요?`)) return
    try { await deleteMetric(pid, r.id) } catch { alert('삭제에 실패했습니다.') }
  }

  if (rows.length === 0 && !canEdit) return null

  const fmtVal = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

  return (
    <>
      <section className="panel">
        <div className="row-between">
          <h3>부가효과 지표</h3>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={openNew}>+ 지표 추가</button>}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            발전율·사용량처럼 프로젝트의 성과를 보여주는 지표를 등록하면 월별 차트로 표시됩니다.
          </div>
        ) : (
          rows.map((r, idx) => {
            const { last, delta } = latestDelta(r.points)
            return (
              <div key={r.id} className={`metric-block ${idx > 0 ? 'metric-block-sep' : ''}`}>
                <div className="row-between">
                  <b style={{ fontSize: 13.5 }}>{r.name}</b>
                  {canEdit && (
                    <span style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>편집</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                    </span>
                  )}
                </div>
                {last && (
                  <div className="metric-summary">
                    <span className="m-value">
                      {fmtVal(last.value)}<small>{r.unit}</small>
                    </span>
                    <span className="m-month muted">{last.month}</span>
                    {delta !== null && (
                      <span className={`m-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                        {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {fmtVal(Math.abs(delta))}{r.unit}
                        <small> 전월 대비</small>
                      </span>
                    )}
                  </div>
                )}
                <MetricChart points={r.points} unit={r.unit} />
              </div>
            )
          })
        )}
      </section>

      {modalOpen && <MetricFormModal pid={pid} editing={editing} onClose={() => setModalOpen(false)} />}
    </>
  )
}
