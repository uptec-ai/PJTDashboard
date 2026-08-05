import { collection, deleteDoc, doc, getCountFromServer, query, where } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app, db } from './firebase'
import type { UserProfile } from '../types'

/**
 * 회원 완전 삭제 (마스터) — Cloud Functions로 로그인 계정까지 삭제한다.
 * 실패 시(함수 미배포 등) Firestore만 정리하는 폴백을 사용한다.
 */
export async function deleteUserFully(
  uid: string,
  profile: UserProfile,
): Promise<{ authDeleted: boolean }> {
  try {
    const fn = httpsCallable<{ uid: string }, { ok: boolean; authDeleted: boolean }>(
      getFunctions(app, 'asia-northeast3'),
      'deleteUserAccount',
    )
    const res = await fn({ uid })
    return { authDeleted: res.data.authDeleted }
  } catch {
    await deleteUserAccount(uid, profile) // 폴백: Firestore 데이터만 정리
    return { authDeleted: false }
  }
}

/**
 * 마스터의 회원 삭제 — 프로필·아이디 매핑·ID찾기 문서를 정리한다.
 *
 * 두 가지 한계를 의도적으로 남겨둔다:
 *  1) 내 공간(events/notes)은 마스터도 읽을 수 없으므로(개인정보 보호) 정리하지 않는다.
 *     프로필이 사라지면 대시보드 접근 경로가 없어져 사실상 접근 불가 상태가 된다.
 *  2) 로그인 계정(Firebase Auth) 자체 삭제는 관리자 SDK가 필요해 웹에서 불가능하다.
 *     완전 삭제는 Firebase 콘솔 > Authentication 에서 수행한다.
 */
export async function deleteUserAccount(uid: string, profile: UserProfile) {
  // 아이디 매핑
  if (profile.name) {
    await deleteDoc(doc(db, 'usernames', profile.name.toLowerCase())).catch(() => {})
  }

  // ID 찾기 매핑 (이메일 키 — 구버전 휴대폰 키도 정리)
  if (profile.email) {
    await deleteDoc(doc(db, 'emailLookup', profile.email.toLowerCase())).catch(() => {})
  }
  if (profile.phone) {
    await deleteDoc(doc(db, 'emailLookup', profile.phone)).catch(() => {})
  }

  // 프로필 문서
  await deleteDoc(doc(db, 'users', uid))
}

/** 회원이 소유한 프로젝트 수 (삭제 전 경고용) */
export async function countOwnedProjects(uid: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, 'projects'), where('ownerUid', '==', uid)),
  ).catch(() => null)
  return snap?.data().count ?? 0
}
