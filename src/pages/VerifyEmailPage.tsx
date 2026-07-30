import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendEmailVerification } from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext'

export default function VerifyEmailPage() {
  const { user, logout } = useAuth()
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  if (!user) {
    navigate('/login')
    return null
  }
  if (user.emailVerified) {
    navigate('/')
    return null
  }

  const resend = async () => {
    setError('')
    setMsg('')
    try {
      await sendEmailVerification(user)
      setMsg('인증 메일을 다시 보냈습니다. 메일함을 확인하세요.')
    } catch {
      setError('메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.')
    }
  }

  const checkVerified = async () => {
    setError('')
    await user.reload()
    if (user.emailVerified) {
      navigate('/')
    } else {
      setError('아직 인증이 완료되지 않았습니다. 메일의 인증 링크를 먼저 클릭하세요.')
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <h2>이메일 인증</h2>
        <p className="sub">
          <b>{user.email}</b> 으로 인증 메일을 보냈습니다.
          <br />메일 안의 링크를 클릭한 뒤 아래 버튼을 눌러주세요.
        </p>
        <p className="hint muted">
          ※ 개발(에뮬레이터) 모드에서는 실제 메일 대신 에뮬레이터 UI
          (http://127.0.0.1:4000/auth)에서 인증 링크를 확인할 수 있습니다.
        </p>

        {msg && <div className="msg msg-ok">{msg}</div>}
        {error && <div className="msg msg-error">{error}</div>}

        <button className="btn btn-primary" onClick={checkVerified}>인증 완료 확인</button>
        <button className="btn btn-ghost" onClick={resend}>인증 메일 다시 보내기</button>
        <button className="btn btn-ghost" onClick={logout}>로그아웃</button>
      </div>
    </div>
  )
}
