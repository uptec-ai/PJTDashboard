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
  openIssueCount?: number // 미해결 이슈 수 (이슈 생성/해결 시 자동 유지)
  workflowNote?: string // 프로젝트 동작 설명 (등록 시 Claude가 채움, 수정 가능)
  sequenceMermaid?: string // 시퀀스 다이어그램 (Mermaid 코드)
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

// ===== 투입 장비 =====
export type CommType = 'modbus-tcp' | 'modbus-rtu' | 'can' | 'rs232' | 'rs485' | 'ethernet' | 'etc'

export const COMM_LABEL: Record<CommType, string> = {
  'modbus-tcp': 'Modbus TCP',
  'modbus-rtu': 'Modbus RTU (Serial)',
  can: 'CAN',
  rs232: 'RS-232',
  rs485: 'RS-485',
  ethernet: 'Ethernet',
  etc: '기타',
}

export type EquipStatus = 'ok' | 'repair' | 'returned'

export const EQUIP_STATUS_LABEL: Record<EquipStatus, string> = {
  ok: '정상',
  repair: '수리중',
  returned: '반납',
}

export type IoPortType = 'DI' | 'DO' | 'AI' | 'AO' | 'COMM' | 'ETC'

export interface IoPort {
  id: string
  port: string // 예: X0, Y1, 502, COM3
  type: IoPortType
  desc: string
}

export interface Equipment {
  name: string
  ip: string // IP 또는 포트 (예: 192.168.0.10, COM3)
  commType: CommType
  commNote: string // 통신 메모 (예: 9600bps slave 1)
  status: EquipStatus
  ioPorts: IoPort[]
  createdAt?: unknown
}

export interface EquipmentRow extends Equipment {
  id: string
}

// ===== 일정 / 이슈 =====
export type TaskKind = 'schedule' | 'issue'
export type TaskStatus = 'todo' | 'doing' | 'done' // 일정용
export type IssueStatus = 'open' | 'resolved' // 이슈용
export type Severity = 'high' | 'mid' | 'low'

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '예정',
  doing: '진행중',
  done: '완료',
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: '열림',
  resolved: '해결',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: '심각',
  mid: '보통',
  low: '낮음',
}

export interface Task {
  kind: TaskKind
  title: string
  startDate: string // 일정 시작일 (YYYY-MM-DD, 없으면 '')
  dueDate: string // 마감일/처리기한
  status: TaskStatus // 일정 상태
  priority: Priority // 일정 우선순위
  severity: Severity // 이슈 심각도
  issueStatus: IssueStatus // 이슈 상태
  resolution: string // 이슈 해결 내용
  resolvedAt?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export interface TaskRow extends Task {
  id: string
}

// ===== 문서 (버전 관리) =====
export type DocSource = 'user' | 'ai'

export interface DocumentVersion {
  name: string // 문서 이름 (같은 이름 = 같은 문서의 새 버전)
  version: number // 1부터 증가
  fileName: string // 원본 파일명
  storagePath: string // GCS(Storage) 경로
  contentType: string
  size: number // bytes
  source: DocSource // user=직접 업로드, ai=Claude 재작성본(Phase 5)
  textContent: string | null // md/txt 계열의 본문 (보기·diff용, 대용량이면 null)
  diffAdded: number | null // 이전 버전 대비 추가 줄 수
  diffRemoved: number | null // 이전 버전 대비 삭제 줄 수
  createdAt?: unknown
}

export interface DocumentVersionRow extends DocumentVersion {
  id: string
}
