/**
 * 로컬 에뮬레이터 → 실서버(Firestore) 데이터 이전
 *
 * 사용법: node scripts/migrate-to-prod.mjs <마스터UID> <마스터이메일> [표시이름]
 *
 * - Firebase CLI 로그인 계정 권한(OAuth)으로 실서버에 기록 (프로젝트 소유자)
 * - 프로젝트/하위 컬렉션의 문서 ID를 그대로 보존 (문서 storagePath 일관성 유지)
 * - ownerUid는 실서버 마스터 UID로 교체
 * - 실행 전: 에뮬레이터가 켜져 있어야 함 (npm run emulators)
 */
import { readFileSync } from 'node:fs'

const [, , MASTER_UID, MASTER_EMAIL, MASTER_NAME = 'kingkong'] = process.argv
if (!MASTER_UID || !MASTER_EMAIL) {
  console.error('사용법: node scripts/migrate-to-prod.mjs <마스터UID> <마스터이메일> [표시이름]')
  process.exit(1)
}

const PROD = 'kongboard-f8d65'
const SRC = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
const DST = `https://firestore.googleapis.com/v1/projects/${PROD}/databases/(default)`
const SRC_H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
const SUBS = ['equipment', 'tasks', 'documents', 'activity', 'progressHistory', 'metrics', 'updates', 'comments']

// ===== 관리자 액세스 토큰 (Firebase CLI 로그인 자격 증명 재사용) =====
const conf = JSON.parse(readFileSync(process.env.USERPROFILE + '/.config/configstore/firebase-tools.json', 'utf8'))
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: conf.tokens.refresh_token,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  }),
})
const ACCESS = (await tokenRes.json()).access_token
if (!ACCESS) { console.error('✖ 관리자 토큰 발급 실패 — firebase login 상태를 확인하세요'); process.exit(1) }
const DST_H = { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json' }

// ===== 에뮬레이터 확인 =====
try { await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(3000) }) }
catch { console.error('✖ 에뮬레이터가 꺼져 있습니다: npm run emulators'); process.exit(1) }

// ===== 도우미 =====
async function listAll(base, headers, path) {
  const docs = []
  let pageToken = ''
  do {
    const url = `${base}/documents/${path}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
    const j = await (await fetch(url, { headers })).json()
    docs.push(...(j.documents ?? []))
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return docs
}

async function putDoc(path, fields) {
  const r = await fetch(`${DST}/documents/${path}`, {
    method: 'PATCH', headers: DST_H, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`${path}: ${(await r.text()).slice(0, 200)}`)
}

// ===== 1) 마스터 이메일 인증 완료 처리 + 프로필(role: master) =====
const upd = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROD}/accounts:update`, {
  method: 'POST', headers: DST_H,
  body: JSON.stringify({ localId: MASTER_UID, emailVerified: true, displayName: MASTER_NAME }),
})
if (!upd.ok) { console.error('✖ 이메일 인증 처리 실패:', (await upd.text()).slice(0, 200)); process.exit(1) }
console.log(`✔ 이메일 인증 완료 처리: ${MASTER_EMAIL}`)

await putDoc(`users/${MASTER_UID}`, {
  role: { stringValue: 'master' },
  name: { stringValue: MASTER_NAME },
  email: { stringValue: MASTER_EMAIL },
  phone: { stringValue: '' },
  disabled: { booleanValue: false },
  createdAt: { timestampValue: new Date().toISOString() },
})
console.log('✔ 마스터 승격 (role: master)')

// ===== 2) 프로젝트 + 하위 컬렉션 이전 =====
const projects = await listAll('http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'.replace('/documents', ''), SRC_H, 'projects').catch(() => null)
  ?? []
const srcProjects = projects.length ? projects : (await (await fetch(`${SRC}/documents/projects`, { headers: SRC_H })).json()).documents ?? []

let totalSub = 0
for (const p of srcProjects) {
  const pid = p.name.split('/').pop()
  const fields = { ...p.fields, ownerUid: { stringValue: MASTER_UID } }
  await putDoc(`projects/${pid}`, fields)

  let subCount = 0
  for (const sub of SUBS) {
    const list = (await (await fetch(`${SRC}/documents/projects/${pid}/${sub}?pageSize=300`, { headers: SRC_H })).json()).documents ?? []
    for (const d of list) {
      await putDoc(`projects/${pid}/${sub}/${d.name.split('/').pop()}`, d.fields)
      subCount++
    }
  }
  totalSub += subCount
  console.log(`✔ ${p.fields.name?.stringValue ?? pid} 이전 (하위 문서 ${subCount}건)`)
}

// ===== 3) 검증 =====
const check = await (await fetch(`${DST}/documents/projects`, { headers: DST_H })).json()
console.log(`\n완료: 실서버 프로젝트 ${(check.documents ?? []).length}건 · 하위 문서 총 ${totalSub}건`)
console.log('확인: https://kongboard.web.app')
