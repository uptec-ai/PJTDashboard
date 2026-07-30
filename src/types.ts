export type Role = 'master' | 'personal' | 'guest'

export interface UserProfile {
  role: Role
  name: string
  email: string
  phone: string
  disabled?: boolean
  createdAt?: unknown
}

export const ROLE_LABEL: Record<Role, string> = {
  master: '마스터',
  personal: '개인',
  guest: '게스트',
}
