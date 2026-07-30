import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import ProjectCard from '../components/ProjectCard'
import ProjectFormModal from '../components/ProjectFormModal'
import { daysLeft, sortProjects } from '../lib/projects'
import type { SortKey } from '../lib/projects'
import { STATUS_LABEL } from '../types'
import type { Project, ProjectRow, ProjectStatus } from '../types'

type Filter = 'all' | ProjectStatus

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const isGuest = user?.isAnonymous ?? false
  const isMaster = profile?.role === 'master'

  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('latest')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // 상단 메뉴 "프로젝트 등록" 클릭(/?new=1) → 등록 모달 자동 열기
  useEffect(() => {
    if (searchParams.get('new') === '1' && !isGuest) {
      setEditing(null)
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, isGuest, setSearchParams])

  useEffect(() => {
    if (!user) return
    // 게스트는 공개 프로젝트만 (보안 규칙과 일치하는 조건)
    const base = collection(db, 'projects')
    const q = isGuest ? query(base, where('isPublic', '==', true)) : query(base)
    return onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Project) })))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, isGuest])

  // ===== KPI 집계 =====
  const kpi = useMemo(() => {
    const active = rows.filter((r) => r.status === 'active')
    const avg =
      active.length > 0
        ? Math.round(active.reduce((a, r) => a + r.progress, 0) / active.length)
        : null
    const dueSoon = active.filter((r) => {
      const d = daysLeft(r.dueDate)
      return d !== null && d >= 0 && d <= 7
    })
    const nearest = dueSoon
      .map((r) => daysLeft(r.dueDate)!)
      .sort((a, b) => a - b)[0]
    const issues = rows.reduce((a, r) => a + (r.openIssueCount ?? 0), 0)
    return { total: rows.length, active: active.length, avg, dueSoon: dueSoon.length, nearest, issues }
  }, [rows])

  // ===== 필터 + 정렬 =====
  const visible = useMemo(() => {
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
    return sortProjects(filtered, sortKey)
  }, [rows, filter, sortKey])

  const canEdit = (p: ProjectRow) => !isGuest && (isMaster || p.ownerUid === user?.uid)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (p: ProjectRow) => {
    setEditing(p)
    setModalOpen(true)
  }

  const FILTERS: Filter[] = ['all', 'active', 'hold', 'done', 'stopped']

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="page-head">
          <h1>대시보드</h1>
          {!isGuest && (
            <button className="btn btn-primary btn-sm" onClick={openNew}>+ 새 프로젝트</button>
          )}
        </div>

        {/* ===== KPI 요약 ===== */}
        <div className="kpis">
          <div className="kpi">
            <span className="k-label">진행 중 프로젝트</span>
            <span className="k-value">{kpi.active}<small>건</small></span>
            <span className="k-hint">전체 {kpi.total}건</span>
          </div>
          <div className="kpi">
            <span className="k-label">평균 달성률</span>
            <span className="k-value">{kpi.avg ?? '—'}{kpi.avg !== null && <small>%</small>}</span>
            <span className="k-hint">진행 중 프로젝트 기준</span>
          </div>
          <div className="kpi">
            <span className="k-label"><span className="k-dot k-dot-warn" />이번 주 마감</span>
            <span className="k-value">{kpi.dueSoon}<small>건</small></span>
            <span className="k-hint">{kpi.dueSoon > 0 ? `가장 빠른 D-${kpi.nearest}` : '7일 내 마감 없음'}</span>
          </div>
          <div className="kpi">
            <span className="k-label"><span className="k-dot k-dot-crit" />미해결 이슈</span>
            <span className="k-value">{kpi.issues}<small>건</small></span>
            <span className="k-hint">{kpi.issues > 0 ? '프로젝트 상세에서 확인' : '모두 해결됨'}</span>
          </div>
        </div>

        {/* ===== 필터 / 정렬 ===== */}
        <div className="filters">
          <div className="seg">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={filter === f ? 'on' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '전체' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          <select className="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="latest">정렬: 최신순</option>
            <option value="due">정렬: 마감일순</option>
            <option value="priority">정렬: 중요도순</option>
          </select>
        </div>

        {/* ===== 카드 그리드 ===== */}
        {loading ? (
          <div className="empty">불러오는 중…</div>
        ) : visible.length === 0 ? (
          <div className="empty">
            {rows.length === 0 ? (
              isGuest ? '공개된 프로젝트가 없습니다.' : (
                <>아직 등록된 프로젝트가 없습니다.<br />위의 <b>+ 새 프로젝트</b> 버튼으로 첫 프로젝트를 등록해 보세요!</>
              )
            ) : '조건에 맞는 프로젝트가 없습니다.'}
          </div>
        ) : (
          <div className="cards">
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} canEdit={canEdit(p)} onEdit={openEdit} />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <ProjectFormModal editing={editing} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
