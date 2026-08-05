import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { validatePassword } from '../lib/validators'
import {
  isUsernameTaken,
  normalizeUsername,
  reserveUsername,
  validateUsername,
} from '../lib/usernames'

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const idError = validateUsername(username)
    if (idError) return setError(idError)
    const pwError = validatePassword(pw)
    if (pwError) return setError(pwError)
    if (pw !== pw2) return setError('비밀번호가 서로 일치하지 않습니다.')

    const uname = normalizeUsername(username)
    setBusy(true)
    try {
      // 아이디 중복 확인
      if (await isUsernameTaken(uname)) {
        setError('이미 사용 중인 아이디입니다.')
        setBusy(false)
        return
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw)
      await updateProfile(cred.user, { displayName: uname })

      // 아이디 → 이메일 매핑 (아이디 로그인용)
      await reserveUsername(uname, email.trim(), cred.user.uid)

      // 프로필 문서 (가입 직후 = 비회원, 마스터 승인 후 회원으로 전환)
      await setDoc(doc(db, 'users', cred.user.uid), {
        role: 'pending',
        name: uname,
        email: email.trim(),
        disabled: false,
        createdAt: serverTimestamp(),
      })

      // ID 찾기용: 이메일 → 아이디
      await setDoc(doc(db, 'emailLookup', email.trim().toLowerCase()), { username: uname })

      await sendEmailVerification(cred.user)
      navigate('/verify-email')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/email-already-in-use') setError('이미 가입된 이메일입니다.')
      else if (code === 'auth/invalid-email') setError('올바른 이메일 형식이 아닙니다.')
      else setError('회원가입에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={handleSignup}>
        <h2>회원가입</h2>
        <div className="sub">가입 → 이메일 인증 → 회원 승인 대기 → 마스터 승인(비회원) 후 이용할 수 있습니다.</div>

        <div className="field">
          <label htmlFor="su-id">아이디 (로그인에 사용)</label>
          <input
            id="su-id"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="영문 소문자·숫자 3~20자"
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="su-email">이메일</label>
          <input
            id="su-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <span className="hint">가입 인증 메일과 비밀번호 찾기에 사용됩니다.</span>
        </div>
        <div className="field">
          <label htmlFor="su-pw">비밀번호</label>
          <input
            id="su-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          <span className="hint">영문 + 숫자 + 특수문자 포함 10자 이상</span>
        </div>
        <div className="field">
          <label htmlFor="su-pw2">비밀번호 확인</label>
          <input
            id="su-pw2"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>가입하기</button>
        <div className="auth-links">
          <Link to="/login">← 로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  )
}
