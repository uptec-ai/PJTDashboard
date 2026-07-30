import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizePhone, validatePhone } from '../lib/validators'

export default function FindIdPage() {
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFind = async (e: FormEvent) => {
    e.preventDefault()
    setResult('')
    setError('')

    const phoneError = validatePhone(phone)
    if (phoneError) return setError(phoneError)

    setBusy(true)
    try {
      const snap = await getDoc(doc(db, 'emailLookup', normalizePhone(phone)))
      if (snap.exists()) {
        setResult(snap.data().maskedEmail as string)
      } else {
        setError('해당 휴대폰 번호로 가입된 계정이 없습니다.')
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
        <div className="sub">가입 시 등록한 휴대폰 번호로 아이디(이메일)를 찾습니다.</div>

        <div className="field">
          <label htmlFor="fi-phone">휴대폰 번호</label>
          <input
            id="fi-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            required
          />
        </div>

        {result && (
          <div className="msg msg-ok">
            가입된 아이디: <b>{result}</b>
            <br />(보안을 위해 일부만 표시됩니다)
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
