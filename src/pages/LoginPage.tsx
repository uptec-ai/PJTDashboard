import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { clearLoginFail, getLock, recordLoginFail, toEmail } from '../lib/validators'

export default function LoginPage() {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [keep, setKeep] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const email = toEmail(id)

    // 5회 실패 잠금 확인
    const lock = getLock(email)
    if (lock.locked) {
      setError(`로그인이 잠겼습니다. 약 ${lock.remainMin}분 후 다시 시도하세요.`)
      return
    }

    setBusy(true)
    try {
      // 로그인 유지: 체크 시 브라우저를 닫아도 유지, 해제 시 탭 닫으면 로그아웃
      await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence)
      await signInWithEmailAndPassword(auth, email, pw)
      clearLoginFail(email)
      navigate('/')
    } catch {
      const r = recordLoginFail(email)
      setError(
        r.locked
          ? '5회 실패로 로그인이 10분간 잠겼습니다.'
          : `아이디 또는 비밀번호가 올바르지 않습니다. (남은 시도 ${r.remain}회)`,
      )
    } finally {
      setBusy(false)
    }
  }

  const handleGuest = async () => {
    setError('')
    setBusy(true)
    try {
      const cred = await signInAnonymously(auth)
      // 게스트 프로필 문서 생성 (최초 1회)
      const ref = doc(db, 'users', cred.user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, {
          role: 'guest',
          name: '게스트',
          email: '',
          phone: '',
          disabled: false,
          createdAt: serverTimestamp(),
        })
      }
      navigate('/')
    } catch {
      setError('게스트 입장에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="logo">📊 <em>Kong</em>Board</div>
        <div className="sub">개인 프로젝트 관리 대시보드</div>

        <div className="field">
          <label htmlFor="login-id">아이디 (이메일)</label>
          <input
            id="login-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="이메일 또는 kingkong"
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-pw">비밀번호</label>
          <input
            id="login-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="row-between">
          <label className="check">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            로그인 유지
          </label>
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <button className="btn btn-primary" disabled={busy}>로그인</button>
        <button type="button" className="btn btn-ghost" onClick={handleGuest} disabled={busy}>
          👀 게스트로 둘러보기
        </button>

        <div className="auth-links">
          <Link to="/signup">회원가입</Link>
          <span className="sep">·</span>
          <Link to="/find-id">ID 찾기</Link>
          <span className="sep">·</span>
          <Link to="/reset-password">PW 재설정</Link>
        </div>
      </form>
    </div>
  )
}
