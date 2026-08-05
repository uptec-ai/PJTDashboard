/**
 * dbDesign 필드 → 하위 문서(design/db) 이전
 *
 * DB 설계는 회원 전용인데 프로젝트 문서의 필드로 두면 비회원도 읽을 수 있어
 * (Firestore는 필드 단위 권한이 없음) 별도 하위 문서로 분리한다.
 *
 * 사용법: node scripts/migrate-dbdesign.mjs [--prod]
 */
import { readFileSync } from 'node:fs'

const isProd = process.argv.includes('--prod')

let FS
let HDR
if (isProd) {
  FS = 'https://firestore.googleapis.com/v1/projects/kongboard-f8d65/databases/(default)'
  const conf = JSON.parse(readFileSync(process.env.USERPROFILE + '/.config/configstore/firebase-tools.json', 'utf8'))
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conf.tokens.refresh_token,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }),
  })
  HDR = { Authorization: `Bearer ${(await tr.json()).access_token}`, 'Content-Type': 'application/json' }
} else {
  FS = 'http://127.0.0.1:8080/v1/projects/demo-gcs-dashboard/databases/(default)'
  HDR = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
}

console.log(`대상: ${isProd ? '실서버' : '로컬 에뮬레이터'}`)

const list = await (await fetch(`${FS}/documents/projects`, { headers: HDR })).json()
let moved = 0
for (const p of list.documents ?? []) {
  const pid = p.name.split('/').pop()
  const design = p.fields?.dbDesign
  if (!design) continue

  // 1) 하위 문서로 복사 (mapValue의 필드를 그대로 옮긴다)
  const r = await fetch(`${FS}/documents/projects/${pid}/design/db`, {
    method: 'PATCH', headers: HDR,
    body: JSON.stringify({ fields: design.mapValue.fields }),
  })
  if (!r.ok) { console.error(`✖ ${pid} 복사 실패:`, (await r.text()).slice(0, 150)); continue }

  // 2) 원본 필드 제거 (updateMask에 넣고 값을 주지 않으면 삭제됨)
  const d = await fetch(`${FS}/documents/projects/${pid}?updateMask.fieldPaths=dbDesign`, {
    method: 'PATCH', headers: HDR, body: JSON.stringify({ fields: {} }),
  })
  if (!d.ok) { console.error(`✖ ${pid} 필드 제거 실패:`, (await d.text()).slice(0, 150)); continue }

  const tables = design.mapValue.fields?.tables?.arrayValue?.values?.length ?? 0
  console.log(`✔ ${p.fields.name.stringValue}: ${tables}개 테이블 이전`)
  moved++
}
console.log(`\n완료: ${moved}건 이전`)
