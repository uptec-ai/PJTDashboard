import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'
import ProjectCard from '../components/ProjectCard'
import ProjectFormModal from '../components/ProjectFormModal'
import { daysLeft, saveCardOrder, sortProjects } from '../lib/projects'
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
  const [sortKey, setSortKeyState] = useState<SortKey>(
    () => (localStorage.getItem('dash-sort') as SortKey) || 'latest',
  )
  const setSortKey = (k: SortKey) => {
    setSortKeyState(k)
    localStorage.setItem('dash-sort', k)
  }
  // 드래그 재배치 (마스터 전용 — 전체 카드 순서는 공용 데이터)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
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
  const canReorder = isMaster // 전체 카드 순서 변경은 마스터만

  /** 드롭: 끌던 카드를 대상 카드 앞에 끼워 넣고 순서 저장 → 커스텀 정렬로 전환 */
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const ids = visible.map((p) => p.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragId)
    setDragId(null)
    setOverId(null)
    try {
      await saveCardOrder(ids)
      setSortKey('custom')
    } catch {
      alert('순서 저장에 실패했습니다.')
    }
  }

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
            <option value="custom">정렬: 커스텀 (드래그 순서)</option>
          </select>
          {canReorder && (
            <span className="muted" style={{ fontSize: 11.5 }}>
              카드를 끌어 다른 카드 위에 놓으면 순서가 바뀝니다
            </span>
          )}
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
              <div
                key={p.id}
                className={`card-wrap ${dragId === p.id ? 'dragging' : ''} ${overId === p.id && dragId !== p.id ? 'drag-over' : ''}`}
                draggable={canReorder}
                onDragStart={() => setDragId(p.id)}
                onDragEnd={() => { setDragId(null); setOverId(null) }}
                onDragOver={(e) => { e.preventDefault(); setOverId(p.id) }}
                onDragLeave={() => setOverId((cur) => (cur === p.id ? null : cur))}
                onDrop={(e) => { e.preventDefault(); handleDrop(p.id) }}
              >
                <ProjectCard project={p} canEdit={canEdit(p)} onEdit={openEdit} />
              </div>
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
