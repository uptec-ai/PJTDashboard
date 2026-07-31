import { useEffect, useMemo, useState } from 'react'
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

type SortKey = 'created' | 'name' | 'ip'

const toMillis = (v: unknown): number =>
  v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis: () => number }).toMillis() : 0

export default function EquipmentTab({ pid, canEdit }: Props) {
  const [rows, setRows] = useState<EquipmentRow[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRow | null>(null)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'projects', pid, 'equipment')), (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Equipment) }))),
    )
  }, [pid])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sortKey === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    } else if (sortKey === 'ip') {
      // 숫자 인식 정렬: 192.168.0.2 < 192.168.0.10, COM3 < COM10. IP 없는 장비는 뒤로
      list.sort((a, b) => {
        if (!a.ip && !b.ip) return 0
        if (!a.ip) return 1
        if (!b.ip) return -1
        return a.ip.localeCompare(b.ip, undefined, { numeric: true })
      })
    } else {
      list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)) // 등록 순서
    }
    return list
  }, [rows, sortKey])

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
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="created">정렬: 등록순</option>
            <option value="name">정렬: 장비명순</option>
            <option value="ip">정렬: IP순</option>
          </select>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={openNew}>+ 장비 등록</button>}
        </span>
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
              {sorted.map((r) => (
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
