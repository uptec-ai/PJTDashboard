import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import {
  maskEmail,
  normalizePhone,
  validatePassword,
  validatePhone,
} from '../lib/validators'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const pwError = validatePassword(pw)
    if (pwError) return setError(pwError)
    if (pw !== pw2) return setError('비밀번호가 서로 일치하지 않습니다.')
    const phoneError = validatePhone(phone)
    if (phoneError) return setError(phoneError)

    const digits = normalizePhone(phone)
    setBusy(true)
    try {
      // 휴대폰 번호 중복 확인 (ID 찾기 데이터 기준)
      const lookupRef = doc(db, 'emailLookup', digits)
      const dup = await getDoc(lookupRef)
      if (dup.exists()) {
        setError('이미 가입에 사용된 휴대폰 번호입니다.')
        setBusy(false)
        return
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw)
      await updateProfile(cred.user, { displayName: name.trim() })

      // 프로필 문서 (기본 등급: 개인)
      await setDoc(doc(db, 'users', cred.user.uid), {
        role: 'personal',
        name: name.trim(),
        email: email.trim(),
        phone: digits,
        disabled: false,
        createdAt: serverTimestamp(),
      })

      // ID 찾기용: 휴대폰 번호 → 마스킹된 이메일 (원본 이메일은 저장하지 않음)
      await setDoc(lookupRef, { maskedEmail: maskEmail(email.trim()) })

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
        <div className="sub">가입 후 이메일 인증을 완료해야 이용할 수 있습니다.</div>

        <div className="field">
          <label htmlFor="su-name">이름</label>
          <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="su-email">이메일 (아이디로 사용)</label>
          <input
            id="su-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="su-phone">휴대폰 번호</label>
          <input
            id="su-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            autoComplete="tel"
            required
          />
          <span className="hint">ID 찾기에 사용됩니다. (SMS 인증은 없음)</span>
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
