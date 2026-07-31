import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { addEquipment, updateEquipment } from '../lib/subitems'
import type { CommType, EquipStatus, EquipmentRow, IoPort, IoPortType } from '../types'

interface Props {
  pid: string
  editing: EquipmentRow | null
  onClose: () => void
}

export default function EquipmentFormModal({ pid, editing, onClose }: Props) {
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [commType, setCommType] = useState<CommType>('modbus-tcp')
  const [commNote, setCommNote] = useState('')
  const [status, setStatus] = useState<EquipStatus>('ok')
  const [ioPorts, setIoPorts] = useState<IoPort[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setIp(editing.ip)
      setCommType(editing.commType)
      setCommNote(editing.commNote)
      setStatus(editing.status)
      setIoPorts(editing.ioPorts)
    }
  }, [editing])

  const portsRef = useRef<HTMLDivElement>(null)

  /** IO 포트 표에서 Tab = 같은 열의 아래 행으로 (Shift+Tab = 위 행). 끝 행에서는 기본 이동 */
  const handleTabNav = (e: KeyboardEvent, row: number, col: string) => {
    if (e.key !== 'Tab') return
    const nextRow = e.shiftKey ? row - 1 : row + 1
    const target = portsRef.current?.querySelector<HTMLElement>(
      `[data-row="${nextRow}"][data-col="${col}"]`,
    )
    if (target) {
      e.preventDefault()
      target.focus()
    }
  }

  const addPort = () =>
    setIoPorts([...ioPorts, { id: crypto.randomUUID(), port: '', type: 'DI', desc: '' }])

  const setPort = (id: string, patch: Partial<IoPort>) =>
    setIoPorts(ioPorts.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const removePort = (id: string) => setIoPorts(ioPorts.filter((p) => p.id !== id))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('장비명을 입력하세요.')

    const data = {
      name: name.trim(),
      ip: ip.trim(),
      commType,
      commNote: commNote.trim(),
      status,
      ioPorts: ioPorts.filter((p) => p.port.trim() !== ''),
    }

    setBusy(true)
    try {
      if (editing) await updateEquipment(pid, editing.id, data)
      else await addEquipment(pid, data)
      onClose()
    } catch {
      setError('저장에 실패했습니다.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{editing ? '장비 수정' : '장비 등록'}</h2>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="eq-name">장비명 *</label>
            <input id="eq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 메인 PLC" required />
          </div>
          <div className="field">
            <label htmlFor="eq-ip">IP / 포트</label>
            <input id="eq-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="예: 192.168.0.10 또는 COM3" />
          </div>
        </div>

        <div className="form-grid form-grid-3">
          <div className="field">
            <label htmlFor="eq-comm">통신 방식</label>
            <select id="eq-comm" value={commType} onChange={(e) => setCommType(e.target.value as CommType)}>
              <option value="modbus-tcp">Modbus TCP</option>
              <option value="modbus-rtu">Modbus RTU (Serial)</option>
              <option value="can">CAN</option>
              <option value="rs232">RS-232</option>
              <option value="rs485">RS-485</option>
              <option value="ethernet">Ethernet</option>
              <option value="etc">기타</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="eq-note">통신 메모</label>
            <input id="eq-note" value={commNote} onChange={(e) => setCommNote(e.target.value)} placeholder="예: 9600bps, slave 1" />
          </div>
          <div className="field">
            <label htmlFor="eq-status">장비 상태</label>
            <select id="eq-status" value={status} onChange={(e) => setStatus(e.target.value as EquipStatus)}>
              <option value="ok">정상</option>
              <option value="repair">수리중</option>
              <option value="returned">반납</option>
            </select>
          </div>
        </div>

        {/* IO 포트 목록 */}
        <div className="goals-edit">
          <div className="row-between">
            <b>IO 포트</b>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addPort}>+ 포트 추가</button>
          </div>
          {ioPorts.length === 0 && <p className="hint muted">등록된 IO 포트가 없습니다.</p>}
          <div ref={portsRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ioPorts.map((p, i) => (
              <div key={p.id} className="goal-row">
                <input
                  style={{ width: 72, flex: 'none' }}
                  data-row={i}
                  data-col="port"
                  value={p.port}
                  onChange={(e) => setPort(p.id, { port: e.target.value })}
                  onKeyDown={(e) => handleTabNav(e, i, 'port')}
                  placeholder="포트"
                />
                <select
                  className="io-type"
                  data-row={i}
                  data-col="type"
                  value={p.type}
                  onChange={(e) => setPort(p.id, { type: e.target.value as IoPortType })}
                  onKeyDown={(e) => handleTabNav(e, i, 'type')}
                >
                  <option value="DI">DI</option>
                  <option value="DO">DO</option>
                  <option value="AI">AI</option>
                  <option value="AO">AO</option>
                  <option value="COMM">통신</option>
                  <option value="ETC">기타</option>
                </select>
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  data-row={i}
                  data-col="desc"
                  value={p.desc}
                  onChange={(e) => setPort(p.id, { desc: e.target.value })}
                  onKeyDown={(e) => handleTabNav(e, i, 'desc')}
                  placeholder="용도 (예: 비상정지 입력)"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  title="이 포트 삭제"
                  onClick={() => removePort(p.id)}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy}>{editing ? '저장' : '등록'}</button>
        </div>
      </form>
    </div>
  )
}
