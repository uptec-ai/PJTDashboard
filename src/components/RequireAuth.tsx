import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

interface Props {
  children: ReactNode
  /** 지정하면 해당 역할만 접근 가능 (예: 회원 관리 = master) */
  roles?: Role[]
  /** true면 게스트(익명) 접근 차단 */
  noGuest?: boolean
}

export default function RequireAuth({ children, roles, noGuest }: Props) {
  const { user, profile, loading, logout } = useAuth()

  if (loading) {
    return <div className="center-page muted">불러오는 중…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 비활성화된 계정 차단
  if (profile?.disabled) {
    return (
      <div className="center-page">
        <div className="auth-card">
          <h2>계정이 비활성화되었습니다</h2>
          <p className="muted">관리자에게 문의하세요.</p>
          <button className="btn btn-ghost" onClick={logout}>로그아웃</button>
        </div>
      </div>
    )
  }

  // 일반 계정은 이메일 인증 필수 (게스트=익명 제외)
  if (!user.isAnonymous && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  // 비회원(가입 완료, 마스터 승인 대기) — 승인 전까지 이용 불가
  if (profile?.role === 'pending') {
    return (
      <div className="center-page">
        <div className="auth-card">
          <h2>승인 대기 중입니다</h2>
          <p className="sub">
            가입과 이메일 인증이 완료되었습니다.
            <br />마스터가 회원 승인을 하면 대시보드를 이용할 수 있습니다.
          </p>
          <button className="btn btn-ghost" onClick={logout}>로그아웃</button>
        </div>
      </div>
    )
  }

  if (noGuest && user.isAnonymous) {
    return <Navigate to="/" replace />
  }

  if (roles && (!profile || !roles.includes(profile.role))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
