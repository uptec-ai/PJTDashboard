import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function FindIdPage() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFind = async (e: FormEvent) => {
    e.preventDefault()
    setResult('')
    setError('')

    setBusy(true)
    try {
      const snap = await getDoc(doc(db, 'emailLookup', email.trim().toLowerCase()))
      if (snap.exists()) {
        setResult(snap.data().username as string)
      } else {
        setError('해당 이메일로 가입된 계정이 없습니다.')
      }
    } catch {
      setError('조회에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={handleFind}>
        <h2>ID 찾기</h2>
        <div className="sub">가입 시 등록한 이메일로 아이디를 찾습니다.</div>

        <div className="field">
          <label htmlFor="fi-email">이메일</label>
          <input
            id="fi-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        {result && (
          <div className="msg msg-ok">
            가입된 아이디: <b>{result}</b>
          </div>
        )}
        {error && <div className="msg msg-error">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>찾기</button>
        <div className="auth-links">
          <Link to="/login">← 로그인으로 돌아가기</Link>
          <span className="sep">·</span>
          <Link to="/reset-password">PW 재설정</Link>
        </div>
      </form>
    </div>
  )
}
