/**
 * KongBoard 프로젝트 등록/업데이트 스크립트 — kongboard-register 스킬이 호출한다.
 *
 * 사용법:
 *   node scripts/register-project.mjs <초안.json>          # 로컬 에뮬레이터 (개발)
 *   node scripts/register-project.mjs <초안.json> --prod   # 실서버 kongboard.web.app (운영)
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
 *   "goals": [{ "title": "목표", "progress": 0, "items": [{ "title": "세부항목", "done": false }] }],
 *   "summary": "이번 등록/업데이트 요약 (내부 로그)",
 *   "workflowNote": "동작 설명",
 *   "sequenceMermaid": "sequenceDiagram\n ...",
 *   "commitActivity": [{ "date": "YYYY-MM-DD", "count": 1, "messages": ["..."] }],
 *   "progressBackfill": [{ "date": "YYYY-MM-DD", "progress": 0 }],   // 최초 1회, 사용자 검토 필수
 *   "updates": [{ "date": "YYYY-MM-DD", "title": "...", "kind": "feature|view|db|comm|fix|etc" }],
 *   "documents": [{ "name": "문서이름", "fileName": "..._AI재작성.md", "textContent": "..." }]
 * }
 */
import { readFileSync } from 'node:fs'
import { diffCounts, diffLines } from '../src/lib/diff.ts'

const isProd = process.argv.includes('--prod')
const draftPath = process.argv.filter((a) => !a.startsWith('--'))[2]
if (!draftPath) {
  console.error('사용법: node scripts/register-project.mjs <초안.json> [--prod]')
  process.exit(1)
}

// =====================================================================
// 대상 환경 설정 (로컬 에뮬레이터 / 실서버)
// =====================================================================
let FS // Firestore documents 베이스 URL
let HDR // 인증 헤더
let APP_URL
let uploadFile // (path, bytes, contentType) => Promise<boolean>
let findMasterUid // () => Promise<string|null>

if (!isProd) {
  const AUTH = 'http://127.0.0.1:9099'
  const STORAGE = 'http://127.0.0.1:9199'
  const BUCKET = 'demo-gcs-dashboard.appspot.com'
  FS = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
  HDR = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
  APP_URL = 'http://localhost:5173'

  try {
    await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(3000) })
  } catch {
    console.error('✖ Firestore 에뮬레이터가 꺼져 있습니다. 대시보드 폴더에서 "npm run emulators"를 먼저 실행하세요.')
    process.exit(1)
  }

  uploadFile = async (path, bytes, contentType) => {
    const r = await fetch(
      `${STORAGE}/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
      { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': contentType }, body: bytes },
    )
    return r.ok
  }

  findMasterUid = async () => {
    const lookup = await (await fetch(
      `${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-gcs-dashboard/accounts:lookup`,
      { method: 'POST', headers: HDR, body: JSON.stringify({ email: ['kingkong@dashboard.local'] }) },
    )).json()
    return lookup?.users?.[0]?.localId ?? null
  }
} else {
  const PROD = 'kongboard-f8d65'
  const BUCKET = `${PROD}.firebasestorage.app`
  FS = `https://firestore.googleapis.com/v1/projects/${PROD}/databases/(default)`
  APP_URL = 'https://kongboard.web.app'

  // Firebase CLI 로그인 자격 증명으로 관리자 토큰 발급
  const confPath = process.env.USERPROFILE + '/.config/configstore/firebase-tools.json'
  let refresh
  try {
    refresh = JSON.parse(readFileSync(confPath, 'utf8')).tokens?.refresh_token
  } catch { /* 아래에서 처리 */ }
  if (!refresh) {
    console.error('✖ Firebase CLI 로그인이 필요합니다: 터미널에서 "firebase login" 실행')
    process.exit(1)
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }),
  })
  const access = (await tokenRes.json()).access_token
  if (!access) {
    console.error('✖ 관리자 토큰 발급 실패 — "firebase login"으로 다시 로그인하세요.')
    process.exit(1)
  }
  HDR = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }

  uploadFile = async (path, bytes, contentType) => {
    const r = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
      { method: 'POST', headers: { Authorization: HDR.Authorization, 'Content-Type': contentType }, body: bytes },
    )
    if (!r.ok && (r.status === 404 || r.status === 403)) {
      console.log('  ⚠ Storage 버킷이 아직 없어 문서 파일 업로드를 건너뜁니다 (배포 3단계 후 가능)')
      return false
    }
    return r.ok
  }

  findMasterUid = async () => {
    const q = await (await fetch(`${FS}/documents:runQuery`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'master' } } },
          limit: 1,
        },
      }),
    })).json()
    return q.find((r) => r.document)?.document?.name.split('/').pop() ?? null
  }
}

