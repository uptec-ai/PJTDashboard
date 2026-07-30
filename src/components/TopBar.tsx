import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABEL } from '../types'

export default function TopBar() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  const name = user?.isAnonymous ? '게스트' : (profile?.name ?? user?.displayName ?? '')
  const role = user?.isAnonymous ? 'guest' : profile?.role

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">📊 <em>Kong</em>Board</Link>
      <div className="spacer" />
      <nav className="topnav">
        <Link to="/">📋 프로젝트 관리</Link>
        {!user?.isAnonymous && <Link to="/?new=1">➕ 프로젝트 등록</Link>}
        {!user?.isAnonymous && <Link to="/account">내 정보</Link>}
        {role === 'master' && <Link to="/admin/users">회원 관리</Link>}
      </nav>
      <div className="user-chip">
        <span className="avatar">{name ? name[0] : '?'}</span>
        <span>{name}</span>
        {role && <span className="role-badge">{ROLE_LABEL[role]}</span>}
      </div>
      <button className="btn btn-sm btn-ghost" onClick={handleLogout}>로그아웃</button>
    </header>
  )
}
