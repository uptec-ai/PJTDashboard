import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { computeProgress, createProject, updateProject } from '../lib/projects'
import { useAuth } from '../contexts/AuthContext'
import type { Goal, GoalItem, Priority, ProjectCategory, ProjectRow, ProjectStatus } from '../types'

interface Props {
  /** null이면 새 프로젝트, 값이 있으면 수정 */
  editing: ProjectRow | null
  onClose: () => void
}

export default function ProjectFormModal({ editing, onClose }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ProjectCategory>('company')
  const [client, setClient] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [priority, setPriority] = useState<Priority>('mid')
  const [dueDate, setDueDate] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [progressManual, setProgressManual] = useState(false)
  const [manualProgress, setManualProgress] = useState(0)
  const [workflowNote, setWorkflowNote] = useState('')
  const [sequenceMermaid, setSequenceMermaid] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setCategory(editing.category ?? 'company')
      setClient(editing.client)
      setDescription(editing.description)
      setStatus(editing.status)
      setPriority(editing.priority)
      setDueDate(editing.dueDate)
      setIsPublic(editing.isPublic)
      setGoals(editing.goals)
      setProgressManual(editing.progressManual)
      setManualProgress(editing.progress)
      setWorkflowNote(editing.workflowNote ?? '')
      setSequenceMermaid(editing.sequenceMermaid ?? '')
    }
  }, [editing])

  const auto = computeProgress(goals)
  // 목표가 있고 직접 입력을 끄면 자동 계산, 그 외엔 직접 입력값
  const progress = !progressManual && auto !== null ? auto : manualProgress

  const addGoal = () =>
    setGoals([...goals, { id: crypto.randomUUID(), title: '', progress: 0, updatedBy: 'user', items: [] }])

  const setGoal = (id: string, patch: Partial<Goal>) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch, updatedBy: 'user' } : g)))

  const removeGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id))

  // 세부항목 편집
  const addItem = (goalId: string) =>
    setGoal(goalId, {
      items: [
        ...(goals.find((g) => g.id === goalId)?.items ?? []),
        { id: crypto.randomUUID(), title: '', done: false },
      ],
    })

  const setItem = (goalId: string, itemId: string, patch: Partial<GoalItem>) => {
    const goal = goals.find((g) => g.id === goalId)
    if (!goal) return
    setGoal(goalId, {
      items: (goal.items ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    })
  }

  const removeItem = (goalId: string, itemId: string) => {
    const goal = goals.find((g) => g.id === goalId)
    if (!goal) return
    setGoal(goalId, { items: (goal.items ?? []).filter((it) => it.id !== itemId) })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return
    if (!name.trim()) return setError('프로젝트 이름을 입력하세요.')
    if (goals.some((g) => !g.title.trim())) return setError('제목이 빈 목표가 있습니다.')

    const data = {
      name: name.trim(),
      category,
      client: client.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate,
      isPublic,
      goals: goals.map((g) => ({
        ...g,
        items: (g.items ?? []).filter((it) => it.title.trim() !== ''),
      })),
      progress,
      progressManual,
      workflowNote: workflowNote.trim(),
      sequenceMermaid: sequenceMermaid.trim(),
    }

    setBusy(true)
    try {
      if (editing) {
        await updateProject(editing.id, data, editing.progress)
      } else {
        await createProject(data, user.uid)
      }
      onClose()
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도하세요.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{editing ? '프로젝트 수정' : '새 프로젝트'}</h2>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-name">프로젝트 이름 *</label>
            <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pf-category">카테고리</label>
            <select id="pf-category" value={category} onChange={(e) => setCategory(e.target.value as ProjectCategory)}>
              <option value="company">🏢 회사</option>
              <option value="personal">👤 개인</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-client">거래처 (협업 업체)</label>
          <input
            id="pf-client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="없으면 비워두세요"
          />
        </div>

        <div className="field">
          <label htmlFor="pf-desc">설명</label>
          <input
            id="pf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="프로젝트 내용을 한 줄로"
          />
        </div>

        <div className="form-grid form-grid-3">
          <div className="field">
            <label htmlFor="pf-status">상태</label>
            <select id="pf-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="active">진행중</option>
              <option value="hold">보류</option>
              <option value="done">완료</option>
              <option value="stopped">중단</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-priority">중요도</label>
            <select id="pf-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="high">높음</option>
              <option value="mid">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-due">마감일</label>
            <input id="pf-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          게스트에게 노출 (이름·개요·목표·지표만 보임 — 장비·일정·문서는 항상 회원 전용)
        </label>

        {/* ===== 목표 (마일스톤) ===== */}
        <div className="goals-edit">
          <div className="row-between">
            <b>목표 (마일스톤)</b>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addGoal}>+ 목표 추가</button>
          </div>
          {goals.length === 0 && (
            <p className="hint muted">
              목표를 추가하면 달성률이 자동 계산됩니다. (나중에 Claude가 업로드 시 초안을 제안합니다)
            </p>
          )}
          {goals.map((g) => (
            <div key={g.id} className="goal-block">
              <div className="goal-row">
                <input
                  value={g.title}
                  onChange={(e) => setGoal(g.id, { title: e.target.value })}
                  placeholder="목표 내용"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={g.progress}
                  onChange={(e) =>
                    setGoal(g.id, { progress: Math.max(0, Math.min(100, Number(e.target.value))) })
                  }
                />
                <span className="muted">%</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeGoal(g.id)}>✕</button>
              </div>

              {/* 세부항목 편집 */}
              <div className="goal-items-edit">
                {(g.items ?? []).map((it) => (
                  <div key={it.id} className="goal-item-row">
                    <label className="check" title={it.done ? '완료' : '미완료'}>
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={(e) => setItem(g.id, it.id, { done: e.target.checked })}
                      />
                    </label>
                    <input
                      value={it.title}
                      onChange={(e) => setItem(g.id, it.id, { title: e.target.value })}
                      placeholder="세부항목"
                    />
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeItem(g.id, it.id)}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-ghost gi-add" onClick={() => addItem(g.id)}>
                  + 세부항목
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ===== 달성률 ===== */}
        <div className="progress-edit">
          <div className="row-between">
            <b>전체 달성률: {progress}%</b>
            {auto !== null && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={progressManual}
                  onChange={(e) => setProgressManual(e.target.checked)}
                />
                직접 입력
              </label>
            )}
          </div>
          {(auto === null || progressManual) && (
            <input
              type="range"
              min={0}
              max={100}
              value={manualProgress}
              onChange={(e) => setManualProgress(Number(e.target.value))}
            />
          )}
          {auto !== null && !progressManual && (
            <p className="hint muted">목표 {goals.length}개의 평균으로 자동 계산 중</p>
          )}
        </div>

        {/* ===== 동작 설명 · 시퀀스 (선택) ===== */}
        <details className="form-details">
          <summary>동작 설명 · 시퀀스 다이어그램 (선택)</summary>
          <div className="field">
            <label htmlFor="pf-note">동작 설명</label>
            <textarea
              id="pf-note"
              value={workflowNote}
              onChange={(e) => setWorkflowNote(e.target.value)}
              rows={3}
              placeholder="프로젝트가 어떻게 동작하는지 간단 설명 (Claude 등록 시 자동 작성됨)"
            />
          </div>
          <div className="field">
            <label htmlFor="pf-seq">시퀀스 다이어그램 (Mermaid 코드)</label>
            <textarea
              id="pf-seq"
              value={sequenceMermaid}
              onChange={(e) => setSequenceMermaid(e.target.value)}
              rows={5}
              placeholder={'sequenceDiagram\n    A->>B: 요청\n    B-->>A: 응답'}
              style={{ fontFamily: 'Consolas, monospace' }}
            />
          </div>
        </details>

        {error && <div className="msg msg-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn-primary" disabled={busy}>{editing ? '저장' : '등록'}</button>
        </div>
      </form>
    </div>
  )
}
