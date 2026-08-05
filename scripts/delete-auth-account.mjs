/**
 * 로그인 계정(Firebase Auth) 완전 삭제 — 이메일 재사용을 위해 필요
 *
 * 웹 화면의 "계정 삭제"는 Firestore 데이터(프로필·아이디·ID찾기)만 지운다.
 * 로그인 계정 자체는 관리자 권한이 필요해 브라우저에서 지울 수 없으므로 이 스크립트로 처리한다.
 *
 * 사용법:
 *   node scripts/delete-auth-account.mjs <이메일> --prod   # 실서버
 *   node scripts/delete-auth-account.mjs <이메일>          # 로컬 에뮬레이터
 *   node scripts/delete-auth-account.mjs --list [--prod]   # 계정 목록 + 고아 계정 확인
 *
 * 안전장치: 프로필이 살아 있는 계정(사용 중)은 삭제를 거부한다.
 */
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const isProd = args.includes('--prod')
const listOnly = args.includes('--list')
const email = args.find((a) => !a.startsWith('--'))

if (!listOnly && !email) {
  console.error('사용법: node scripts/delete-auth-account.mjs <이메일> [--prod]')
  console.error('        node scripts/delete-auth-account.mjs --list [--prod]')
  process.exit(1)
}

let IDP // Identity Toolkit 베이스
let FS // Firestore documents 베이스
let HDR
let PROJECT

if (isProd) {
  PROJECT = 'kongboard-f8d65'
  IDP = 'https://identitytoolkit.googleapis.com/v1'
  FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`
  const confPath = process.env.USERPROFILE + '/.config/configstore/firebase-tools.json'
  let refresh
  try { refresh = JSON.parse(readFileSync(confPath, 'utf8')).tokens?.refresh_token } catch { /* below */ }
  if (!refresh) { console.error('✖ Firebase CLI 로그인 필요: firebase login'); process.exit(1) }
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }),
  })
  const access = (await tr.json()).access_token
  if (!access) { console.error('✖ 관리자 토큰 발급 실패'); process.exit(1) }
  HDR = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }
} else {
  PROJECT = 'demo-gcs-dashboard'
  IDP = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
  FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)`
  HDR = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
  try { await fetch('http://127.0.0.1:9099/', { signal: AbortSignal.timeout(3000) }) }
  catch { console.error('✖ 에뮬레이터가 꺼져 있습니다: npm run emulators'); process.exit(1) }
}

console.log(`대상: ${isProd ? '실서버 (kongboard.web.app)' : '로컬 에뮬레이터'}`)

// 계정 + 프로필 대조
const accounts = (await (await fetch(`${IDP}/projects/${PROJECT}/accounts:query`, {
  method: 'POST', headers: HDR, body: JSON.stringify({}),
})).json()).userInfo ?? []
const profiles = new Set(
  ((await (await fetch(`${FS}/documents/users`, { headers: HDR })).json()).documents ?? [])
    .map((d) => d.name.split('/').pop()),
)

if (listOnly) {
  for (const u of accounts) {
    console.log(`${u.email ?? '(익명)'} | uid ${u.localId} | 프로필 ${profiles.has(u.localId) ? '있음 (사용 중)' : '없음 → 삭제 가능'}`)
  }
  console.log(`\n총 ${accounts.length}개 계정 / 프로필 ${profiles.size}개`)
  process.exit(0)
}

const target = accounts.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())
if (!target) { console.error(`✖ "${email}" 계정을 찾을 수 없습니다.`); process.exit(1) }
if (profiles.has(target.localId)) {
  console.error(`✖ "${email}" 은(는) 아직 사용 중인 계정입니다. 웹의 회원 관리에서 먼저 "계정 삭제"를 실행하세요.`)
  process.exit(1)
}

const del = await fetch(`${IDP}/projects/${PROJECT}/accounts:delete`, {
  method: 'POST', headers: HDR, body: JSON.stringify({ localId: target.localId }),
})
if (!del.ok) { console.error('✖ 삭제 실패:', (await del.text()).slice(0, 200)); process.exit(1) }
console.log(`✔ 로그인 계정 삭제 완료: ${email}`)
console.log('  이제 이 이메일로 다시 회원가입할 수 있습니다.')
