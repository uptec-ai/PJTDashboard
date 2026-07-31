/**
 * 데모/샘플 데이터 시드 (멱등) — BMS 통신 모듈 프로젝트 + 장비 + 일정/이슈
 * PC 강제 종료 등으로 에뮬레이터 데이터가 초기화됐을 때 복구용.
 *
 * 사용법: node scripts/seed-demo.mjs   (에뮬레이터 실행 중 + 마스터 시드 완료 상태)
 * 문서 샘플까지 복구하려면 이어서: node scripts/seed-sample-docs.mjs <마스터PW>
 */
const AUTH = 'http://127.0.0.1:9099'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
const PID = 'test-bms-gateway'

const enc = (v) => {
  if (v === null) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } }
}
const fieldsOf = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]))

// 마스터 uid
const lookup = await (await fetch(
  `${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-gcs-dashboard/accounts:lookup`,
  { method: 'POST', headers: ADMIN, body: JSON.stringify({ email: ['kingkong@dashboard.local'] }) },
)).json()
const masterUid = lookup?.users?.[0]?.localId
if (!masterUid) {
  console.error('✖ 마스터 계정이 없습니다. 먼저: npm run seed -- "<비밀번호>"')
  process.exit(1)
}

const now = new Date()

// 1) 프로젝트 (고정 id → 재실행해도 중복 없음)
const project = {
  name: 'BMS 통신 모듈',
  client: '(주)한빛에너지',
  description: 'CAN-Modbus 게이트웨이 개발',
  status: 'active',
  priority: 'high',
  dueDate: '2026-08-15',
  isPublic: true,
  goals: [],
  progress: 35,
  progressManual: true,
  openIssueCount: 1,
  ownerUid: masterUid,
  createdAt: now,
  updatedAt: now,
}
const mask = Object.keys(project).map((f) => `updateMask.fieldPaths=${f}`).join('&')
let r = await fetch(`${FS}/documents/projects/${PID}?${mask}`, {
  method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: fieldsOf(project) }),
})
if (!r.ok) { console.error('✖ 프로젝트 시드 실패:', await r.text()); process.exit(1) }
console.log('✔ 프로젝트: BMS 통신 모듈')

// 2) 장비/일정·이슈 — 이미 있으면 건너뜀 (멱등)
const sub = async (name, docs) => {
  const existing = await (await fetch(`${FS}/documents/projects/${PID}/${name}`, { headers: ADMIN })).json()
  if (existing.documents?.length) {
    console.log(`ℹ ${name} 이미 있음 (${existing.documents.length}건) — 건너뜀`)
    return
  }
  for (const d of docs) {
    const res = await fetch(`${FS}/documents/projects/${PID}/${name}`, {
      method: 'POST', headers: ADMIN, body: JSON.stringify({ fields: fieldsOf(d) }),
    })
    if (!res.ok) { console.error(`✖ ${name} 시드 실패:`, await res.text()); process.exit(1) }
  }
  console.log(`✔ ${name}: ${docs.length}건`)
}

await sub('equipment', [{
  name: '메인 PLC', ip: '192.168.0.10', commType: 'modbus-tcp', commNote: 'port 502, unit 1',
  status: 'ok',
  ioPorts: [
    { id: 'p1', port: 'X0', type: 'DI', desc: '비상정지 입력' },
    { id: 'p2', port: 'Y0', type: 'DO', desc: '운전 램프' },
  ],
  createdAt: now,
}])

await sub('tasks', [
  {
    kind: 'schedule', title: '현장 통신 테스트', startDate: '2026-08-03', dueDate: '2026-08-07',
    status: 'doing', priority: 'high', severity: 'mid', issueStatus: 'open', resolution: '',
    createdAt: now, updatedAt: now,
  },
  {
    kind: 'issue', title: 'CAN 통신 간헐적 끊김', startDate: '', dueDate: '2026-08-01',
    status: 'todo', priority: 'mid', severity: 'high', issueStatus: 'open', resolution: '',
    createdAt: now, updatedAt: now,
  },
])

await sub('progressHistory', [{ date: now, progress: 35 }])

console.log('\n완료. 문서 샘플까지 복구하려면: node scripts/seed-sample-docs.mjs "<마스터PW>"')
