/**
 * 보안 규칙 검증 (에뮬레이터 전용)
 * 실제 앱과 동일한 웹 SDK 경로로 Firestore 규칙이 의도대로 작동하는지 확인한다.
 *
 * 사용법: node scripts/test-rules.mjs  (에뮬레이터 실행 중이어야 함)
 *
 * 권한 모델
 *   마스터   : 전체 (유일한 쓰기 주체)
 *   회원     : 회사 카테고리 전체 탭 조회 (개요~업데이트 이력)
 *   비회원   : 회사 카테고리의 개요·일정/이슈·문서만 조회
 *   승인대기 : 이용 불가
 *   게스트   : 공개 프로젝트의 공개 정보만
 */
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
  signInAnonymously, signInWithEmailAndPassword, signOut,
} from 'firebase/auth'
import {
  addDoc, collection, connectFirestoreEmulator, doc, getDoc, getDocs,
  getFirestore, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'

const app = initializeApp({ apiKey: 'demo-api-key', projectId: 'demo-gcs-dashboard' })
const auth = getAuth(app)
const db = getFirestore(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)

const FS = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

let pass = 0
let fail = 0

async function expectAllowed(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  ✔ ${name}`)
  } catch (e) {
    fail++
    console.log(`  ✖ ${name} — 허용돼야 하는데 거부됨 (${e.code ?? e.message})`)
  }
}

async function expectDenied(name, fn) {
  try {
    await fn()
    fail++
    console.log(`  ✖ ${name} — 거부돼야 하는데 허용됨!`)
  } catch (e) {
    if (e.code === 'permission-denied') {
      pass++
      console.log(`  ✔ ${name} (정상 차단)`)
    } else {
      fail++
      console.log(`  ✖ ${name} — 예상 밖 오류 (${e.code ?? e.message})`)
    }
  }
}

// ===== 관리자 권한 도우미 (마스터가 하는 일을 시뮬레이션) =====
const enc = (v) =>
  typeof v === 'string' ? { stringValue: v }
    : typeof v === 'boolean' ? { booleanValue: v }
      : typeof v === 'number' ? { integerValue: String(v) }
        : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
          : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } }

async function adminPut(path, obj) {
  const mask = Object.keys(obj).map((k) => `updateMask.fieldPaths=${k}`).join('&')
  const r = await fetch(`${FS}/documents/${path}?${mask}`, {
    method: 'PATCH', headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) }),
  })
  if (!r.ok) throw new Error(`adminPut ${path}: ${await r.text()}`)
}
async function adminDelete(path) {
  await fetch(`${FS}/documents/${path}`, { method: 'DELETE', headers: ADMIN })
}
async function setRole(uid, role) {
  await adminPut(`users/${uid}`, { role })
}

// ===== 테스트 픽스처 =====
const RUN = Math.random().toString(36).slice(2, 8)
const COMPANY_PID = `t-company-${RUN}`
const PERSONAL_PID = `t-personal-${RUN}`
const PUBLIC_PID = `t-public-${RUN}`
const cleanupPaths = []

const projectFields = (name, category, isPublic) => ({
  name, category, isPublic,
  client: '', description: '', status: 'active', priority: 'mid', dueDate: '',
  goals: [], progress: 0, progressManual: true, ownerUid: 'master-uid',
})

for (const [pid, cat, pub] of [
  [COMPANY_PID, 'company', false],
  [PERSONAL_PID, 'personal', false],
  [PUBLIC_PID, 'company', true],
]) {
  await adminPut(`projects/${pid}`, projectFields(`테스트-${pid}`, cat, pub))
  await adminPut(`projects/${pid}/equipment/e1`, { name: '장비', ip: '10.0.0.1' })
  await adminPut(`projects/${pid}/tasks/t1`, { kind: 'issue', title: '이슈' })
  await adminPut(`projects/${pid}/documents/d1`, { name: '문서', version: 1, isPublic: false })
  await adminPut(`projects/${pid}/documents/d2`, { name: '공개문서', version: 1, isPublic: true })
  await adminPut(`projects/${pid}/design/db`, { dbName: 'DB', tables: [] })
  await adminPut(`projects/${pid}/updates/u1`, { date: '2026-08-05', title: '변경', kind: 'feature' })
  await adminPut(`projects/${pid}/metrics/m1`, { name: '지표', unit: '%', points: [] })
  await adminPut(`projects/${pid}/progressHistory/h1`, { progress: 10 })
  cleanupPaths.push(pid)
}

const users = []
async function makeUser(role) {
  const email = `rules-${role}-${RUN}-${Math.random().toString(36).slice(2, 5)}@test.local`
  const cred = await createUserWithEmailAndPassword(auth, email, 'Test1234!@#$')
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'pending', name: `t${users.length}`, email, disabled: false, createdAt: serverTimestamp(),
  })
  if (role !== 'pending') await setRole(cred.user.uid, role)
  users.push({ uid: cred.user.uid, email })
  await signOut(auth)
  return { uid: cred.user.uid, email }
}
const login = (u) => signInWithEmailAndPassword(auth, u.email, 'Test1234!@#$')

// =====================================================================
console.log('— 가입 흐름 (승인 대기) —')
const pendingUser = await makeUser('pending')
await login(pendingUser)
await expectDenied('승인 대기자의 회사 프로젝트 조회', () =>
  getDoc(doc(db, 'projects', COMPANY_PID)),
)
await expectDenied('승인 대기자의 프로젝트 목록 조회', () =>
  getDocs(query(collection(db, 'projects'), where('category', '==', 'company'))),
)
await signOut(auth)

// 가입 시 자가 등급 위조 차단
const forgeEmail = `rules-forge-${RUN}@test.local`
const forge = await createUserWithEmailAndPassword(auth, forgeEmail, 'Test1234!@#$')
users.push({ uid: forge.user.uid, email: forgeEmail })
await expectDenied('가입 시 회원(personal) 자가 등록', () =>
  setDoc(doc(db, 'users', forge.user.uid), {
    role: 'personal', name: 'forge', email: forgeEmail, disabled: false, createdAt: serverTimestamp(),
  }),
)
await expectAllowed('가입 시 승인 대기(pending) 등록', () =>
  setDoc(doc(db, 'users', forge.user.uid), {
    role: 'pending', name: 'forge', email: forgeEmail, disabled: false, createdAt: serverTimestamp(),
  }),
)
await expectDenied('셀프 등급 승격(pending→master)', () =>
  updateDoc(doc(db, 'users', forge.user.uid), { role: 'master' }),
)
await signOut(auth)

// =====================================================================
console.log('— 비회원 (회사: 개요·일정/이슈·문서만) —')
const nonmember = await makeUser('nonmember')
await login(nonmember)
await expectAllowed('회사 프로젝트 조회', () => getDoc(doc(db, 'projects', COMPANY_PID)))
await expectDenied('개인 카테고리 프로젝트 조회', () => getDoc(doc(db, 'projects', PERSONAL_PID)))
await expectAllowed('일정·이슈 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'tasks')))
await expectAllowed('문서 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'documents')))
await expectAllowed('달성률 추이 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'progressHistory')))
await expectDenied('장비(IP) 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'equipment')))
await expectDenied('DB 설계 조회', () => getDoc(doc(db, 'projects', COMPANY_PID, 'design', 'db')))
await expectDenied('업데이트 이력 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'updates')))
await expectDenied('프로젝트 생성', () =>
  addDoc(collection(db, 'projects'), projectFields('비회원생성', 'company', false)),
)
await expectDenied('프로젝트 수정', () => updateDoc(doc(db, 'projects', COMPANY_PID), { progress: 99 }))
await expectAllowed('요청·코멘트 작성', () =>
  addDoc(collection(db, 'projects', COMPANY_PID, 'comments'), {
    author: '비회원', role: 'nonmember', text: '요청합니다', authorUid: nonmember.uid,
    acked: false, createdAt: serverTimestamp(),
  }),
)
await signOut(auth)

// =====================================================================
console.log('— 회원 (회사: 전체 탭) —')
const member = await makeUser('personal')
await login(member)
await expectAllowed('장비(IP) 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'equipment')))
await expectAllowed('DB 설계 조회', () => getDoc(doc(db, 'projects', COMPANY_PID, 'design', 'db')))
await expectAllowed('업데이트 이력 조회', () => getDocs(collection(db, 'projects', COMPANY_PID, 'updates')))
await expectDenied('개인 카테고리 프로젝트 조회', () => getDoc(doc(db, 'projects', PERSONAL_PID)))
await expectDenied('개인 카테고리 장비 조회', () => getDocs(collection(db, 'projects', PERSONAL_PID, 'equipment')))
await expectDenied('프로젝트 생성', () =>
  addDoc(collection(db, 'projects'), projectFields('회원생성', 'company', false)),
)
await expectDenied('장비 수정(쓰기)', () =>
  addDoc(collection(db, 'projects', COMPANY_PID, 'equipment'), { name: 'x' }),
)
await signOut(auth)

// =====================================================================
console.log('— 게스트 (공개 프로젝트의 공개 정보만) —')
const anon = await signInAnonymously(auth)
await setDoc(doc(db, 'users', anon.user.uid), {
  role: 'guest', name: '게스트', email: '', disabled: false, createdAt: serverTimestamp(),
})
await expectAllowed('공개 프로젝트만 목록 조회', () =>
  getDocs(query(collection(db, 'projects'), where('isPublic', '==', true))),
)
await expectDenied('비공개 회사 프로젝트 조회', () => getDoc(doc(db, 'projects', COMPANY_PID)))
await expectAllowed('공개 프로젝트 지표 조회', () =>
  getDocs(collection(db, 'projects', PUBLIC_PID, 'metrics')),
)
await expectAllowed('공개 프로젝트 업데이트 이력 조회', () =>
  getDocs(collection(db, 'projects', PUBLIC_PID, 'updates')),
)
await expectDenied('공개 프로젝트 장비 조회', () =>
  getDocs(collection(db, 'projects', PUBLIC_PID, 'equipment')),
)
await expectDenied('공개 프로젝트 일정·이슈 조회', () =>
  getDocs(collection(db, 'projects', PUBLIC_PID, 'tasks')),
)
await expectAllowed('공개 문서만 조회', () =>
  getDocs(query(collection(db, 'projects', PUBLIC_PID, 'documents'), where('isPublic', '==', true))),
)
await expectDenied('전체 문서 조회', () => getDocs(collection(db, 'projects', PUBLIC_PID, 'documents')))
await expectAllowed('공개 프로젝트 코멘트 작성', () =>
  addDoc(collection(db, 'projects', PUBLIC_PID, 'comments'), {
    author: '게스트', role: 'guest', text: '문의', authorUid: anon.user.uid,
    acked: false, createdAt: serverTimestamp(),
  }),
)
await expectDenied('셀프 등급 승격(guest→master)', () =>
  updateDoc(doc(db, 'users', anon.user.uid), { role: 'master' }),
)
await signOut(auth)

// =====================================================================
console.log('— 내 공간 (완전 비공개) —')
await login(member)
await expectAllowed('본인 일정 작성', () =>
  addDoc(collection(db, 'users', member.uid, 'events'), {
    title: '테스트', startDate: '2026-08-05', endDate: '', memo: '', createdAt: serverTimestamp(),
  }),
)
await expectDenied('다른 사용자의 개인 일정 열람', () =>
  getDocs(collection(db, 'users', nonmember.uid, 'events')),
)
await signOut(auth)
const anon2 = await signInAnonymously(auth)
await expectDenied('게스트의 개인 일정 열람', () =>
  getDocs(collection(db, 'users', member.uid, 'events')),
)
await signOut(auth)

// ===== 정리 =====
for (const pid of cleanupPaths) {
  for (const sub of ['equipment', 'tasks', 'documents', 'design', 'updates', 'metrics', 'progressHistory', 'comments']) {
    const l = await (await fetch(`${FS}/documents/projects/${pid}/${sub}`, { headers: ADMIN })).json()
    for (const d of l.documents ?? []) await adminDelete(`projects/${pid}/${sub}/${d.name.split('/').pop()}`)
  }
  await adminDelete(`projects/${pid}`)
}
const allUids = [...users.map((u) => u.uid), anon.user.uid, anon2.user.uid]
for (const uid of allUids) {
  for (const sub of ['events', 'notes']) {
    const l = await (await fetch(`${FS}/documents/users/${uid}/${sub}`, { headers: ADMIN })).json()
    for (const d of l.documents ?? []) await adminDelete(`users/${uid}/${sub}/${d.name.split('/').pop()}`)
  }
  await adminDelete(`users/${uid}`)
}
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-gcs-dashboard/accounts:delete', {
  method: 'POST', headers: ADMIN, body: JSON.stringify({ localIds: allUids }),
}).catch(() => {})

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`)
process.exit(fail > 0 ? 1 : 0)
