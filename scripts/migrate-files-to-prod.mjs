/**
 * 로컬 에뮬레이터 Storage → 실서버 버킷 파일 이전
 * 사용법: node scripts/migrate-files-to-prod.mjs   (에뮬레이터 실행 중 + firebase login 상태)
 */
import { readFileSync } from 'node:fs'

const SRC_BUCKET = 'demo-gcs-dashboard.appspot.com'
const DST_BUCKET = 'kongboard-f8d65.firebasestorage.app'
const SRC = 'http://127.0.0.1:9199'

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
const ACCESS = (await tr.json()).access_token
if (!ACCESS) { console.error('✖ 관리자 토큰 발급 실패'); process.exit(1) }

const list = await (await fetch(`${SRC}/storage/v1/b/${SRC_BUCKET}/o`, {
  headers: { Authorization: 'Bearer owner' },
})).json()

let moved = 0
let bytes = 0
for (const o of list.items ?? []) {
  const data = await (await fetch(
    `${SRC}/storage/v1/b/${SRC_BUCKET}/o/${encodeURIComponent(o.name)}?alt=media`,
    { headers: { Authorization: 'Bearer owner' } },
  )).arrayBuffer()

  const up = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${DST_BUCKET}/o?uploadType=media&name=${encodeURIComponent(o.name)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': o.contentType ?? 'application/octet-stream' },
      body: data,
    },
  )
  if (!up.ok) { console.error(`✖ 업로드 실패: ${o.name} (${up.status})`); process.exit(1) }

  // 게스트 공개 메타데이터 보존 (있을 때만)
  if (o.metadata?.public) {
    await fetch(`https://storage.googleapis.com/storage/v1/b/${DST_BUCKET}/o/${encodeURIComponent(o.name)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { public: o.metadata.public } }),
    })
  }
  moved++
  bytes += data.byteLength
  console.log(`✔ ${o.name} (${(data.byteLength / 1024).toFixed(1)}KB)`)
}

// 왕복 검증: 첫 파일 내려받아 크기 비교
if (list.items?.length) {
  const first = list.items[0]
  const back = await (await fetch(
    `https://storage.googleapis.com/storage/v1/b/${DST_BUCKET}/o/${encodeURIComponent(first.name)}?alt=media`,
    { headers: { Authorization: `Bearer ${ACCESS}` } },
  )).arrayBuffer()
  const srcData = await (await fetch(
    `${SRC}/storage/v1/b/${SRC_BUCKET}/o/${encodeURIComponent(first.name)}?alt=media`,
    { headers: { Authorization: 'Bearer owner' } },
  )).arrayBuffer()
  console.log(back.byteLength === srcData.byteLength ? '✔ 왕복 검증 성공 (크기 일치)' : '✖ 왕복 검증 실패')
}

console.log(`\n완료: ${moved}개 파일, 총 ${(bytes / 1024).toFixed(1)}KB 이전`)
