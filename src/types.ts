export type Role = 'master' | 'personal' | 'guest'

export interface UserProfile {
  role: Role
  name: string
  email: string
  phone: string
  disabled?: boolean
  createdAt?: unknown
}

export const ROLE_LABEL: Record<Role, string> = {
  master: '마스터',
  personal: '개인',
  guest: '게스트',
}

// ===== 프로젝트 =====
export type ProjectStatus = 'active' | 'hold' | 'done' | 'stopped'
export type Priority = 'high' | 'mid' | 'low'

export interface Goal {
  id: string
  title: string
  progress: number // 0~100
  updatedBy: 'ai' | 'user'
}

export interface Project {
  name: string
  client: string // 거래처 (없으면 '')
  description: string
  status: ProjectStatus
  priority: Priority
  dueDate: string // 'YYYY-MM-DD' 또는 ''
  isPublic: boolean // 게스트 공개 여부
  goals: Goal[]
  progress: number // 전체 달성률(%) — 목표 평균 또는 직접 입력
  progressManual: boolean // true면 직접 입력값 유지 (목표 평균으로 덮어쓰지 않음)
  ownerUid: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface ProjectRow extends Project {
  id: string
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '진행중',
  hold: '보류',
  done: '완료',
  stopped: '중단',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '높음',
  mid: '보통',
  low: '낮음',
}
