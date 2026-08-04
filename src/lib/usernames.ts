import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { ID_DOMAIN } from './validators'

/** 아이디 → 이메일 매핑 (usernames/{아이디}) — 아이디+비밀번호 로그인의 핵심 */

export function normalizeUsername(v: string): string {
  return v.trim().toLowerCase()
}

export function validateUsername(v: string): string | null {
  const s = normalizeUsername(v)
  if (!/^[a-z0-9_-]{3,20}$/.test(s)) {
    return '아이디는 영문 소문자·숫자·하이픈(-)·언더바(_) 조합 3~20자입니다.'
  }
  return null
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', normalizeUsername(username)))
  return snap.exists()
}

export async function reserveUsername(username: string, email: string, uid: string) {
  await setDoc(doc(db, 'usernames', normalizeUsername(username)), { email, uid })
}

export async function releaseUsername(username: string) {
  await deleteDoc(doc(db, 'usernames', normalizeUsername(username))).catch(() => {})
}

/**
 * 로그인 입력값 해석: 이메일이면 그대로, 아이디면 매핑에서 이메일 조회.
 * 매핑이 없으면 레거시(에뮬레이터 kingkong@dashboard.local) 형식으로 시도.
 */
export async function resolveLoginEmail(idOrEmail: string): Promise<string> {
  const v = idOrEmail.trim()
  if (v.includes('@')) return v
  try {
    const snap = await getDoc(doc(db, 'usernames', v.toLowerCase()))
    if (snap.exists()) return snap.data().email as string
  } catch {
    // 조회 실패 시 레거시 형식으로
  }
  return `${v}@${ID_DOMAIN}`
}