const draft = JSON.parse(readFileSync(draftPath, 'utf8'))
if (!draft.name?.trim()) {
  console.error('✖ 초안에 name(프로젝트 이름)이 없습니다.')
  process.exit(1)
}
console.log(`대상: ${isProd ? '실서버 (kongboard.web.app)' : '로컬 에뮬레이터'}`)

// ===== 값 정리 =====
const goals = (draft.goals ?? []).map((g, i) => ({
  id: `g${Date.now()}${i}`,
  title: String(g.title),
  progress: Math.max(0, Math.min(100, Number(g.progress) || 0)),
  updatedBy: 'ai',
  items: (g.items ?? []).map((it, j) => ({
    id: `i${Date.now()}${i}_${j}`,
    title: String(it.title),
    done: Boolean(it.done),
  })),
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
  if (!f) return null
  if ('stringValue' in f) return f.stringValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue' in f) return f.doubleValue
  if ('booleanValue' in f) return f.booleanValue
  return null
}

// ===== 마스터 uid =====
const masterUid = await findMasterUid()
if (!masterUid) {
  console.error(isProd
    ? '✖ 실서버에 마스터 계정이 없습니다. 배포 2단계(가입→승격)를 먼저 진행하세요.'
    : '✖ 마스터 계정이 없습니다. "npm run seed -- <비밀번호>"를 먼저 실행하세요.')
  process.exit(1)
}

// ===== 같은 이름의 기존 프로젝트 검색 =====
const queryRes = await (await fetch(`${FS}/documents:runQuery`, {
  method: 'POST',
  headers: HDR,
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'projects' }],
      where: {
        fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: draft.name.trim() } },
      },
      limit: 1,
    },
  }),
})).json()
const existing = queryRes.find((r) => r.document)?.document ?? null

const now = new Date()
const common = {
  name: draft.name.trim(),
  category: draft.category === 'personal' ? 'personal' : 'company',
  client: String(draft.client ?? '').trim(),
  description: String(draft.description ?? '').trim(),
  status: ['active', 'hold', 'done', 'stopped'].includes(draft.status) ? draft.status : 'active',
  priority: ['high', 'mid', 'low'].includes(draft.priority) ? draft.priority : 'mid',
  dueDate: String(draft.dueDate ?? ''),
  isPublic: Boolean(draft.isPublic),
  goals,
  progress,
  progressManual: goals.length === 0,
  workflowNote: String(draft.workflowNote ?? ''),
  sequenceMermaid: String(draft.sequenceMermaid ?? ''),
  updatedAt: now,
}
if (Array.isArray(draft.commitActivity)) {
  common.commitDays = draft.commitActivity
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d.date)))
    .map((d) => ({
      date: String(d.date),
      count: Math.max(1, Number(d.count) || 1),
      messages: (d.messages ?? []).slice(0, 30).map((m) => String(m).slice(0, 200)),
    }))
}
// DB 테이블 설계는 회원 전용이라 하위 문서(design/db)에 저장한다 (등록 후 아래에서 기록)
const dbDesign = draft.dbDesign && Array.isArray(draft.dbDesign.tables)
  ? {
      dbName: String(draft.dbDesign.dbName ?? ''),
      note: String(draft.dbDesign.note ?? ''),
      tables: draft.dbDesign.tables.map((t) => ({
        name: String(t.name),
        summary: String(t.summary ?? ''),
        columns: (t.columns ?? []).map((c) => ({
          name: String(c.name),
          type: String(c.type ?? ''),
          desc: String(c.desc ?? ''),
        })),
      })),
    }
  : null

// 업데이트 시 부분 반영: 초안에 명시된 항목만 덮어쓴다 (빈 값으로 기존 데이터가 지워지는 것 방지)
const PARTIAL_KEYS = {
  category: 'category',
  client: 'client', description: 'description', status: 'status', priority: 'priority',
  dueDate: 'dueDate', isPublic: 'isPublic', workflowNote: 'workflowNote',
  sequenceMermaid: 'sequenceMermaid', commitActivity: 'commitDays',
}
function updateFieldsOf(commonObj) {
  const keys = new Set(['name', 'updatedAt'])
  for (const [draftKey, commonKey] of Object.entries(PARTIAL_KEYS)) {
    if (draft[draftKey] !== undefined) keys.add(commonKey)
  }
  if (draft.goals !== undefined || draft.progress !== undefined) {
    keys.add('goals'); keys.add('progress'); keys.add('progressManual')
  }
  return Object.fromEntries(Object.entries(commonObj).filter(([k]) => keys.has(k)))
}

