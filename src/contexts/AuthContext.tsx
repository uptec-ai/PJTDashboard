import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile?.()
      unsubProfile = undefined
      setUser(u)

      if (!u) {
        setProfile(null)
        setLoading(false)
        return
      }

      // users/{uid} 문서(역할·이름 등)를 실시간 구독 — 마스터가 등급을 바꾸면 즉시 반영
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          const p = snap.exists() ? (snap.data() as UserProfile) : null
          setProfile(p)
          setLoading(false)
          // 로그아웃 정책: 마스터만 브라우저를 닫아도 로그인 유지 (개인/게스트는 세션 종료 시 로그아웃)
          if (p?.role === 'master') {
            setPersistence(auth, browserLocalPersistence).catch(() => {})
          }
        },
        () => {
          setProfile(null)
          setLoading(false)
        },
      )
    })

    return () => {
      unsubAuth()
      unsubProfile?.()
    }
  }, [])

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
