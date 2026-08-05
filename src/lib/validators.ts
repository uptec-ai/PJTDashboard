/** 로컬 에뮬레이터 마스터 계정용 내부 도메인 (아이디 매핑이 없을 때의 폴백) */
export const ID_DOMAIN = 'dashboard.local'

/** PW 정책: 영문 + 숫자 + 특수문자 포함 10자 이상 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.'
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자를 포함해야 합니다.'
  if (!/\d/.test(pw)) return '비밀번호에 숫자를 포함해야 합니다.'
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해야 합니다.'
  return null
}

/** 로그인 실패 잠금: 5회 실패 시 10분 잠금 (브라우저 저장) */
const LOCK_MAX = 5
const LOCK_MS = 10 * 60 * 1000

interface LockState {
  count: number
  until: number
}

function lockKey(email: string) {
  return `login-lock:${email}`
}

export function getLock(email: string): { locked: boolean; remainMin: number; count: number } {
  const raw = localStorage.getItem(lockKey(email))
  if (!raw) return { locked: false, remainMin: 0, count: 0 }
  const state: LockState = JSON.parse(raw)
  if (state.until > Date.now()) {
    return { locked: true, remainMin: Math.ceil((state.until - Date.now()) / 60000), count: state.count }
  }
  if (state.until > 0) {
    // 잠금 시간이 지났으면 초기화
    localStorage.removeItem(lockKey(email))
    return { locked: false, remainMin: 0, count: 0 }
  }
  return { locked: false, remainMin: 0, count: state.count }
}

export function recordLoginFail(email: string): { locked: boolean; remain: number } {
  const prev = getLock(email)
  const count = prev.count + 1
  if (count >= LOCK_MAX) {
    localStorage.setItem(lockKey(email), JSON.stringify({ count, until: Date.now() + LOCK_MS }))
    return { locked: true, remain: 0 }
  }
  localStorage.setItem(lockKey(email), JSON.stringify({ count, until: 0 }))
  return { locked: false, remain: LOCK_MAX - count }
}

export function clearLoginFail(email: string) {
  localStorage.removeItem(lockKey(email))
}
