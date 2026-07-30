import { useNavigate } from 'react-router-dom'
import { ddayLabel, daysLeft, deleteProject } from '../lib/projects'
import { PRIORITY_LABEL, STATUS_LABEL } from '../types'
import type { ProjectRow } from '../types'

const STATUS_CLASS: Record<string, string> = {
  active: 'pill-run',
  hold: 'pill-hold',
  done: 'pill-done',
  stopped: 'pill-stop',
}

const STATUS_ICON: Record<string, string> = {
  active: '●',
  hold: '⏸',
  done: '✔',
  stopped: '✕',
}

const PRIORITY_ICON: Record<string, string> = {
  high: '🔴',
  mid: '🟡',
  low: '🟢',
}

interface Props {
  project: ProjectRow
  canEdit: boolean
  onEdit: (p: ProjectRow) => void
}

export default function ProjectCard({ project: p, canEdit, onEdit }: Props) {
  const navigate = useNavigate()
  const dday = ddayLabel(p.dueDate)
  const left = daysLeft(p.dueDate)
  const ddayUrgent = left !== null && left <= 7 && p.status === 'active'
  const issues = p.openIssueCount ?? 0

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`"${p.name}" 프로젝트를 삭제할까요?`)) return
    try {
      await deleteProject(p.id)
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(p)
  }

  return (
    <div className="card card-click" onClick={() => navigate(`/projects/${p.id}`)}>
      <div className="c-top">
        <h3>{p.name}</h3>
        <span className={`pill ${STATUS_CLASS[p.status]}`}>
          {STATUS_ICON[p.status]} {STATUS_LABEL[p.status]}
        </span>
      </div>

      <div className={`client ${p.client ? '' : 'none'}`}>
        🏢 {p.client || '개인 프로젝트'}
      </div>

      {p.description && <div className="desc">{p.description}</div>}

      <div className="progress">
        <div className="p-row">
          <span>달성률{p.goals.length > 0 && ` (목표 ${p.goals.length}개)`}</span>
          <b>{p.progress}%</b>
        </div>
        <div className="bar"><i style={{ width: `${p.progress}%` }} /></div>
      </div>

      <div className="c-meta">
        {dday && <span className={ddayUrgent ? 'warn' : ''}>⏰ {dday}</span>}
        {issues > 0 && <span className="warn">⚠ 이슈 {issues}</span>}
        <span title="중요도">{PRIORITY_ICON[p.priority]} {PRIORITY_LABEL[p.priority]}</span>
        <span title={p.isPublic ? '게스트 공개' : '비공개'}>{p.isPublic ? '🌐' : '🔒'}</span>
        {canEdit && (
          <span className="right">
            <button className="btn btn-sm btn-ghost" onClick={handleEdit}>수정</button>
            <button className="btn btn-sm btn-ghost" onClick={handleDelete}>삭제</button>
          </span>
        )}
      </div>
    </div>
  )
}
