/**
 * KongBoard Cloud Functions — 관리자 전용 기능
 *
 * deleteUserAccount: 마스터가 회원을 완전히 삭제한다.
 *   웹(클라이언트 SDK)에서는 다른 사용자의 로그인 계정을 지울 수 없어,
 *   관리자 권한이 필요한 이 작업만 서버에서 처리한다.
 *   - Firestore: 프로필 · 아이디 매핑 · ID찾기 · 내 공간(events/notes)
 *   - Auth: 로그인 계정 자체 (이메일 재사용 가능해짐)
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()
const db = getFirestore()
const auth = getAuth()

export const deleteUserAccount = onCall({ region: 'asia-northeast3' }, async (req) => {
  const callerUid = req.auth?.uid
  if (!callerUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')

  // 호출자가 마스터인지 서버에서 직접 검증
  const callerSnap = await db.doc(`users/${callerUid}`).get()
  if (callerSnap.data()?.role !== 'master') {
    throw new HttpsError('permission-denied', '마스터만 계정을 삭제할 수 있습니다.')
  }

  const targetUid = String(req.data?.uid ?? '')
  if (!targetUid) throw new HttpsError('invalid-argument', '삭제할 계정 uid가 필요합니다.')
  if (targetUid === callerUid) throw new HttpsError('failed-precondition', '자기 계정은 삭제할 수 없습니다.')

  const targetSnap = await db.doc(`users/${targetUid}`).get()
  const target = targetSnap.data() ?? {}

  // 1) 내 공간(개인 일정·Study) — 계정과 함께 정리
  for (const sub of ['events', 'notes']) {
    const docs = await db.collection(`users/${targetUid}/${sub}`).listDocuments()
    await Promise.all(docs.map((d) => d.delete()))
  }

  // 2) 아이디 매핑 · ID찾기 매핑
  if (target.name) await db.doc(`usernames/${String(target.name).toLowerCase()}`).delete().catch(() => {})
  if (target.email) await db.doc(`emailLookup/${String(target.email).toLowerCase()}`).delete().catch(() => {})
  if (target.phone) await db.doc(`emailLookup/${target.phone}`).delete().catch(() => {})

  // 3) 프로필
  await db.doc(`users/${targetUid}`).delete().catch(() => {})

  // 4) 로그인 계정 (이메일 재사용을 위해 필수)
  let authDeleted = true
  try {
    await auth.deleteUser(targetUid)
  } catch (e) {
    authDeleted = false // 이미 없는 경우 등
    console.warn('auth.deleteUser 실패:', e?.message)
  }

  return { ok: true, authDeleted, email: target.email ?? '' }
})
