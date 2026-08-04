/**
 * 마스터 계정(kingkong) 시드 스크립트 — 로컬 에뮬레이터 전용
 *
 * 사용법:
 *   npm run seed -- "마스터비밀번호"
 *   (또는 환경변수 SEED_MASTER_PASSWORD 사용)
 *
 * 에뮬레이터(firebase emulators:start)가 켜져 있어야 합니다.
 * 이미 계정이 있으면 비밀번호를 재설정합니다.
 */

const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'
const PROJECT = 'demo-gcs-dashboard'

const EMAIL = 'kingkong@dashboard.local'
const NAME = 'kingkong'

const password = process.argv[2] ?? process.env.SEED_MASTER_PASSWORD

if (!password) {
  console.error('사용법: npm run seed -- "마스터비밀번호"')
  process.exit(1)
}
if (
  password.length < 10 ||
  !/[A-Za-z]/.test(password) ||
  !/\d/.test(password) ||
  !/[^A-Za-z0-9]/.test(password)
) {
  console.error('비밀번호 정책 위반: 영문 + 숫자 + 특수문자 포함 10자 이상이어야 합니다.')
  process.exit(1)
}

// 에뮬레이터 관리자 권한 헤더 (에뮬레이터는 "Bearer owner"를 관리자 토큰으로 인정)
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

async function post(url, body, headers = { 'Content-Type': 'application/json' }) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json }
}

async function main() {
  // 1) 계정 생성 (이미 있으면 uid 조회)
  let uid
  const signUp = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    email: EMAIL,
    password,
    returnSecureToken: true,
  })

  if (signUp.ok) {
    uid = signUp.json.localId
    console.log(`✔ 마스터 계정 생성: ${EMAIL}`)
  } else if (signUp.json?.error?.message === 'EMAIL_EXISTS') {
    const lookup = await post(
      `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
      { email: [EMAIL] },
      ADMIN,
    )
    uid = lookup.json?.users?.[0]?.localId
    if (!uid) throw new Error('기존 계정 조회 실패')
    console.log(`✔ 기존 마스터 계정 발견 (비밀번호 재설정): ${EMAIL}`)
  } else {
    throw new Error(`계정 생성 실패: ${JSON.stringify(signUp.json)}`)
  }

  // 2) 이메일 인증 완료 처리 + 표시 이름 + 비밀번호 확정
  const update = await post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`,
    { localId: uid, emailVerified: true, displayName: NAME, password },
    ADMIN,
  )
  if (!update.ok) throw new Error(`계정 설정 실패: ${JSON.stringify(update.json)}`)
  console.log('✔ 이메일 인증 완료 처리')

  // 3) Firestore 프로필 문서 (role: master)
  const docUrl =
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}` +
    '?updateMask.fieldPaths=role&updateMask.fieldPaths=name&updateMask.fieldPaths=email' +
    '&updateMask.fieldPaths=phone&updateMask.fieldPaths=disabled&updateMask.fieldPaths=createdAt'
  const res = await fetch(docUrl, {
    method: 'PATCH',
    headers: ADMIN,
    body: JSON.stringify({
      fields: {
        role: { stringValue: 'master' },
        name: { stringValue: NAME },
        email: { stringValue: EMAIL },
        phone: { stringValue: '' },
        disabled: { booleanValue: false },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  })
  if (!res.ok) throw new Error(`프로필 문서 생성 실패: ${await res.text()}`)
  console.log('✔ 마스터 프로필(role: master) 저장')

  // 아이디 로그인 매핑 + ID 찾기 매핑
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/usernames/kingkong?updateMask.fieldPaths=email&updateMask.fieldPaths=uid`, {
    method: 'PATCH', headers: ADMIN,
    body: JSON.stringify({ fields: { email: { stringValue: EMAIL }, uid: { stringValue: uid } } }),
  })
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/emailLookup/${encodeURIComponent(EMAIL)}?updateMask.fieldPaths=username`, {
    method: 'PATCH', headers: ADMIN,
    body: JSON.stringify({ fields: { username: { stringValue: NAME } } }),
  })
  console.log('✔ 아이디 매핑(usernames/kingkong) + ID 찾기 매핑 저장')

  console.log('\n완료! 로그인 화면에서 아이디에 "kingkong"만 입력해도 됩니다.')
}

main().catch((err) => {
  console.error('✖ 시드 실패:', err.message)
  console.error('  에뮬레이터가 켜져 있는지 확인하세요: npm run emulators')
  process.exit(1)
})
