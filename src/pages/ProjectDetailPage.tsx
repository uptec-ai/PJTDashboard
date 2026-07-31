import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import EquipmentTab from '../components/EquipmentTab'
import TasksTab from '../components/TasksTab'
import DocumentsTab from '../components/DocumentsTab'
import ActivityTab from '../components/ActivityTab'
import ProjectFormModal from '../components/ProjectFormModal'
import { ddayLabel } from '../lib/projects'
import { STATUS_LABEL } from '../types'
import type { Project, ProjectRow } from '../types'

type Tab = 'overview' | 'equipment' | 'tasks' | 'docs' | 'activity'

const STATUS_CLASS: Record<string, string> = {
  active: 'pill-run',
  hold: 'pill-hold',
  done: 'pill-done',
  stopped: 'pill-stop',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()

  const [project, setProject] = useState<ProjectRow | null>(null)
  const [denied, setDenied] = useState(false)
  const [gone, setGone] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    return onSnapshot(
      doc(db, 'projects', id),
      (snap) => {
        if (!snap.exists()) { setGone(true); return }
        setProject({ id: snap.id, ...(snap.data() as Project) })
      },
      () => setDenied(true),
    )
  }, [id])

  if (gone) {
    return (
      <>
        <TopBar />
        <main className="page">
          <div className="empty">삭제되었거나 존재하지 않는 프로젝트입니다. <Link to="/">← 대시보드로</Link></div>
        </main>
      </>
    )
  }
  if (denied) {
    return (
      <>
        <TopBar />
        <main className="page">
          <div className="empty">이 프로젝트를 볼 권한이 없습니다. <Link to="/">← 대시보드로</Link></div>
        </main>
      </>
    )
  }
  if (!project) {
    return (
      <>
        <TopBar />
        <main className="page"><div className="empty">불러오는 중…</div></main>
      </>
    )
  }

  const isGuest = user?.isAnonymous ?? false
  const canEdit = !isGuest && (profile?.role === 'master' || project.ownerUid === user?.uid)
  const dday = ddayLabel(project.dueDate)

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="crumb"><Link to="/">← 대시보드</Link></div>

        {/* ===== 헤더 ===== */}
        <div className="detail-head">
          <div className="dh-top">
            <h1>{project.name}</h1>
            <span className={`pill ${STATUS_CLASS[project.status]}`}>{STATUS_LABEL[project.status]}</span>
            <span className={`client ${project.client ? '' : 'none'}`}>🏢 {project.client || '개인 프로젝트'}</span>
            <div className="dh-right">
              {dday && <span className="muted">⏰ {dday}</span>}
              <span className="muted">{project.isPublic ? '🌐 공개' : '🔒 비공개'}</span>
              {canEdit && <button className="btn btn-sm btn-ghost" onClick={() => setEditOpen(true)}>프로젝트 수정</button>}
            </div>
          </div>
          {project.description && <p className="muted" style={{ fontSize: 13.5 }}>{project.description}</p>}
          <div className="dh-progress">
            <span className="big">{project.progress}<small>%</small></span>
            <div className="bar"><i style={{ width: `${project.progress}%` }} /></div>
          </div>
        </div>

        {/* ===== 탭 ===== */}
        <div className="tabs">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>개요</button>
          <button className={tab === 'equipment' ? 'on' : ''} onClick={() => setTab('equipment')}>장비</button>
          <button className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>
            일정 · 이슈{(project.openIssueCount ?? 0) > 0 && <span className="tab-badge">{project.openIssueCount}</span>}
          </button>
          <button className={tab === 'docs' ? 'on' : ''} onClick={() => setTab('docs')}>문서</button>
          <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>연동 이력</button>
        </div>

        {tab === 'overview' && (
          <section className="panel">
            <h3>목표 (마일스톤)</h3>
            {project.goals.length === 0 ? (
              <div className="empty">
                등록된 목표가 없습니다.
                {canEdit && <><br />"프로젝트 수정"에서 목표를 추가하면 달성률이 자동 계산됩니다.</>}
              </div>
            ) : (
              <div className="goal-list">
                {project.goals.map((g) => (
                  <div key={g.id} className="goal-view">
                    <div className="g-row">
                      <span>{g.title}</span>
                      <span className={`by ${g.updatedBy === 'ai' ? 'by-ai' : 'by-user'}`}>
                        {g.updatedBy === 'ai' ? 'AI' : '사용자'}
                      </span>
                      <b>{g.progress}%</b>
                    </div>
                    <div className="bar"><i style={{ width: `${g.progress}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'equipment' && <EquipmentTab pid={project.id} canEdit={canEdit} />}
        {tab === 'tasks' && <TasksTab pid={project.id} canEdit={canEdit} />}
        {tab === 'docs' && <DocumentsTab pid={project.id} canEdit={canEdit} />}
        {tab === 'activity' && <ActivityTab pid={project.id} />}
      </main>

      {editOpen && <ProjectFormModal editing={project} onClose={() => setEditOpen(false)} />}
    </>
  )
}
