// 샘플 문서 v1/v2 등록 + Storage 업로드/다운로드 왕복 검증 (웹 SDK, 마스터 계정)
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  addDoc, collection, connectFirestoreEmulator, doc, getFirestore, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes } from 'firebase/storage'
import { diffCounts, diffLines } from '../src/lib/diff.ts'

const app = initializeApp({
  apiKey: 'demo-api-key',
  projectId: 'demo-gcs-dashboard',
  storageBucket: 'demo-gcs-dashboard.appspot.com',
})
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)
connectStorageEmulator(storage, '127.0.0.1', 9199)

const PID = 'test-bms-gateway'
const PW = process.argv[2]
if (!PW) {
  console.error('사용법: node seed-docs.mjs <마스터PW>')
  process.exit(1)
}
await signInWithEmailAndPassword(auth, 'kingkong@dashboard.local', PW)

const V1 = `# BMS 통신 모듈 요구사양서

## 1. 개요
배터리 관리 시스템(BMS)과 상위 PC 간 통신 게이트웨이를 개발한다.

## 2. 통신 사양
- CAN 500kbps, 11bit ID
- Modbus TCP, port 502

## 3. 기능 요구사항
- 셀 전압 모니터링
- 온도 모니터링
`

const V2 = `# BMS 통신 모듈 요구사양서

## 1. 개요
배터리 관리 시스템(BMS)과 상위 PC 간 통신 게이트웨이를 개발한다.
게이트웨이는 24시간 무인 운전을 전제로 한다.

## 2. 통신 사양
- CAN 500kbps, 29bit 확장 ID
- Modbus TCP, port 502
- 통신 두절 시 3회 재시도 후 알람

## 3. 기능 요구사항
- 셀 전압 모니터링
- 온도 모니터링
- SOC/SOH 계산값 전달
`

async function upload(name, version, fileName, text, prevText) {
  let diffAdded = null
  let diffRemoved = null
  if (prevText != null) {
    const c = diffCounts(diffLines(prevText, text))
    diffAdded = c.added
    diffRemoved = c.removed
  }
  const bytes = new TextEncoder().encode(text)
  const metaRef = await addDoc(collection(db, 'projects', PID, 'documents'), {
    name, version, fileName,
    storagePath: '', contentType: 'text/markdown', size: bytes.length,
    source: version === 1 ? 'user' : 'ai',
    textContent: text, diffAdded, diffRemoved,
    createdAt: serverTimestamp(),
  })
  const path = `projects/${PID}/docs/${metaRef.id}/v${version}_${fileName}`
  await uploadBytes(ref(storage, path), bytes, { contentType: 'text/markdown' })
  await updateDoc(doc(db, 'projects', PID, 'documents', metaRef.id), { storagePath: path })
  console.log(`✔ ${name} v${version} 업로드 (${bytes.length}B, diff +${diffAdded ?? '-'} −${diffRemoved ?? '-'})`)
  return path
}

// 멱등: 이미 샘플 문서가 있으면 업로드는 건너뛰고 검증만 수행
const { getDocs, query, where } = await import('firebase/firestore')
const existing = await getDocs(
  query(collection(db, 'projects', PID, 'documents'), where('name', '==', '요구사양서')),
)

let v2path
if (existing.empty) {
  await upload('요구사양서', 1, '요구사양서.md', V1, null)
  v2path = await upload('요구사양서', 2, '요구사양서_AI재작성.md', V2, V1)
} else {
  const docs = existing.docs.map((d) => d.data()).sort((a, b) => b.version - a.version)
  v2path = docs[0].storagePath
  console.log(`ℹ 샘플 문서가 이미 있어 업로드 생략 (최신 v${docs[0].version})`)
}

// ===== 왕복 검증 (Node에서는 getBytes 사용; 브라우저 앱은 getBlob) =====
const bytes2 = await getBytes(ref(storage, v2path))
const back = new TextDecoder().decode(bytes2)
if (back === V2) console.log('✔ Storage 업로드→다운로드 왕복 검증 성공 (내용 일치, 한글 무손상)')
else { console.error('✖ 왕복 검증 실패: 내용 불일치'); process.exit(1) }

process.exit(0)
