import { useEffect, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deleteEquipment } from '../lib/subitems'
import EquipmentFormModal from './EquipmentFormModal'
import { COMM_LABEL, EQUIP_STATUS_LABEL } from '../types'
import type { Equipment, EquipmentRow } from '../types'

const STATUS_CLASS: Record<string, string> = {
  ok: 'chip-good',
  repair: 'chip-warn',
  returned: 'chip-mute',
}

interface Props {
  pid: string
  canEdit: boolean
}

export default function EquipmentTab({ pid, canEdit }: Props) {
  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRow | null>(null)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'equipment')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Equipment) }))),
    )
  }, [pid])

  const openNew = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (r: EquipmentRow) => { setEditing(r); setModalOpen(true) }

  const handleDelete = async (r: EquipmentRow) => {
    if (!confirm(`장비 "${r.name}"을(를) 삭제할까요?`)) return
    try { await deleteEquipment(pid, r.id) } catch { alert('삭제에 실패했습니다.') }
  }

  return (
    <section className="panel">
      <div className="row-between">
        <h3>투입 장비 ({rows.length})</h3>
        {canEdit && <button className="btn btn-sm btn-primary" onClick={openNew}>+ 장비 등록</button>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">등록된 장비가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>장비명</th><th>IP / 포트</th><th>통신</th><th>IO 포트</th><th>상태</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.ip || '—'}</td>
                  <td>
                    {COMM_LABEL[r.commType]}
                    {r.commNote && <span className="muted"> · {r.commNote}</span>}
                  </td>
                  <td>
                    {r.ioPorts.length === 0 ? '—' : (
                      <span title={r.ioPorts.map((p) => `${p.port}(${p.type}) ${p.desc}`.trim()).join('\n')}>
                        {r.ioPorts.length}개
                        <span className="muted"> · {r.ioPorts.slice(0, 3).map((p) => p.port).join(', ')}{r.ioPorts.length > 3 ? '…' : ''}</span>
                      </span>
                    )}
                  </td>
                  <td><span className={`chip ${STATUS_CLASS[r.status]}`}>{EQUIP_STATUS_LABEL[r.status]}</span></td>
                  {canEdit && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>수정</button>{' '}
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r)}>삭제</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <EquipmentFormModal pid={pid} editing={editing} onClose={() => setModalOpen(false)} />}
    </section>
  )
}
