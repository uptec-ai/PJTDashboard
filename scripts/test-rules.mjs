/**
 * 보안 규칙 검증 스크립트 (에뮬레이터 전용)
 * 실제 앱과 동일한 웹 SDK 경로로 Firestore 규칙이 의도대로 작동하는지 확인한다.
 *
 * 사용법: node scripts/test-rules.mjs  (에뮬레이터 실행 중이어야 함)
 */
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

const app = initializeApp({ apiKey: 'demo-api-key', projectId: 'demo-gcs-dashboard' })
const auth = getAuth(app)
const db = getFirestore(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)

let pass = 0
let fail = 0
const created = [] // 테스트 후 정리할 프로젝트 문서 id

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

const projectData = (ownerUid, extra = {}) => ({
  name: '규칙테스트',
  client: '',
  description: '',
  status: 'active',
  priority: 'mid',
  dueDate: '',
  isPublic: false,
  goals: [],
  progress: 0,
  progressManual: true,
  ownerUid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
})

console.log('— 게스트(익명) 규칙 —')
const anon = await signInAnonymously(auth)
await expectAllowed('게스트 프로필(role: guest) 생성', () =>
  setDoc(doc(db, 'users', anon.user.uid), {
    role: 'guest', name: '게스트', email: '', phone: '', disabled: false, createdAt: serverTimestamp(),
  }),
)
await expectDenied('게스트의 프로젝트 생성', () =>
  addDoc(collection(db, 'projects'), projectData(anon.user.uid)),
)
await expectDenied('게스트의 전체 프로젝트 목록 조회', () =>
  getDocs(collection(db, 'projects')),
)
await expectAllowed('게스트의 공개 프로젝트만 조회', () =>
  getDocs(query(collection(db, 'projects'), where('isPublic', '==', true))),
)
await expectDenied('게스트의 셀프 등급 승격(guest→master)', () =>
  updateDoc(doc(db, 'users', anon.user.uid), { role: 'master' }),
)
await signOut(auth)

console.log('— 일반 회원(personal) 규칙 —')
const email = `rules-test-${Math.random().toString(36).slice(2, 8)}@test.local`
const user = await createUserWithEmailAndPassword(auth, email, 'Test1234!@#$')
await expectAllowed('본인 프로필(role: personal) 생성', () =>
  setDoc(doc(db, 'users', user.user.uid), {
    role: 'personal', name: '테스트', email, phone: '', disabled: false, createdAt: serverTimestamp(),
  }),
)
await expectDenied('타인 명의(ownerUid 불일치) 프로젝트 생성', () =>
  addDoc(collection(db, 'projects'), projectData('someone-else')),
)
await expectAllowed('본인 프로젝트 생성', async () => {
  const ref = await addDoc(collection(db, 'projects'), projectData(user.user.uid))
  created.push(ref.id)
})
await expectDenied('셀프 등급 승격(personal→master)', () =>
  updateDoc(doc(db, 'users', user.user.uid), { role: 'master' }),
)
await signOut(auth)

console.log('— 하위 컬렉션(장비/일정·이슈) 규칙 —')
const taskData = {
  kind: 'issue', title: '규칙테스트 이슈', startDate: '', dueDate: '', status: 'todo',
  priority: 'mid', severity: 'mid', issueStatus: 'open', resolution: '',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
}
const pid = created[0]

// 소유자 A
await signInWithEmailAndPassword(auth, email, 'Test1234!@#$')
await expectAllowed('소유자의 이슈 등록', () =>
  addDoc(collection(db, 'projects', pid, 'tasks'), taskData),
)
await signOut(auth)

// 다른 회원 B
const emailB = `rules-testb-${Math.random().toString(36).slice(2, 8)}@test.local`
const userB = await createUserWithEmailAndPassword(auth, emailB, 'Test1234!@#$')
await setDoc(doc(db, 'users', userB.user.uid), {
  role: 'personal', name: '테스트B', email: emailB, phone: '', disabled: false, createdAt: serverTimestamp(),
})
await expectDenied('타인 프로젝트에 이슈 등록', () =>
  addDoc(collection(db, 'projects', pid, 'tasks'), taskData),
)
await expectAllowed('회원의 타 프로젝트 이슈 열람', () =>
  getDocs(collection(db, 'projects', pid, 'tasks')),
)
await signOut(auth)

// 게스트
const anon2 = await signInAnonymously(auth)
await setDoc(doc(db, 'users', anon2.user.uid), {
  role: 'guest', name: '게스트', email: '', phone: '', disabled: false, createdAt: serverTimestamp(),
})
await expectDenied('게스트의 비공개 프로젝트 이슈 열람', () =>
  getDocs(collection(db, 'projects', pid, 'tasks')),
)
await signOut(auth)

// ===== 테스트 데이터 정리 (에뮬레이터 관리자 권한) =====
const ADMIN = { Authorization: 'Bearer owner' }
for (const id of created) {
  await fetch(`http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)/documents/projects/${id}`, { method: 'DELETE', headers: ADMIN })
}
for (const uid of [anon.user.uid, user.user.uid, userB.user.uid, anon2.user.uid]) {
  await fetch(`http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)/documents/users/${uid}`, { method: 'DELETE', headers: ADMIN })
}
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-gcs-dashboard/accounts:delete', {
  method: 'POST',
  headers: { ...ADMIN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ localIds: [anon.user.uid, user.user.uid, userB.user.uid, anon2.user.uid] }),
}).catch(() => {})

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`)
process.exit(fail > 0 ? 1 : 0)
