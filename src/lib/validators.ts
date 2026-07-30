/** 마스터 편의: "kingkong"처럼 @ 없이 입력하면 내부 이메일 형식으로 변환 */
export const ID_DOMAIN = 'dashboard.local'

export function toEmail(idOrEmail: string): string {
  const v = idOrEmail.trim()
  return v.includes('@') ? v : `${v}@${ID_DOMAIN}`
}

/** PW 정책: 영문 + 숫자 + 특수문자 포함 10자 이상 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.'
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자를 포함해야 합니다.'
  if (!/\d/.test(pw)) return '비밀번호에 숫자를 포함해야 합니다.'
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해야 합니다.'
  return null
}

/** 휴대폰 번호: 숫자만 남긴다 (010-1234-5678 → 01012345678) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function validatePhone(phone: string): string | null {
  const digits = normalizePhone(phone)
  if (!/^01[016789]\d{7,8}$/.test(digits)) return '올바른 휴대폰 번호가 아닙니다. (예: 010-1234-5678)'
  return null
}

/** ID 찾기 결과용 이메일 마스킹: kingkong@dashboard.local → ki******@da******.local */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  const maskPart = (s: string) =>
    s.length <= 2 ? s[0] + '*' : s.slice(0, 2) + '*'.repeat(Math.max(s.length - 2, 1))
  const domainParts = domain.split('.')
  const maskedDomain = [maskPart(domainParts[0]), ...domainParts.slice(1)].join('.')
  return `${maskPart(local)}@${maskedDomain}`
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
