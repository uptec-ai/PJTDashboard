/**
 * KongBoard 프로젝트 등록/업데이트 스크립트 — kongboard-register 스킬이 호출한다.
 *
 * 사용법: node scripts/register-project.mjs <초안.json>
 *
 * 초안 JSON 형식:
 * {
 *   "name": "프로젝트 이름",            // 필수. 같은 이름이 있으면 업데이트
 *   "client": "거래처명",              // 선택 ('' = 개인 프로젝트)
 *   "description": "한 줄 설명",
 *   "status": "active|hold|done|stopped",
 *   "priority": "high|mid|low",
 *   "dueDate": "YYYY-MM-DD",           // 선택
 *   "isPublic": false,
 *   "goals": [{ "title": "목표", "progress": 0 }],  // AI가 제안, 사용자 검토 후
 *   "summary": "이번 등록/업데이트 요약 (연동 이력에 기록)"
 * }
 *
 * 현재는 로컬 에뮬레이터 전용(관리자 권한 REST). 실서버 전환 시 이 스크립트만
 * Cloud Functions HTTP API 호출로 교체하면 스킬은 그대로 동작한다. (Phase 5)
 */
import { readFileSync } from 'node:fs'

const AUTH = 'http://127.0.0.1:9099'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
const MASTER_EMAIL = 'kingkong@dashboard.local'

const draftPath = process.argv[2]
if (!draftPath) {
  console.error('사용법: node scripts/register-project.mjs <초안.json>')
  process.exit(1)
}

// ===== 에뮬레이터 확인 =====
try {
  await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(3000) })
} catch {
  console.error('✖ Firestore 에뮬레이터가 꺼져 있습니다. 대시보드 폴더에서 "npm run emulators"를 먼저 실행하세요.')
  process.exit(1)
}

const draft = JSON.parse(readFileSync(draftPath, 'utf8'))
if (!draft.name?.trim()) {
  console.error('✖ 초안에 name(프로젝트 이름)이 없습니다.')
  process.exit(1)
}

// ===== 값 정리 =====
const goals = (draft.goals ?? []).map((g, i) => ({
  id: `g${Date.now()}${i}`,
  title: String(g.title),
  progress: Math.max(0, Math.min(100, Number(g.progress) || 0)),
  updatedBy: 'ai',
}))
const progress =
  goals.length > 0
    ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length)
    : Math.max(0, Math.min(100, Number(draft.progress) || 0))

// ===== Firestore 값 인코딩 도우미 =====
const enc = (v) => {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } }
}
const dec = (f) => {
  if ('stringValue' in f) return f.stringValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue' in f) return f.doubleValue
  if ('booleanValue' in f) return f.booleanValue
  return null
}

// ===== 마스터 uid 조회 =====
const lookup = await (await fetch(
  `${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-gcs-dashboard/accounts:lookup`,
  { method: 'POST', headers: ADMIN, body: JSON.stringify({ email: [MASTER_EMAIL] }) },
)).json()
const masterUid = lookup?.users?.[0]?.localId
if (!masterUid) {
  console.error('✖ 마스터 계정이 없습니다. "npm run seed -- <비밀번호>"를 먼저 실행하세요.')
  process.exit(1)
}

// ===== 같은 이름의 기존 프로젝트 검색 =====
const queryRes = await (await fetch(`${FS}/documents:runQuery`, {
  method: 'POST',
  headers: ADMIN,
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'projects' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'name' },
          op: 'EQUAL',
          value: { stringValue: draft.name.trim() },
        },
      },
      limit: 1,
    },
  }),
})).json()
const existing = queryRes.find((r) => r.document)?.document ?? null

const now = new Date()
const common = {
  name: draft.name.trim(),
  client: String(draft.client ?? '').trim(),
  description: String(draft.description ?? '').trim(),
  status: ['active', 'hold', 'done', 'stopped'].includes(draft.status) ? draft.status : 'active',
  priority: ['high', 'mid', 'low'].includes(draft.priority) ? draft.priority : 'mid',
  dueDate: String(draft.dueDate ?? ''),
  isPublic: Boolean(draft.isPublic),
  goals,
  progress,
  progressManual: goals.length === 0,
  updatedAt: now,
}

let pid
let action
if (existing) {
  // ---- 업데이트 ----
  pid = existing.name.split('/').pop()
  const prevProgress = dec(existing.fields.progress ?? {})
  const mask = Object.keys(common).map((f) => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${FS}/documents/projects/${pid}?${mask}`, {
    method: 'PATCH', headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(common).map(([k, v]) => [k, enc(v)])) }),
  })
  if (!r.ok) { console.error('✖ 업데이트 실패:', await r.text()); process.exit(1) }
  action = 'update'
  if (prevProgress !== progress) {
    await fetch(`${FS}/documents/projects/${pid}/progressHistory`, {
      method: 'POST', headers: ADMIN,
      body: JSON.stringify({ fields: { date: enc(now), progress: enc(progress) } }),
    })
  }
} else {
  // ---- 신규 등록 ----
  const r = await fetch(`${FS}/documents/projects`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries({ ...common, openIssueCount: 0, ownerUid: masterUid, createdAt: now })
          .map(([k, v]) => [k, enc(v)]),
      ),
    }),
  })
  const created = await r.json()
  if (!r.ok) { console.error('✖ 등록 실패:', JSON.stringify(created)); process.exit(1) }
  pid = created.name.split('/').pop()
  action = 'register'
  await fetch(`${FS}/documents/projects/${pid}/progressHistory`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ fields: { date: enc(now), progress: enc(progress) } }),
  })
}

// ===== 연동 이력(activity) 기록 — Phase 5 타임라인의 데이터 =====
await fetch(`${FS}/documents/projects/${pid}/activity`, {
  method: 'POST', headers: ADMIN,
  body: JSON.stringify({
    fields: {
      type: enc(action),
      by: enc('claude-code'),
      summary: enc(String(draft.summary ?? (action === 'register' ? '프로젝트 최초 등록' : '프로젝트 업데이트'))),
      sourcePath: enc(String(draft.sourcePath ?? '')),
      at: enc(now),
    },
  }),
})

console.log(`✔ ${action === 'register' ? '등록' : '업데이트'} 완료: ${draft.name}`)
console.log(`  달성률 ${progress}% · 목표 ${goals.length}개`)
console.log(`  대시보드: http://localhost:5173/projects/${pid}`)