let pid
let action
if (existing) {
  pid = existing.name.split('/').pop()
  const prevProgress = dec(existing.fields.progress)
  const partial = updateFieldsOf(common)
  const mask = Object.keys(partial).map((f) => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${FS}/documents/projects/${pid}?${mask}`, {
    method: 'PATCH', headers: HDR,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(partial).map(([k, v]) => [k, enc(v)])) }),
  })
  if (!r.ok) { console.error('✖ 업데이트 실패:', await r.text()); process.exit(1) }
  action = 'update'
  if ((draft.goals !== undefined || draft.progress !== undefined) && prevProgress !== progress) {
    await fetch(`${FS}/documents/projects/${pid}/progressHistory`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({ fields: { date: enc(now), progress: enc(progress) } }),
    })
  }
} else {
  const r = await fetch(`${FS}/documents/projects`, {
    method: 'POST', headers: HDR,
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
    method: 'POST', headers: HDR,
    body: JSON.stringify({ fields: { date: enc(now), progress: enc(progress) } }),
  })
}

// ===== DB 설계 (회원 전용 하위 문서) =====
if (dbDesign) {
  const r = await fetch(`${FS}/documents/projects/${pid}/design/db`, {
    method: 'PATCH', headers: HDR,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(dbDesign).map(([k, v]) => [k, enc(v)])) }),
  })
  if (!r.ok) { console.error('✖ DB 설계 저장 실패:', (await r.text()).slice(0, 200)); process.exit(1) }
  console.log(`  🗄 DB 설계 저장 (${dbDesign.tables.length}개 테이블)`)
}

// ===== 달성률 추이 소급(백필) =====
if (Array.isArray(draft.progressBackfill) && draft.progressBackfill.length > 0) {
  const existingHist = await (await fetch(`${FS}/documents/projects/${pid}/progressHistory`, { headers: HDR })).json()
  const existingDates = new Set(
    (existingHist.documents ?? []).map((d) => {
      const ts = d.fields?.date?.timestampValue
      return ts ? new Date(new Date(ts).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) : ''
    }),
  )
  let added = 0
  for (const p of draft.progressBackfill) {
    const date = String(p.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || existingDates.has(date)) continue
    await fetch(`${FS}/documents/projects/${pid}/progressHistory`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({
        fields: { date: { timestampValue: `${date}T03:00:00Z` }, progress: enc(Math.max(0, Math.min(100, Number(p.progress) || 0))) },
      }),
    })
    added++
  }
  if (added > 0) console.log(`  📉 달성률 추이 소급 ${added}개 시점 반영`)
}

// ===== 업데이트 이력 =====
if (Array.isArray(draft.updates) && draft.updates.length > 0) {
  const existingUpd = await (await fetch(`${FS}/documents/projects/${pid}/updates`, { headers: HDR })).json()
  const seen = new Set(
    (existingUpd.documents ?? []).map((d) => `${d.fields?.date?.stringValue ?? ''}|${d.fields?.title?.stringValue ?? ''}`),
  )
  let added = 0
  const KINDS = ['feature', 'view', 'db', 'comm', 'fix', 'etc']
  for (const u of draft.updates) {
    const date = String(u.date ?? '')
    const title = String(u.title ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || seen.has(`${date}|${title}`)) continue
    await fetch(`${FS}/documents/projects/${pid}/updates`, {
      method: 'POST', headers: HDR,
      body: JSON.stringify({
        fields: { date: enc(date), title: enc(title), kind: enc(KINDS.includes(u.kind) ? u.kind : 'etc'), createdAt: enc(now) },
      }),
    })
    added++
  }
  if (added > 0) console.log(`  📝 업데이트 이력 ${added}건 기록`)
}

// ===== 부가효과 지표 upsert =====
for (const m of draft.metrics ?? []) {
  if (!m.name?.trim()) continue
  const metricName = m.name.trim()
  const points = (m.points ?? [])
    .filter((p) => /^\d{4}-\d{2}$/.test(String(p.month)))
    .map((p) => ({ month: String(p.month), value: Number(p.value) || 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const found = (await (await fetch(`${FS}/documents/projects/${pid}:runQuery`, {
    method: 'POST', headers: HDR,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'metrics' }],
        where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: metricName } } },
        limit: 1,
      },
    }),
  })).json()).find((r) => r.document)?.document ?? null

  const fields = { name: enc(metricName), unit: enc(String(m.unit ?? '')), points: enc(points) }
  if (found) {
    const mid = found.name.split('/').pop()
    await fetch(`${FS}/documents/projects/${pid}/metrics/${mid}?updateMask.fieldPaths=name&updateMask.fieldPaths=unit&updateMask.fieldPaths=points`, {
      method: 'PATCH', headers: HDR, body: JSON.stringify({ fields }),
    })
  } else {
    await fetch(`${FS}/documents/projects/${pid}/metrics`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ fields: { ...fields, createdAt: enc(now) } }),
    })
  }
  console.log(`  📈 지표 "${metricName}" ${found ? '갱신' : '등록'} (${points.length}개 값)`)
}

// ===== 문서(AI 재작성본) 업로드 =====
let docCount = 0
for (const d of draft.documents ?? []) {
  if (!d.name?.trim() || !d.textContent) continue
  const docName = d.name.trim()
  const fileName = String(d.fileName ?? `${docName}_AI재작성.md`)

  const versions = (await (await fetch(`${FS}/documents/projects/${pid}:runQuery`, {
    method: 'POST', headers: HDR,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'documents' }],
        where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: docName } } },
      },
    }),
  })).json()).filter((r) => r.document).map((r) => r.document)

  const prevVersion = versions.length
    ? Math.max(...versions.map((v) => Number(v.fields.version?.integerValue ?? 0)))
    : 0
  const prev = versions.find((v) => Number(v.fields.version?.integerValue ?? 0) === prevVersion)
  const prevText = prev?.fields.textContent?.stringValue ?? null

  let diffAdded = null
  let diffRemoved = null
  if (prevText != null) {
    const c = diffCounts(diffLines(prevText, d.textContent))
    diffAdded = c.added
    diffRemoved = c.removed
  }

  const bytes = new TextEncoder().encode(d.textContent)
  const metaRes = await fetch(`${FS}/documents/projects/${pid}/documents`, {
    method: 'POST', headers: HDR,
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries({
        name: docName, version: prevVersion + 1, fileName,
        storagePath: '', contentType: 'text/markdown', size: bytes.length,
        source: 'ai', isPublic: false, fileModifiedAt: null,
        textContent: d.textContent, diffAdded, diffRemoved, createdAt: now,
      }).map(([k, v]) => [k, enc(v)])),
    }),
  })
  const meta = await metaRes.json()
  if (!metaRes.ok) { console.error('✖ 문서 메타 생성 실패:', JSON.stringify(meta)); process.exit(1) }
  const docId = meta.name.split('/').pop()

  const path = `projects/${pid}/docs/${docId}/v${prevVersion + 1}_${fileName}`
  const uploaded = await uploadFile(path, bytes, 'text/markdown')
  if (uploaded) {
    await fetch(`${FS}/documents/projects/${pid}/documents/${docId}?updateMask.fieldPaths=storagePath`, {
      method: 'PATCH', headers: HDR, body: JSON.stringify({ fields: { storagePath: enc(path) } }),
    })
  }
  docCount++
  console.log(`  📄 ${docName} v${prevVersion + 1} ${uploaded ? '업로드' : '메타 등록(파일은 보류)'}${diffAdded !== null ? ` (diff +${diffAdded} −${diffRemoved})` : ''}`)
}

// ===== 연동 로그(activity) =====
await fetch(`${FS}/documents/projects/${pid}/activity`, {
  method: 'POST', headers: HDR,
  body: JSON.stringify({
    fields: {
      type: enc(action),
      by: enc('claude-code'),
      summary: enc(String(draft.summary ?? (action === 'register' ? '프로젝트 최초 등록' : '프로젝트 업데이트'))),
      sourcePath: enc(String(draft.sourcePath ?? '')),
      docCount: enc(docCount),
      at: enc(now),
    },
  }),
})

console.log(`✔ ${action === 'register' ? '등록' : '업데이트'} 완료: ${draft.name}`)
console.log(`  달성률 ${progress}% · 목표 ${goals.length}개${docCount > 0 ? ` · 문서 ${docCount}건` : ''}`)
console.log(`  대시보드: ${APP_URL}/projects/${pid}`)
