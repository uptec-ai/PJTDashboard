import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { resolveLoginEmail } from '../lib/usernames'

export default function ResetPasswordPage() {
  const [id, setId] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    setMsg('')
    setError('')
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, await resolveLoginEmail(id))
      setMsg('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.')
    } catch {
      // 존재하지 않는 이메일이어도 성공처럼 표시 (계정 존재 여부 노출 방지)
      setMsg('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={handleReset}>
        <h2>비밀번호 재설정</h2>
        <div className="sub">가입 시 등록한 이메일로 재설정 링크를 보내드립니다.</div>

        <div className="field">
          <label htmlFor="rp-id">아이디 (또는 이메일)</label>
          <input id="rp-id" value={id} onChange={(e) => setId(e.target.value)} required />
        </div>

        {msg && <div className="msg msg-ok">{msg}</div>}
        {error && <div className="msg msg-error">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>재설정 메일 보내기</button>
        <div className="auth-links">
          <Link to="/login">← 로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  )
}
